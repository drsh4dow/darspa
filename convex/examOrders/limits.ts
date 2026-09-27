import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { v } from "convex/values";
import { Effect } from "effect";
import { components } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import { runConvex } from "../lib/runtime";

// Global budgets suit this low-traffic anonymous workflow and keep the limiter
// constant-size: no patient details, email addresses, or IP identifiers are stored.
const limiter = new RateLimiter(components.rateLimiter, {
  examGeneration: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 5 },
  examEmail: { kind: "token bucket", rate: 6, period: HOUR, capacity: 2 },
});

export const consume = internalMutation({
  args: { operation: v.union(v.literal("examGeneration"), v.literal("examEmail")) },
  returns: v.object({ ok: v.boolean(), retryAfter: v.number() }),
  handler: (ctx, { operation }) =>
    runConvex(
      Effect.gen(function* () {
        const result = yield* Effect.promise(() => limiter.limit(ctx, operation));

        return { ok: result.ok, retryAfter: result.retryAfter ?? 0 };
      }),
    ),
});
