import { and, eq, lte } from "drizzle-orm";
import { Clock, Effect, Layer } from "effect";
import { HttpApiBuilder, HttpApiMiddleware } from "effect/unstable/httpapi";
import { Api, ExamProblem, ExamValidation } from "../shared/api";
import {
  BusinessError,
  CurrentUser,
  RateLimited,
  Unavailable,
  isUnsettled,
} from "../shared/contracts";
import { validationErrors } from "../shared/examOrder";
import { AuthenticationLive } from "./auth";
import { offerings } from "./catalog";
import { Database, execute } from "./db/database";
import { purchases as purchaseTable } from "./db/schema";
import { ExamOrders } from "./examOrders/workflow";
import { BackgroundJobs } from "./jobs";
import { Operations } from "./operations";
import { Purchases } from "./purchasing/purchases";
import { VoucherDeliveries } from "./vouchers/deliveries";
import { VoucherDocuments } from "./vouchers/documents";
import { Vouchers } from "./vouchers/vouchers";

const ExamValidationLive = HttpApiMiddleware.layerSchemaErrorTransform(
  ExamValidation,
  (error) =>
    new ExamProblem({
      message: "Revisa los datos del formulario.",
      fields: validationErrors(error.cause),
    }),
);

const PublicHandlers = HttpApiBuilder.group(
  Api,
  "public",
  Effect.fnUntraced(function* (handlers) {
    const exams = yield* ExamOrders;

    return handlers.handleAll({
      catalog: () => Effect.succeed(offerings),
      examOrder: ({ payload }) =>
        exams.generate(payload).pipe(
          Effect.catchTags({
            ExamTextTooLong: (error) =>
              new ExamProblem({
                message: error.message,
                fields: [{ field: error.field, message: error.message }],
              }),
            ExamRateLimited: (error) =>
              new RateLimited({
                message: "Hay muchas solicitudes. Espera un momento y vuelve a intentarlo.",
                retryAfter: error.retryAfter,
              }),
            ExamDocumentError: (error) => new Unavailable({ message: error.message }),
          }),
        ),
    });
  }),
);

const AccountHandlers = HttpApiBuilder.group(Api, "account", (handlers) =>
  handlers.handleAll({ viewer: () => CurrentUser }),
);

const PurchaseHandlers = HttpApiBuilder.group(
  Api,
  "purchases",
  Effect.fnUntraced(function* (handlers) {
    const purchases = yield* Purchases;
    const vouchers = yield* Vouchers;
    const jobs = yield* BackgroundJobs;
    const db = yield* Database;

    return handlers.handleAll({
      start: Effect.fnUntraced(function* ({ payload }) {
        const id = yield* purchases.create(payload, yield* CurrentUser);
        yield* jobs.schedule({ kind: "payment", id });

        return id;
      }),
      history: Effect.fnUntraced(function* ({ payload }) {
        return yield* purchases.history(payload.cursor, yield* CurrentUser);
      }),
      get: Effect.fnUntraced(function* ({ params }) {
        return yield* purchases.get(params.purchaseId, yield* CurrentUser);
      }),
      vouchers: Effect.fnUntraced(function* ({ params }) {
        return yield* vouchers.forPurchase(params.purchaseId, yield* CurrentUser);
      }),
      reconcile: Effect.fnUntraced(function* ({ params }) {
        const purchase = yield* purchases.get(params.purchaseId, yield* CurrentUser);
        const now = yield* Clock.currentTimeMillis;

        if (isUnsettled(purchase.status)) {
          const [due] = yield* execute(() =>
            db
              .select({ id: purchaseTable.id })
              .from(purchaseTable)
              .where(
                and(
                  eq(purchaseTable.id, purchase.id),
                  lte(purchaseTable.lastCheckedAt, now - 30_000),
                ),
              )
              .limit(1),
          );

          if (due !== undefined) yield* jobs.schedule({ kind: "payment", id: due.id });
        }

        return null;
      }),
    });
  }),
);

const VoucherHandlers = HttpApiBuilder.group(
  Api,
  "vouchers",
  Effect.fnUntraced(function* (handlers) {
    const vouchers = yield* Vouchers;
    const documents = yield* VoucherDocuments;
    const deliveries = yield* VoucherDeliveries;
    const jobs = yield* BackgroundJobs;

    return handlers.handleAll({
      get: Effect.fnUntraced(function* ({ params }) {
        return yield* vouchers.accessible(params.voucherId, yield* CurrentUser);
      }),
      document: Effect.fnUntraced(function* ({ params }) {
        return yield* documents
          .download(params.voucherId, yield* CurrentUser)
          .pipe(
            Effect.catchTag(
              "VoucherDocumentError",
              (error) => new Unavailable({ message: error.message }),
            ),
          );
      }),
      delivery: Effect.fnUntraced(function* ({ params }) {
        return yield* deliveries.latest(params.voucherId, yield* CurrentUser);
      }),
      send: Effect.fnUntraced(function* ({ params, payload }) {
        const id = yield* deliveries
          .request(params.voucherId, payload.recipient, payload.requestId, yield* CurrentUser)
          .pipe(
            Effect.catchTags({
              EmailError: (error) => new BusinessError({ message: error.message }),
              ConfigError: Effect.die,
            }),
          );

        yield* jobs.schedule({ kind: "delivery", id });

        return id;
      }),
    });
  }),
);

const OperationHandlers = HttpApiBuilder.group(
  Api,
  "operations",
  Effect.fnUntraced(function* (handlers) {
    const operations = yield* Operations;
    const vouchers = yield* Vouchers;

    return handlers.handleAll({
      customers: Effect.fnUntraced(function* ({ payload }) {
        return yield* operations.customers(payload.email, payload.cursor, yield* CurrentUser);
      }),
      purchases: Effect.fnUntraced(function* ({ payload }) {
        return yield* operations.purchases(payload.customerId, payload.cursor, yield* CurrentUser);
      }),
      purchase: Effect.fnUntraced(function* ({ params }) {
        return yield* operations.purchase(params.purchaseId, yield* CurrentUser);
      }),
      findPurchase: Effect.fnUntraced(function* ({ params }) {
        return yield* operations.findPurchase(params.buyOrder, yield* CurrentUser);
      }),
      vouchers: Effect.fnUntraced(function* ({ payload }) {
        return yield* operations.vouchers(payload.scope, payload.cursor, yield* CurrentUser);
      }),
      voucher: Effect.fnUntraced(function* ({ params }) {
        return yield* operations.voucher(params.code, yield* CurrentUser);
      }),
      history: Effect.fnUntraced(function* ({ params, payload }) {
        return yield* operations.history(params.voucherId, payload.cursor, yield* CurrentUser);
      }),
      issue: Effect.fnUntraced(function* ({ payload }) {
        return yield* vouchers.issue(payload, yield* CurrentUser);
      }),
      redeem: Effect.fnUntraced(function* ({ payload }) {
        return yield* vouchers.changeRedemption({ ...payload, kind: "redeem" }, yield* CurrentUser);
      }),
      reverse: Effect.fnUntraced(function* ({ payload }) {
        return yield* vouchers.changeRedemption(
          { ...payload, kind: "reverse" },
          yield* CurrentUser,
        );
      }),
    });
  }),
);

export const ApiHandlers = Layer.mergeAll(
  PublicHandlers,
  AccountHandlers,
  PurchaseHandlers,
  VoucherHandlers,
  OperationHandlers,
).pipe(Layer.provideMerge([AuthenticationLive, ExamValidationLive]));

export const ApiRoutes = HttpApiBuilder.layer(Api).pipe(Layer.provide(ApiHandlers));
