import { and, eq, gte, sql } from "drizzle-orm";
import { Clock, Context, Crypto, DateTime, Effect, Layer } from "effect";
import {
  BusinessError,
  type Viewer,
  NotFound,
  type manualIssuance,
  type redemption,
  type reversal,
} from "../../shared/contracts";
import { requirePublishedOffering } from "../catalog";
import { Database, execute } from "../db/database";
import { purchases, voucherEvents, vouchers } from "../db/schema";
import { requireAdministrator } from "../lib/identity";
import { expirationFrom, isExpired } from "./validity";

export function describeVoucher(row: typeof vouchers.$inferSelect, now: number) {
  return {
    id: row.id,
    source: row.source,
    purchaseId: row.purchaseId,
    code: row.code,
    terms: row.terms,
    issuedAt: row.issuedAt,
    expiresAt: row.expiresAt,
    redeemed: row.redeemed,
    expired: isExpired(row.expiresAt, now),
  };
}

export class Vouchers extends Context.Service<Vouchers>()("darspa/Vouchers", {
  make: Effect.gen(function* () {
    const db = yield* Database;
    const newId = (yield* Crypto.Crypto).randomUUIDv4.pipe(Effect.orDie);

    const read = Effect.fn("Vouchers.read")(function* (voucherId: string) {
      const [row] = yield* execute(() =>
        db.select().from(vouchers).where(eq(vouchers.id, voucherId)).limit(1),
      );

      if (row === undefined) return yield* new NotFound({ message: "Voucher no encontrado." });

      return row;
    });

    const accessible = Effect.fn("Vouchers.accessible")(function* (
      voucherId: string,
      customer: Viewer,
    ) {
      const voucher = yield* read(voucherId);

      if (customer.role !== "administrator" && voucher.userId !== customer.id) {
        return yield* new NotFound({ message: "No puedes consultar este voucher." });
      }

      return describeVoucher(voucher, yield* Clock.currentTimeMillis);
    });

    const forPurchase = Effect.fn("Vouchers.forPurchase")(function* (
      purchaseId: string,
      customer: Viewer,
    ) {
      const [purchase] = yield* execute(() =>
        db
          .select({ id: purchases.id })
          .from(purchases)
          .where(and(eq(purchases.id, purchaseId), eq(purchases.userId, customer.id)))
          .limit(1),
      );

      if (purchase === undefined)
        return yield* new NotFound({ message: "No puedes consultar estos vouchers." });

      const rows = yield* execute(() =>
        db
          .select()
          .from(vouchers)
          .where(eq(vouchers.purchaseId, purchaseId))
          .orderBy(vouchers.unit)
          .limit(20),
      );

      const now = yield* Clock.currentTimeMillis;

      return rows.map((row) => describeVoucher(row, now));
    });

    const issue = Effect.fn("Vouchers.issue")(function* (
      input: typeof manualIssuance.Type,
      actor: Viewer,
    ) {
      const administrator = yield* requireAdministrator(actor);

      const request = and(
        eq(vouchers.issuedBy, administrator.id),
        eq(vouchers.requestId, input.requestId),
      );

      const [previous] = yield* execute(() => db.select().from(vouchers).where(request).limit(1));
      let voucher = previous;

      if (voucher === undefined) {
        const offering = yield* requirePublishedOffering(input.offeringId);
        const now = yield* DateTime.now;
        const id = yield* newId;
        const code = (yield* newId).replaceAll("-", "");
        yield* execute(() =>
          db
            .insert(vouchers)
            .values({
              id,
              code,
              source: "manual",
              category: input.category,
              issuanceReason: input.reason,
              issuedBy: administrator.id,
              requestId: input.requestId,
              issuedAt: DateTime.toEpochMillis(now),
              expiresAt: expirationFrom(now),
              terms: {
                offeringId: offering.id,
                legacyId: offering.legacyId,
                name: offering.name,
                description: offering.description,
                priceClp: offering.priceClp,
              },
            })
            .onConflictDoNothing({ target: [vouchers.issuedBy, vouchers.requestId] }),
        );
        [voucher] = yield* execute(() => db.select().from(vouchers).where(request).limit(1));
      }

      if (voucher === undefined) return yield* Effect.die(new Error("Issued voucher missing"));

      if (
        voucher.terms.offeringId !== input.offeringId ||
        voucher.category !== input.category ||
        voucher.issuanceReason !== input.reason
      ) {
        return yield* new BusinessError({ message: "La solicitud corresponde a otra emisión." });
      }

      return voucher.id;
    });

    const changeRedemption = Effect.fn("Vouchers.changeRedemption")(function* (
      input:
        | ({ kind: "redeem" } & typeof redemption.Type)
        | ({ kind: "reverse" } & typeof reversal.Type),
      actor: Viewer,
    ) {
      const administrator = yield* requireAdministrator(actor);
      const now = yield* Clock.currentTimeMillis;
      const id = yield* newId;
      const redeeming = input.kind === "redeem";
      const kind = redeeming ? "redeemed" : "reversed";
      const reason = input.kind === "reverse" ? input.reason : null;

      const eligibility = and(
        eq(vouchers.id, input.voucherId),
        eq(vouchers.revision, input.revision),
        eq(vouchers.redeemed, !redeeming),
        redeeming ? gte(vouchers.expiresAt, now) : undefined,
      );

      const result = yield* execute(() =>
        db.batch([
          db.run(sql`INSERT INTO ${voucherEvents} (id, voucherId, kind, actorId, at, reason)
            SELECT ${id}, ${input.voucherId}, ${kind}, ${administrator.id}, ${now}, ${reason}
            FROM ${vouchers} WHERE ${eligibility}`),
          db
            .update(vouchers)
            .set({ redeemed: redeeming, revision: sql`${vouchers.revision} + 1` })
            .where(eligibility),
        ]),
      );

      if (result.some((statement) => statement.meta.changes > 0)) return kind;
      const current = yield* read(input.voucherId);

      if (redeeming && current.redeemed) return "already_redeemed" as const;

      if (redeeming && isExpired(current.expiresAt, now)) return "expired" as const;

      if (!redeeming && !current.redeemed) return "not_redeemed" as const;

      return "stale" as const;
    });

    return { read, accessible, forPurchase, issue, changeRedemption };
  }),
}) {
  static readonly layer = Layer.effect(Vouchers, Vouchers.make);
}
