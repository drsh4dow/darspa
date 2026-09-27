import { Crypto, Effect } from "effect";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { Webpay } from "./webpay";

/** The same program drives scheduled actions and deterministic provider-boundary tests.
 * Convex owns claims and settlement; Webpay owns external calls, never a DB transaction.
 */
export const processPayment = Effect.fn("processPayment")(function* (
  ctx: Pick<ActionCtx, "runMutation">,
  transactionId: Id<"paymentTransactions">,
): Effect.fn.Return<void, never, Webpay | Crypto.Crypto> {
  const job = yield* Effect.promise(() =>
    ctx.runMutation(internal.purchasing.transactions.claim, { transactionId }),
  );

  if (job === null) return;
  const provider = yield* Webpay;

  const work = Effect.gen(function* () {
    if (job.environment !== provider.environment) {
      return yield* Effect.fail({
        message: "La configuración de Webpay cambió. Contacta a Dar Spa.",
      });
    }

    if (job.session === null) {
      const session = yield* provider.create(job);
      yield* Effect.promise(() =>
        ctx.runMutation(internal.purchasing.transactions.created, {
          transactionId,
          lease: job.lease,
          session,
        }),
      );

      return yield* Effect.void;
    }

    // Commit only a normal provider return. If its response is lost, the next run
    // consults status first, recovering authorization without a second issuance.
    let result = yield* provider.status(job.session.token);

    if (job.returnKind === "normal" && result.status === "INITIALIZED") {
      result = yield* provider.commit(job.session.token);
    }

    const codes: string[] = [];

    if (result.status === "AUTHORIZED" && result.response_code === 0) {
      const crypto = yield* Crypto.Crypto;

      for (let unit = 0; unit < job.units; unit++) {
        const code = yield* crypto.randomUUIDv4.pipe(Effect.orDie);
        codes.push(code.replaceAll("-", ""));
      }
    }

    yield* Effect.promise(() =>
      ctx.runMutation(internal.purchasing.transactions.settle, {
        transactionId,
        lease: job.lease,
        result,
        codes,
      }),
    );

    return yield* Effect.void;
  });

  yield* work.pipe(
    Effect.catch((error) =>
      Effect.promise(() =>
        ctx.runMutation(internal.purchasing.transactions.uncertain, {
          transactionId,
          lease: job.lease,
          problem: error.message,
        }),
      ),
    ),
  );
});
