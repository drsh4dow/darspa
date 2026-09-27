import { Effect } from "effect";
import { expect, test } from "vite-plus/test";
import { decodeOfferingMetadata, decodeNewsMetadata } from "./schema";

const offering = {
  id: "masaje-relajacion",
  name: "Masaje de relajación",
  priceClp: 25000,
  available: true,
  image: "/images/terapias/relajacion.png",
  imageAlt: "Masaje de relajación",
};

const news = {
  slug: "nuevas-tecnicas",
  title: "Nuevas técnicas",
  publishedAt: "2024-02-29T10:30:00-03:00",
  image: null,
  imageAlt: "Nuevas técnicas",
};

test("catalog publication rejects ambiguous money and availability instead of coercing them", () => {
  for (const priceClp of [25000.5, "25000", 0, -1, Number.MAX_SAFE_INTEGER + 1]) {
    expect(() => Effect.runSync(decodeOfferingMetadata({ ...offering, priceClp }))).toThrow();
  }

  expect(() =>
    Effect.runSync(decodeOfferingMetadata({ ...offering, available: "false" })),
  ).toThrow();
  expect(Effect.runSync(decodeOfferingMetadata({ ...offering, available: false }))).toMatchObject({
    id: offering.id,
    priceClp: 25000,
    available: false,
  });
});

test("publication trims text, defaults display order and rejects unknown or empty metadata", () => {
  expect(Effect.runSync(decodeOfferingMetadata({ ...offering, name: "  Masaje  " }))).toMatchObject(
    {
      name: "Masaje",
      displayOrder: 0,
    },
  );

  expect(() => Effect.runSync(decodeOfferingMetadata({ ...offering, name: "  " }))).toThrow();
  expect(() => Effect.runSync(decodeOfferingMetadata({ ...offering, price: 25000 }))).toThrow();
  expect(() => Effect.runSync(decodeNewsMetadata({ ...news, draft: true }))).toThrow();
});

test("news requires real calendar dates and timezone-qualified ISO timestamps", () => {
  for (const publishedAt of ["2024-02-29T10:30:00-03:00", "2024-02-29T13:30:00.123Z"]) {
    expect(Effect.runSync(decodeNewsMetadata({ ...news, publishedAt })).publishedAt).toBe(
      publishedAt,
    );
  }

  for (const publishedAt of [
    "2023-02-29T10:30:00Z",
    "2024-04-31T10:30:00Z",
    "2024-02-29",
    "2024-02-29T10:30:00",
    "2024-02-29T10:30Z",
    "2024-02-29T24:00:00Z",
    "2024-02-29T10:30:00+24:00",
  ]) {
    expect(() => Effect.runSync(decodeNewsMetadata({ ...news, publishedAt }))).toThrow();
  }
});
