import { v } from "convex/values";
import { paymentStatus, providerResult, purchaseLine } from "../purchasing/model";
import { manualCategory, voucherDetails } from "../vouchers/model";

export const customerSummary = v.object({ id: v.id("users"), email: v.string() });

export const purchaseSummary = v.object({
  id: v.id("purchases"),
  customer: customerSummary,
  createdAt: v.number(),
  totalClp: v.number(),
  buyOrder: v.string(),
  status: paymentStatus,
});

export const purchaseRecord = v.object({
  ...purchaseSummary.fields,
  lines: v.array(purchaseLine),
  transactionId: v.id("paymentTransactions"),
  environment: v.union(v.literal("integration"), v.literal("production")),
  result: v.union(v.null(), providerResult),
  problem: v.union(v.null(), v.string()),
  lastCheckedAt: v.union(v.null(), v.number()),
});

export const operationalVoucher = v.object({
  ...voucherDetails.fields,
  revision: v.number(),
  category: v.union(v.null(), manualCategory),
  issuanceReason: v.union(v.null(), v.string()),
  issuedBy: v.union(v.null(), v.string()),
  customer: v.union(v.null(), customerSummary),
});

export const voucherEvent = v.object({
  id: v.id("voucherEvents"),
  kind: v.union(v.literal("redeemed"), v.literal("reversed")),
  actor: v.string(),
  at: v.number(),
  reason: v.union(v.null(), v.string()),
});
