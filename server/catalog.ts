import { Effect } from "effect";
import { BusinessError, type offeringTerms } from "../shared/contracts";
import catalog from "../content/generated/catalog.json";

export const offerings = catalog.filter((offering) => offering.available);

// Offerings created after the legacy catalog have no legacyId; the key must then be absent.
export function termsOf(offering: (typeof catalog)[number]): typeof offeringTerms.Type {
  const terms = {
    offeringId: offering.id,
    name: offering.name,
    description: offering.description,
    priceClp: offering.priceClp,
  };

  return "legacyId" in offering && offering.legacyId !== undefined
    ? { ...terms, legacyId: offering.legacyId }
    : terms;
}

// Purchases snapshot these repository-owned terms, never browser-supplied prices.
export const requirePublishedOffering = Effect.fnUntraced(function* (id: string) {
  const offering = catalog.find((item) => item.id === id);

  if (!offering?.available) {
    return yield* new BusinessError({
      message: "El servicio ya no está disponible para nuevas compras.",
    });
  }

  return offering;
});
