import { Context, Schema } from "effect";
import { HttpApiMiddleware } from "effect/unstable/httpapi";

export const id = Schema.NonEmptyString.check(Schema.isMaxLength(128));

export const requestId = Schema.String.check(Schema.isUUID(4));

export const paymentStatus = Schema.Literals([
  "creating",
  "pending",
  "unknown",
  "paid",
  "declined",
  "aborted",
  "timed_out",
  "error",
]);

export type PaymentStatus = typeof paymentStatus.Type;

export const environment = Schema.Literals(["integration", "production"]);

export const providerResult = Schema.Struct({
  buy_order: Schema.NonEmptyString,
  session_id: Schema.NonEmptyString,
  amount: Schema.Int,
  status: Schema.NonEmptyString,
  response_code: Schema.optionalKey(Schema.Int),
  authorization_code: Schema.optionalKey(Schema.String),
  transaction_date: Schema.optionalKey(Schema.String),
  payment_type_code: Schema.optionalKey(Schema.String),
  card_detail: Schema.optionalKey(Schema.Struct({ card_number: Schema.String })),
});

export type ProviderResult = typeof providerResult.Type;

export const offeringTerms = Schema.Struct({
  offeringId: Schema.String,
  legacyId: Schema.optionalKey(Schema.String),
  name: Schema.String,
  description: Schema.String,
  priceClp: Schema.Int,
});

export const purchaseLine = Schema.Struct({ terms: offeringTerms, quantity: Schema.Int });

export type PurchaseLine = typeof purchaseLine.Type;

export const cartSchema = Schema.Array(
  Schema.Struct({
    offeringId: Schema.NonEmptyString,
    quantity: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 20 })),
    expectedPriceClp: Schema.Int.check(Schema.isGreaterThan(0)),
  }),
).check(Schema.isMinLength(1), Schema.isMaxLength(20));

export const checkout = Schema.Struct({ items: cartSchema, requestId });

export const customer = Schema.Struct({ id, email: Schema.String });

export const viewer = Schema.Struct({
  ...customer.fields,
  role: Schema.Literals(["customer", "administrator"]),
});

export type Viewer = typeof viewer.Type;

export class CurrentUser extends Context.Service<CurrentUser, Viewer>()("darspa/CurrentUser") {}

export class BusinessError extends Schema.TaggedError<BusinessError>()(
  "BusinessError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 400 },
) {}

export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  {
    message: Schema.String,
  },
  { httpApiStatus: 401 },
) {}

export class Forbidden extends Schema.TaggedError<Forbidden>()(
  "Forbidden",
  {
    message: Schema.String,
  },
  { httpApiStatus: 403 },
) {}

export class NotFound extends Schema.TaggedError<NotFound>()(
  "NotFound",
  {
    message: Schema.String,
  },
  { httpApiStatus: 404 },
) {}

export class RateLimited extends Schema.TaggedError<RateLimited>()(
  "RateLimited",
  {
    message: Schema.String,
    retryAfter: Schema.Finite,
  },
  { httpApiStatus: 429 },
) {}

export class Unavailable extends Schema.TaggedError<Unavailable>()(
  "Unavailable",
  {
    message: Schema.String,
  },
  { httpApiStatus: 503 },
) {}

export class Authentication extends HttpApiMiddleware.Service<
  Authentication,
  {
    provides: CurrentUser;
  }
>()("darspa/Authentication", { error: Unauthorized }) {}

export const pageRequest = Schema.Struct({ cursor: Schema.NullOr(Schema.String) });

export const purchaseSummary = Schema.Struct({
  id,
  createdAt: Schema.Finite,
  lines: Schema.Array(purchaseLine),
  totalClp: Schema.Int,
  status: paymentStatus,
});

export const purchase = Schema.Struct({
  ...purchaseSummary.fields,
  requestId: Schema.String,
  environment,
  checkout: Schema.NullOr(Schema.Struct({ token: Schema.String, url: Schema.String })),
  buyOrder: Schema.String,
  result: Schema.NullOr(providerResult),
  problem: Schema.NullOr(Schema.String),
});

export const manualCategory = Schema.Literals(["external_payment", "complimentary"]);

export const manualIssuance = Schema.Struct({
  offeringId: Schema.NonEmptyString,
  category: manualCategory,
  reason: Schema.Trim.check(Schema.isMinLength(1), Schema.isMaxLength(1000)),
  requestId,
});

export const voucher = Schema.Struct({
  id,
  source: Schema.Literals(["webpay", "manual"]),
  purchaseId: Schema.NullOr(id),
  code: Schema.String,
  terms: offeringTerms,
  issuedAt: Schema.Finite,
  expiresAt: Schema.Finite,
  redeemed: Schema.Boolean,
  expired: Schema.Boolean,
});

export type Voucher = typeof voucher.Type;

export const delivery = Schema.Struct({
  recipient: Schema.String,
  status: Schema.Literals(["queued", "accepted", "unconfirmed"]),
});

export const operationalVoucher = Schema.Struct({
  ...voucher.fields,
  revision: Schema.Int,
  category: Schema.NullOr(manualCategory),
  issuanceReason: Schema.NullOr(Schema.String),
  issuedBy: Schema.NullOr(Schema.String),
  customer: Schema.NullOr(customer),
});

export type OperationalVoucher = typeof operationalVoucher.Type;

export const operationalPurchase = Schema.Struct({
  ...purchase.fields,
  customer,
  transactionId: id,
  lastCheckedAt: Schema.NullOr(Schema.Finite),
});

export const voucherEvent = Schema.Struct({
  id,
  kind: Schema.Literals(["redeemed", "reversed"]),
  actor: Schema.String,
  at: Schema.Finite,
  reason: Schema.NullOr(Schema.String),
});

export const voucherScope = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("all") }),
  Schema.Struct({ kind: Schema.Literal("source"), source: Schema.Literals(["webpay", "manual"]) }),
  Schema.Struct({ kind: Schema.Literal("customer"), customerId: id }),
  Schema.Struct({ kind: Schema.Literal("purchase"), purchaseId: id }),
]);

export type VoucherScope = typeof voucherScope.Type;

export const redemptionResult = Schema.Literals([
  "redeemed",
  "reversed",
  "already_redeemed",
  "expired",
  "not_redeemed",
  "stale",
]);

export const redemption = Schema.Struct({
  voucherId: id,
  revision: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

export const reversal = Schema.Struct({
  ...redemption.fields,
  reason: manualIssuance.fields.reason,
});

export function isUnsettled(status: PaymentStatus) {
  return status === "creating" || status === "pending" || status === "unknown";
}
