import { v } from "convex/values";
import { Effect } from "effect";
import { internalMutation, mutation } from "../_generated/server";
import { issueManual, changeRedemption } from "./lifecycle";
import { issuanceArgs } from "./model";

export const issue = internalMutation({
  args: { ...issuanceArgs, code: v.string() },
  returns: v.id("vouchers"),
  handler: (ctx, args) => Effect.runPromise(issueManual(ctx, args)),
});

const outcome = v.union(
  v.literal("redeemed"),
  v.literal("reversed"),
  v.literal("expired"),
  v.literal("already_redeemed"),
  v.literal("not_redeemed"),
  v.literal("stale"),
);

export const redeem = mutation({
  args: { voucherId: v.id("vouchers"), revision: v.number() },
  returns: outcome,
  handler: (ctx, args) => Effect.runPromise(changeRedemption(ctx, { ...args, kind: "redeem" })),
});

export const reverse = mutation({
  args: { voucherId: v.id("vouchers"), revision: v.number(), reason: v.string() },
  returns: outcome,
  handler: (ctx, args) => Effect.runPromise(changeRedemption(ctx, { ...args, kind: "reverse" })),
});
