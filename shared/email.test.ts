import { Effect, Schema } from "effect";
import { expect, test } from "vite-plus/test";
import { emailAddress, normalizedEmailAddress } from "./email";

const decodeEmail = Schema.decodeEffect(emailAddress);

const decodeNormalizedEmail = Schema.decodeEffect(normalizedEmailAddress);

test("identity normalization preserves dots and plus suffixes", () => {
  expect(Effect.runSync(decodeNormalizedEmail("  First.Last+Spa@Example.COM  "))).toBe(
    "first.last+spa@example.com",
  );
  expect(Effect.runSync(decodeEmail("First.Last+Spa@Example.COM"))).toBe(
    "First.Last+Spa@Example.COM",
  );
});

test("email syntax rejects malformed addresses rather than repairing them", () => {
  for (const email of [
    "",
    "missing-at",
    "person@localhost",
    ".person@example.com",
    "a..b@example.com",
    "a b@example.com",
  ]) {
    expect(() => Effect.runSync(decodeNormalizedEmail(email))).toThrow();
  }

  expect(() => Effect.runSync(decodeEmail(" person@example.com "))).toThrow();
});
