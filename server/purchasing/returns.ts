import { and, eq, ne, or, isNull } from "drizzle-orm";
import { Clock, Effect, Schema } from "effect";
import { Database, execute } from "../db/database";
import { purchases } from "../db/schema";

export const webpayReturn = Schema.Struct({
  token_ws: Schema.optionalKey(Schema.NonEmptyString.check(Schema.isMaxLength(128))),
  TBK_TOKEN: Schema.optionalKey(Schema.NonEmptyString.check(Schema.isMaxLength(128))),
  TBK_ORDEN_COMPRA: Schema.optionalKey(Schema.NonEmptyString.check(Schema.isMaxLength(26))),
  TBK_ID_SESION: Schema.optionalKey(Schema.NonEmptyString.check(Schema.isMaxLength(61))),
});

// Cross-site provider returns identify an attempt, never authorize account reads.
export const receiveWebpayReturn = Effect.fn("receiveWebpayReturn")(function* (
  input: typeof webpayReturn.Type,
) {
  const db = yield* Database;
  const token = input.token_ws ?? input.TBK_TOKEN;

  const match =
    token === undefined
      ? eq(purchases.buyOrder, input.TBK_ORDEN_COMPRA ?? "")
      : eq(purchases.token, token);

  const [purchase] = yield* execute(() => db.select().from(purchases).where(match).limit(1));

  if (purchase === undefined) return null;
  let kind: "normal" | "aborted" | "timeout" | "error" = "normal";

  if (input.TBK_TOKEN !== undefined || input.token_ws === undefined) {
    if (
      input.TBK_ORDEN_COMPRA !== purchase.buyOrder ||
      input.TBK_ID_SESION !== purchase.sessionId ||
      (input.TBK_TOKEN !== undefined && input.TBK_TOKEN !== purchase.token)
    )
      return null;
    kind = input.TBK_TOKEN === undefined ? "timeout" : "aborted";

    if (input.token_ws !== undefined) kind = "error";
  }

  const now = yield* Clock.currentTimeMillis;
  yield* execute(() =>
    db
      .update(purchases)
      .set({ returnKind: kind, nextCheckAt: now })
      .where(
        and(
          eq(purchases.id, purchase.id),
          ne(purchases.status, "paid"),
          or(isNull(purchases.returnKind), ne(purchases.returnKind, "normal")),
        ),
      ),
  );

  return purchase.id;
});
