"use node";

import { NodeCrypto } from "@effect/platform-node";
import { v } from "convex/values";
import { Crypto, Effect } from "effect";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action } from "../_generated/server";
import { issuanceArgs } from "./model";

export const issue = action({
  args: issuanceArgs,
  returns: v.id("vouchers"),
  handler: (ctx, args): Promise<Id<"vouchers">> =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* Effect.promise(() => ctx.runQuery(api.accounts.administration, {}));
        const crypto = yield* Crypto.Crypto;
        const uuid = yield* crypto.randomUUIDv4.pipe(Effect.orDie);

        // Authorization is checked again inside the mutation, alongside issuance.
        return yield* Effect.promise(() =>
          ctx.runMutation(internal.vouchers.operations.issue, {
            ...args,
            code: uuid.replaceAll("-", ""),
          }),
        );
      }).pipe(
        // This action is the assembly point for cryptographically secure voucher identities.
        // oxlint-disable-next-line effecttsgo/strict-effect-provide
        Effect.provide(NodeCrypto.layer),
      ),
    ),
});
