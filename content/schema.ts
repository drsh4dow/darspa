import { Effect, Schema } from "effect";

const identity = Schema.String.check(Schema.isPattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/));

const nonEmptyText = Schema.Trim.check(Schema.isNonEmpty());

const localImage = Schema.String.check(
  Schema.isPattern(/^\/images\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp|gif|svg)$/),
);

// Preserve calendar validation (including leap years) and require an explicit timezone.
// DateTime's string decoder alone also accepts non-ISO and normalized invalid dates.
const isoDate =
  /(?:(?:\d\d[2468][048]|\d\d[13579][26]|\d\d0[48]|[02468][048]00|[13579][26]00)-02-29|\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\d|30)|02-(?:0[1-9]|1\d|2[0-8])))/;

const isoTime = /(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)/;

const publishedAt = Schema.String.check(
  Schema.isPattern(new RegExp(`^${isoDate.source}T${isoTime.source}$`), {
    expected: "an ISO timestamp with a timezone",
  }),
);

const offeringMetadata = Schema.Struct({
  id: identity,
  legacyId: Schema.optional(Schema.NonEmptyString),
  name: nonEmptyText,
  priceClp: Schema.Int.check(Schema.isGreaterThan(0)),
  available: Schema.Boolean,
  displayOrder: Schema.Natural.pipe(Schema.withDecodingDefault(Effect.succeed(0))),
  image: localImage,
  imageAlt: nonEmptyText,
});

const newsMetadata = Schema.Struct({
  slug: identity,
  legacyId: Schema.optional(Schema.NonEmptyString),
  title: nonEmptyText,
  publishedAt,
  image: Schema.NullOr(localImage),
  imageAlt: nonEmptyText,
});

export const decodeOfferingMetadata = Schema.decodeUnknownEffect(offeringMetadata, {
  onExcessProperty: "error",
});

export const decodeNewsMetadata = Schema.decodeUnknownEffect(newsMetadata, {
  onExcessProperty: "error",
});
