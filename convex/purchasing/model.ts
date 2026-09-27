import { v, type Infer } from "convex/values";
import { Schema } from "effect";

export const cartItem = v.object({
  offeringId: v.string(),
  quantity: v.number(),
  expectedPriceClp: v.number(),
});

export const cartSchema = Schema.Array(
  Schema.Struct({
    offeringId: Schema.NonEmptyString,
    quantity: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 20 })),
    expectedPriceClp: Schema.Int.check(Schema.isGreaterThan(0)),
  }),
).check(Schema.isMinLength(1), Schema.isMaxLength(20));

export const offeringTerms = v.object({
  offeringId: v.string(),
  legacyId: v.optional(v.string()),
  name: v.string(),
  description: v.string(),
  priceClp: v.number(),
});

export const purchaseLine = v.object({ terms: offeringTerms, quantity: v.number() });

export const paymentStatus = v.union(
  v.literal("creating"),
  v.literal("pending"),
  v.literal("unknown"),
  v.literal("paid"),
  v.literal("declined"),
  v.literal("aborted"),
  v.literal("timed_out"),
  v.literal("error"),
);

export const returnKind = v.union(
  v.literal("normal"),
  v.literal("aborted"),
  v.literal("timeout"),
  v.literal("error"),
);

export const providerSession = v.object({ token: v.string(), url: v.string() });

export const providerResult = v.object({
  buy_order: v.string(),
  session_id: v.string(),
  amount: v.number(),
  status: v.string(),
  response_code: v.optional(v.number()),
  authorization_code: v.optional(v.string()),
  transaction_date: v.optional(v.string()),
  payment_type_code: v.optional(v.string()),
  card_detail: v.optional(v.object({ card_number: v.string() })),
});

export type ProviderResult = Infer<typeof providerResult>;

export type PaymentStatus = Infer<typeof paymentStatus>;

export function isUnsettled(status: PaymentStatus) {
  return status === "creating" || status === "pending" || status === "unknown";
}
