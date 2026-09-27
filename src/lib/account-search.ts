import { Effect, Schema } from "effect";

export const accountSearch = Schema.toStandardSchemaV1(
  Schema.Struct({
    code: Schema.optional(Schema.String),
    metodo: Schema.optional(Schema.Literals(["email", "google"])).pipe(
      Schema.catchDecoding(() => Effect.succeedSome(undefined)),
    ),
    // Explicit application destinations only, never an arbitrary URL.
    redirect: Schema.optional(Schema.Literals(["/admin", "/carro"])).pipe(
      Schema.catchDecoding(() => Effect.succeedSome(undefined)),
    ),
  }),
);
