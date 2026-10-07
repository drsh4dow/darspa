import { and, desc, eq, gt, sql } from "drizzle-orm";
import { Clock, Context, Crypto, Effect, Layer, Schema } from "effect";
import {
  BusinessError,
  type Viewer,
  NotFound,
  purchaseLine,
  type checkout,
  type PurchaseLine,
} from "../../shared/contracts";
import { Database, execute } from "../db/database";
import { purchases } from "../db/schema";
import { requirePublishedOffering } from "../catalog";
import { beforeCursor, pageOf, pageSize } from "../lib/pagination";
import { webpayEnvironment } from "./webpay";

const encodeLines = Schema.encodeEffect(Schema.fromJsonString(Schema.Array(purchaseLine)));

export function describePurchase(row: typeof purchases.$inferSelect) {
  const checkout =
    row.status === "pending" &&
    row.returnKind === null &&
    row.token !== null &&
    row.checkoutUrl !== null
      ? { token: row.token, url: row.checkoutUrl }
      : null;

  return {
    id: row.id,
    requestId: row.requestId,
    createdAt: row.createdAt,
    lines: row.lines,
    totalClp: row.totalClp,
    status: row.status,
    environment: row.environment,
    checkout,
    buyOrder: row.buyOrder,
    result: row.result,
    problem: row.problem,
  };
}

export class Purchases extends Context.Service<Purchases>()("darspa/Purchases", {
  make: Effect.gen(function* () {
    const db = yield* Database;
    const newId = (yield* Crypto.Crypto).randomUUIDv4.pipe(Effect.orDie);
    const environment = yield* webpayEnvironment;

    const get = Effect.fn("Purchases.get")(function* (purchaseId: string, customer: Viewer) {
      const [row] = yield* execute(() =>
        db
          .select()
          .from(purchases)
          .where(and(eq(purchases.id, purchaseId), eq(purchases.userId, customer.id)))
          .limit(1),
      );

      if (row === undefined)
        return yield* new NotFound({ message: "No puedes consultar esta compra." });

      return describePurchase(row);
    });

    const create = Effect.fn("Purchases.create")(function* (
      input: typeof checkout.Type,
      customer: Viewer,
    ) {
      const request = and(
        eq(purchases.userId, customer.id),
        eq(purchases.requestId, input.requestId),
      );

      const [previous] = yield* execute(() =>
        db.select({ id: purchases.id }).from(purchases).where(request).limit(1),
      );

      if (previous !== undefined) return previous.id;
      const seen = new Set<string>();
      const lines: PurchaseLine[] = [];
      let totalClp = 0;
      let units = 0;

      for (const item of input.items) {
        if (seen.has(item.offeringId))
          return yield* new BusinessError({ message: "El carro contiene un servicio repetido." });
        seen.add(item.offeringId);
        const offering = yield* requirePublishedOffering(item.offeringId);

        if (offering.priceClp !== item.expectedPriceClp) {
          return yield* new BusinessError({
            message: "Un precio cambió. Actualiza el carro y revisa el total antes de pagar.",
          });
        }

        lines.push({
          terms: {
            offeringId: offering.id,
            legacyId: offering.legacyId,
            name: offering.name,
            description: offering.description,
            priceClp: offering.priceClp,
          },
          quantity: item.quantity,
        });
        totalClp += offering.priceClp * item.quantity;
        units += item.quantity;
      }

      if (units > 20 || !Number.isSafeInteger(totalClp))
        return yield* new BusinessError({ message: "Puedes comprar hasta 20 vouchers por pago." });
      const now = yield* Clock.currentTimeMillis;
      const id = yield* newId;
      const buyOrder = (yield* newId).replaceAll("-", "").slice(0, 26);
      const sessionId = yield* newId;
      const encodedLines = yield* encodeLines(lines).pipe(Effect.orDie);

      // A single INSERT…SELECT enforces the rolling checkout limit and request identity
      // atomically. There is no interactive SQLite transaction on D1.
      const recent = db
        .select({ count: sql<number>`count(*)` })
        .from(purchases)
        .where(and(eq(purchases.userId, customer.id), gt(purchases.createdAt, now - 60_000)));

      yield* execute(() =>
        db.run(sql`
        INSERT INTO ${purchases} (id, userId, requestId, createdAt, lines, totalClp, buyOrder, sessionId, environment, status, nextCheckAt)
        SELECT ${id}, ${customer.id}, ${input.requestId}, ${now}, ${encodedLines}, ${totalClp}, ${buyOrder}, ${sessionId}, ${environment}, 'creating', ${now}
        WHERE (${recent}) < 5
        ON CONFLICT(userId, requestId) DO NOTHING
      `),
      );

      const [created] = yield* execute(() =>
        db.select({ id: purchases.id }).from(purchases).where(request).limit(1),
      );

      if (created === undefined)
        return yield* new BusinessError({
          message: "Espera un minuto antes de iniciar otro pago.",
        });

      return created.id;
    });

    const history = Effect.fn("Purchases.history")(function* (
      cursor: string | null,
      customer: Viewer,
    ) {
      const before = yield* beforeCursor(cursor, purchases.createdAt, purchases.id);

      const rows = yield* execute(() =>
        db
          .select()
          .from(purchases)
          .where(and(eq(purchases.userId, customer.id), before))
          .orderBy(desc(purchases.createdAt), desc(purchases.id))
          .limit(pageSize + 1),
      );

      const page = yield* pageOf(rows, (row) => ({ at: row.createdAt, id: row.id }));

      return { ...page, items: page.items.map(describePurchase) };
    });

    return { create, get, history };
  }),
}) {
  static readonly layer = Layer.effect(Purchases, Purchases.make);
}
