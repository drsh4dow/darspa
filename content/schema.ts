import { z } from "zod";

const identity = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const localImage = z
  .string()
  .regex(/^\/images\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp|gif|svg)$/);

export const offeringMetadata = z.strictObject({
  id: identity,
  legacyId: z.string().min(1).optional(),
  name: z.string().trim().min(1),
  priceClp: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  available: z.boolean(),
  displayOrder: z.number().int().nonnegative().default(0),
  image: localImage,
  imageAlt: z.string().trim().min(1),
});

export const newsMetadata = z.strictObject({
  slug: identity,
  legacyId: z.string().min(1).optional(),
  title: z.string().trim().min(1),
  publishedAt: z.iso.datetime({ offset: true }),
  image: localImage.nullable(),
  imageAlt: z.string().trim().min(1),
});
