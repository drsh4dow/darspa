import { ConvexError, v } from "convex/values";
import { Clock, Effect } from "effect";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, internalQuery, query } from "../_generated/server";
import { requireCustomer } from "../lib/access";
import { voucherDetails } from "./model";
import { isExpired } from "./validity";
import { requireVoucherAccess } from "./access";

export function details(voucher: Doc<"vouchers">, now: number) {
  return {
    id: voucher._id,
    source: voucher.source,
    purchaseId: voucher.source === "webpay" ? voucher.purchaseId : null,
    code: voucher.code,
    terms: voucher.terms,
    issuedAt: voucher.issuedAt,
    expiresAt: voucher.expiresAt,
    redeemed: voucher.redeemed,
    expired: isExpired(voucher.expiresAt, now),
    pdfId: voucher.pdfId ?? null,
  };
}

export const forPurchase = query({
  args: { purchaseId: v.id("purchases") },
  returns: v.array(voucherDetails),
  handler: (ctx, { purchaseId }) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const customer = yield* requireCustomer(ctx);
        const purchase = yield* Effect.promise(() => ctx.db.get(purchaseId));

        if (purchase === null || purchase.userId !== customer.id) {
          return yield* Effect.fail(new ConvexError("No puedes consultar estos vouchers."));
        }

        const vouchers = yield* Effect.promise(() =>
          ctx.db
            .query("vouchers")
            .withIndex("by_purchase", (q) => q.eq("purchaseId", purchaseId))
            .take(20),
        );

        const now = yield* Clock.currentTimeMillis;

        return vouchers.map((voucher) => details(voucher, now));
      }),
    ),
});

export const accessible = query({
  args: { voucherId: v.id("vouchers") },
  returns: voucherDetails,
  handler: (ctx, { voucherId }) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { voucher } = yield* requireVoucherAccess(
          ctx,
          voucherId,
          "No puedes consultar este voucher.",
        );

        return details(voucher, yield* Clock.currentTimeMillis);
      }),
    ),
});

export const read = internalQuery({
  args: { voucherId: v.id("vouchers") },
  returns: voucherDetails,
  handler: (ctx, { voucherId }) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const voucher = yield* Effect.promise(() => ctx.db.get(voucherId));

        if (voucher === null) return yield* Effect.die(new Error("Voucher missing"));

        return details(voucher, yield* Clock.currentTimeMillis);
      }),
    ),
});

export const savePdf = internalMutation({
  args: { voucherId: v.id("vouchers"), pdfId: v.id("_storage") },
  returns: v.id("_storage"),
  handler: (ctx, args) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const voucher = yield* Effect.promise(() => ctx.db.get(args.voucherId));

        if (voucher === null) return yield* Effect.die(new Error("Voucher missing"));

        if (voucher.pdfId !== undefined) {
          yield* Effect.promise(() => ctx.storage.delete(args.pdfId));

          return voucher.pdfId;
        }

        yield* Effect.promise(() => ctx.db.patch(args.voucherId, { pdfId: args.pdfId }));

        return args.pdfId;
      }),
    ),
});
