import type { R2Conditional, R2HTTPMetadata, R2Object } from "@cloudflare/workers-types";
import { Clock, Config, Context, Effect, Layer, Schema } from "effect";
import { DocumentAssets } from "../documents/assets";
import type { Viewer, Voucher } from "../../shared/contracts";
import { renderVoucher, VoucherDocumentError } from "./pdf";
import { describeVoucher, Vouchers } from "./vouchers";

export class DocumentBucket extends Context.Service<
  DocumentBucket,
  {
    head(key: string): Promise<Pick<R2Object, "key"> | null>;
    put(
      key: string,
      bytes: Uint8Array,
      options: { onlyIf: R2Conditional; httpMetadata: R2HTTPMetadata },
    ): Promise<Pick<R2Object, "key"> | null>;
  }
>()("darspa/DocumentBucket") {}

export class VoucherDocuments extends Context.Service<VoucherDocuments>()(
  "darspa/VoucherDocuments",
  {
    make: Effect.gen(function* () {
      const bucket = yield* DocumentBucket;
      const assets = yield* DocumentAssets;
      const vouchers = yield* Vouchers;
      const origin = yield* Config.schema(Schema.URL, "SITE_URL");

      const prepare = Effect.fn("VoucherDocuments.prepare")(
        function* (voucher: Voucher) {
          const key = `vouchers/${voucher.code}.pdf`;
          const stored = yield* Effect.tryPromise(() => bucket.head(key));

          if (stored === null) {
            const bytes = yield* renderVoucher(voucher).pipe(
              Effect.provideService(DocumentAssets, assets),
            );

            yield* Effect.tryPromise(() =>
              bucket.put(key, bytes, {
                onlyIf: { etagDoesNotMatch: "*" },
                httpMetadata: {
                  contentType: "application/pdf",
                  contentDisposition: `attachment; filename="voucher-${voucher.code}.pdf"`,
                },
              }),
            );
          }

          return new URL(`/documents/${key}`, origin).href;
        },
        Effect.mapError(
          () =>
            new VoucherDocumentError({
              message: "No pudimos preparar el PDF. Tu voucher sigue disponible.",
            }),
        ),
      );

      const download = Effect.fn("VoucherDocuments.download")(function* (
        voucherId: string,
        customer: Viewer,
      ) {
        return yield* prepare(yield* vouchers.accessible(voucherId, customer));
      });

      const forDelivery = Effect.fn("VoucherDocuments.forDelivery")(function* (voucherId: string) {
        const voucher = yield* vouchers.read(voucherId);

        return yield* prepare(describeVoucher(voucher, yield* Clock.currentTimeMillis));
      });

      return { download, forDelivery };
    }),
  },
) {
  static readonly layer = Layer.effect(VoucherDocuments, VoucherDocuments.make);
}
