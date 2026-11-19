import { Effect, Schema } from "effect";
import { expect, test } from "vite-plus/test";
import { offeringTerms } from "../shared/contracts";
import catalog from "../content/generated/catalog.json";
import { termsOf } from "./catalog";

const encode = Schema.encodeEffect(offeringTerms);

test("an offering without legacyId produces terms without that key", () => {
  const created = catalog.find((offering) => offering.id === "lipolaser-x-6");

  if (created === undefined) throw new Error("lipolaser-x-6 is missing from the catalog");

  const terms = termsOf(created);

  expect("legacyId" in terms).toBe(false);

  return Effect.runPromise(encode(terms)).then((encoded) => {
    expect(encoded.offeringId).toBe("lipolaser-x-6");
  });
});

test("an offering with legacyId keeps it in the terms", () => {
  const legacy = catalog.find((offering) => offering.id === "presoterapia-x3");

  if (legacy === undefined) throw new Error("presoterapia-x3 is missing from the catalog");

  expect(termsOf(legacy).legacyId).toBe("Y5OGKBAAACIA5lIM");
});
