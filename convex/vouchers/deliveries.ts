import { ConvexError, v } from "convex/values";
import { Clock, Effect, Schema } from "effect";
import { normalizedEmailAddress } from "../../shared/email";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { runConvex } from "../lib/runtime";
import { internalMutation, mutation, query } from "../_generated/server";
import { requireVoucherAccess } from "./access";
import { checkDevelopmentRecipient } from "../lib/email";

export const request = mutation({
  args: { voucherId: v.id("vouchers"), recipient: v.string(), requestId: v.string() },
  returns: v.id("voucherDeliveries"),
  handler: (ctx, args): Promise<Id<"voucherDeliveries">> =>
    runConvex(
      Effect.gen(function* () {
        const { customer, voucher } = yield* requireVoucherAccess(
          ctx,
          args.voucherId,
          "No puedes enviar este voucher.",
        );

        const recipient = yield* Schema.decodeEffect(normalizedEmailAddress)(args.recipient);
        yield* Schema.decodeEffect(Schema.String.check(Schema.isUUID(4)))(args.requestId);
        yield* checkDevelopmentRecipient(recipient);

        const previous = yield* Effect.promise(() =>
          ctx.db
            .query("voucherDeliveries")
            .withIndex("by_request", (q) =>
              q.eq("userId", customer.id).eq("requestId", args.requestId),
            )
            .unique(),
        );

        if (previous !== null) {
          if (previous.voucherId !== voucher._id || previous.recipient !== recipient) {
            return yield* Effect.fail(new ConvexError("La solicitud corresponde a otro envío."));
          }

          return previous._id;
        }

        const last = yield* Effect.promise(() =>
          ctx.db
            .query("voucherDeliveries")
            .withIndex("by_voucher", (q) => q.eq("voucherId", args.voucherId))
            .order("desc")
            .first(),
        );

        const now = yield* Clock.currentTimeMillis;

        if (last !== null && now - last._creationTime < 60_000) {
          return yield* Effect.fail(
            new ConvexError("Espera un minuto antes de enviar nuevamente este voucher."),
          );
        }

        const deliveryId = yield* Effect.promise(() =>
          ctx.db.insert("voucherDeliveries", {
            userId: customer.id,
            voucherId: voucher._id,
            recipient,
            requestId: args.requestId,
            status: "queued",
            attempts: 0,
            lease: 0,
            nextAttemptAt: now,
          }),
        );

        yield* Effect.promise(() =>
          ctx.scheduler.runAfter(0, internal.vouchers.mail.send, { deliveryId }),
        );

        return deliveryId;
      }),
    ),
});

export const latest = query({
  args: { voucherId: v.id("vouchers") },
  returns: v.union(
    v.null(),
    v.object({
      recipient: v.string(),
      status: v.union(v.literal("queued"), v.literal("accepted"), v.literal("unconfirmed")),
    }),
  ),
  handler: (ctx, { voucherId }) =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* requireVoucherAccess(ctx, voucherId, "No puedes consultar este envío.");

        const delivery = yield* Effect.promise(() =>
          ctx.db
            .query("voucherDeliveries")
            .withIndex("by_voucher", (q) => q.eq("voucherId", voucherId))
            .order("desc")
            .first(),
        );

        return delivery === null
          ? null
          : { recipient: delivery.recipient, status: delivery.status };
      }),
    ),
});

export const claim = internalMutation({
  args: { deliveryId: v.id("voucherDeliveries") },
  returns: v.union(
    v.null(),
    v.object({ voucherId: v.id("vouchers"), recipient: v.string(), lease: v.number() }),
  ),
  handler: (ctx, { deliveryId }) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const delivery = yield* Effect.promise(() => ctx.db.get(deliveryId));
        const now = yield* Clock.currentTimeMillis;

        if (delivery === null || delivery.status !== "queued" || delivery.lease > now) return null;

        // Never retry beyond Resend's 24-hour deduplication window.
        if (delivery.attempts >= 5 || now - delivery._creationTime > 23 * 3_600_000) {
          yield* Effect.promise(() =>
            ctx.db.patch(deliveryId, { status: "unconfirmed", nextAttemptAt: undefined, lease: 0 }),
          );

          return null;
        }

        const lease = now + 120_000;
        yield* Effect.promise(() =>
          ctx.db.patch(deliveryId, {
            lease,
            nextAttemptAt: lease,
            attempts: delivery.attempts + 1,
          }),
        );

        return { voucherId: delivery.voucherId, recipient: delivery.recipient, lease };
      }),
    ),
});

export const finish = internalMutation({
  args: {
    deliveryId: v.id("voucherDeliveries"),
    lease: v.number(),
    providerId: v.union(v.null(), v.string()),
  },
  returns: v.null(),
  handler: (ctx, args) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const delivery = yield* Effect.promise(() => ctx.db.get(args.deliveryId));

        if (delivery === null || delivery.status === "accepted" || delivery.lease !== args.lease)
          return null;
        const now = yield* Clock.currentTimeMillis;

        const providerId = args.providerId;

        if (providerId !== null) {
          yield* Effect.promise(() =>
            ctx.db.patch(delivery._id, {
              status: "accepted",
              providerId,
              lease: 0,
              nextAttemptAt: undefined,
            }),
          );
        } else {
          const exhausted = delivery.attempts >= 5;
          yield* Effect.promise(() =>
            ctx.db.patch(delivery._id, {
              status: exhausted ? "unconfirmed" : "queued",
              lease: 0,
              nextAttemptAt: exhausted ? undefined : now + 60_000 * 2 ** delivery.attempts,
            }),
          );
        }

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
            .query("voucherDeliveries")
            .withIndex("by_due", (q) => q.gt("nextAttemptAt", 0).lte("nextAttemptAt", now))
            .take(20),
        );

        for (const delivery of due) {
          yield* Effect.promise(() =>
            ctx.scheduler.runAfter(0, internal.vouchers.mail.send, { deliveryId: delivery._id }),
          );
          yield* Effect.promise(() => ctx.db.patch(delivery._id, { nextAttemptAt: now + 60_000 }));
        }

        return null;
      }),
    ),
});
