import { ConvexError, v } from "convex/values";
import { query } from "./_generated/server";
import { currentCustomer, requireAdministrator, requireCustomer } from "./lib/access";

export const viewer = query({
  args: {},
  handler: currentCustomer,
});

export const get = query({
  args: { customerId: v.id("users") },
  handler: async (ctx, { customerId }) => {
    const requester = await requireCustomer(ctx);

    // Check ownership before looking up the requested record, including nonexistent IDs.
    if (requester.id !== customerId && requester.role !== "administrator") {
      throw new ConvexError("No tienes permiso para consultar esta cuenta.");
    }

    const customer = await ctx.db.get(customerId);

    if (customer?.emailVerificationTime === undefined) return null;

    return { id: customer._id, email: customer.email };
  },
});

export const administration = query({
  args: {},
  handler: async (ctx) => {
    const administrator = await requireAdministrator(ctx);

    return { email: administrator.email };
  },
});
