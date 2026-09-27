import { ConvexError, v } from "convex/values";
import { Config, Effect } from "effect";
import { internalMutation } from "./_generated/server";
import { emailAddress } from "./lib/identity";

// Internal functions require deployment credentials, not an application user's token.
// Operator is the deployment operator's declared audit identity, not an end-user claim.
export const setRole = internalMutation({
  args: {
    email: v.string(),
    role: v.union(v.literal("customer"), v.literal("administrator")),
    operator: v.string(),
    reason: v.string(),
    deploymentUrl: v.string(),
  },
  returns: v.object({ changed: v.boolean() }),
  handler: (ctx, args) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const deploymentUrl = yield* Config.String("CONVEX_CLOUD_URL");

        if (args.deploymentUrl !== deploymentUrl) {
          return yield* Effect.fail(
            new ConvexError("The selected deployment does not match the requested target."),
          );
        }

        const email = yield* Effect.try(() => emailAddress.parse(args.email));
        const operator = yield* Effect.try(() => emailAddress.parse(args.operator));
        const reason = args.reason.trim();

        if (!reason) return yield* Effect.fail(new ConvexError("A reason is required."));

        const user = yield* Effect.promise(() =>
          ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", email))
            .filter((q) => q.neq(q.field("emailVerificationTime"), undefined))
            .unique(),
        );

        if (user === null)
          return yield* Effect.fail(
            new ConvexError("The customer must sign in and verify their email first."),
          );

        const from = user.role ?? "customer";

        if (from === args.role) return { changed: false };

        yield* Effect.promise(() => ctx.db.patch(user._id, { role: args.role }));
        yield* Effect.promise(() =>
          ctx.db.insert("roleChanges", {
            userId: user._id,
            from,
            to: args.role,
            operator,
            reason,
            deploymentUrl: args.deploymentUrl,
          }),
        );

        return { changed: true };
      }),
    ),
});
