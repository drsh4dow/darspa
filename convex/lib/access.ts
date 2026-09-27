import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { Clock, Effect } from "effect";
import type { QueryCtx } from "../_generated/server";

export const currentCustomer = Effect.fnUntraced(function* (ctx: QueryCtx) {
  const userId = yield* Effect.promise(() => getAuthUserId(ctx));
  const sessionId = yield* Effect.promise(() => getAuthSessionId(ctx));

  if (userId === null || sessionId === null) return null;

  const session = yield* Effect.promise(() => ctx.db.get(sessionId));
  const now = yield* Clock.currentTimeMillis;

  if (session === null || session.userId !== userId || session.expirationTime <= now) return null;

  const user = yield* Effect.promise(() => ctx.db.get(userId));

  if (user?.emailVerificationTime === undefined) return null;

  return { id: user._id, email: user.email, role: user.role ?? "customer" };
});

export const requireCustomer = Effect.fnUntraced(function* (ctx: QueryCtx) {
  const customer = yield* currentCustomer(ctx);

  if (customer === null)
    return yield* Effect.fail(new ConvexError("Debes iniciar sesión para continuar."));

  return customer;
});

export const requireAdministrator = Effect.fnUntraced(function* (ctx: QueryCtx) {
  const customer = yield* requireCustomer(ctx);

  if (customer.role !== "administrator") {
    return yield* Effect.fail(new ConvexError("No tienes permiso para realizar esta acción."));
  }

  return customer;
});
