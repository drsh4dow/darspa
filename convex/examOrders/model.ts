import { Context, type Effect, Schema } from "effect";
import type { EmailOutcome, ExamOrder } from "../../shared/examOrder";

export class ExamDocumentError extends Schema.TaggedError<ExamDocumentError>()(
  "ExamDocumentError",
  {
    message: Schema.String,
  },
) {}

export class ExamTextTooLong extends Schema.TaggedError<ExamTextTooLong>()("ExamTextTooLong", {
  field: Schema.Literals(["fullName", "address"]),
  message: Schema.String,
}) {}

export class ExamRateLimited extends Schema.TaggedError<ExamRateLimited>()("ExamRateLimited", {
  retryAfter: Schema.Finite,
}) {}

export class ExamLimits extends Context.Service<
  ExamLimits,
  {
    consume: (operation: "examGeneration" | "examEmail") => Effect.Effect<void, ExamRateLimited>;
  }
>()("darspa/examOrders/ExamLimits") {}

export class ExamOrders extends Context.Service<
  ExamOrders,
  {
    generate: (
      patient: ExamOrder,
    ) => Effect.Effect<
      { pdf: Uint8Array; email: EmailOutcome },
      ExamDocumentError | ExamTextTooLong | ExamRateLimited
    >;
  }
>()("darspa/examOrders/ExamOrders") {}
