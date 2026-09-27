import { ConvexError, type Infer } from "convex/values";
import { DateTime, Effect, Schema } from "effect";
import type { Doc, Id } from "../_generated/dataModel";
import type { WithoutSystemFields } from "convex/server";
import type { MutationCtx } from "../_generated/server";
import { requirePublishedOffering } from "../catalog";
import { requireAdministrator } from "../lib/access";
import type { manualCategory } from "./model";
import { expirationFrom, isExpired } from "./validity";

const reasonSchema = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(1000));

const requestSchema = Schema.String.check(Schema.isUUID(4));

const readReason = Effect.fnUntraced(function* (reason: string) {
  return yield* Schema.decodeEffect(reasonSchema)(reason.trim()).pipe(
    Effect.mapError(() => new ConvexError("Escribe un motivo de hasta 1.000 caracteres.")),
  );
});

export const issueManual = Effect.fn("vouchers.issueManual")(function* (
  ctx: MutationCtx,
  input: {
    offeringId: string;
    category: Infer<typeof manualCategory>;
    reason: string;
    requestId: string;
    code: string;
  },
) {
  const administrator = yield* requireAdministrator(ctx);
  const reason = yield* readReason(input.reason);
  yield* Schema.decodeEffect(requestSchema)(input.requestId);
  yield* Schema.decodeEffect(Schema.String.check(Schema.isPattern(/^[a-f0-9]{32}$/)))(input.code);

  const previous = yield* Effect.promise(() =>
    ctx.db
      .query("vouchers")
      .withIndex("by_issuance_request", (q) =>
        q.eq("issuedBy", administrator.id).eq("requestId", input.requestId),
      )
      .unique(),
  );

  if (previous !== null) {
    if (
      previous.source !== "manual" ||
      previous.terms.offeringId !== input.offeringId ||
      previous.category !== input.category ||
      previous.issuanceReason !== reason
    ) {
      return yield* Effect.fail(new ConvexError("La solicitud corresponde a otra emisión."));
    }

    return previous._id;
  }

  const offering = requirePublishedOffering(input.offeringId);

  const existing = yield* Effect.promise(() =>
    ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", input.code))
      .unique(),
  );

  if (existing !== null) return yield* Effect.die(new Error("Voucher code collision"));
  const now = yield* DateTime.now;

  return yield* Effect.promise(() =>
    ctx.db.insert("vouchers", {
      source: "manual",
      category: input.category,
      issuanceReason: reason,
      issuedBy: administrator.id,
      requestId: input.requestId,
      code: input.code,
      terms: {
        offeringId: offering.id,
        legacyId: offering.legacyId,
        name: offering.name,
        description: offering.description,
        priceClp: offering.priceClp,
      },
      issuedAt: DateTime.toEpochMillis(now),
      expiresAt: expirationFrom(now),
      redeemed: false,
    }),
  );
});

/** Eligibility, state change and audit entry share the same serializable transaction.
 * The revision prevents an old confirmation from consuming a voucher after a reversal.
 */
export const changeRedemption = Effect.fn("vouchers.changeRedemption")(function* (
  ctx: MutationCtx,
  input: { voucherId: Id<"vouchers">; revision: number } & (
    | { kind: "redeem" }
    | { kind: "reverse"; reason: string }
  ),
) {
  const administrator = yield* requireAdministrator(ctx);
  const voucher = yield* Effect.promise(() => ctx.db.get(input.voucherId));

  if (voucher === null) return yield* Effect.fail(new ConvexError("Voucher no encontrado."));
  const now = DateTime.toEpochMillis(yield* DateTime.now);
  const revision = voucher.revision ?? 0;

  if (input.kind === "redeem" && voucher.redeemed) return "already_redeemed" as const;

  if (input.kind === "redeem" && isExpired(voucher.expiresAt, now)) return "expired" as const;

  if (input.kind === "reverse" && !voucher.redeemed) return "not_redeemed" as const;

  if (revision !== input.revision) return "stale" as const;

  const reason = input.kind === "reverse" ? yield* readReason(input.reason) : undefined;
  const kind = input.kind === "redeem" ? "redeemed" : "reversed";
  yield* Effect.promise(() =>
    ctx.db.patch(voucher._id, {
      redeemed: input.kind === "redeem",
      revision: revision + 1,
    }),
  );

  const event: WithoutSystemFields<Doc<"voucherEvents">> = {
    voucherId: voucher._id,
    kind,
    actorId: administrator.id,
    at: now,
  };

  if (reason !== undefined) event.reason = reason;
  yield* Effect.promise(() => ctx.db.insert("voucherEvents", event));

  return kind;
});
