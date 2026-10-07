import type { Fetcher } from "@cloudflare/workers-types";
import { Context, Effect, Layer, Schema } from "effect";

export class AssetError extends Schema.TaggedError<AssetError>()("AssetError", {
  message: Schema.String,
}) {}

export class DocumentAssets extends Context.Service<
  DocumentAssets,
  {
    read(
      name: "metabolic" | "laboratory" | "laboratory-extended" | "voucher",
    ): Effect.Effect<Uint8Array, AssetError>;
  }
>()("darspa/DocumentAssets") {
  static layer(assets: Fetcher) {
    return Layer.succeed(
      DocumentAssets,
      DocumentAssets.of({
        read: Effect.fnUntraced(
          function* (name) {
            const response = yield* Effect.tryPromise(() =>
              assets.fetch(`https://assets.internal/documents/templates/${name}.pdf`),
            );

            if (!response.ok) return yield* new AssetError({ message: "PDF artwork unavailable" });
            const bytes = yield* Effect.tryPromise(() => response.arrayBuffer());

            return new Uint8Array(bytes);
          },
          Effect.mapError(
            () => new AssetError({ message: "No pudimos obtener la plantilla del documento." }),
          ),
        ),
      }),
    );
  }
}
