import { convexTest } from "convex-test";
import { expect, test } from "vite-plus/test";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("a fresh deployment has no data; preparation can safely run twice", async () => {
  const backend = convexTest(schema, modules);

  expect(await backend.query(api.development.status)).toBeNull();

  await backend.mutation(internal.development.seed);
  await backend.mutation(internal.development.seed);

  expect(await backend.query(api.development.status)).toEqual({
    message: "Conexión con el entorno de desarrollo verificada.",
    configuration: "Configuración de prueba",
  });
});
