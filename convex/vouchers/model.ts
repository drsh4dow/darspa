import { v } from "convex/values";
import { offeringTerms } from "../purchasing/model";

export const manualCategory = v.union(v.literal("external_payment"), v.literal("complimentary"));

export const issuanceArgs = {
  offeringId: v.string(),
  category: manualCategory,
  reason: v.string(),
  requestId: v.string(),
};

const voucherFields = {
  code: v.string(),
  terms: offeringTerms,
  issuedAt: v.number(),
  expiresAt: v.number(),
  redeemed: v.boolean(),
  revision: v.optional(v.number()),
  pdfId: v.optional(v.id("_storage")),
};

export const voucherRecord = v.union(
  v.object({
    ...voucherFields,
    source: v.literal("webpay"),
    userId: v.id("users"),
    purchaseId: v.id("purchases"),
  }),
  v.object({
    ...voucherFields,
    source: v.literal("manual"),
    // Historical imports may lack these facts. New issuance requires all four.
    category: v.optional(manualCategory),
    issuanceReason: v.optional(v.string()),
    issuedBy: v.optional(v.id("users")),
    requestId: v.optional(v.string()),
  }),
);

export const voucherDetails = v.object({
  id: v.id("vouchers"),
  source: v.union(v.literal("webpay"), v.literal("manual")),
  purchaseId: v.union(v.null(), v.id("purchases")),
  code: v.string(),
  terms: offeringTerms,
  issuedAt: v.number(),
  expiresAt: v.number(),
  redeemed: v.boolean(),
  expired: v.boolean(),
  pdfId: v.union(v.null(), v.id("_storage")),
});
