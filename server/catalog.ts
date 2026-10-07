import { Effect } from "effect";
import { BusinessError } from "../shared/contracts";
import catalog from "../content/generated/catalog.json";

export const offerings = catalog.filter((offering) => offering.available);

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
