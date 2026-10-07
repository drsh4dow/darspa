import { and, eq, lt, or, type AnyColumn } from "drizzle-orm";
import { Effect, Schema } from "effect";
import { BusinessError } from "../../shared/contracts";

export const pageSize = 30;

const cursorSchema = Schema.fromJsonString(Schema.Struct({ at: Schema.Finite, id: Schema.String }));

const encodeCursor = Schema.encodeEffect(cursorSchema);

export const beforeCursor = Effect.fnUntraced(function* (
  cursor: string | null,
  at: AnyColumn,
  id: AnyColumn,
) {
  if (cursor === null) return undefined;

  const position = yield* Schema.decodeEffect(cursorSchema)(cursor).pipe(
    Effect.mapError(() => new BusinessError({ message: "La página solicitada no es válida." })),
  );

  return or(lt(at, position.at), and(eq(at, position.at), lt(id, position.id)));
});

export const pageOf = Effect.fnUntraced(function* <A>(
  rows: readonly A[],
  position: (row: A) => { at: number; id: string },
) {
  const items = rows.slice(0, pageSize);
  const last = items.at(-1);

  const nextCursor =
    rows.length > pageSize && last !== undefined
      ? yield* encodeCursor(position(last)).pipe(Effect.orDie)
      : null;

  return { items, nextCursor };
});
