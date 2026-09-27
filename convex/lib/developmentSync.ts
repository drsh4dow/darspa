import { Effect, Redacted, Schema } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";

export const developmentTarget = {
  deploymentUrl: "https://industrious-retriever-886.convex.cloud",
  projectId: "b0bb221b-dffd-4c26-9600-6e5d9ea82205",
  environment: "dev",
  secretPath: "/convex",
} as const;

const responseSchema = Schema.Struct({
  secrets: Schema.Array(
    Schema.Struct({
      secretKey: Schema.String,
      secretValue: Schema.String,
      secretValueHidden: Schema.Literal(false),
      environment: Schema.Literal(developmentTarget.environment),
      secretPath: Schema.Literal(developmentTarget.secretPath),
    }),
  ).check(Schema.isMaxLength(100)),
});

const publicJwksSchema = Schema.fromJsonString(
  Schema.Struct({
    keys: Schema.Array(
      Schema.Struct({
        kty: Schema.Literal("RSA"),
        use: Schema.Literal("sig"),
        n: Schema.NonEmptyString,
        e: Schema.NonEmptyString,
        alg: Schema.optionalKey(Schema.Literal("RS256")),
        kid: Schema.optionalKey(Schema.String),
      }),
    ).check(Schema.isMinLength(1)),
  }),
);

export const ownedVariables = [
  "DARSPA_DEVELOPMENT_LABEL",
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "RESEND_API_KEY",
  "AUTH_EMAIL_FROM",
  "JWT_PRIVATE_KEY",
  "JWKS",
  "SITE_URL",
  "DEVELOPMENT_EMAIL_RECIPIENT",
] as const;

type OwnedVariable = (typeof ownedVariables)[number];

export class SecretSyncError extends Schema.TaggedError<SecretSyncError>()("SecretSyncError", {
  message: Schema.String,
}) {}

export const syncDevelopmentSecrets = Effect.fnUntraced(function* (
  infisicalToken: Redacted.Redacted,
  convexKey: Redacted.Redacted,
  current: ReadonlyMap<OwnedVariable, Redacted.Redacted>,
) {
  if (!Redacted.value(convexKey).startsWith("dev:industrious-retriever-886|")) {
    return yield* new SecretSyncError({
      message: "Secret sync requires the designated development deployment key",
    });
  }

  const client = yield* HttpClient.HttpClient;

  const parsed = yield* client
    .get("https://app.infisical.com/api/v4/secrets", {
      headers: { Authorization: `Bearer ${Redacted.value(infisicalToken)}` },
      urlParams: {
        projectId: developmentTarget.projectId,
        environment: developmentTarget.environment,
        secretPath: developmentTarget.secretPath,
        expandSecretReferences: "false",
        includeImports: "false",
        includePersonalOverrides: "false",
        recursive: "false",
      },
    })
    .pipe(
      Effect.flatMap(HttpClientResponse.filterStatusOk),
      Effect.flatMap(HttpClientResponse.schemaBodyJson(responseSchema)),
      Effect.timeout("10 seconds"),
      Effect.mapError(
        () =>
          new SecretSyncError({
            message: "Infisical returned an invalid development secret set or could not be read",
          }),
      ),
    );

  const changes: { name: OwnedVariable; value: string }[] = [];

  for (const name of ownedVariables) {
    const matches = parsed.secrets.filter((secret) => secret.secretKey === name);
    const secret = matches[0];

    if (matches.length !== 1 || secret === undefined || secret.secretValue.trim().length === 0) {
      return yield* new SecretSyncError({
        message: "Every owned development variable must exist exactly once and be nonempty",
      });
    }

    if (name === "JWKS") {
      // This value is served publicly. Reject escaped JSON and private key fields before syncing.
      yield* Schema.decodeEffect(publicJwksSchema, { onExcessProperty: "error" })(
        secret.secretValue,
      ).pipe(
        Effect.mapError(
          () =>
            new SecretSyncError({
              message: "JWKS must be JSON containing only public RSA signing keys",
            }),
        ),
      );
    }

    const previous = current.get(name);

    if (previous === undefined || secret.secretValue !== Redacted.value(previous)) {
      changes.push({ name, value: secret.secretValue });
    }
  }

  if (changes.length === 0) return { changed: false };

  yield* HttpClientRequest.post(
    `${developmentTarget.deploymentUrl}/api/update_environment_variables`,
  ).pipe(
    HttpClientRequest.setHeader("Authorization", `Convex ${Redacted.value(convexKey)}`),
    HttpClientRequest.bodyJson({ changes }),
    Effect.flatMap(client.execute),
    Effect.flatMap(HttpClientResponse.filterStatusOk),
    Effect.timeout("10 seconds"),
    Effect.mapError(() => new SecretSyncError({ message: "Convex environment update failed" })),
  );

  return { changed: true };
});
