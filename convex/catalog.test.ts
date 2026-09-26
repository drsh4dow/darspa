import { convexTest } from "convex-test";
import { expect, test } from "vite-plus/test";
import catalog from "../content/generated/catalog.json";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("published catalog metadata survives the public backend contract unchanged", async () => {
  const backend = convexTest(schema, modules);
  const available = catalog.filter((offering) => offering.available);

  expect(await backend.query(api.catalog.list, {})).toEqual(available);

  for (const offering of catalog) {
    expect(await backend.query(api.catalog.get, { id: offering.id })).toEqual(offering);
  }

  expect(await backend.query(api.catalog.get, { id: "unknown-offering" })).toBeNull();
});
