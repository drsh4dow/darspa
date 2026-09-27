import { convexTest } from "convex-test";
import { Effect } from "effect";
import { expect, test } from "vite-plus/test";
import catalog from "../content/generated/catalog.json";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("published catalog metadata survives the public backend contract unchanged", () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const backend = convexTest(schema, modules);
      const available = catalog.filter((offering) => offering.available);

      const listed = yield* Effect.promise(() => backend.query(api.catalog.list, {}));
      expect(listed).toEqual(available);

      yield* Effect.forEach(
        catalog,
        Effect.fnUntraced(function* (offering) {
          const actual = yield* Effect.promise(() =>
            backend.query(api.catalog.get, { id: offering.id }),
          );

          expect(actual).toEqual(offering);
        }),
        { concurrency: 8, discard: true },
      );

      const missing = yield* Effect.promise(() =>
        backend.query(api.catalog.get, { id: "unknown-offering" }),
      );

      expect(missing).toBeNull();
    }),
  ));
