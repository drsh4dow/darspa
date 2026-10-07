import { drizzle } from "drizzle-orm/d1";
import { Context, Effect, Layer, Redacted, Schema } from "effect";
import type { D1Database } from "@cloudflare/workers-types";

export function connect(binding: D1Database) {
  return drizzle(binding);
}

export class Database extends Context.Service<Database, ReturnType<typeof connect>>()(
  "darspa/Database",
) {
  static layer(binding: D1Database) {
    return Layer.succeed(Database, connect(binding));
  }
}

export class DatabaseError extends Schema.TaggedError<DatabaseError>()("DatabaseError", {
  message: Schema.String,
  cause: Schema.Redacted(Schema.Defect()),
}) {}

// Database errors may contain SQL parameters. Keep them out of responses and logs.
export const execute = <A>(query: () => PromiseLike<A>) =>
  Effect.tryPromise({
    try: () => Promise.resolve(query()),
    catch: (cause) =>
      new DatabaseError({
        message: "La base de datos no está disponible.",
        cause: Redacted.make(cause),
      }),
  }).pipe(Effect.orDie);
