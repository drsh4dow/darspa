import { convexTest, type TestConvex } from "convex-test";
import { DateTime, Effect } from "effect";
import { beforeEach, afterEach, expect, test, vi } from "vite-plus/test";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import catalog from "../../content/generated/catalog.json";

const modules = import.meta.glob("/convex/**/*.ts");

const now = DateTime.toEpochMillis(DateTime.makeUnsafe("2026-03-01T12:00:00Z"));

const expiry = DateTime.toEpochMillis(DateTime.makeUnsafe("2026-04-30T12:00:00Z"));

const offering = catalog.find((entry) => entry.available);

if (offering === undefined) throw new Error("Published offering required by staff fixture");

const issuance = {
  offeringId: offering.id,
  category: "external_payment" as const,
  reason: "Pago presencial sintético",
  requestId: "00000000-0000-4000-8000-000000000006",
};

const paginationOpts = { numItems: 2, cursor: null };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

const identity = Effect.fnUntraced(function* (
  backend: TestConvex<typeof schema>,
  role: "administrator" | "customer",
  email: string,
) {
  const run = Effect.runPromiseWith(yield* Effect.context());

  const ids = yield* Effect.promise(() =>
    backend.run((ctx) =>
      run(
        Effect.gen(function* () {
          const userId = yield* Effect.promise(() =>
            ctx.db.insert("users", { email, role, emailVerificationTime: now }),
          );

          const sessionId = yield* Effect.promise(() =>
            ctx.db.insert("authSessions", { userId, expirationTime: expiry + 86_400_000 }),
          );

          return { userId, sessionId };
        }),
      ),
    ),
  );

  return { client: backend.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }), ...ids };
});

const fixture = Effect.fnUntraced(function* () {
  const backend = convexTest(schema, modules);
  const admin = yield* identity(backend, "administrator", "administrator@example.com");
  const customer = yield* identity(backend, "customer", "recipient@example.com");

  return { backend, admin, customer };
});

const issue = Effect.fnUntraced(function* (client: Pick<TestConvex<typeof schema>, "action">) {
  return yield* Effect.promise(() => client.action(api.vouchers.issuance.issue, issuance));
});

test("staff records and mutations reject anonymous/customers, including guessed manual voucher IDs", () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { backend, admin, customer } = yield* fixture();
      const voucherId = yield* issue(admin.client);

      const voucher = yield* Effect.promise(() =>
        admin.client.query(api.vouchers.vouchers.accessible, { voucherId }),
      );

      for (const client of [backend, customer.client]) {
        yield* Effect.promise(() =>
          expect(
            client.query(api.operations.records.customers, { email: "", paginationOpts }),
          ).rejects.toThrow(),
        );
        yield* Effect.promise(() =>
          expect(
            client.query(api.operations.records.purchases, { paginationOpts }),
          ).rejects.toThrow(),
        );
        yield* Effect.promise(() =>
          expect(
            client.query(api.operations.records.findPurchase, { buyOrder: "synthetic" }),
          ).rejects.toThrow(),
        );
        yield* Effect.promise(() =>
          expect(
            client.query(api.operations.records.vouchers, {
              scope: { kind: "all" },
              paginationOpts,
            }),
          ).rejects.toThrow(),
        );
        yield* Effect.promise(() =>
          expect(
            client.query(api.operations.records.voucher, { code: voucher.code }),
          ).rejects.toThrow(),
        );
        yield* Effect.promise(() =>
          expect(
            client.query(api.operations.records.history, { voucherId, paginationOpts }),
          ).rejects.toThrow(),
        );
        yield* Effect.promise(() =>
          expect(client.action(api.vouchers.issuance.issue, issuance)).rejects.toThrow(),
        );
        yield* Effect.promise(() =>
          expect(
            client.mutation(internal.vouchers.operations.issue, {
              ...issuance,
              code: "a".repeat(32),
            }),
          ).rejects.toThrow(),
        );
        yield* Effect.promise(() =>
          expect(
            client.mutation(api.vouchers.operations.redeem, { voucherId, revision: 0 }),
          ).rejects.toThrow(),
        );
        yield* Effect.promise(() =>
          expect(
            client.mutation(api.vouchers.operations.reverse, {
              voucherId,
              revision: 0,
              reason: "Error",
            }),
          ).rejects.toThrow(),
        );
        yield* Effect.promise(() =>
          expect(client.query(api.vouchers.vouchers.accessible, { voucherId })).rejects.toThrow(),
        );
        yield* Effect.promise(() =>
          expect(client.action(api.vouchers.documents.download, { voucherId })).rejects.toThrow(),
        );
        yield* Effect.promise(() =>
          expect(client.query(api.vouchers.deliveries.latest, { voucherId })).rejects.toThrow(),
        );
        yield* Effect.promise(() =>
          expect(
            client.mutation(api.vouchers.deliveries.request, {
              voucherId,
              recipient: "gift@example.com",
              requestId: issuance.requestId,
            }),
          ).rejects.toThrow(),
        );
      }
    }),
  ));

test("manual issuance is attributable, retry-safe, accountless and creates no online payment", () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { backend, admin } = yield* fixture();

      const [first, repeated] = yield* Effect.promise(() =>
        Promise.all([
          admin.client.action(api.vouchers.issuance.issue, issuance),
          admin.client.action(api.vouchers.issuance.issue, issuance),
        ]),
      );

      expect(repeated).toBe(first);

      const voucher = yield* Effect.promise(() =>
        admin.client.query(api.vouchers.vouchers.accessible, { voucherId: first }),
      );

      expect(voucher.purchaseId).toBeNull();
      expect(voucher.code).toMatch(/^[a-f0-9]{32}$/);
      expect(voucher.issuedAt).toBe(now);
      expect(voucher.expiresAt).toBe(expiry);
      expect(voucher.terms.name).toBe(offering.name);

      const record = yield* Effect.promise(() =>
        admin.client.query(api.operations.records.voucher, { code: voucher.code }),
      );

      expect(record).toMatchObject({
        source: "manual",
        customer: null,
        category: "external_payment",
        issuanceReason: issuance.reason,
        issuedBy: "administrator@example.com",
        redeemed: false,
      });

      const purchases = yield* Effect.promise(() =>
        admin.client.query(api.operations.records.purchases, { paginationOpts }),
      );

      expect(purchases.page).toEqual([]);

      const payments = yield* Effect.promise(() =>
        backend.run((ctx) => ctx.db.query("paymentTransactions").take(1)),
      );

      expect(payments).toEqual([]);

      yield* Effect.promise(() =>
        expect(
          admin.client.action(api.vouchers.issuance.issue, { ...issuance, reason: "Otro motivo" }),
        ).rejects.toThrow("otra emisión"),
      );
      yield* Effect.promise(() =>
        expect(
          admin.client.action(api.vouchers.issuance.issue, { ...issuance, reason: "  " }),
        ).rejects.toThrow("motivo"),
      );
      yield* Effect.promise(() =>
        expect(
          admin.client.action(api.vouchers.issuance.issue, {
            ...issuance,
            requestId: "00000000-0000-4000-8000-000000000007",
            offeringId: "withdrawn",
          }),
        ).rejects.toThrow("disponible"),
      );

      const secondAdmin = yield* identity(backend, "administrator", "other-admin@example.com");

      const delivery = {
        voucherId: first,
        recipient: "gift@example.com",
        requestId: issuance.requestId,
      };

      const deliveryId = yield* Effect.promise(() =>
        secondAdmin.client.mutation(api.vouchers.deliveries.request, delivery),
      );

      expect(
        yield* Effect.promise(() =>
          secondAdmin.client.mutation(api.vouchers.deliveries.request, delivery),
        ),
      ).toBe(deliveryId);
      expect(
        yield* Effect.promise(() =>
          admin.client.query(api.vouchers.deliveries.latest, { voucherId: first }),
        ),
      ).toEqual({ recipient: "gift@example.com", status: "queued" });
      expect(
        yield* Effect.promise(() =>
          admin.client.query(api.vouchers.vouchers.accessible, { voucherId: first }),
        ),
      ).toEqual(voucher);
    }),
  ));

test("inspection is read-only; concurrent redemption consumes once and corrections retain history", () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { backend, admin } = yield* fixture();
      const secondAdmin = yield* identity(backend, "administrator", "other-admin@example.com");
      const voucherId = yield* issue(admin.client);

      const voucher = yield* Effect.promise(() =>
        admin.client.query(api.vouchers.vouchers.accessible, { voucherId }),
      );

      const inspected = yield* Effect.promise(() =>
        admin.client.query(api.operations.records.voucher, { code: voucher.code }),
      );

      expect(inspected?.redeemed).toBe(false);

      const outcomes = yield* Effect.promise(() =>
        Promise.all([
          admin.client.mutation(api.vouchers.operations.redeem, { voucherId, revision: 0 }),
          secondAdmin.client.mutation(api.vouchers.operations.redeem, { voucherId, revision: 0 }),
        ]),
      );

      expect(new Set(outcomes)).toEqual(new Set(["already_redeemed", "redeemed"]));
      yield* Effect.promise(() =>
        expect(
          admin.client.mutation(api.vouchers.operations.reverse, {
            voucherId,
            revision: 1,
            reason: "  ",
          }),
        ).rejects.toThrow("motivo"),
      );
      expect(
        yield* Effect.promise(() =>
          secondAdmin.client.mutation(api.vouchers.operations.reverse, {
            voucherId,
            revision: 1,
            reason: "Voucher equivocado",
          }),
        ),
      ).toBe("reversed");
      expect(
        yield* Effect.promise(() =>
          admin.client.mutation(api.vouchers.operations.redeem, { voucherId, revision: 0 }),
        ),
      ).toBe("stale");

      const history = yield* Effect.promise(() =>
        admin.client.query(api.operations.records.history, { voucherId, paginationOpts }),
      );

      expect(history.page).toHaveLength(2);
      expect(history.page[0]).toMatchObject({
        kind: "reversed",
        reason: "Voucher equivocado",
        actor: "other-admin@example.com",
        at: now,
      });
      expect(history.page[1]?.kind).toBe("redeemed");
      expect(
        yield* Effect.promise(() =>
          admin.client.query(api.vouchers.vouchers.accessible, { voucherId }),
        ),
      ).toEqual(voucher);
    }),
  ));

test.each([-1, 0, 1])("redemption honors the strict expiry boundary (%i ms)", (offset) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { admin } = yield* fixture();
      const voucherId = yield* issue(admin.client);
      vi.setSystemTime(expiry + offset);

      const outcome = yield* Effect.promise(() =>
        admin.client.mutation(api.vouchers.operations.redeem, { voucherId, revision: 0 }),
      );

      expect(outcome).toBe(offset > 0 ? "expired" : "redeemed");
    }),
  ),
);

test("reversing an expired historical redemption preserves expiry and does not invent its actor/time", () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { backend, admin } = yield* fixture();
      const voucherId = yield* issue(admin.client);
      // Import-like state: the legacy redeemed flag exists, but no trustworthy audit facts do.
      yield* Effect.promise(() =>
        backend.run((ctx) =>
          ctx.db.patch(voucherId, {
            redeemed: true,
            issuedBy: undefined,
            issuanceReason: undefined,
            category: undefined,
          }),
        ),
      );
      vi.setSystemTime(expiry + 1);
      expect(
        yield* Effect.promise(() =>
          admin.client.mutation(api.vouchers.operations.reverse, {
            voucherId,
            revision: 0,
            reason: "Corrección histórica",
          }),
        ),
      ).toBe("reversed");

      const voucher = yield* Effect.promise(() =>
        admin.client.query(api.vouchers.vouchers.accessible, { voucherId }),
      );

      expect(voucher).toMatchObject({
        redeemed: false,
        expired: true,
        issuedAt: now,
        expiresAt: expiry,
      });
      expect(
        yield* Effect.promise(() =>
          admin.client.mutation(api.vouchers.operations.redeem, { voucherId, revision: 1 }),
        ),
      ).toBe("expired");

      const history = yield* Effect.promise(() =>
        admin.client.query(api.operations.records.history, { voucherId, paginationOpts }),
      );

      expect(history.page).toHaveLength(1);
      expect(history.page[0]?.kind).toBe("reversed");
    }),
  ));

test("indexed staff lists paginate and isolate customer/source lookups", () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { admin, customer } = yield* fixture();
      yield* issue(admin.client);

      const customers = yield* Effect.promise(() =>
        admin.client.query(api.operations.records.customers, { email: "RECIP", paginationOpts }),
      );

      expect(customers.page).toEqual([{ id: customer.userId, email: "recipient@example.com" }]);

      const first = yield* Effect.promise(() =>
        admin.client.query(api.operations.records.customers, {
          email: "",
          paginationOpts: { numItems: 1, cursor: null },
        }),
      );

      const second = yield* Effect.promise(() =>
        admin.client.query(api.operations.records.customers, {
          email: "",
          paginationOpts: { numItems: 1, cursor: first.continueCursor },
        }),
      );

      expect(first.page[0]?.id).not.toBe(second.page[0]?.id);
      expect(
        yield* Effect.promise(() =>
          admin.client.query(api.operations.records.vouchers, {
            scope: { kind: "source", source: "webpay" },
            paginationOpts,
          }),
        ),
      ).toMatchObject({ page: [] });
      expect(
        yield* Effect.promise(() =>
          admin.client.query(api.operations.records.vouchers, {
            scope: { kind: "customer", customerId: customer.userId },
            paginationOpts,
          }),
        ),
      ).toMatchObject({ page: [] });

      const manual = yield* Effect.promise(() =>
        admin.client.query(api.operations.records.vouchers, {
          scope: { kind: "source", source: "manual" },
          paginationOpts,
        }),
      );

      expect(manual.page).toHaveLength(1);
    }),
  ));
