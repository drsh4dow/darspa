import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";

export async function currentCustomer(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  const sessionId = await getAuthSessionId(ctx);

  if (userId === null || sessionId === null) return null;

  const session = await ctx.db.get(sessionId);

  if (session === null || session.userId !== userId || session.expirationTime <= Date.now())
    return null;

  const user = await ctx.db.get(userId);

  if (user?.emailVerificationTime === undefined) return null;

  return { id: user._id, email: user.email, role: user.role ?? "customer" };
}

export async function requireCustomer(ctx: QueryCtx) {
  const customer = await currentCustomer(ctx);

  if (customer === null) throw new ConvexError("Debes iniciar sesión para continuar.");

  return customer;
}

export async function requireAdministrator(ctx: QueryCtx) {
  const customer = await requireCustomer(ctx);

  if (customer.role !== "administrator")
    throw new ConvexError("No tienes permiso para realizar esta acción.");

  return customer;
}
