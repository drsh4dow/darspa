import { v } from "convex/values";
import { Clock, DateTime, Effect } from "effect";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import { expirationFrom } from "../vouchers/validity";
import { paymentStatus, providerResult, providerSession, returnKind } from "./model";

export const paymentJob = v.object({
  id: v.id("paymentTransactions"),
  lease: v.number(),
  status: paymentStatus,
  environment: v.union(v.literal("integration"), v.literal("production")),
  buyOrder: v.string(),
  sessionId: v.string(),
  amount: v.number(),
  units: v.number(),
  session: v.union(v.null(), providerSession),
  returnKind: v.union(v.null(), returnKind),
});

export const claim = internalMutation({
  args: { transactionId: v.id("paymentTransactions") },
  returns: v.union(v.null(), paymentJob),
  handler: (ctx, { transactionId }) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const transaction = yield* Effect.promise(() => ctx.db.get(transactionId));
        const now = yield* Clock.currentTimeMillis;

        if (
          transaction === null ||
          transaction.status === "paid" ||
          transaction.status === "error" ||
          transaction.lease > now
        )
          return null;

        const purchase = yield* Effect.promise(() =>
          ctx.db
            .query("purchases")
            .withIndex("by_transaction", (q) => q.eq("transactionId", transactionId))
            .unique(),
        );

        if (purchase === null) return yield* Effect.die(new Error("Transaction missing purchase"));

        // A crashed action relinquishes its lease after one minute; the cron rediscovers it.
        const lease = now + 60_000;
        yield* Effect.promise(() =>
          ctx.db.patch(transactionId, {
            lease,
            nextCheckAt: lease,
            lastCheckedAt: now,
            attempts: transaction.attempts + 1,
          }),
        );
        let units = 0;

        for (const line of purchase.lines) units += line.quantity;

        return {
          id: transactionId,
          lease,
          status: transaction.status,
          environment: transaction.environment,
          buyOrder: transaction.buyOrder,
          sessionId: transaction.sessionId,
          amount: transaction.amount,
          units,
          session: transaction.session ?? null,
          returnKind: transaction.returnKind ?? null,
        };
      }),
    ),
});

export const created = internalMutation({
  args: { transactionId: v.id("paymentTransactions"), lease: v.number(), session: providerSession },
  returns: v.null(),
  handler: (ctx, args) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const transaction = yield* Effect.promise(() => ctx.db.get(args.transactionId));

        if (
          transaction === null ||
          transaction.lease !== args.lease ||
          transaction.session !== undefined
        )
          return null;
        const now = yield* Clock.currentTimeMillis;
        yield* Effect.promise(() =>
          ctx.db.patch(args.transactionId, {
            session: args.session,
            status: "pending",
            lease: 0,
            nextCheckAt: now + 60_000,
            problem: undefined,
          }),
        );

        return null;
      }),
    ),
});

export const uncertain = internalMutation({
  args: { transactionId: v.id("paymentTransactions"), lease: v.number(), problem: v.string() },
  returns: v.null(),
  handler: (ctx, args) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const transaction = yield* Effect.promise(() => ctx.db.get(args.transactionId));

        if (
          transaction === null ||
          transaction.lease !== args.lease ||
          transaction.status === "paid"
        )
          return null;
        const now = yield* Clock.currentTimeMillis;
        const creating = transaction.session === undefined;

        const exhausted = creating
          ? transaction.attempts >= 3
          : now - transaction._creationTime >= 6 * 86_400_000;

        let status = transaction.status;

        if (!creating) status = "unknown";

        if (creating && exhausted) status = "error";

        yield* Effect.promise(() =>
          ctx.db.patch(args.transactionId, {
            status,
            lease: 0,
            problem: args.problem,
            nextCheckAt: exhausted
              ? undefined
              : now + Math.min(3_600_000, 60_000 * 2 ** Math.min(transaction.attempts, 6)),
          }),
        );

        return null;
      }),
    ),
});

export const settle = internalMutation({
  args: {
    transactionId: v.id("paymentTransactions"),
    lease: v.number(),
    result: providerResult,
    codes: v.array(v.string()),
  },
  returns: v.null(),
  handler: (ctx, args) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const transaction = yield* Effect.promise(() => ctx.db.get(args.transactionId));

        if (
          transaction === null ||
          transaction.status === "paid" ||
          transaction.lease !== args.lease
        )
          return null;
        const now = yield* DateTime.now;
        const nowMs = DateTime.toEpochMillis(now);
        const result = args.result;
        const age = nowMs - transaction._creationTime;

        if (
          result.buy_order !== transaction.buyOrder ||
          result.session_id !== transaction.sessionId ||
          result.amount !== transaction.amount
        ) {
          yield* Effect.promise(() =>
            ctx.db.patch(args.transactionId, {
              status: "unknown",
              lease: 0,
              problem: "La respuesta de Webpay no coincide con esta compra. Contacta a Dar Spa.",
              nextCheckAt: age < 6 * 86_400_000 ? nowMs + 3_600_000 : undefined,
            }),
          );

          return null;
        }

        if (result.status === "AUTHORIZED" && result.response_code === 0) {
          const purchase = yield* Effect.promise(() =>
            ctx.db
              .query("purchases")
              .withIndex("by_transaction", (q) => q.eq("transactionId", transaction._id))
              .unique(),
          );

          if (purchase === null)
            return yield* Effect.die(new Error("Transaction missing purchase"));
          let unitCount = 0;

          for (const line of purchase.lines) unitCount += line.quantity;

          if (args.codes.length !== unitCount || new Set(args.codes).size !== unitCount) {
            return yield* Effect.die(
              new Error("Each paid unit requires an independent voucher code"),
            );
          }

          let index = 0;

          for (const line of purchase.lines) {
            for (let unit = 0; unit < line.quantity; unit++) {
              const code = args.codes[index++];

              if (code === undefined || !/^[a-f0-9]{32}$/.test(code)) {
                return yield* Effect.die(new Error("Invalid generated voucher code"));
              }

              const existing = yield* Effect.promise(() =>
                ctx.db
                  .query("vouchers")
                  .withIndex("by_code", (q) => q.eq("code", code))
                  .unique(),
              );

              if (existing !== null) return yield* Effect.die(new Error("Voucher code collision"));
              yield* Effect.promise(() =>
                ctx.db.insert("vouchers", {
                  userId: purchase.userId,
                  purchaseId: purchase._id,
                  code,
                  terms: line.terms,
                  source: "webpay",
                  issuedAt: nowMs,
                  expiresAt: expirationFrom(now),
                  redeemed: false,
                }),
              );
            }
          }

          // This transition and all vouchers commit together; neither provider nor email IO is here.
          yield* Effect.promise(() =>
            ctx.db.patch(transaction._id, {
              status: "paid",
              result,
              lease: 0,
              nextCheckAt: undefined,
              problem: undefined,
            }),
          );

          return null;
        }

        let status: "pending" | "unknown" | "declined" | "aborted" | "timed_out" = "unknown";

        if (result.status === "FAILED") status = "declined";

        if (result.status === "INITIALIZED") status = "pending";

        if (result.status === "INITIALIZED" || result.status === "FAILED") {
          if (transaction.returnKind === "aborted") status = "aborted";

          if (
            transaction.returnKind === "timeout" ||
            (result.status === "INITIALIZED" && age >= 30 * 60_000)
          )
            status = "timed_out";
        }

        // Abort/timeout redirects are only hints. Continue checking for a racing authorization.
        const continueChecking = status === "unknown" ? age < 6 * 86_400_000 : age < 60 * 60_000;
        yield* Effect.promise(() =>
          ctx.db.patch(transaction._id, {
            status,
            result,
            lease: 0,
            problem: undefined,
            nextCheckAt: continueChecking ? nowMs + 60_000 : undefined,
          }),
        );

        return null;
      }),
    ),
});

export const sweep = internalMutation({
  args: {},
  returns: v.null(),
  handler: (ctx): Promise<null> =>
    Effect.runPromise(
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;

        const due = yield* Effect.promise(() =>
          ctx.db
            .query("paymentTransactions")
            .withIndex("by_due", (q) => q.gt("nextCheckAt", 0).lte("nextCheckAt", now))
            .take(20),
        );

        for (const transaction of due) {
          yield* Effect.promise(() =>
            ctx.scheduler.runAfter(0, internal.purchasing.payments.process, {
              transactionId: transaction._id,
            }),
          );
          yield* Effect.promise(() => ctx.db.patch(transaction._id, { nextCheckAt: now + 60_000 }));
        }

        return null;
      }),
    ),
});
