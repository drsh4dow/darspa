import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  offeringTerms,
  paymentStatus,
  providerResult,
  providerSession,
  purchaseLine,
  returnKind,
} from "./purchasing/model";

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
  purchases: defineTable({
    userId: v.id("users"),
    requestId: v.string(),
    lines: v.array(purchaseLine),
    totalClp: v.number(),
    transactionId: v.id("paymentTransactions"),
  })
    .index("by_customer", ["userId"])
    .index("by_request", ["userId", "requestId"])
    .index("by_transaction", ["transactionId"]),
  paymentTransactions: defineTable({
    userId: v.id("users"),
    buyOrder: v.string(),
    sessionId: v.string(),
    environment: v.union(v.literal("integration"), v.literal("production")),
    amount: v.number(),
    status: paymentStatus,
    session: v.optional(providerSession),
    returnKind: v.optional(returnKind),
    result: v.optional(providerResult),
    attempts: v.number(),
    lease: v.number(),
    nextCheckAt: v.optional(v.number()),
    lastCheckedAt: v.optional(v.number()),
    problem: v.optional(v.string()),
  })
    .index("by_order", ["buyOrder"])
    .index("by_token", ["session.token"])
    .index("by_due", ["nextCheckAt"]),
  vouchers: defineTable({
    userId: v.id("users"),
    purchaseId: v.id("purchases"),
    code: v.string(),
    terms: offeringTerms,
    source: v.literal("webpay"),
    issuedAt: v.number(),
    expiresAt: v.number(),
    redeemed: v.boolean(),
    pdfId: v.optional(v.id("_storage")),
  })
    .index("by_purchase", ["purchaseId"])
    .index("by_customer", ["userId"])
    .index("by_code", ["code"]),
  voucherDeliveries: defineTable({
    userId: v.id("users"),
    voucherId: v.id("vouchers"),
    requestId: v.string(),
    recipient: v.string(),
    status: v.union(v.literal("queued"), v.literal("accepted"), v.literal("unconfirmed")),
    providerId: v.optional(v.string()),
    attempts: v.number(),
    lease: v.number(),
    nextAttemptAt: v.optional(v.number()),
  })
    .index("by_voucher", ["voucherId"])
    .index("by_request", ["userId", "requestId"])
    .index("by_due", ["nextAttemptAt"]),
  developmentMessages: defineTable({
    name: v.literal("foundation"),
    message: v.string(),
  }).index("by_name", ["name"]),
});
