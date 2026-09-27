import { paginationOptsValidator } from "convex/server";
import { ConvexError, v, type Infer } from "convex/values";
import { Clock, Effect, Schema } from "effect";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { runConvex } from "../lib/runtime";
import { internalMutation, mutation, query } from "../_generated/server";
import { requireCustomer } from "../lib/access";
import { requirePublishedOffering } from "../catalog";
import {
  cartItem,
  cartSchema,
  isUnsettled,
  paymentStatus,
  providerResult,
  purchaseLine,
} from "./model";
import { webpayEnvironment } from "./webpay";

const checkoutArgs = { items: v.array(cartItem), requestId: v.string() };

export const create = internalMutation({
  args: { ...checkoutArgs, buyOrder: v.string(), sessionId: v.string() },
  returns: v.id("purchases"),
  handler: (ctx, args): Promise<Id<"purchases">> =>
    runConvex(
      Effect.gen(function* () {
        const customer = yield* requireCustomer(ctx);
        yield* Schema.decodeEffect(Schema.String.check(Schema.isUUID(4)))(args.requestId);

        const previous = yield* Effect.promise(() =>
          ctx.db
            .query("purchases")
            .withIndex("by_request", (q) =>
              q.eq("userId", customer.id).eq("requestId", args.requestId),
            )
            .unique(),
        );

        if (previous !== null) return previous._id;

        const items = yield* Schema.decodeEffect(cartSchema)(args.items).pipe(
          Effect.mapError(
            () => new ConvexError("Revisa las cantidades de tu carro (máximo 20 vouchers)."),
          ),
        );

        const now = yield* Clock.currentTimeMillis;

        const recent = yield* Effect.promise(() =>
          ctx.db
            .query("purchases")
            .withIndex("by_customer", (q) => q.eq("userId", customer.id))
            .order("desc")
            .take(5),
        );

        if (
          recent.length === 5 &&
          recent.every((purchase) => purchase._creationTime > now - 60_000)
        ) {
          return yield* Effect.fail(
            new ConvexError("Espera un minuto antes de iniciar otro pago."),
          );
        }

        const seen = new Set<string>();
        const lines: Infer<typeof purchaseLine>[] = [];
        let totalClp = 0;
        let units = 0;

        for (const item of items) {
          if (seen.has(item.offeringId)) {
            return yield* Effect.fail(new ConvexError("El carro contiene un servicio repetido."));
          }

          seen.add(item.offeringId);
          const offering = requirePublishedOffering(item.offeringId);

          if (offering.priceClp !== item.expectedPriceClp) {
            return yield* Effect.fail(
              new ConvexError(
                "Un precio cambió. Actualiza el carro y revisa el total antes de pagar.",
              ),
            );
          }

          lines.push({
            terms: {
              offeringId: offering.id,
              legacyId: offering.legacyId,
              name: offering.name,
              description: offering.description,
              priceClp: offering.priceClp,
            },
            quantity: item.quantity,
          });
          totalClp += offering.priceClp * item.quantity;
          units += item.quantity;
        }

        if (units > 20 || !Number.isSafeInteger(totalClp)) {
          return yield* Effect.fail(new ConvexError("Puedes comprar hasta 20 vouchers por pago."));
        }

        const environment = yield* webpayEnvironment;

        const transactionId = yield* Effect.promise(() =>
          ctx.db.insert("paymentTransactions", {
            userId: customer.id,
            buyOrder: args.buyOrder,
            sessionId: args.sessionId,
            amount: totalClp,
            environment,
            status: "creating",
            attempts: 0,
            lease: 0,
            nextCheckAt: now,
          }),
        );

        const purchaseId = yield* Effect.promise(() =>
          ctx.db.insert("purchases", {
            userId: customer.id,
            requestId: args.requestId,
            lines,
            totalClp,
            transactionId,
          }),
        );

        yield* Effect.promise(() =>
          ctx.scheduler.runAfter(0, internal.purchasing.payments.process, { transactionId }),
        );

        return purchaseId;
      }),
    ),
});

const summary = v.object({
  id: v.id("purchases"),
  createdAt: v.number(),
  lines: v.array(purchaseLine),
  totalClp: v.number(),
  status: paymentStatus,
});

export const history = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({ page: v.array(summary), isDone: v.boolean(), continueCursor: v.string() }),
  handler: (ctx, args) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const customer = yield* requireCustomer(ctx);

        const result = yield* Effect.promise(() =>
          ctx.db
            .query("purchases")
            .withIndex("by_customer", (q) => q.eq("userId", customer.id))
            .order("desc")
            .paginate(args.paginationOpts),
        );

        const page = [];

        for (const purchase of result.page) {
          const transaction = yield* Effect.promise(() => ctx.db.get(purchase.transactionId));

          if (transaction === null)
            return yield* Effect.die(new Error("Purchase missing its payment transaction"));
          page.push({
            id: purchase._id,
            createdAt: purchase._creationTime,
            lines: purchase.lines,
            totalClp: purchase.totalClp,
            status: transaction.status,
          });
        }

        return { page, isDone: result.isDone, continueCursor: result.continueCursor };
      }),
    ),
});

export const get = query({
  args: { purchaseId: v.string() },
  returns: v.object({
    ...summary.fields,
    requestId: v.string(),
    environment: v.union(v.literal("integration"), v.literal("production")),
    checkout: v.union(v.null(), v.object({ token: v.string(), url: v.string() })),
    buyOrder: v.string(),
    result: v.union(v.null(), providerResult),
    problem: v.union(v.null(), v.string()),
  }),
  handler: (ctx, { purchaseId }) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const customer = yield* requireCustomer(ctx);
        const id = ctx.db.normalizeId("purchases", purchaseId);
        const purchase = id === null ? null : yield* Effect.promise(() => ctx.db.get(id));

        if (purchase === null || purchase.userId !== customer.id) {
          return yield* Effect.fail(new ConvexError("No puedes consultar esta compra."));
        }

        const transaction = yield* Effect.promise(() => ctx.db.get(purchase.transactionId));

        if (transaction === null)
          return yield* Effect.die(new Error("Purchase missing its payment transaction"));

        const checkout =
          transaction.status === "pending" && transaction.returnKind === undefined
            ? (transaction.session ?? null)
            : null;

        return {
          id: purchase._id,
          requestId: purchase.requestId,
          createdAt: purchase._creationTime,
          lines: purchase.lines,
          totalClp: purchase.totalClp,
          status: transaction.status,
          environment: transaction.environment,
          checkout,
          buyOrder: transaction.buyOrder,
          result: transaction.result ?? null,
          problem: transaction.problem ?? null,
        };
      }),
    ),
});

export const reconcile = mutation({
  args: { purchaseId: v.id("purchases") },
  returns: v.null(),
  handler: (ctx, { purchaseId }): Promise<null> =>
    Effect.runPromise(
      Effect.gen(function* () {
        const customer = yield* requireCustomer(ctx);
        const purchase = yield* Effect.promise(() => ctx.db.get(purchaseId));

        if (purchase === null || purchase.userId !== customer.id) {
          return yield* Effect.fail(new ConvexError("No puedes consultar esta compra."));
        }

        const transaction = yield* Effect.promise(() => ctx.db.get(purchase.transactionId));
        const now = yield* Clock.currentTimeMillis;

        if (
          transaction !== null &&
          isUnsettled(transaction.status) &&
          now - (transaction.lastCheckedAt ?? 0) >= 30_000
        ) {
          yield* Effect.promise(() =>
            ctx.scheduler.runAfter(0, internal.purchasing.payments.process, {
              transactionId: transaction._id,
            }),
          );
        }

        return null;
      }),
    ),
});
