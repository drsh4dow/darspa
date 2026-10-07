import { and, asc, desc, eq, gt, gte, lt, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { Clock, Context, Effect, Layer } from "effect";
import { NotFound, type Viewer, type VoucherScope } from "../shared/contracts";
import { Database, execute } from "./db/database";
import { purchases, user, voucherEvents, vouchers } from "./db/schema";
import { requireAdministrator } from "./lib/identity";
import { beforeCursor, pageOf, pageSize } from "./lib/pagination";
import { describePurchase } from "./purchasing/purchases";
import { describeVoucher } from "./vouchers/vouchers";

export class Operations extends Context.Service<Operations>()("darspa/Operations", {
  make: Effect.gen(function* () {
    const db = yield* Database;
    const issuer = alias(user, "issuer");

    const voucherQuery = () =>
      db
        .select({
          voucher: vouchers,
          customer: { id: user.id, email: user.email },
          issuedBy: issuer.email,
        })
        .from(vouchers)
        .leftJoin(user, eq(user.id, vouchers.userId))
        .leftJoin(issuer, eq(issuer.id, vouchers.issuedBy));

    const purchaseQuery = () =>
      db
        .select({ purchase: purchases, customer: { id: user.id, email: user.email } })
        .from(purchases)
        .innerJoin(user, eq(user.id, purchases.userId));

    const customers = Effect.fn("Operations.customers")(function* (
      email: string,
      cursor: string | null,
      actor: Viewer,
    ) {
      yield* requireAdministrator(actor);
      const prefix = email.trim().toLowerCase();

      const rows = yield* execute(() =>
        db
          .select({ id: user.id, email: user.email })
          .from(user)
          .where(
            and(
              gte(user.email, prefix),
              lt(user.email, `${prefix}\uffff`),
              cursor === null ? undefined : gt(user.email, cursor),
            ),
          )
          .orderBy(asc(user.email))
          .limit(pageSize + 1),
      );

      const items = rows.slice(0, pageSize);
      const last = items.at(-1);

      return {
        items,
        nextCursor: rows.length > pageSize && last !== undefined ? last.email : null,
      };
    });

    const listPurchases = Effect.fn("Operations.purchases")(function* (
      customerId: string | undefined,
      cursor: string | null,
      actor: Viewer,
    ) {
      yield* requireAdministrator(actor);
      const before = yield* beforeCursor(cursor, purchases.createdAt, purchases.id);

      const rows = yield* execute(() =>
        purchaseQuery()
          .where(
            and(before, customerId === undefined ? undefined : eq(purchases.userId, customerId)),
          )
          .orderBy(desc(purchases.createdAt), desc(purchases.id))
          .limit(pageSize + 1),
      );

      const page = yield* pageOf(rows, ({ purchase }) => ({
        at: purchase.createdAt,
        id: purchase.id,
      }));

      return {
        ...page,
        items: page.items.map(({ purchase, customer }) =>
          Object.assign(describePurchase(purchase), {
            customer,
            transactionId: purchase.id,
            lastCheckedAt: purchase.lastCheckedAt,
          }),
        ),
      };
    });

    const purchase = Effect.fn("Operations.purchase")(function* (
      purchaseId: string,
      actor: Viewer,
    ) {
      yield* requireAdministrator(actor);

      const [row] = yield* execute(() =>
        purchaseQuery().where(eq(purchases.id, purchaseId)).limit(1),
      );

      if (row === undefined) return yield* new NotFound({ message: "Compra no encontrada." });

      return {
        ...describePurchase(row.purchase),
        customer: row.customer,
        transactionId: row.purchase.id,
        lastCheckedAt: row.purchase.lastCheckedAt,
      };
    });

    const findPurchase = Effect.fn("Operations.findPurchase")(function* (
      buyOrder: string,
      actor: Viewer,
    ) {
      yield* requireAdministrator(actor);

      const [row] = yield* execute(() =>
        db
          .select({ id: purchases.id })
          .from(purchases)
          .where(eq(purchases.buyOrder, buyOrder.trim()))
          .limit(1),
      );

      return row?.id ?? null;
    });

    const listVouchers = Effect.fn("Operations.vouchers")(function* (
      scope: VoucherScope,
      cursor: string | null,
      actor: Viewer,
    ) {
      yield* requireAdministrator(actor);
      const before = yield* beforeCursor(cursor, vouchers.issuedAt, vouchers.id);
      let filter: SQL | undefined;

      switch (scope.kind) {
        case "all":
          break;
        case "source":
          filter = eq(vouchers.source, scope.source);
          break;
        case "customer":
          filter = eq(vouchers.userId, scope.customerId);
          break;
        case "purchase":
          filter = eq(vouchers.purchaseId, scope.purchaseId);
          break;
      }

      const rows = yield* execute(() =>
        voucherQuery()
          .where(and(before, filter))
          .orderBy(desc(vouchers.issuedAt), desc(vouchers.id))
          .limit(pageSize + 1),
      );

      const page = yield* pageOf(rows, ({ voucher }) => ({ at: voucher.issuedAt, id: voucher.id }));
      const now = yield* Clock.currentTimeMillis;

      return {
        ...page,
        items: page.items.map(({ voucher, customer, issuedBy }) =>
          Object.assign(describeVoucher(voucher, now), {
            revision: voucher.revision,
            category: voucher.category,
            issuanceReason: voucher.issuanceReason,
            customer,
            issuedBy,
          }),
        ),
      };
    });

    const voucher = Effect.fn("Operations.voucher")(function* (code: string, actor: Viewer) {
      yield* requireAdministrator(actor);

      const [row] = yield* execute(() =>
        voucherQuery().where(eq(vouchers.code, code.trim())).limit(1),
      );

      if (row === undefined) return null;
      const now = yield* Clock.currentTimeMillis;

      return {
        ...describeVoucher(row.voucher, now),
        revision: row.voucher.revision,
        category: row.voucher.category,
        issuanceReason: row.voucher.issuanceReason,
        customer: row.customer,
        issuedBy: row.issuedBy,
      };
    });

    const history = Effect.fn("Operations.history")(function* (
      voucherId: string,
      cursor: string | null,
      actor: Viewer,
    ) {
      yield* requireAdministrator(actor);
      const before = yield* beforeCursor(cursor, voucherEvents.at, voucherEvents.id);

      const rows = yield* execute(() =>
        db
          .select({
            id: voucherEvents.id,
            kind: voucherEvents.kind,
            at: voucherEvents.at,
            reason: voucherEvents.reason,
            actor: user.email,
          })
          .from(voucherEvents)
          .innerJoin(user, eq(user.id, voucherEvents.actorId))
          .where(and(eq(voucherEvents.voucherId, voucherId), before))
          .orderBy(desc(voucherEvents.at), desc(voucherEvents.id))
          .limit(pageSize + 1),
      );

      return yield* pageOf(rows, (row) => ({ at: row.at, id: row.id }));
    });

    return {
      customers,
      purchases: listPurchases,
      purchase,
      findPurchase,
      vouchers: listVouchers,
      voucher,
      history,
    };
  }),
}) {
  static readonly layer = Layer.effect(Operations, Operations.make);
}
