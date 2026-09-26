import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

export const status = query({
  args: {},
  returns: v.union(v.null(), v.object({ message: v.string(), configuration: v.string() })),
  handler: async (ctx) => {
    const record = await ctx.db
      .query("developmentMessages")
      .withIndex("by_name", (q) => q.eq("name", "foundation"))
      .unique();

    if (record === null) return null;

    return {
      message: record.message,
      // Only this explicitly public, synthetic marker may be returned to the browser.
      configuration: process.env["DARSPA_DEVELOPMENT_LABEL"] ?? "Sin sincronizar",
    };
  },
});

export const seed = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const record = await ctx.db
      .query("developmentMessages")
      .withIndex("by_name", (q) => q.eq("name", "foundation"))
      .unique();

    if (record === null) {
      await ctx.db.insert("developmentMessages", {
        name: "foundation",
        message: "Conexión con el entorno de desarrollo verificada.",
      });
    }

    return null;
  },
});
