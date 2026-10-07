import { Effect } from "effect";
import { expect, test } from "vite-plus/test";
import catalog from "../content/generated/catalog.json";
import { BusinessError, Forbidden, NotFound, Unauthorized } from "../shared/contracts";
import { fixture } from "./testing";

const offering = catalog.find((entry) => entry.available);

if (offering === undefined) throw new Error("Published offering required by migration tests");

const issuance = {
  offeringId: offering.id,
  category: "external_payment" as const,
  reason: "Pago presencial sintético",
  requestId: "00000000-0000-4000-8000-000000000001",
};

test(
  "real Better Auth sessions authorize the shared API and D1 issuance is retry-safe",
  () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const backend = yield* fixture();
          const guest = yield* backend.client();
          expect(
            yield* guest.operations.issue({ payload: issuance }).pipe(Effect.flip),
          ).toBeInstanceOf(Unauthorized);

          const admin = yield* backend.signIn("admin@example.com", "administrator");
          const customer = yield* backend.signIn("customer@example.com");
          expect((yield* admin.api.account.viewer()).role).toBe("administrator");
          expect((yield* customer.api.account.viewer()).role).toBe("customer");
          const replay = yield* Effect.promise(() => backend.auth.handler(new Request(admin.link)));
          expect(
            replay.headers.getSetCookie().some((cookie) => cookie.includes("session_token=")),
          ).toBe(false);
          expect(
            yield* customer.api.operations.issue({ payload: issuance }).pipe(Effect.flip),
          ).toBeInstanceOf(Forbidden);

          const ids = yield* Effect.all(
            [
              admin.api.operations.issue({ payload: issuance }),
              admin.api.operations.issue({ payload: issuance }),
            ],
            { concurrency: 2 },
          );

          expect(ids[0]).toBe(ids[1]);

          const records = yield* admin.api.operations.vouchers({
            payload: { cursor: null, scope: { kind: "all" } },
          });

          expect(records.items).toHaveLength(1);
          expect(records.items[0]).toMatchObject({
            source: "manual",
            category: "external_payment",
            issuanceReason: issuance.reason,
            issuedBy: "admin@example.com",
          });
          const [voucher] = records.items;

          if (voucher === undefined) throw new Error("Issued voucher missing");
          expect(
            yield* customer.api.vouchers
              .get({ params: { voucherId: voucher.id } })
              .pipe(Effect.flip),
          ).toBeInstanceOf(NotFound);
          expect(
            yield* customer.api.vouchers
              .document({ params: { voucherId: voucher.id } })
              .pipe(Effect.flip),
          ).toBeInstanceOf(NotFound);
        }),
      ),
    ),
  30_000,
);

test(
  "concurrent redemption is atomic with its audit; stale corrections cannot consume a changed voucher",
  () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const backend = yield* fixture();
          const { api } = yield* backend.signIn("admin@example.com", "administrator");
          const voucherId = yield* api.operations.issue({ payload: issuance });
          const voucher = yield* api.vouchers.get({ params: { voucherId } });
          const input = { voucherId, revision: 0 };

          const outcomes = yield* Effect.all(
            [api.operations.redeem({ payload: input }), api.operations.redeem({ payload: input })],
            { concurrency: 2 },
          );

          expect(outcomes.toSorted()).toEqual(["already_redeemed", "redeemed"]);
          expect(
            (yield* api.operations.history({ params: { voucherId }, payload: { cursor: null } }))
              .items,
          ).toHaveLength(1);
          expect(
            yield* api.operations.reverse({
              payload: { voucherId, revision: 1, reason: "Corrección sintética" },
            }),
          ).toBe("reversed");
          expect(yield* api.operations.redeem({ payload: input })).toBe("stale");
          expect(yield* api.operations.voucher({ params: { code: voucher.code } })).toMatchObject({
            redeemed: false,
            revision: 2,
            expiresAt: voucher.expiresAt,
          });
          expect(
            (yield* api.operations.history({
              params: { voucherId },
              payload: { cursor: null },
            })).items
              .map((event) => event.kind)
              .toSorted(),
          ).toEqual(["redeemed", "reversed"]);
          yield* backend.advance(60 * 86_400_000 + 1);
          expect(yield* api.operations.redeem({ payload: { voucherId, revision: 2 } })).toBe(
            "expired",
          );
        }),
      ),
    ),
  30_000,
);

test(
  "a lost Webpay commit response recovers without a second charge or duplicate paid units",
  () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const backend = yield* fixture();
          const customer = yield* backend.signIn("customer@example.com");
          const other = yield* backend.signIn("other@example.com");

          const payload = {
            requestId: issuance.requestId,
            items: [{ offeringId: offering.id, expectedPriceClp: offering.priceClp, quantity: 2 }],
          };

          for (const item of [
            { offeringId: offering.id, expectedPriceClp: offering.priceClp + 1, quantity: 1 },
            { offeringId: "not-in-the-published-catalog", expectedPriceClp: 1, quantity: 1 },
          ]) {
            expect(
              yield* customer.api.purchases
                .start({ payload: { ...payload, items: [item] } })
                .pipe(Effect.flip),
            ).toBeInstanceOf(BusinessError);
          }

          const [purchaseId, retryId] = yield* Effect.all(
            [customer.api.purchases.start({ payload }), customer.api.purchases.start({ payload })],
            { concurrency: 2 },
          );

          expect(retryId).toBe(purchaseId);
          expect(
            yield* other.api.purchases.get({ params: { purchaseId } }).pipe(Effect.flip),
          ).toBeInstanceOf(NotFound);
          yield* backend.run({ kind: "payment", id: purchaseId });
          const purchase = yield* customer.api.purchases.get({ params: { purchaseId } });

          if (purchase.checkout === null) throw new Error("Checkout session missing");
          backend.webpay.loseNextCommit();
          expect(yield* backend.receiveReturn({ token_ws: purchase.checkout.token })).toBe(
            purchaseId,
          );
          yield* backend.run({ kind: "payment", id: purchaseId });
          expect((yield* customer.api.purchases.get({ params: { purchaseId } })).status).toBe(
            "unknown",
          );
          expect(yield* customer.api.purchases.vouchers({ params: { purchaseId } })).toHaveLength(
            0,
          );
          yield* backend.advance(3_600_000);
          yield* backend.recover;
          yield* Effect.all(
            [
              backend.run({ kind: "payment", id: purchaseId }),
              backend.run({ kind: "payment", id: purchaseId }),
            ],
            { concurrency: 2 },
          );
          expect(backend.webpay.commits).toBe(1);
          expect((yield* customer.api.purchases.get({ params: { purchaseId } })).status).toBe(
            "paid",
          );
          const vouchers = yield* customer.api.purchases.vouchers({ params: { purchaseId } });
          expect(vouchers).toHaveLength(2);
          expect(new Set(vouchers.map((voucher) => voucher.code)).size).toBe(2);

          for (const voucher of vouchers) {
            expect(voucher.terms.priceClp).toBe(offering.priceClp);
            expect(
              yield* other.api.vouchers
                .get({ params: { voucherId: voucher.id } })
                .pipe(Effect.flip),
            ).toBeInstanceOf(NotFound);
          }
        }),
      ),
    ),
  30_000,
);

test(
  "provider mismatches and forged returns never issue vouchers",
  () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const backend = yield* fixture();
          const { api } = yield* backend.signIn("customer@example.com");

          const purchaseId = yield* api.purchases.start({
            payload: {
              requestId: issuance.requestId,
              items: [
                { offeringId: offering.id, expectedPriceClp: offering.priceClp, quantity: 1 },
              ],
            },
          });

          yield* backend.run({ kind: "payment", id: purchaseId });
          const purchase = yield* api.purchases.get({ params: { purchaseId } });

          if (purchase.checkout === null) throw new Error("Checkout session missing");
          expect(
            yield* backend.receiveReturn({
              TBK_TOKEN: purchase.checkout.token,
              TBK_ORDEN_COMPRA: purchase.buyOrder,
              TBK_ID_SESION: "forged",
            }),
          ).toBeNull();
          backend.webpay.report(purchase.checkout.token, {
            status: "AUTHORIZED",
            response_code: 0,
            amount: purchase.totalClp + 1,
          });
          yield* backend.run({ kind: "payment", id: purchaseId });
          expect((yield* api.purchases.get({ params: { purchaseId } })).status).toBe("unknown");
          expect(yield* api.purchases.vouchers({ params: { purchaseId } })).toHaveLength(0);
        }),
      ),
    ),
  30_000,
);

test(
  "voucher PDF storage and durable email retries retain the same delivery identity",
  () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const backend = yield* fixture();
          const { api } = yield* backend.signIn("admin@example.com", "administrator");
          const voucherId = yield* api.operations.issue({ payload: issuance });
          const voucher = yield* api.vouchers.get({ params: { voucherId } });
          const url = yield* api.vouchers.document({ params: { voucherId } });
          expect(url).toBe(`https://darspa.test/documents/vouchers/${voucher.code}.pdf`);

          const document = yield* Effect.promise(() =>
            backend.bucket.get(`vouchers/${voucher.code}.pdf`),
          );

          if (document === null) throw new Error("Stored voucher PDF missing");
          const bytes = yield* Effect.promise(() => document.arrayBuffer());
          expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

          const input = {
            params: { voucherId },
            payload: { recipient: "gift@example.com", requestId: issuance.requestId },
          };

          const [deliveryId, retryId] = yield* Effect.all(
            [api.vouchers.send(input), api.vouchers.send(input)],
            { concurrency: 2 },
          );

          expect(retryId).toBe(deliveryId);
          backend.email.rejectNext();
          yield* backend.run({ kind: "delivery", id: deliveryId });
          expect((yield* api.vouchers.delivery({ params: { voucherId } }))?.status).toBe("queued");
          yield* backend.advance(180_000);
          yield* backend.recover;
          expect((yield* api.vouchers.delivery({ params: { voucherId } }))?.status).toBe(
            "accepted",
          );
          expect(
            backend.email.messages
              .filter((message) => message.to.includes("gift@example.com"))
              .map((message) => message.key),
          ).toEqual([`voucher/${deliveryId}`, `voucher/${deliveryId}`]);
        }),
      ),
    ),
  30_000,
);
