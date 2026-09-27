"use node";

import { v } from "convex/values";
import { Effect, Schema } from "effect";
import { emailOutcome, examOrder } from "../../shared/examOrder";
import { internal } from "../_generated/api";
import { internalAction, type ActionCtx } from "../_generated/server";
import { convexHttpRuntime } from "../lib/runtime";
import { ExamLimits, ExamRateLimited } from "./model";
import { generateExamOrder } from "./workflow";

const requestLimits = (ctx: ActionCtx): ExamLimits["Service"] =>
  ExamLimits.of({
    consume: Effect.fnUntraced(function* (operation) {
      const result = yield* Effect.promise(() =>
        ctx.runMutation(internal.examOrders.limits.consume, { operation }),
      );

      if (!result.ok) return yield* new ExamRateLimited({ retryAfter: result.retryAfter });

      return yield* Effect.void;
    }),
  });

// Full-resolution artwork decoding and attachment encoding exceed the HTTP
// isolate's 64 MB heap. Node owns both; no patient data or PDFs are persisted.
export const generate = internalAction({
  args: { patient: v.string() },
  returns: v.union(
    v.object({
      kind: v.literal("document"),
      pdf: v.bytes(),
      email: v.union(...emailOutcome.literals.map((outcome) => v.literal(outcome))),
    }),
    v.object({
      kind: v.literal("invalid"),
      field: v.union(v.literal("fullName"), v.literal("address")),
      message: v.string(),
    }),
    v.object({ kind: v.literal("limited"), retryAfter: v.number() }),
    v.object({ kind: v.literal("unavailable") }),
  ),
  handler: (ctx, args) =>
    convexHttpRuntime.runPromise(
      Schema.decodeEffect(Schema.fromJsonString(examOrder))(args.patient).pipe(
        Effect.flatMap(generateExamOrder),
        Effect.provideService(ExamLimits, requestLimits(ctx)),
        Effect.map(({ pdf, email }) => ({
          kind: "document" as const,
          pdf: new Uint8Array(pdf).buffer,
          email,
        })),
        Effect.catchTags({
          ExamTextTooLong: (error) =>
            Effect.succeed({
              kind: "invalid" as const,
              field: error.field,
              message: error.message,
            }),
          ExamRateLimited: (error) =>
            Effect.succeed({ kind: "limited" as const, retryAfter: error.retryAfter }),
        }),
        // Never throw patient-bearing validation or library errors into host logs.
        Effect.catchCause(() => Effect.succeed({ kind: "unavailable" as const })),
      ),
    ),
});
