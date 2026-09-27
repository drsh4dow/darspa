import { DateTime } from "effect";
import { expect, test } from "vite-plus/test";
import { expirationFrom, isExpired } from "./validity";

// Independently established with legacy addDays in TZ=UTC, matching Vercel.
// Both periods cross a Chilean daylight-saving change; Santiago arithmetic would
// move the expiration instant by an hour and violate historical compatibility.
test.each([
  ["2026-03-01T12:00:00.000Z", "2026-04-30T12:00:00.000Z"],
  ["2026-08-01T12:00:00.000Z", "2026-09-30T12:00:00.000Z"],
  ["2024-01-01T23:59:59.999Z", "2024-03-01T23:59:59.999Z"],
])("60 UTC calendar days from %s expire at %s", (issued, expected) => {
  const expiration = expirationFrom(DateTime.makeUnsafe(issued));
  expect(expiration).toBe(DateTime.toEpochMillis(DateTime.makeUnsafe(expected)));
  expect(isExpired(expiration, expiration - 1)).toBe(false);
  expect(isExpired(expiration, expiration)).toBe(false);
  expect(isExpired(expiration, expiration + 1)).toBe(true);
});
