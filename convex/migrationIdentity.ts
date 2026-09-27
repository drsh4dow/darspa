import { ConvexError, v } from "convex/values";
import { Effect } from "effect";
import { internalMutation } from "./_generated/server";
import { emailAddress } from "./lib/identity";

/** Launch's importer supplies verifiedEmail only when historical evidence establishes it.
 * A claimed email alone is deliberately insufficient. This imports identity mappings, not users,
 * sessions, privileges, or purchases. Legacy NextAuth sessions never migrate: customers sign in again.
 * Ambiguous identities stop rather than merge.
 */
export const register = internalMutation({
  args: { legacyId: v.string(), verifiedEmail: v.optional(v.string()) },
  returns: v.id("legacyIdentities"),
  handler: (ctx, { legacyId, verifiedEmail }) =>
    Effect.runPromise(
      Effect.gen(function* () {
        if (!legacyId.trim())
          return yield* Effect.fail(new ConvexError("A legacy identity is required."));

        const email =
          verifiedEmail === undefined
            ? undefined
            : yield* Effect.try(() => emailAddress.parse(verifiedEmail));

        const existing = yield* Effect.promise(() =>
          ctx.db
            .query("legacyIdentities")
            .withIndex("legacyId", (q) => q.eq("legacyId", legacyId))
            .unique(),
        );

        if (existing !== null) {
          if (existing.verifiedEmail !== email) {
            return yield* Effect.fail(
              new ConvexError("Legacy identity evidence changed; review required."),
            );
          }

          return existing._id;
        }

        if (email === undefined)
          return yield* Effect.promise(() => ctx.db.insert("legacyIdentities", { legacyId }));

        const duplicate = yield* Effect.promise(() =>
          ctx.db
            .query("legacyIdentities")
            .withIndex("verifiedEmail", (q) => q.eq("verifiedEmail", email))
            .unique(),
        );

        if (duplicate !== null) {
          return yield* Effect.fail(
            new ConvexError("Multiple legacy identities claim the same verified email."),
          );
        }

        const user = yield* Effect.promise(() =>
          ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", email))
            .filter((q) => q.neq(q.field("emailVerificationTime"), undefined))
            .unique(),
        );

        const id = yield* Effect.promise(() =>
          ctx.db.insert("legacyIdentities", { legacyId, verifiedEmail: email }),
        );

        if (user !== null) yield* Effect.promise(() => ctx.db.patch(id, { userId: user._id }));

        return id;
      }),
    ),
});
