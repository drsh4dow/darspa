import { convexTest, type TestConvex } from "convex-test";
import { NodeCrypto } from "@effect/platform-node";
import { Clock, DateTime, Effect } from "effect";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import catalog from "../../content/generated/catalog.json";
import { processPayment } from "./processor";
import { Webpay, WebpayError } from "./webpay";
import type { ProviderResult } from "./model";

const modules = import.meta.glob("/convex/**/*.ts");

const instant = DateTime.toEpochMillis(DateTime.makeUnsafe("2026-03-01T12:00:00Z"));

const requestId = "00000000-0000-4000-8000-000000000001";

const offering = catalog.find((entry) => entry.available);

if (offering === undefined) throw new Error("Published offering required by checkout fixture");

const item = { offeringId: offering.id, expectedPriceClp: offering.priceClp, quantity: 2 };

const order = {
  items: [item],
  requestId,
  buyOrder: "synthetic-order",
  sessionId: "synthetic-session",
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(instant);
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

const signedInCustomer = Effect.fnUntraced(function* (
  backend: TestConvex<typeof schema>,
  email: string,
) {
  const run = Effect.runPromiseWith(yield* Effect.context());

  const user = yield* Effect.promise(() =>
    backend.run((ctx) =>
      run(
        Effect.gen(function* () {
          const userId = yield* Effect.promise(() =>
            ctx.db.insert("users", {
              email,
              emailVerificationTime: instant,
            }),
          );

          const sessionId = yield* Effect.promise(() =>
            ctx.db.insert("authSessions", { userId, expirationTime: instant + 86_400_000 }),
          );

          return { userId, sessionId };
        }),
      ),
    ),
  );

  return backend.withIdentity({ subject: `${user.userId}|${user.sessionId}` });
});

const fixture = Effect.fnUntraced(function* () {
  const backend = convexTest(schema, modules);
  const customer = yield* signedInCustomer(backend, "recipient@example.com");
  const other = yield* signedInCustomer(backend, "other@example.com");
  const store: Pick<TestConvex<typeof schema>, "action"> = backend;

  return { backend, customer, other, store };
});

function gateway() {
  let result: ProviderResult = {
    buy_order: order.buyOrder,
    session_id: order.sessionId,
    amount: item.expectedPriceClp * 2,
    status: "INITIALIZED",
  };

  let loseCommitResponse = false;

  const provider = Webpay.of({
    environment: "integration",
    create: () =>
      Effect.succeed({ token: "synthetic-token", url: "https://webpay3gint.transbank.cl/pay" }),
    status: () => Effect.succeed(result),
    commit: () =>
      Effect.suspend(() => {
        result = { ...result, status: "AUTHORIZED", response_code: 0 };

        if (loseCommitResponse)
          return Effect.fail(new WebpayError({ message: "Synthetic lost response" }));

        return Effect.succeed(result);
      }),
  });

  return {
    provider,
    authorize: () => {
      result = { ...result, status: "AUTHORIZED", response_code: 0 };
    },
    report: (next: ProviderResult) => {
      result = next;
    },
    loseResponse: () => {
      loseCommitResponse = true;
    },
  };
}

const drive = Effect.fnUntraced(function* (
  store: Pick<TestConvex<typeof schema>, "action">,
  transactionId: Id<"paymentTransactions">,
  provider: Webpay["Service"],
) {
  const run = Effect.runPromiseWith(yield* Effect.context());
  yield* Effect.promise(() =>
    store.action((ctx) =>
      run(
        processPayment(ctx, transactionId).pipe(
          Effect.provideService(Webpay, provider),
          // The native action harness supplies Convex; only Webpay is substituted.
          // oxlint-disable-next-line effecttsgo/strict-effect-provide
          Effect.provide(NodeCrypto.layer),
        ),
      ),
    ),
  );
});

test("checkout requires ownership, rejects changed/unavailable carts, and snapshots each paid unit", () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { backend, customer, other, store } = yield* fixture();
      yield* Effect.promise(() =>
        expect(backend.mutation(internal.purchasing.purchases.create, order)).rejects.toThrow(
          "iniciar sesión",
        ),
      );
      yield* Effect.promise(() =>
        expect(
          customer.mutation(internal.purchasing.purchases.create, {
            ...order,
            items: [{ ...item, expectedPriceClp: 1 }],
          }),
        ).rejects.toThrow("precio cambió"),
      );
      yield* Effect.promise(() =>
        expect(
          customer.mutation(internal.purchasing.purchases.create, {
            ...order,
            items: [{ ...item, offeringId: "withdrawn" }],
          }),
        ).rejects.toThrow("disponible"),
      );
      yield* Effect.promise(() =>
        expect(
          customer.mutation(internal.purchasing.purchases.create, {
            ...order,
            items: [{ ...item, quantity: 0.5 }],
          }),
        ).rejects.toThrow("cantidades"),
      );

      const purchaseId = yield* Effect.promise(() =>
        customer.mutation(internal.purchasing.purchases.create, order),
      );

      const repeated = yield* Effect.promise(() =>
        customer.mutation(internal.purchasing.purchases.create, order),
      );

      expect(repeated).toBe(purchaseId);
      const purchase = yield* Effect.promise(() => backend.run((ctx) => ctx.db.get(purchaseId)));

      if (purchase === null) throw new Error("Purchase missing");
      expect(purchase.totalClp).toBe(item.expectedPriceClp * 2);
      expect(purchase.lines[0]?.terms.description).toBe(offering.description);
      const fake = gateway();
      yield* drive(store, purchase.transactionId, fake.provider);
      fake.authorize();
      const run = Effect.runPromiseWith(yield* Effect.context());
      yield* Effect.promise(() =>
        Promise.all([
          run(drive(store, purchase.transactionId, fake.provider)),
          run(drive(store, purchase.transactionId, fake.provider)),
        ]),
      );
      yield* drive(store, purchase.transactionId, fake.provider);

      const vouchers = yield* Effect.promise(() =>
        customer.query(api.vouchers.vouchers.forPurchase, { purchaseId }),
      );

      expect(vouchers).toHaveLength(2);
      expect(new Set(vouchers.map((voucher) => voucher.code)).size).toBe(2);
      expect(vouchers.every((voucher) => voucher.issuedAt === instant)).toBe(true);
      yield* Effect.promise(() =>
        expect(other.query(api.purchasing.purchases.get, { purchaseId })).rejects.toThrow(
          "No puedes consultar esta compra",
        ),
      );
      const voucher = vouchers[0];

      if (voucher === undefined) throw new Error("Voucher missing");
      yield* Effect.promise(() =>
        expect(other.query(api.vouchers.vouchers.owned, { voucherId: voucher.id })).rejects.toThrow(
          "No puedes consultar este voucher",
        ),
      );
      yield* Effect.promise(() =>
        expect(
          other.mutation(api.vouchers.deliveries.request, {
            voucherId: voucher.id,
            recipient: "gift@example.com",
            requestId,
          }),
        ).rejects.toThrow("No puedes enviar este voucher"),
      );
      yield* Effect.promise(() =>
        expect(
          other.action(api.vouchers.documents.download, { voucherId: voucher.id }),
        ).rejects.toThrow("No puedes consultar este voucher"),
      );

      const otherHistory = yield* Effect.promise(() =>
        other.query(api.purchasing.purchases.history, {
          paginationOpts: { numItems: 10, cursor: null },
        }),
      );

      expect(otherHistory.page).toEqual([]);

      const deliveryId = yield* Effect.promise(() =>
        customer.mutation(api.vouchers.deliveries.request, {
          voucherId: voucher.id,
          recipient: "gift@example.com",
          requestId,
        }),
      );

      const sameDelivery = yield* Effect.promise(() =>
        customer.mutation(api.vouchers.deliveries.request, {
          voucherId: voucher.id,
          recipient: "gift@example.com",
          requestId,
        }),
      );

      expect(sameDelivery).toBe(deliveryId);

      const claim = yield* Effect.promise(() =>
        backend.mutation(internal.vouchers.deliveries.claim, { deliveryId }),
      );

      if (claim === null) throw new Error("Delivery claim missing");
      yield* Effect.promise(() =>
        backend.mutation(internal.vouchers.deliveries.finish, {
          deliveryId,
          lease: claim.lease,
          providerId: null,
        }),
      );

      const afterFailure = yield* Effect.promise(() =>
        customer.query(api.purchasing.purchases.get, { purchaseId }),
      );

      expect(afterFailure.status).toBe("paid");
      expect(
        yield* Effect.promise(() =>
          customer.query(api.vouchers.vouchers.forPurchase, { purchaseId }),
        ),
      ).toEqual(vouchers);
    }),
  ));

test("an interrupted action releases its lease; an old provider decline stays declined", () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { backend, customer, store } = yield* fixture();

      const purchaseId = yield* Effect.promise(() =>
        customer.mutation(internal.purchasing.purchases.create, order),
      );

      const purchase = yield* Effect.promise(() => backend.run((ctx) => ctx.db.get(purchaseId)));

      if (purchase === null) throw new Error("Purchase missing");
      const fake = gateway();
      yield* drive(store, purchase.transactionId, fake.provider);
      yield* Effect.promise(() =>
        backend.mutation(internal.purchasing.transactions.claim, {
          transactionId: purchase.transactionId,
        }),
      );
      fake.report({
        buy_order: order.buyOrder,
        session_id: order.sessionId,
        amount: item.expectedPriceClp * 2,
        status: "FAILED",
        response_code: -1,
      });
      yield* drive(store, purchase.transactionId, fake.provider);
      expect(
        (yield* Effect.promise(() => customer.query(api.purchasing.purchases.get, { purchaseId })))
          .status,
      ).toBe("pending");
      vi.setSystemTime(instant + 3_600_000);
      yield* drive(store, purchase.transactionId, fake.provider);
      expect(
        (yield* Effect.promise(() => customer.query(api.purchasing.purchases.get, { purchaseId })))
          .status,
      ).toBe("declined");
      expect(
        yield* Effect.promise(() =>
          customer.query(api.vouchers.vouchers.forPurchase, { purchaseId }),
        ),
      ).toHaveLength(0);
    }),
  ));

test("a lost commit response remains unknown and status reconciliation issues vouchers once", () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { backend, customer, store } = yield* fixture();

      const purchaseId = yield* Effect.promise(() =>
        customer.mutation(internal.purchasing.purchases.create, order),
      );

      const purchase = yield* Effect.promise(() => backend.run((ctx) => ctx.db.get(purchaseId)));

      if (purchase === null) throw new Error("Purchase missing");
      const fake = gateway();
      yield* drive(store, purchase.transactionId, fake.provider);
      fake.loseResponse();
      yield* Effect.promise(() =>
        backend.mutation(internal.purchasing.returns.receive, { token_ws: "synthetic-token" }),
      );
      yield* drive(store, purchase.transactionId, fake.provider);
      expect(
        (yield* Effect.promise(() => customer.query(api.purchasing.purchases.get, { purchaseId })))
          .status,
      ).toBe("unknown");
      expect(
        yield* Effect.promise(() =>
          customer.query(api.vouchers.vouchers.forPurchase, { purchaseId }),
        ),
      ).toHaveLength(0);
      yield* drive(store, purchase.transactionId, fake.provider);
      expect(
        (yield* Effect.promise(() => customer.query(api.purchasing.purchases.get, { purchaseId })))
          .status,
      ).toBe("paid");
      expect(
        yield* Effect.promise(() =>
          customer.query(api.vouchers.vouchers.forPurchase, { purchaseId }),
        ),
      ).toHaveLength(2);
    }),
  ));

test.each([
  { status: "AUTHORIZED", response_code: 0, amount: 1, expected: "unknown" },
  {
    status: "AUTHORIZED",
    response_code: -1,
    amount: item.expectedPriceClp * 2,
    expected: "unknown",
  },
  { status: "FAILED", response_code: -1, amount: item.expectedPriceClp * 2, expected: "declined" },
])("provider $status/$response_code/$amount cannot invent value", (result) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { backend, customer, store } = yield* fixture();

      const purchaseId = yield* Effect.promise(() =>
        customer.mutation(internal.purchasing.purchases.create, order),
      );

      const purchase = yield* Effect.promise(() => backend.run((ctx) => ctx.db.get(purchaseId)));

      if (purchase === null) throw new Error("Purchase missing");
      const fake = gateway();
      yield* drive(store, purchase.transactionId, fake.provider);
      fake.report({
        buy_order: order.buyOrder,
        session_id: order.sessionId,
        status: result.status,
        response_code: result.response_code,
        amount: result.amount,
      });
      yield* drive(store, purchase.transactionId, fake.provider);
      expect(
        (yield* Effect.promise(() => customer.query(api.purchasing.purchases.get, { purchaseId })))
          .status,
      ).toBe(result.expected);
      expect(
        yield* Effect.promise(() =>
          customer.query(api.vouchers.vouchers.forPurchase, { purchaseId }),
        ),
      ).toHaveLength(0);
    }),
  ),
);

test.each([
  { fields: { TBK_TOKEN: "synthetic-token" }, status: "aborted" },
  { fields: {}, status: "timed_out" },
  { fields: { TBK_TOKEN: "synthetic-token", token_ws: "synthetic-token" }, status: "pending" },
])("documented return without a normal success token: $status", (example) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { backend, customer, store } = yield* fixture();

      const purchaseId = yield* Effect.promise(() =>
        customer.mutation(internal.purchasing.purchases.create, order),
      );

      const purchase = yield* Effect.promise(() => backend.run((ctx) => ctx.db.get(purchaseId)));

      if (purchase === null) throw new Error("Purchase missing");
      const fake = gateway();
      yield* drive(store, purchase.transactionId, fake.provider);
      expect(
        yield* Effect.promise(() =>
          backend.mutation(internal.purchasing.returns.receive, {
            ...example.fields,
            TBK_ORDEN_COMPRA: order.buyOrder,
            TBK_ID_SESION: "wrong-session",
          }),
        ),
      ).toBeNull();
      yield* Effect.promise(() =>
        backend.mutation(internal.purchasing.returns.receive, {
          ...example.fields,
          TBK_ORDEN_COMPRA: order.buyOrder,
          TBK_ID_SESION: order.sessionId,
        }),
      );
      yield* drive(store, purchase.transactionId, fake.provider);
      expect(
        (yield* Effect.promise(() => customer.query(api.purchasing.purchases.get, { purchaseId })))
          .status,
      ).toBe(example.status);
      // A provider approval racing with an abort must still be recognized.
      fake.authorize();
      yield* drive(store, purchase.transactionId, fake.provider);
      expect(
        (yield* Effect.promise(() => customer.query(api.purchasing.purchases.get, { purchaseId })))
          .status,
      ).toBe("paid");
      expect(yield* Clock.currentTimeMillis).toBe(instant);
    }),
  ),
);
