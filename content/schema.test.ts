import { expect, test } from "vite-plus/test";
import { offeringMetadata } from "./schema";

const offering = {
  id: "masaje-relajacion",
  name: "Masaje de relajación",
  priceClp: 25000,
  available: true,
  image: "/images/terapias/relajacion.png",
  imageAlt: "Masaje de relajación",
};

test("catalog publication rejects ambiguous money and availability instead of coercing them", () => {
  for (const priceClp of [25000.5, "25000", 0, -1, Number.MAX_SAFE_INTEGER + 1]) {
    expect(offeringMetadata.safeParse({ ...offering, priceClp }).success).toBe(false);
  }

  expect(offeringMetadata.safeParse({ ...offering, available: "false" }).success).toBe(false);
  expect(offeringMetadata.parse({ ...offering, available: false })).toMatchObject({
    id: offering.id,
    priceClp: 25000,
    available: false,
  });
});
