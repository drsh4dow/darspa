import { v } from "convex/values";
import { Config, Effect, Option, Schema, type Redacted } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { internalAction } from "./_generated/server";
import {
  developmentTarget,
  ownedVariables,
  SecretSyncError,
  syncDevelopmentSecrets,
} from "./lib/developmentSync";

// Infisical's Convex app connection manages access keys, not runtime secret synchronization.
export const reconcileDevelopment = internalAction({
  args: {},
  returns: v.object({ changed: v.boolean() }),
  handler: () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const deployment = yield* Config.String("CONVEX_CLOUD_URL");

        if (deployment !== developmentTarget.deploymentUrl) {
          return yield* new SecretSyncError({
            message: "Development secret sync cannot run on another deployment",
          });
        }

        const { token, key } = yield* Config.all({
          token: Config.schema(Schema.Redacted(Schema.NonEmptyString), "INFISICAL_SYNC_TOKEN"),
          key: Config.schema(Schema.Redacted(Schema.NonEmptyString), "INFISICAL_SYNC_CONVEX_KEY"),
        }).pipe(
          Effect.mapError(
            () =>
              new SecretSyncError({ message: "Development secret sync credentials are missing" }),
          ),
        );

        const current = new Map<(typeof ownedVariables)[number], Redacted.Redacted>();

        for (const name of ownedVariables) {
          const value = yield* Config.Redacted(name).pipe(Config.option);

          if (Option.isSome(value)) current.set(name, value.value);
        }

        return yield* syncDevelopmentSecrets(token, key, current).pipe(
          // Provider errors can contain secret response bodies. The next cron tick retries.
          Effect.mapError(
            () =>
              new SecretSyncError({
                message:
                  "Development secret sync failed. Next cron tick will reconcile against Infisical.",
              }),
          ),
        );
      }).pipe(
        // Convex invokes this action as an entry point; no layer escapes the request.
        // oxlint-disable-next-line effecttsgo/strict-effect-provide
        Effect.provide(FetchHttpClient.layer),
      ),
    ),
});
