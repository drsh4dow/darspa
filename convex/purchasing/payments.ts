"use node";

import { v } from "convex/values";
import { Crypto, Effect, Layer } from "effect";
import { NodeCrypto } from "@effect/platform-node";
import { FetchHttpClient } from "effect/unstable/http";
import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { cartItem } from "./model";
import { runConvex } from "../lib/runtime";
import { processPayment } from "./processor";
import { Webpay } from "./webpay";

export const start = action({
  args: { items: v.array(cartItem), requestId: v.string() },
  returns: v.id("purchases"),
  handler: (ctx, args): Promise<Id<"purchases">> =>
    runConvex(
      Effect.gen(function* () {
        const crypto = yield* Crypto.Crypto;
        const buyOrder = (yield* crypto.randomUUIDv4).replaceAll("-", "").slice(0, 26);
        const sessionId = yield* crypto.randomUUIDv4;

        return yield* Effect.promise(() =>
          ctx.runMutation(internal.purchasing.purchases.create, { ...args, buyOrder, sessionId }),
        );
      }).pipe(
        // Cryptographic entropy belongs to actions, never deterministic mutations.
        // oxlint-disable-next-line effecttsgo/strict-effect-provide
        Effect.provide(NodeCrypto.layer),
      ),
    ),
});

export const process = internalAction({
  args: { transactionId: v.id("paymentTransactions") },
  returns: v.null(),
  handler: (ctx, { transactionId }): Promise<null> =>
    runConvex(
      processPayment(ctx, transactionId).pipe(
        Effect.as(null),
        // Each scheduled action owns its transport and configuration lifetime.
        // oxlint-disable-next-line effecttsgo/strict-effect-provide
        Effect.provide(
          Layer.merge(Webpay.layer.pipe(Layer.provide(FetchHttpClient.layer)), NodeCrypto.layer),
        ),
      ),
    ),
});
