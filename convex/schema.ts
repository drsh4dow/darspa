import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  developmentMessages: defineTable({
    name: v.literal("foundation"),
    message: v.string(),
  }).index("by_name", ["name"]),
});
