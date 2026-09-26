import { ConvexError, v } from "convex/values";
import { query } from "./_generated/server";
import catalog from "../content/generated/catalog.json";

const offering = v.object({
  id: v.string(),
  legacyId: v.optional(v.string()),
  name: v.string(),
  priceClp: v.number(),
  available: v.boolean(),
  displayOrder: v.number(),
  image: v.string(),
  imageAlt: v.string(),
  description: v.string(),
  html: v.string(),
});

// Compiled from repository Markdown before backend deployment. There is no catalog
// mutation or independently editable database copy. Checkout must call this helper
// inside its mutation and snapshot the returned terms, never accept browser prices.
export function requirePublishedOffering(id: string) {
  const published = catalog.find((item) => item.id === id);

  if (!published?.available) {
    throw new ConvexError("El servicio ya no está disponible para nuevas compras.");
  }

  return published;
}

export const list = query({
  args: {},
  returns: v.array(offering),
  handler: () => catalog.filter((item) => item.available),
});

export const get = query({
  args: { id: v.string() },
  returns: v.union(offering, v.null()),
  handler: (_ctx, { id }) => catalog.find((item) => item.id === id) ?? null,
});
