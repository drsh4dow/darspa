import { ConvexError } from "convex/values";
import { Effect } from "effect";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { requireCustomer } from "../lib/access";

/** Delivery belongs to the purchaser or any administrator, never the code's recipient. */
export const requireVoucherAccess = Effect.fnUntraced(function* (
  ctx: QueryCtx,
  voucherId: Id<"vouchers">,
  message: string,
) {
  const customer = yield* requireCustomer(ctx);
  const voucher = yield* Effect.promise(() => ctx.db.get(voucherId));
  const ownsVoucher = voucher?.source === "webpay" && voucher.userId === customer.id;

  if (voucher === null || (!ownsVoucher && customer.role !== "administrator")) {
    return yield* Effect.fail(new ConvexError(message));
  }

  return { voucher, customer };
});
