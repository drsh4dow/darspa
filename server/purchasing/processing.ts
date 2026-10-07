import { and, eq, lte, ne, sql, type SQL } from "drizzle-orm";
import { Clock, Context, Crypto, DateTime, Effect, Layer, Schema } from "effect";
import { offeringTerms, type ProviderResult } from "../../shared/contracts";
import { Database, execute } from "../db/database";
import { purchases, vouchers } from "../db/schema";
import { expirationFrom } from "../vouchers/validity";
import { Webpay, WebpayError } from "./webpay";

const encodeTerms = Schema.encodeEffect(Schema.fromJsonString(offeringTerms));

type PaymentJob = typeof purchases.$inferSelect;

const owned = (job: PaymentJob) =>
  and(eq(purchases.id, job.id), eq(purchases.lease, job.lease), ne(purchases.status, "paid"));

export class PaymentProcessing extends Context.Service<PaymentProcessing>()(
  "darspa/PaymentProcessing",
  {
    make: Effect.gen(function* () {
      const db = yield* Database;
      const newId = (yield* Crypto.Crypto).randomUUIDv4.pipe(Effect.orDie);
      const provider = yield* Webpay;

      const uncertain = Effect.fn("PaymentProcessing.uncertain")(function* (
        job: PaymentJob,
        problem: string,
      ) {
        const now = yield* Clock.currentTimeMillis;
        const creating = job.token === null;
        const exhausted = creating ? job.attempts >= 3 : now - job.createdAt >= 6 * 86_400_000;
        let status = job.status;

        if (!creating) status = "unknown";

        if (creating && exhausted) status = "error";
        yield* execute(() =>
          db
            .update(purchases)
            .set({
              status,
              lease: 0,
              problem,
              nextCheckAt: exhausted
                ? null
                : now + Math.min(3_600_000, 60_000 * 2 ** Math.min(job.attempts, 6)),
            })
            .where(owned(job)),
        );
      });

      const settle = Effect.fn("PaymentProcessing.settle")(function* (
        job: PaymentJob,
        result: ProviderResult,
      ) {
        const now = yield* DateTime.now;
        const at = DateTime.toEpochMillis(now);
        const age = at - job.createdAt;

        if (
          result.buy_order !== job.buyOrder ||
          result.session_id !== job.sessionId ||
          result.amount !== job.totalClp
        ) {
          yield* uncertain(
            job,
            "La respuesta de Webpay no coincide con esta compra. Contacta a Dar Spa.",
          );

          return yield* Effect.void;
        }

        if (result.status === "AUTHORIZED" && result.response_code === 0) {
          const writes: SQL[] = [];
          let unit = 0;
          const expiresAt = expirationFrom(now);

          for (const line of job.lines) {
            const terms = yield* encodeTerms(line.terms).pipe(Effect.orDie);

            for (let index = 0; index < line.quantity; index++) {
              const id = yield* newId;
              const code = (yield* newId).replaceAll("-", "");
              // Every insert is conditional on the same claim. D1 executes this batch
              // and the paid transition atomically, including uniqueness failures.
              writes.push(sql`
                INSERT INTO ${vouchers} (id, code, source, userId, purchaseId, unit, terms, issuedAt, expiresAt)
                SELECT ${id}, ${code}, 'webpay', ${job.userId}, ${job.id}, ${unit++}, ${terms}, ${at}, ${expiresAt}
                FROM ${purchases} WHERE ${owned(job)}
              `);
            }
          }

          const [first, ...rest] = writes;

          if (first === undefined)
            return yield* Effect.die(new Error("Paid purchase contains no units"));
          yield* execute(() =>
            db.batch([
              db.run(first),
              ...rest.map((query) => db.run(query)),
              db
                .update(purchases)
                .set({
                  status: "paid",
                  result,
                  lease: 0,
                  nextCheckAt: null,
                  problem: null,
                })
                .where(owned(job)),
            ]),
          );

          return yield* Effect.void;
        }

        let status: "pending" | "unknown" | "declined" | "aborted" | "timed_out" = "unknown";

        if (result.status === "FAILED") status = "declined";

        if (result.status === "INITIALIZED") status = "pending";

        if (result.status === "INITIALIZED" || result.status === "FAILED") {
          if (job.returnKind === "aborted") status = "aborted";

          if (
            job.returnKind === "timeout" ||
            (result.status === "INITIALIZED" && age >= 30 * 60_000)
          )
            status = "timed_out";
        }

        // Browser abort/timeout signals never outrank a subsequent provider authorization.
        const keepChecking = status === "unknown" ? age < 6 * 86_400_000 : age < 3_600_000;
        yield* execute(() =>
          db
            .update(purchases)
            .set({
              status,
              result,
              lease: 0,
              problem: null,
              nextCheckAt: keepChecking ? at + 60_000 : null,
            })
            .where(owned(job)),
        );

        return yield* Effect.void;
      });

      const process = Effect.fn("PaymentProcessing.process")(function* (purchaseId: string) {
        const now = yield* Clock.currentTimeMillis;

        const [job] = yield* execute(() =>
          db
            .update(purchases)
            .set({
              lease: now + 60_000,
              nextCheckAt: now + 60_000,
              lastCheckedAt: now,
              attempts: sql`${purchases.attempts} + 1`,
            })
            .where(
              and(
                eq(purchases.id, purchaseId),
                ne(purchases.status, "paid"),
                ne(purchases.status, "error"),
                lte(purchases.lease, now),
              ),
            )
            .returning(),
        );

        if (job === undefined) return;
        yield* Effect.gen(function* () {
          if (job.environment !== provider.environment) {
            return yield* new WebpayError({
              message: "La configuración de Webpay cambió. Contacta a Dar Spa.",
            });
          }

          if (job.token === null) {
            const session = yield* provider.create({
              buyOrder: job.buyOrder,
              sessionId: job.sessionId,
              amount: job.totalClp,
            });

            yield* execute(() =>
              db
                .update(purchases)
                .set({
                  token: session.token,
                  checkoutUrl: session.url,
                  status: "pending",
                  lease: 0,
                  nextCheckAt: now + 60_000,
                  problem: null,
                })
                .where(owned(job)),
            );

            return yield* Effect.void;
          }

          let result = yield* provider.status(job.token);

          if (job.returnKind === "normal" && result.status === "INITIALIZED")
            result = yield* provider.commit(job.token);

          return yield* settle(job, result);
        }).pipe(Effect.catch((error) => uncertain(job, error.message)));
      });

      const due = Effect.fn("PaymentProcessing.due")(function* () {
        const now = yield* Clock.currentTimeMillis;

        return yield* execute(() =>
          db
            .select({ id: purchases.id })
            .from(purchases)
            .where(lte(purchases.nextCheckAt, now))
            .orderBy(purchases.nextCheckAt)
            .limit(20),
        );
      });

      return { process, due };
    }),
  },
) {
  static readonly layer = Layer.effect(PaymentProcessing, PaymentProcessing.make);
}
