import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { DateTime, Effect } from "effect";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { requireAdministrator } from "../lib/access";
import { details } from "../vouchers/vouchers";
import {
  customerSummary,
  operationalVoucher,
  purchaseRecord,
  purchaseSummary,
  voucherEvent,
} from "./model";

const customerDetails = Effect.fnUntraced(function* (ctx: QueryCtx, id: Id<"users">) {
  const customer = yield* Effect.promise(() => ctx.db.get(id));

  if (customer === null) return yield* Effect.die(new Error("Record missing its customer"));

  return { id: customer._id, email: customer.email };
});

const describeVoucher = Effect.fnUntraced(function* (ctx: QueryCtx, voucher: Doc<"vouchers">) {
  const now = DateTime.toEpochMillis(yield* DateTime.now);
  let customer = null;
  let issuedBy = null;

  if (voucher.source === "webpay") customer = yield* customerDetails(ctx, voucher.userId);

  if (voucher.source === "manual" && voucher.issuedBy !== undefined) {
    issuedBy = (yield* customerDetails(ctx, voucher.issuedBy)).email;
  }

  return {
    ...details(voucher, now),
    revision: voucher.revision ?? 0,
    source: voucher.source,
    category: voucher.source === "manual" ? (voucher.category ?? null) : null,
    issuanceReason: voucher.source === "manual" ? (voucher.issuanceReason ?? null) : null,
    issuedBy,
    customer,
  };
});

const describePurchase = Effect.fnUntraced(function* (ctx: QueryCtx, purchase: Doc<"purchases">) {
  const transaction = yield* Effect.promise(() => ctx.db.get(purchase.transactionId));

  if (transaction === null) return yield* Effect.die(new Error("Purchase missing its transaction"));

  return {
    id: purchase._id,
    customer: yield* customerDetails(ctx, purchase.userId),
    createdAt: purchase._creationTime,
    totalClp: purchase.totalClp,
    buyOrder: transaction.buyOrder,
    status: transaction.status,
    lines: purchase.lines,
    transactionId: transaction._id,
    environment: transaction.environment,
    result: transaction.result ?? null,
    problem: transaction.problem ?? null,
    lastCheckedAt: transaction.lastCheckedAt ?? null,
  };
});

export const customers = query({
  args: { email: v.string(), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(customerSummary),
  handler: (ctx, args) =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* requireAdministrator(ctx);
        const prefix = args.email.trim().toLowerCase();

        const result = yield* Effect.promise(() =>
          ctx.db
            .query("users")
            .withIndex("email", (q) => q.gte("email", prefix).lt("email", `${prefix}\uffff`))
            .paginate(args.paginationOpts),
        );

        return {
          ...result,
          page: result.page.map((user) => ({ id: user._id, email: user.email })),
        };
      }),
    ),
});

export const purchases = query({
  args: { customerId: v.optional(v.id("users")), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(purchaseSummary),
  handler: (ctx, args) =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* requireAdministrator(ctx);
        const customerId = args.customerId;

        const records =
          customerId === undefined
            ? ctx.db.query("purchases").withIndex("by_creation_time")
            : ctx.db.query("purchases").withIndex("by_customer", (q) => q.eq("userId", customerId));

        const result = yield* Effect.promise(() =>
          records.order("desc").paginate(args.paginationOpts),
        );

        const page = [];

        for (const purchase of result.page) {
          const record = yield* describePurchase(ctx, purchase);
          page.push({
            id: record.id,
            customer: record.customer,
            createdAt: record.createdAt,
            totalClp: record.totalClp,
            buyOrder: record.buyOrder,
            status: record.status,
          });
        }

        return { ...result, page };
      }),
    ),
});

export const purchase = query({
  args: { purchaseId: v.id("purchases") },
  returns: purchaseRecord,
  handler: (ctx, args) =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* requireAdministrator(ctx);
        const record = yield* Effect.promise(() => ctx.db.get(args.purchaseId));

        if (record === null) return yield* Effect.fail(new ConvexError("Compra no encontrada."));

        return yield* describePurchase(ctx, record);
      }),
    ),
});

export const findPurchase = query({
  args: { buyOrder: v.string() },
  returns: v.union(v.null(), v.id("purchases")),
  handler: (ctx, args) =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* requireAdministrator(ctx);

        const transaction = yield* Effect.promise(() =>
          ctx.db
            .query("paymentTransactions")
            .withIndex("by_order", (q) => q.eq("buyOrder", args.buyOrder.trim()))
            .unique(),
        );

        if (transaction === null) return null;

        const record = yield* Effect.promise(() =>
          ctx.db
            .query("purchases")
            .withIndex("by_transaction", (q) => q.eq("transactionId", transaction._id))
            .unique(),
        );

        return record?._id ?? null;
      }),
    ),
});

export const vouchers = query({
  args: {
    scope: v.union(
      v.object({ kind: v.literal("all") }),
      v.object({
        kind: v.literal("source"),
        source: v.union(v.literal("webpay"), v.literal("manual")),
      }),
      v.object({ kind: v.literal("customer"), customerId: v.id("users") }),
      v.object({ kind: v.literal("purchase"), purchaseId: v.id("purchases") }),
    ),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(operationalVoucher),
  handler: (ctx, args) =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* requireAdministrator(ctx);
        const scope = args.scope;
        let records = ctx.db.query("vouchers").withIndex("by_creation_time");

        switch (scope.kind) {
          case "all":
            break;
          case "source":
            records = ctx.db
              .query("vouchers")
              .withIndex("by_source", (q) => q.eq("source", scope.source));
            break;
          case "customer":
            records = ctx.db
              .query("vouchers")
              .withIndex("by_customer", (q) => q.eq("userId", scope.customerId));
            break;
          case "purchase":
            records = ctx.db
              .query("vouchers")
              .withIndex("by_purchase", (q) => q.eq("purchaseId", scope.purchaseId));
            break;
        }

        const result = yield* Effect.promise(() =>
          records.order("desc").paginate(args.paginationOpts),
        );

        const page = [];

        for (const voucher of result.page) page.push(yield* describeVoucher(ctx, voucher));

        return { ...result, page };
      }),
    ),
});

export const voucher = query({
  args: { code: v.string() },
  returns: v.union(v.null(), operationalVoucher),
  handler: (ctx, args) =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* requireAdministrator(ctx);

        const record = yield* Effect.promise(() =>
          ctx.db
            .query("vouchers")
            .withIndex("by_code", (q) => q.eq("code", args.code.trim()))
            .unique(),
        );

        return record === null ? null : yield* describeVoucher(ctx, record);
      }),
    ),
});

export const history = query({
  args: { voucherId: v.id("vouchers"), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(voucherEvent),
  handler: (ctx, args) =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* requireAdministrator(ctx);

        const result = yield* Effect.promise(() =>
          ctx.db
            .query("voucherEvents")
            .withIndex("by_voucher", (q) => q.eq("voucherId", args.voucherId))
            .order("desc")
            .paginate(args.paginationOpts),
        );

        const page = [];

        for (const event of result.page) {
          page.push({
            id: event._id,
            kind: event.kind,
            at: event.at,
            actor: (yield* customerDetails(ctx, event.actorId)).email,
            reason: event.reason ?? null,
          });
        }

        return { ...result, page };
      }),
    ),
});
