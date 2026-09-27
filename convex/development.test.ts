import { convexTest } from "convex-test";
import { Effect } from "effect";
import { expect, test } from "vite-plus/test";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("a fresh deployment has no data; preparation can safely run twice", () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const backend = convexTest(schema, modules);
      const initial = yield* Effect.promise(() => backend.query(api.development.status));
      expect(initial).toBeNull();

      yield* Effect.promise(() => backend.mutation(internal.development.seed));
      yield* Effect.promise(() => backend.mutation(internal.development.seed));

      const status = yield* Effect.promise(() => backend.query(api.development.status));
      expect(status).toEqual({
        message: "Conexión con el entorno de desarrollo verificada.",
        configuration: "Configuración de prueba",
      });
    }),
  ));
