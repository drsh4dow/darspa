import { Config, Effect, Encoding, Schema } from "effect";
import type { EmailOutcome, ExamOrder } from "../../shared/examOrder";
import { sendEmail } from "../lib/email";
import { examOrderEmail, examOrderFilename } from "./email";
import { ExamLimits } from "./model";
import { renderExamOrder } from "./pdf";

export const generateExamOrder = Effect.fn("generateExamOrder")(function* (patient: ExamOrder) {
  const limits = yield* ExamLimits;
  yield* limits.consume("examGeneration");
  const pdf = yield* renderExamOrder(patient);
  let email: EmailOutcome = "not-requested";

  if (patient.email !== undefined) {
    const recipient = patient.email;

    email = yield* Effect.gen(function* () {
      yield* limits.consume("examEmail");
      const attachment = Encoding.encodeBase64(pdf);

      const digest = yield* Effect.promise(() =>
        crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${recipient}\n${attachment}`)),
      );

      const assetOrigin = yield* Config.schema(Schema.URL, "CONVEX_SITE_URL");

      yield* sendEmail({
        to: recipient,
        ...examOrderEmail(assetOrigin),
        attachments: [
          { filename: examOrderFilename, content: attachment, content_type: "application/pdf" },
        ],
        idempotencyKey: `exam-${Encoding.encodeHex(new Uint8Array(digest))}`,
      });

      return "accepted" as const;
    }).pipe(
      Effect.catchTag("ExamRateLimited", () => Effect.succeed("limited" as const)),
      // No patient payloads or provider errors enter logs. Email never invalidates
      // a completed PDF; ambiguous provider responses are not retried automatically.
      Effect.catchCause(() => Effect.succeed("unconfirmed" as const)),
    );
  }

  return { pdf, email };
});
