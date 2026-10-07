import { Config, Context, Crypto, Effect, Encoding, Layer, Schema } from "effect";
import { HttpClient } from "effect/unstable/http";
import type { EmailOutcome, ExamOrder } from "../../shared/examOrder";
import { DocumentAssets } from "../documents/assets";
import { sendEmail } from "../lib/email";
import { examOrderEmail, examOrderFilename } from "./email";
import { ExamLimits } from "./model";
import { renderExamOrder } from "./pdf";

export class ExamOrders extends Context.Service<ExamOrders>()("darspa/ExamOrders", {
  make: Effect.gen(function* () {
    const limits = yield* ExamLimits;
    const assets = yield* DocumentAssets;
    const http = yield* HttpClient.HttpClient;
    const crypto = yield* Crypto.Crypto;
    const assetOrigin = yield* Config.schema(Schema.URL, "SITE_URL");

    const generate = Effect.fn("ExamOrders.generate")(function* (patient: ExamOrder) {
      yield* limits.consume("examGeneration");

      const pdf = yield* renderExamOrder(patient).pipe(
        Effect.provideService(DocumentAssets, assets),
      );

      let email: EmailOutcome = "not-requested";

      if (patient.email !== undefined) {
        const recipient = patient.email;
        email = yield* Effect.gen(function* () {
          yield* limits.consume("examEmail");
          const attachment = Encoding.encodeBase64(pdf);

          const digest = yield* crypto.digest(
            "SHA-256",
            new TextEncoder().encode(`${recipient}\n${attachment}`),
          );

          yield* sendEmail({
            to: recipient,
            ...examOrderEmail(assetOrigin),
            attachments: [
              { filename: examOrderFilename, content: attachment, content_type: "application/pdf" },
            ],
            idempotencyKey: `exam-${Encoding.encodeHex(digest)}`,
          }).pipe(Effect.provideService(HttpClient.HttpClient, http));

          return "accepted" as const;
        }).pipe(
          Effect.catchTag("ExamRateLimited", () => Effect.succeed("limited" as const)),
          // Email never invalidates a completed PDF; ambiguous responses are not retried.
          // Patient payloads and provider errors must not enter logs.
          Effect.catchCause(() => Effect.succeed("unconfirmed" as const)),
        );
      }

      return { pdf, email };
    });

    return { generate };
  }),
}) {
  static readonly layer = Layer.effect(ExamOrders, ExamOrders.make);
}
