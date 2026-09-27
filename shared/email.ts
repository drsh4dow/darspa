import { Schema, SchemaTransformation } from "effect";

// Preserve the existing email policy; this is syntax validation, not proof of ownership.
export const emailAddress = Schema.String.check(
  Schema.isPattern(
    /^(?:[A-Za-z0-9_'+-]+\.)*[A-Za-z0-9_'+-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/,
    { expected: "an email address" },
  ),
);

// Do not remove dots or +suffixes: those rules are not universal email semantics.
export const normalizedEmailAddress = Schema.Trim.pipe(
  Schema.decodeTo(emailAddress, SchemaTransformation.toLowerCase()),
);
