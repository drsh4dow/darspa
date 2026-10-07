import { Schema } from "effect";
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiMiddleware } from "effect/unstable/httpapi";
import * as Contract from "./contracts";
import { normalizedEmailAddress } from "./email";
import { emailOutcome, examOrder, fieldError } from "./examOrder";

const page = <S extends Schema.Top>(item: S) =>
  Schema.Struct({
    items: Schema.Array(item),
    nextCursor: Schema.NullOr(Schema.String),
  });

export class ExamProblem extends Schema.TaggedError<ExamProblem>()(
  "ExamProblem",
  {
    message: Schema.String,
    fields: Schema.Array(fieldError),
  },
  { httpApiStatus: 400 },
) {}

export class ExamValidation extends HttpApiMiddleware.Service<ExamValidation>()(
  "darspa/ExamValidation",
  { error: ExamProblem },
) {}

const catalogOffering = Schema.Struct({
  id: Schema.String,
  legacyId: Schema.optionalKey(Schema.String),
  name: Schema.String,
  priceClp: Schema.Int,
  available: Schema.Boolean,
  displayOrder: Schema.Finite,
  image: Schema.String,
  imageAlt: Schema.String,
  description: Schema.String,
  html: Schema.String,
});

const errors = {
  error: [
    Contract.BusinessError,
    Contract.Forbidden,
    Contract.NotFound,
    Contract.RateLimited,
    Contract.Unavailable,
  ],
} as const;

const publicApi = HttpApiGroup.make("public").add(
  HttpApiEndpoint.get("catalog", "/catalog", { success: Schema.Array(catalogOffering) }),
  HttpApiEndpoint.post("examOrder", "/exam-orders", {
    payload: examOrder,
    success: Schema.Struct({ pdf: Schema.Uint8ArrayFromBase64, email: emailOutcome }),
    error: [ExamProblem, Contract.RateLimited, Contract.Unavailable],
  }).middleware(ExamValidation),
);

const accountApi = HttpApiGroup.make("account")
  .add(HttpApiEndpoint.get("viewer", "/account", { success: Contract.viewer }))
  .middleware(Contract.Authentication);

const purchasesApi = HttpApiGroup.make("purchases")
  .add(
    HttpApiEndpoint.post("start", "/purchases", {
      ...errors,
      payload: Contract.checkout,
      success: Contract.id,
    }),
    HttpApiEndpoint.post("history", "/purchases/history", {
      ...errors,
      payload: Contract.pageRequest,
      success: page(Contract.purchaseSummary),
    }),
    HttpApiEndpoint.get("get", "/purchases/:purchaseId", {
      ...errors,
      params: { purchaseId: Contract.id },
      success: Contract.purchase,
    }),
    HttpApiEndpoint.post("reconcile", "/purchases/:purchaseId/reconcile", {
      ...errors,
      params: { purchaseId: Contract.id },
      success: Schema.Null,
    }),
    HttpApiEndpoint.get("vouchers", "/purchases/:purchaseId/vouchers", {
      ...errors,
      params: { purchaseId: Contract.id },
      success: Schema.Array(Contract.voucher),
    }),
  )
  .middleware(Contract.Authentication);

const vouchersApi = HttpApiGroup.make("vouchers")
  .add(
    HttpApiEndpoint.get("get", "/vouchers/:voucherId", {
      ...errors,
      params: { voucherId: Contract.id },
      success: Contract.voucher,
    }),
    HttpApiEndpoint.post("document", "/vouchers/:voucherId/document", {
      ...errors,
      params: { voucherId: Contract.id },
      success: Schema.String,
    }),
    HttpApiEndpoint.post("send", "/vouchers/:voucherId/delivery", {
      ...errors,
      params: { voucherId: Contract.id },
      payload: Schema.Struct({ recipient: normalizedEmailAddress, requestId: Contract.requestId }),
      success: Contract.id,
    }),
    HttpApiEndpoint.get("delivery", "/vouchers/:voucherId/delivery", {
      ...errors,
      params: { voucherId: Contract.id },
      success: Schema.NullOr(Contract.delivery),
    }),
  )
  .middleware(Contract.Authentication);

const operationsApi = HttpApiGroup.make("operations")
  .add(
    HttpApiEndpoint.post("customers", "/operations/customers", {
      ...errors,
      payload: Schema.Struct({
        ...Contract.pageRequest.fields,
        email: Schema.String.check(Schema.isMaxLength(254)),
      }),
      success: page(Contract.customer),
    }),
    HttpApiEndpoint.post("purchases", "/operations/purchases", {
      ...errors,
      payload: Schema.Struct({
        ...Contract.pageRequest.fields,
        customerId: Schema.optionalKey(Contract.id),
      }),
      success: page(Contract.operationalPurchase),
    }),
    HttpApiEndpoint.get("purchase", "/operations/purchases/:purchaseId", {
      ...errors,
      params: { purchaseId: Contract.id },
      success: Contract.operationalPurchase,
    }),
    HttpApiEndpoint.get("findPurchase", "/operations/orders/:buyOrder", {
      ...errors,
      params: { buyOrder: Schema.String },
      success: Schema.NullOr(Contract.id),
    }),
    HttpApiEndpoint.post("vouchers", "/operations/vouchers", {
      ...errors,
      payload: Schema.Struct({ ...Contract.pageRequest.fields, scope: Contract.voucherScope }),
      success: page(Contract.operationalVoucher),
    }),
    HttpApiEndpoint.get("voucher", "/operations/codes/:code", {
      ...errors,
      params: { code: Schema.String },
      success: Schema.NullOr(Contract.operationalVoucher),
    }),
    HttpApiEndpoint.post("history", "/operations/vouchers/:voucherId/history", {
      ...errors,
      params: { voucherId: Contract.id },
      payload: Contract.pageRequest,
      success: page(Contract.voucherEvent),
    }),
    HttpApiEndpoint.post("issue", "/operations/issuance", {
      ...errors,
      payload: Contract.manualIssuance,
      success: Contract.id,
    }),
    HttpApiEndpoint.post("redeem", "/operations/redemption", {
      ...errors,
      payload: Contract.redemption,
      success: Contract.redemptionResult,
    }),
    HttpApiEndpoint.post("reverse", "/operations/reversal", {
      ...errors,
      payload: Contract.reversal,
      success: Contract.redemptionResult,
    }),
  )
  .middleware(Contract.Authentication);

export class Api extends HttpApi.make("darspa")
  .add(publicApi, accountApi, purchasesApi, vouchersApi, operationsApi)
  .prefix("/api") {}
