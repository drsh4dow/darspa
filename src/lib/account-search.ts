import { Effect, Schema } from "effect";

export const accountSearch = Schema.toStandardSchemaV1(
  Schema.Struct({
    code: Schema.optional(Schema.String),
    metodo: Schema.optional(Schema.Literals(["email", "google"])).pipe(
      Schema.catchDecoding(() => Effect.succeedSome(undefined)),
    ),
    // Only the existing protected destination is accepted, never an arbitrary URL.
    redirect: Schema.optional(Schema.Literal("/admin")).pipe(
      Schema.catchDecoding(() => Effect.succeedSome(undefined)),
    ),
  }),
);
