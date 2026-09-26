import { ConvexError } from "convex/values";
import { z } from "zod";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

// Do not remove dots or +suffixes: those rules are not universal email semantics.
export const emailAddress = z.string().trim().toLowerCase().pipe(z.email());

export async function resolveCustomerIdentity(
  ctx: MutationCtx,
  identity: { email: string; verified: boolean; existingUserId: Id<"users"> | null },
) {
  const email = emailAddress.parse(identity.email);

  const existing =
    identity.existingUserId === null ? null : await ctx.db.get(identity.existingUserId);

  // A provider account cannot silently move an established customer's history to a new email.
  if (existing?.emailVerificationTime !== undefined && existing.email !== email) {
    throw new ConvexError("No pudimos verificar esta identidad. Contacta a Dar Spa.");
  }

  if (!identity.verified) {
    if (existing !== null) return existing._id;

    return await ctx.db.insert("users", { email });
  }

  const matches = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email))
    .filter((q) => q.neq(q.field("emailVerificationTime"), undefined))
    .take(2);

  if (matches.length > 1) throw new ConvexError("Esta identidad requiere revisión de Dar Spa.");

  const linked = matches[0];
  let userId = linked?._id ?? existing?._id;

  if (userId === undefined) {
    userId = await ctx.db.insert("users", { email, emailVerificationTime: Date.now() });
  } else if (linked === undefined) {
    await ctx.db.patch(userId, { email, emailVerificationTime: Date.now() });
  }

  const legacy = await ctx.db
    .query("legacyIdentities")
    .withIndex("verifiedEmail", (q) => q.eq("verifiedEmail", email))
    .unique();

  if (legacy !== null) {
    if (legacy.userId !== undefined && legacy.userId !== userId) {
      throw new ConvexError("Esta identidad histórica requiere revisión de Dar Spa.");
    }

    await ctx.db.patch(legacy._id, { userId });
  }

  return userId;
}
