import { and, desc, eq, gt, gte, lt, lte, ne, notExists, or, sql } from "drizzle-orm";
import { Clock, Config, Context, Crypto, Effect, Layer, Schema } from "effect";
import { BusinessError, type Viewer } from "../../shared/contracts";
import { Database, execute } from "../db/database";
import { deliveries } from "../db/schema";
import { checkDevelopmentRecipient, sendEmail } from "../lib/email";
import { HttpClient } from "effect/unstable/http";
import { VoucherDocuments } from "./documents";
import { voucherEmail } from "./email";
import { Vouchers } from "./vouchers";

export class VoucherDeliveries extends Context.Service<VoucherDeliveries>()(
  "darspa/VoucherDeliveries",
  {
    make: Effect.gen(function* () {
      const db = yield* Database;
      const newId = (yield* Crypto.Crypto).randomUUIDv4.pipe(Effect.orDie);
      const http = yield* HttpClient.HttpClient;
      const vouchers = yield* Vouchers;
      const documents = yield* VoucherDocuments;
      const assetOrigin = yield* Config.schema(Schema.URL, "SITE_URL");

      const request = Effect.fn("VoucherDeliveries.request")(function* (
        voucherId: string,
        recipient: string,
        requestId: string,
        customer: Viewer,
      ) {
        yield* vouchers.accessible(voucherId, customer);
        yield* checkDevelopmentRecipient(recipient);

        const sameRequest = and(
          eq(deliveries.userId, customer.id),
          eq(deliveries.requestId, requestId),
        );

        const [previous] = yield* execute(() =>
          db.select().from(deliveries).where(sameRequest).limit(1),
        );

        let delivery = previous;

        if (delivery === undefined) {
          const now = yield* Clock.currentTimeMillis;
          const id = yield* newId;

          const recent = db
            .select({ id: deliveries.id })
            .from(deliveries)
            .where(
              and(eq(deliveries.voucherId, voucherId), gt(deliveries.createdAt, now - 60_000)),
            );

          yield* execute(() =>
            db.run(sql`
          INSERT INTO ${deliveries} (id, userId, voucherId, requestId, recipient, createdAt, status, nextAttemptAt)
          SELECT ${id}, ${customer.id}, ${voucherId}, ${requestId}, ${recipient}, ${now}, 'queued', ${now}
          WHERE ${notExists(recent)} ON CONFLICT(userId, requestId) DO NOTHING
        `),
          );
          [delivery] = yield* execute(() =>
            db.select().from(deliveries).where(sameRequest).limit(1),
          );
        }

        if (delivery === undefined)
          return yield* new BusinessError({
            message: "Espera un minuto antes de enviar nuevamente este voucher.",
          });

        if (delivery.voucherId !== voucherId || delivery.recipient !== recipient)
          return yield* new BusinessError({ message: "La solicitud corresponde a otro envío." });

        return delivery.id;
      });

      const latest = Effect.fn("VoucherDeliveries.latest")(function* (
        voucherId: string,
        customer: Viewer,
      ) {
        yield* vouchers.accessible(voucherId, customer);

        const [delivery] = yield* execute(() =>
          db
            .select({ recipient: deliveries.recipient, status: deliveries.status })
            .from(deliveries)
            .where(eq(deliveries.voucherId, voucherId))
            .orderBy(desc(deliveries.createdAt))
            .limit(1),
        );

        return delivery ?? null;
      });

      const process = Effect.fn("VoucherDeliveries.process")(function* (deliveryId: string) {
        const now = yield* Clock.currentTimeMillis;

        const available = and(
          eq(deliveries.id, deliveryId),
          eq(deliveries.status, "queued"),
          lte(deliveries.lease, now),
        );

        // Resend's deduplication expires after 24 hours. Stop conservatively at 23.
        yield* execute(() =>
          db
            .update(deliveries)
            .set({ status: "unconfirmed", nextAttemptAt: null, lease: 0 })
            .where(
              and(
                available,
                or(gte(deliveries.attempts, 5), lt(deliveries.createdAt, now - 23 * 3_600_000)),
              ),
            ),
        );

        const [delivery] = yield* execute(() =>
          db
            .update(deliveries)
            .set({
              attempts: sql`${deliveries.attempts} + 1`,
              lease: now + 120_000,
              nextAttemptAt: now + 120_000,
            })
            .where(available)
            .returning(),
        );

        if (delivery === undefined) return;

        const providerId = yield* Effect.gen(function* () {
          const voucher = yield* vouchers.read(delivery.voucherId);
          const pdf = new URL(yield* documents.forDelivery(delivery.voucherId));

          const result = yield* sendEmail({
            to: delivery.recipient,
            idempotencyKey: `voucher/${delivery.id}`,
            ...voucherEmail({
              name: voucher.terms.name,
              code: voucher.code,
              expiresAt: voucher.expiresAt,
              pdf,
              assetOrigin,
            }),
          }).pipe(Effect.provideService(HttpClient.HttpClient, http));

          return result.id;
        }).pipe(Effect.match({ onSuccess: (id) => id, onFailure: () => null }));

        const finishedAt = yield* Clock.currentTimeMillis;
        const exhausted = delivery.attempts >= 5;
        let status: "queued" | "accepted" | "unconfirmed" = "queued";
        let nextAttemptAt: number | null = finishedAt + 60_000 * 2 ** delivery.attempts;

        if (providerId !== null) {
          status = "accepted";
          nextAttemptAt = null;
        } else if (exhausted) {
          status = "unconfirmed";
          nextAttemptAt = null;
        }

        yield* execute(() =>
          db
            .update(deliveries)
            .set({ status, providerId, lease: 0, nextAttemptAt })
            .where(
              and(
                eq(deliveries.id, delivery.id),
                eq(deliveries.lease, delivery.lease),
                ne(deliveries.status, "accepted"),
              ),
            ),
        );
      });

      const due = Effect.fn("VoucherDeliveries.due")(function* () {
        const now = yield* Clock.currentTimeMillis;

        return yield* execute(() =>
          db
            .select({ id: deliveries.id })
            .from(deliveries)
            .where(lte(deliveries.nextAttemptAt, now))
            .orderBy(deliveries.nextAttemptAt)
            .limit(20),
        );
      });

      return { request, latest, process, due };
    }),
  },
) {
  static readonly layer = Layer.effect(VoucherDeliveries, VoucherDeliveries.make);
}
