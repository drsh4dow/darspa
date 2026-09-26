import { ConvexError, v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { emailAddress } from "./lib/identity";

/** Launch's importer supplies verifiedEmail only when historical evidence establishes it.
 * A claimed email alone is deliberately insufficient. This imports identity mappings, not users,
 * sessions, privileges, or purchases. Legacy NextAuth sessions never migrate: customers sign in again.
 * Ambiguous identities stop rather than merge.
 */
export const register = internalMutation({
  args: { legacyId: v.string(), verifiedEmail: v.optional(v.string()) },
  handler: async (ctx, { legacyId, verifiedEmail }) => {
    if (!legacyId.trim()) throw new ConvexError("A legacy identity is required.");

    const email = verifiedEmail === undefined ? undefined : emailAddress.parse(verifiedEmail);

    const existing = await ctx.db
      .query("legacyIdentities")
      .withIndex("legacyId", (q) => q.eq("legacyId", legacyId))
      .unique();

    if (existing !== null) {
      if (existing.verifiedEmail !== email)
        throw new ConvexError("Legacy identity evidence changed; review required.");

      return existing._id;
    }

    if (email === undefined) return await ctx.db.insert("legacyIdentities", { legacyId });

    const duplicate = await ctx.db
      .query("legacyIdentities")
      .withIndex("verifiedEmail", (q) => q.eq("verifiedEmail", email))
      .unique();

    if (duplicate !== null)
      throw new ConvexError("Multiple legacy identities claim the same verified email.");

    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .filter((q) => q.neq(q.field("emailVerificationTime"), undefined))
      .unique();

    const id = await ctx.db.insert("legacyIdentities", { legacyId, verifiedEmail: email });

    if (user !== null) await ctx.db.patch(id, { userId: user._id });

    return id;
  },
});
