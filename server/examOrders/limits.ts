import { eq, sql } from "drizzle-orm";
import { Clock, Effect, Layer } from "effect";
import { Database, execute } from "../db/database";
import { budgets } from "../db/schema";
import { ExamLimits, ExamRateLimited } from "./model";

const limits = {
  examGeneration: { capacity: 5, period: 60_000, rate: 10 },
  examEmail: { capacity: 2, period: 3_600_000, rate: 6 },
};

// These two global token buckets contain no patient, email or IP information.
export const ExamLimitsLive = Layer.effect(
  ExamLimits,
  Effect.gen(function* () {
    const db = yield* Database;

    return ExamLimits.of({
      consume: Effect.fn("ExamLimits.consume")(function* (operation) {
        const now = yield* Clock.currentTimeMillis;
        const { capacity, period, rate } = limits[operation];
        const available = sql`min(${capacity}, ${budgets.tokens} + max(0, ${now} - ${budgets.updatedAt}) * ${rate} * 1.0 / ${period})`;

        const rows = yield* execute(() =>
          db
            .insert(budgets)
            .values({ key: operation, tokens: capacity - 1, updatedAt: now })
            .onConflictDoUpdate({
              target: budgets.key,
              set: { tokens: sql`${available} - 1`, updatedAt: now },
              setWhere: sql`${available} >= 1`,
            })
            .returning(),
        );

        if (rows.length > 0) return yield* Effect.void;

        const [bucket] = yield* execute(() =>
          db.select().from(budgets).where(eq(budgets.key, operation)).limit(1),
        );

        if (bucket === undefined) return yield* Effect.die(new Error("Rate limit bucket missing"));
        const replenished = bucket.tokens + (Math.max(0, now - bucket.updatedAt) * rate) / period;

        return yield* new ExamRateLimited({
          retryAfter: Math.max(1, Math.ceil(((1 - replenished) * period) / rate)),
        });
      }),
    });
  }),
);
