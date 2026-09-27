import Google from "@auth/core/providers/google";
import Resend from "@auth/core/providers/resend";
import { convexAuth } from "@convex-dev/auth/server";
import { Clock, Config, Effect, Schema } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import type { MutationCtx } from "./_generated/server";
import { developmentTarget } from "./lib/developmentSync";
import { checkDevelopmentRecipient, sendEmail } from "./lib/email";
import { normalizedEmailAddress } from "../shared/email";
import { resolveCustomerIdentity } from "./lib/identity";
import { signInEmail, signInLinkLifetimeMinutes } from "./lib/signInEmail";
import { runConvex } from "./lib/runtime";

class AuthenticationError extends Schema.TaggedError<AuthenticationError>()("AuthenticationError", {
  message: Schema.String,
}) {}

const googleIdentity = Schema.Struct({
  sub: Schema.NonEmptyString,
  email: normalizedEmailAddress,
  email_verified: Schema.Literal(true),
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google({
      // Google's email_verified claim must be true, not merely a claimed address.
      profile(rawProfile) {
        return runConvex(
          Schema.decodeUnknownEffect(googleIdentity)(rawProfile).pipe(
            Effect.map((profile) => ({
              id: profile.sub,
              email: profile.email,
              emailVerified: true,
            })),
          ),
        );
      },
    }),
    Resend({
      maxAge: signInLinkLifetimeMinutes * 60,
      sendVerificationRequest({ identifier, url, token }) {
        return runConvex(
          Effect.gen(function* () {
            const digest = yield* Effect.promise(() =>
              crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
            );

            const fingerprint = Array.from(new Uint8Array(digest), (byte) =>
              byte.toString(16).padStart(2, "0"),
            ).join("");

            const assetOrigin = yield* Config.schema(Schema.URL, "CONVEX_SITE_URL");

            yield* sendEmail({
              ...signInEmail(new URL(url), assetOrigin),
              to: identifier,
              idempotencyKey: `sign-in/${fingerprint}`,
            });
          }).pipe(
            // Auth owns this callback's lifetime; provide transport only at this boundary.
            // oxlint-disable-next-line effecttsgo/strict-effect-provide
            Effect.provide(FetchHttpClient.layer),
          ),
        );
      },
    }),
  ],
  callbacks: {
    redirect({ redirectTo }) {
      return runConvex(
        Effect.gen(function* () {
          const site = yield* Config.schema(Schema.URL, "SITE_URL");
          const destination = yield* Effect.try(() => new URL(redirectTo, site));
          const allowed = [site.origin];
          const deployment = yield* Config.String("CONVEX_CLOUD_URL").pipe(Config.withDefault(""));

          if (deployment === developmentTarget.deploymentUrl) {
            allowed.push("http://localhost:5173");
          }

          if (!allowed.includes(destination.origin) || destination.pathname !== "/mi-cuenta") {
            return yield* new AuthenticationError({
              message: "Destino de autenticación no permitido.",
            });
          }

          return destination.href;
        }),
      );
    },
    createOrUpdateUser(ctx: MutationCtx, { existingUserId, profile, type }) {
      return runConvex(
        Effect.gen(function* () {
          const email = yield* Schema.decodeUnknownEffect(normalizedEmailAddress)(profile.email);
          yield* checkDevelopmentRecipient(email);

          const userId = yield* resolveCustomerIdentity(ctx, {
            email,
            verified: profile.emailVerified === true,
            existingUserId,
          });

          if (type === "email") {
            const user = yield* Effect.promise(() => ctx.db.get(userId));
            const now = yield* Clock.currentTimeMillis;

            if (user?.lastSignInEmailAt !== undefined && now - user.lastSignInEmailAt < 60_000) {
              return yield* new AuthenticationError({
                message: "Espera un minuto antes de pedir otro enlace.",
              });
            }

            yield* Effect.promise(() => ctx.db.patch(userId, { lastSignInEmailAt: now }));
          }

          return userId;
        }),
      );
    },
  },
});
