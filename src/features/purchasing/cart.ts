// Schema-decoded snapshots are immutable; updates deliberately use copy-on-write.
/* oxlint-disable oxc/no-map-spread */
import { useSyncExternalStore } from "react";
import { Option, Schema } from "effect";

const cartSchema = Schema.fromJsonString(
  Schema.Struct({
    requestId: Schema.String,
    items: Schema.Array(
      Schema.Struct({
        offeringId: Schema.String,
        quantity: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 20 })),
        expectedPriceClp: Schema.Int.check(Schema.isGreaterThan(0)),
      }),
    ).check(Schema.isMaxLength(20)),
  }),
);

const key = "darspa-cart-v1";

let memory = "";

function snapshot() {
  try {
    return localStorage.getItem(key) ?? memory;
  } catch {
    return memory;
  }
}

function subscribe(notify: () => void) {
  window.addEventListener("storage", notify);
  window.addEventListener("darspa-cart", notify);

  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener("darspa-cart", notify);
  };
}

function save(items: typeof cartSchema.Type.items) {
  // Browser event boundary: native secure UUID, not deterministic business randomness.
  // oxlint-disable-next-line effecttsgo/crypto-random-uuid
  memory = JSON.stringify({ requestId: crypto.randomUUID(), items });

  try {
    localStorage.setItem(key, memory);
  } catch {
    /* Browsers denying storage retain the cart for this page session. */
  }

  window.dispatchEvent(new Event("darspa-cart"));
}

function parse(value: string): typeof cartSchema.Type {
  return Option.getOrElse(Schema.decodeOption(cartSchema)(value), () => ({
    requestId: "",
    items: [],
  }));
}

export function useCart() {
  const value = useSyncExternalStore(subscribe, snapshot, () => "");
  const cart = parse(value);

  return {
    ...cart,
    add(offeringId: string, priceClp: number) {
      const current = parse(snapshot());
      const units = current.items.reduce((total, item) => total + item.quantity, 0);

      if (units >= 20) return;
      const existing = current.items.find((item) => item.offeringId === offeringId);

      if (existing === undefined) {
        save([...current.items, { offeringId, quantity: 1, expectedPriceClp: priceClp }]);
      } else {
        save(
          current.items.map((item) =>
            item.offeringId === offeringId
              ? { ...item, quantity: Math.min(20, item.quantity + 1), expectedPriceClp: priceClp }
              : item,
          ),
        );
      }
    },
    setQuantity(offeringId: string, quantity: number) {
      const items = parse(snapshot()).items;

      if (quantity === 0) {
        save(items.filter((item) => item.offeringId !== offeringId));

        return;
      }

      save(items.map((item) => (item.offeringId === offeringId ? { ...item, quantity } : item)));
    },
    refreshPrices(prices: ReadonlyMap<string, number>) {
      const items = parse(snapshot()).items;

      save(
        items.map((item) => ({
          ...item,
          expectedPriceClp: prices.get(item.offeringId) ?? item.expectedPriceClp,
        })),
      );
    },
    clear() {
      save([]);
    },
    newAttempt() {
      save(parse(snapshot()).items);
    },
  };
}
