import { v } from "convex/values";
import { offeringTerms } from "../purchasing/model";

export const voucherDetails = v.object({
  id: v.id("vouchers"),
  purchaseId: v.id("purchases"),
  code: v.string(),
  terms: offeringTerms,
  issuedAt: v.number(),
  expiresAt: v.number(),
  redeemed: v.boolean(),
  expired: v.boolean(),
  pdfId: v.union(v.null(), v.id("_storage")),
});
