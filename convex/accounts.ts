import { ConvexError, v } from "convex/values";
import { Effect } from "effect";
import { query } from "./_generated/server";
import { currentCustomer, requireAdministrator, requireCustomer } from "./lib/access";

export const viewer = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      id: v.id("users"),
      email: v.string(),
      role: v.union(v.literal("customer"), v.literal("administrator")),
    }),
  ),
  handler: (ctx) => Effect.runPromise(currentCustomer(ctx)),
});

export const get = query({
  args: { customerId: v.id("users") },
  returns: v.union(v.null(), v.object({ id: v.id("users"), email: v.string() })),
  handler: (ctx, { customerId }) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const requester = yield* requireCustomer(ctx);

        // Check ownership before looking up the requested record, including nonexistent IDs.
        if (requester.id !== customerId && requester.role !== "administrator") {
          return yield* Effect.fail(
            new ConvexError("No tienes permiso para consultar esta cuenta."),
          );
        }

        const customer = yield* Effect.promise(() => ctx.db.get(customerId));

        if (customer?.emailVerificationTime === undefined) return null;

        return { id: customer._id, email: customer.email };
      }),
    ),
});

export const administration = query({
  args: {},
  returns: v.object({ email: v.string() }),
  handler: (ctx) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const administrator = yield* requireAdministrator(ctx);

        return { email: administrator.email };
      }),
    ),
});
