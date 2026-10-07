import { Context, Effect, Match } from "effect";
import { PaymentProcessing } from "./purchasing/processing";
import { VoucherDeliveries } from "./vouchers/deliveries";

export type Job = { kind: "payment" | "delivery"; id: string };

// The durable schedule is already in D1. This boundary only starts work sooner
// with Workers waitUntil; a dropped invocation is recovered by the cron sweep.
export class BackgroundJobs extends Context.Service<
  BackgroundJobs,
  {
    schedule(job: Job): Effect.Effect<void>;
  }
>()("darspa/BackgroundJobs") {}

export const runJob = Effect.fn("runJob")((job: Job) =>
  Match.value(job.kind).pipe(
    Match.when("payment", () => PaymentProcessing.use((payments) => payments.process(job.id))),
    Match.when("delivery", () => VoucherDeliveries.use((deliveries) => deliveries.process(job.id))),
    Match.exhaustive,
  ),
);

export const recoverJobs = Effect.gen(function* () {
  const payments = yield* PaymentProcessing;
  const deliveries = yield* VoucherDeliveries;
  const jobs: Job[] = [];

  for (const payment of yield* payments.due()) jobs.push({ kind: "payment", id: payment.id });

  for (const delivery of yield* deliveries.due()) jobs.push({ kind: "delivery", id: delivery.id });
  yield* Effect.forEach(
    jobs,
    (job) =>
      runJob(job).pipe(
        Effect.catchCause(() =>
          Effect.logError("Background job failed; its durable lease will expire for recovery."),
        ),
      ),
    { concurrency: 2, discard: true },
  );
});
