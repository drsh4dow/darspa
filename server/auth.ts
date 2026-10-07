import { betterAuth, APIError } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { Config, Context, Crypto, Effect, Encoding, Layer, Redacted, Schema } from "effect";
import type { HttpClient } from "effect/unstable/http";
import { HttpServerRequest } from "effect/unstable/http";
import { Authentication, CurrentUser, Unauthorized, viewer } from "../shared/contracts";
import { normalizedEmailAddress } from "../shared/email";
import { Database } from "./db/database";
import * as schema from "./db/schema";
import { sendEmail } from "./lib/email";
import { signInEmail, signInLinkLifetimeMinutes } from "./lib/signInEmail";

export class Auth extends Context.Service<Auth>()("darspa/Auth", {
  make: Effect.gen(function* () {
    const db = yield* Database;

    const config = yield* Config.all({
      origin: Config.schema(Schema.URL, "SITE_URL"),
      secret: Config.schema(
        Schema.Redacted(Schema.String.check(Schema.isMinLength(32))),
        "BETTER_AUTH_SECRET",
      ),
      googleId: Config.String("AUTH_GOOGLE_ID"),
      googleSecret: Config.Redacted("AUTH_GOOGLE_SECRET"),
    });

    const context = yield* Effect.context<HttpClient.HttpClient | Crypto.Crypto>();

    const run = Effect.runPromiseWith(context);

    return betterAuth({
      appName: "Dar Spa",
      baseURL: config.origin.href,
      secret: Redacted.value(config.secret),
      trustedOrigins: [config.origin.origin],
      database: drizzleAdapter(db, { provider: "sqlite", schema, transaction: false }),
      user: {
        additionalFields: {
          role: {
            type: ["customer", "administrator"],
            required: true,
            defaultValue: "customer",
            input: false,
          },
        },
      },
      account: { accountLinking: { enabled: true, allowDifferentEmails: false } },
      socialProviders: {
        google: {
          clientId: config.googleId,
          clientSecret: Redacted.value(config.googleSecret),
          mapProfileToUser(profile) {
            if (!profile.email_verified)
              throw new APIError("UNAUTHORIZED", { message: "Google debe verificar tu correo." });

            return run(
              Schema.decodeEffect(normalizedEmailAddress)(profile.email).pipe(
                Effect.map((email) => ({ email })),
              ),
            );
          },
        },
      },
      rateLimit: {
        enabled: true,
        storage: "database",
        window: 60,
        max: 100,
        customRules: { "/sign-in/magic-link": { window: 60, max: 3 } },
      },
      advanced: { ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] } },
      plugins: [
        magicLink({
          expiresIn: signInLinkLifetimeMinutes * 60,
          storeToken: "hashed",
          sendMagicLink: ({ email, url, token }) =>
            run(
              Effect.gen(function* () {
                const crypto = yield* Crypto.Crypto;

                const fingerprint = yield* crypto.digest(
                  "SHA-256",
                  new TextEncoder().encode(token),
                );

                yield* sendEmail({
                  to: email,
                  ...signInEmail(new URL(url), config.origin),
                  idempotencyKey: `sign-in/${Encoding.encodeHex(fingerprint)}`,
                });
              }),
            ),
        }),
      ],
      // Provider errors may include authentication links; the Worker logs only safe failures.
      logger: { disabled: true },
    });
  }),
}) {
  static readonly layer = Layer.effect(Auth, Auth.make);
}

export const AuthenticationLive = Layer.effect(
  Authentication,
  Effect.gen(function* () {
    const auth = yield* Auth;

    return Authentication.of(
      Effect.fn("authenticate")(function* (next) {
        const request = yield* HttpServerRequest.HttpServerRequest;

        const session = yield* Effect.tryPromise(() =>
          auth.api.getSession({
            headers: new Headers(request.headers),
            query: { disableRefresh: true },
          }),
        ).pipe(
          Effect.mapError(() => new Unauthorized({ message: "Ingresa nuevamente a tu cuenta." })),
        );

        if (session === null || !session.user.emailVerified)
          return yield* new Unauthorized({ message: "Ingresa a tu cuenta." });

        const customer = yield* Schema.decodeEffect(viewer)({
          id: session.user.id,
          email: session.user.email,
          role: session.user.role,
        }).pipe(Effect.orDie);

        return yield* Effect.provideService(next, CurrentUser, customer);
      }),
    );
  }),
);
