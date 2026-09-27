import { v } from "convex/values";
import { Clock, Config, Effect, Option, Schema } from "effect";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { runConvex } from "../lib/runtime";
import { httpAction, internalMutation } from "../_generated/server";

const returnFields = {
  token_ws: v.optional(v.string()),
  TBK_TOKEN: v.optional(v.string()),
  TBK_ORDEN_COMPRA: v.optional(v.string()),
  TBK_ID_SESION: v.optional(v.string()),
};

const returnSchema = Schema.Struct({
  token_ws: Schema.optionalKey(Schema.NonEmptyString.check(Schema.isMaxLength(128))),
  TBK_TOKEN: Schema.optionalKey(Schema.NonEmptyString.check(Schema.isMaxLength(128))),
  TBK_ORDEN_COMPRA: Schema.optionalKey(Schema.NonEmptyString.check(Schema.isMaxLength(26))),
  TBK_ID_SESION: Schema.optionalKey(Schema.NonEmptyString.check(Schema.isMaxLength(61))),
});

export const receive = internalMutation({
  args: returnFields,
  returns: v.union(v.null(), v.id("purchases")),
  handler: (ctx, input): Promise<Id<"purchases"> | null> =>
    Effect.runPromise(
      Effect.gen(function* () {
        const token = input.token_ws ?? input.TBK_TOKEN;

        const transaction =
          token !== undefined
            ? yield* Effect.promise(() =>
                ctx.db
                  .query("paymentTransactions")
                  .withIndex("by_token", (q) => q.eq("session.token", token))
                  .unique(),
              )
            : yield* Effect.promise(() =>
                ctx.db
                  .query("paymentTransactions")
                  .withIndex("by_order", (q) => q.eq("buyOrder", input.TBK_ORDEN_COMPRA ?? ""))
                  .unique(),
              );

        if (transaction === null) return null;

        let kind: "normal" | "aborted" | "timeout" | "error" = "normal";

        if (input.TBK_TOKEN !== undefined || input.token_ws === undefined) {
          if (
            input.TBK_ORDEN_COMPRA !== transaction.buyOrder ||
            input.TBK_ID_SESION !== transaction.sessionId ||
            (input.TBK_TOKEN !== undefined && input.TBK_TOKEN !== transaction.session?.token)
          )
            return null;
          kind = input.TBK_TOKEN === undefined ? "timeout" : "aborted";

          if (input.token_ws !== undefined) kind = "error";
        }

        const purchase = yield* Effect.promise(() =>
          ctx.db
            .query("purchases")
            .withIndex("by_transaction", (q) => q.eq("transactionId", transaction._id))
            .unique(),
        );

        if (purchase === null) return null;

        if (transaction.status !== "paid" && transaction.returnKind !== "normal") {
          const now = yield* Clock.currentTimeMillis;
          yield* Effect.promise(() =>
            ctx.db.patch(transaction._id, { returnKind: kind, nextCheckAt: now }),
          );
          yield* Effect.promise(() =>
            ctx.scheduler.runAfter(0, internal.purchasing.payments.process, {
              transactionId: transaction._id,
            }),
          );
        }

        return purchase._id;
      }),
    ),
});

/** No browser session is required: Webpay returns cross-site and customers can
 * close their browser. Provider tokens identify attempts, never authorize account reads.
 */
export const webpayReturn = httpAction((ctx, request): Promise<Response> =>
  runConvex(
    Effect.gen(function* () {
      const url = new URL(request.url);
      let params = url.searchParams;

      if (request.method === "POST") {
        const body = yield* Effect.promise(() => request.text());

        if (body.length > 2048) return new Response("Retorno inválido", { status: 400 });
        params = new URLSearchParams(body);
      }

      const parsed = Schema.decodeOption(returnSchema)(Object.fromEntries(params));
      const site = yield* Config.schema(Schema.URL, "SITE_URL");
      const destination = new URL("/pagos/confirmacion", site);

      if (Option.isSome(parsed)) {
        const purchaseId = yield* Effect.promise(() =>
          ctx.runMutation(internal.purchasing.returns.receive, parsed.value),
        );

        if (purchaseId !== null) destination.searchParams.set("compra", purchaseId);
      }

      return new Response(null, {
        status: 303,
        headers: {
          Location: destination.href,
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      });
    }),
  ),
);
