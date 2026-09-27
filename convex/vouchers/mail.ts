import { v } from "convex/values";
import { Config, Effect, Schema } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { sendEmail } from "../lib/email";
import { voucherEmail } from "./email";
import { runConvex } from "../lib/runtime";

export const send = internalAction({
  args: { deliveryId: v.id("voucherDeliveries") },
  returns: v.null(),
  handler: (ctx, { deliveryId }): Promise<null> =>
    runConvex(
      Effect.gen(function* () {
        const delivery = yield* Effect.promise(() =>
          ctx.runMutation(internal.vouchers.deliveries.claim, { deliveryId }),
        );

        if (delivery === null) return null;

        const accepted = yield* Effect.gen(function* () {
          const args = { voucherId: delivery.voucherId };

          const voucher = yield* Effect.promise(() =>
            ctx.runQuery(internal.vouchers.vouchers.read, args),
          );

          const url = yield* Effect.tryPromise(() =>
            ctx.runAction(internal.vouchers.documents.forDelivery, args),
          );

          const assetOrigin = yield* Config.schema(Schema.URL, "CONVEX_SITE_URL");
          const pdf = yield* Schema.decodeEffect(Schema.URLFromString)(url);

          return yield* sendEmail({
            to: delivery.recipient,
            idempotencyKey: `voucher/${deliveryId}`,
            ...voucherEmail({
              name: voucher.terms.name,
              code: voucher.code,
              expiresAt: voucher.expiresAt,
              pdf,
              assetOrigin,
            }),
          });
        }).pipe(Effect.match({ onSuccess: (result) => result.id, onFailure: () => null }));

        yield* Effect.promise(() =>
          ctx.runMutation(internal.vouchers.deliveries.finish, {
            deliveryId,
            lease: delivery.lease,
            providerId: accepted,
          }),
        );

        return null;
      }).pipe(
        // A scheduled delivery is an entry point, separate from payment confirmation.
        // oxlint-disable-next-line effecttsgo/strict-effect-provide
        Effect.provide(FetchHttpClient.layer),
      ),
    ),
});
