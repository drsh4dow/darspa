import { v } from "convex/values";
import { Config, Effect } from "effect";
import { convexConfig } from "./lib/runtime";
import { internalMutation, query } from "./_generated/server";

export const status = query({
  args: {},
  returns: v.union(v.null(), v.object({ message: v.string(), configuration: v.string() })),
  handler: (ctx) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const record = yield* Effect.promise(() =>
          ctx.db
            .query("developmentMessages")
            .withIndex("by_name", (q) => q.eq("name", "foundation"))
            .unique(),
        );

        if (record === null) return null;

        // Only this explicitly public, synthetic marker may be returned to the browser.
        const configuration = yield* Config.String("DARSPA_DEVELOPMENT_LABEL")
          .pipe(Config.withDefault("Sin sincronizar"))
          .parse(convexConfig);

        return { message: record.message, configuration };
      }),
    ),
});

export const seed = internalMutation({
  args: {},
  returns: v.null(),
  handler: (ctx) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const record = yield* Effect.promise(() =>
          ctx.db
            .query("developmentMessages")
            .withIndex("by_name", (q) => q.eq("name", "foundation"))
            .unique(),
        );

        if (record === null) {
          yield* Effect.promise(() =>
            ctx.db.insert("developmentMessages", {
              name: "foundation",
              message: "Conexión con el entorno de desarrollo verificada.",
            }),
          );
        }

        return null;
      }),
    ),
});
