import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,
  users: defineTable({
    email: v.string(),
    emailVerificationTime: v.optional(v.number()),
    lastSignInEmailAt: v.optional(v.number()),
    role: v.optional(v.union(v.literal("customer"), v.literal("administrator"))),
  }).index("email", ["email"]),
  legacyIdentities: defineTable({
    legacyId: v.string(),
    verifiedEmail: v.optional(v.string()),
    userId: v.optional(v.id("users")),
  })
    .index("legacyId", ["legacyId"])
    .index("verifiedEmail", ["verifiedEmail"]),
  roleChanges: defineTable({
    userId: v.id("users"),
    from: v.union(v.literal("customer"), v.literal("administrator")),
    to: v.union(v.literal("customer"), v.literal("administrator")),
    operator: v.string(),
    reason: v.string(),
    deploymentUrl: v.string(),
  }),
  developmentMessages: defineTable({
    name: v.literal("foundation"),
    message: v.string(),
  }).index("by_name", ["name"]),
});
