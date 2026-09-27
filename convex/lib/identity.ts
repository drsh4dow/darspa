import { ConvexError } from "convex/values";
import { Clock, Effect, Schema } from "effect";
import { normalizedEmailAddress } from "../../shared/email";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export const resolveCustomerIdentity = Effect.fnUntraced(function* (
  ctx: MutationCtx,
  identity: { email: string; verified: boolean; existingUserId: Id<"users"> | null },
) {
  const email = yield* Schema.decodeEffect(normalizedEmailAddress)(identity.email);
  const existingId = identity.existingUserId;
  const existing = existingId === null ? null : yield* Effect.promise(() => ctx.db.get(existingId));

  // A provider account cannot silently move an established customer's history to a new email.
  if (existing?.emailVerificationTime !== undefined && existing.email !== email) {
    return yield* Effect.fail(
      new ConvexError("No pudimos verificar esta identidad. Contacta a Dar Spa."),
    );
  }

  if (!identity.verified) {
    if (existing !== null) return existing._id;

    return yield* Effect.promise(() => ctx.db.insert("users", { email }));
  }

  const matches = yield* Effect.promise(() =>
    ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .filter((q) => q.neq(q.field("emailVerificationTime"), undefined))
      .take(2),
  );

  if (matches.length > 1)
    return yield* Effect.fail(new ConvexError("Esta identidad requiere revisión de Dar Spa."));

  const linked = matches[0];
  const candidateId = linked?._id ?? existing?._id;
  const now = yield* Clock.currentTimeMillis;

  const userId =
    candidateId ??
    (yield* Effect.promise(() => ctx.db.insert("users", { email, emailVerificationTime: now })));

  if (candidateId !== undefined && linked === undefined) {
    yield* Effect.promise(() => ctx.db.patch(userId, { email, emailVerificationTime: now }));
  }

  const legacy = yield* Effect.promise(() =>
    ctx.db
      .query("legacyIdentities")
      .withIndex("verifiedEmail", (q) => q.eq("verifiedEmail", email))
      .unique(),
  );

  if (legacy !== null) {
    if (legacy.userId !== undefined && legacy.userId !== userId) {
      return yield* Effect.fail(
        new ConvexError("Esta identidad histórica requiere revisión de Dar Spa."),
      );
    }

    yield* Effect.promise(() => ctx.db.patch(legacy._id, { userId }));
  }

  return userId;
});
