"use node";

import { ConvexError, v, type Infer } from "convex/values";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { api, internal } from "../_generated/api";
import { action, internalAction, type ActionCtx } from "../_generated/server";
import type { voucherDetails } from "./model";
import { renderVoucher } from "./pdf";
import { runConvex } from "../lib/runtime";

const documentUrl = Effect.fn("documentUrl")(function* (
  ctx: ActionCtx,
  voucher: Infer<typeof voucherDetails>,
) {
  let pdfId = voucher.pdfId;

  if (pdfId === null) {
    const bytes = yield* renderVoucher(voucher);

    const stored = yield* Effect.promise(() =>
      ctx.storage.store(new Blob([Buffer.from(bytes)], { type: "application/pdf" })),
    );

    pdfId = yield* Effect.promise(() =>
      ctx.runMutation(internal.vouchers.vouchers.savePdf, { voucherId: voucher.id, pdfId: stored }),
    );
  }

  const storedId = pdfId;
  const url = yield* Effect.promise(() => ctx.storage.getUrl(storedId));

  if (url === null)
    return yield* Effect.fail(new ConvexError("No pudimos obtener el PDF. Contacta a Dar Spa."));

  return url;
});

export const download = action({
  args: { voucherId: v.id("vouchers") },
  returns: v.string(),
  handler: (ctx, args): Promise<string> =>
    runConvex(
      Effect.gen(function* () {
        const voucher = yield* Effect.promise(() =>
          ctx.runQuery(api.vouchers.vouchers.owned, args),
        );

        return yield* documentUrl(ctx, voucher);
      }).pipe(
        // The action owns document generation and its HTTP transport.
        // oxlint-disable-next-line effecttsgo/strict-effect-provide
        Effect.provide(FetchHttpClient.layer),
      ),
    ),
});

export const forDelivery = internalAction({
  args: { voucherId: v.id("vouchers") },
  returns: v.string(),
  handler: (ctx, args): Promise<string> =>
    runConvex(
      Effect.gen(function* () {
        const voucher = yield* Effect.promise(() =>
          ctx.runQuery(internal.vouchers.vouchers.read, args),
        );

        return yield* documentUrl(ctx, voucher);
      }).pipe(
        // Internal delivery uses the same stable PDF, without inventing another voucher.
        // oxlint-disable-next-line effecttsgo/strict-effect-provide
        Effect.provide(FetchHttpClient.layer),
      ),
    ),
});
