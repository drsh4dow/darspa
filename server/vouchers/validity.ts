import { DateTime } from "effect";

/** Legacy Vercel uses UTC (no TZ override). Preserve its setDate(+60) calendar rule,
 * not Chilean wall-clock arithmetic or end-of-day rounding. Display is independent.
 */
export function expirationFrom(issuedAt: DateTime.Utc) {
  return DateTime.toEpochMillis(DateTime.add(issuedAt, { days: 60 }));
}

export function isExpired(expiresAt: number, now: number) {
  return now > expiresAt;
}
