import { Effect, Redacted } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";
import { expect, test } from "vite-plus/test";
import { developmentTarget, ownedVariables, syncDevelopmentSecrets } from "./developmentSync";

const token = Redacted.make("test-token");

const developmentKey = Redacted.make("dev:industrious-retriever-886|test-only");

const publicKey = { kty: "RSA", use: "sig", n: "test-modulus", e: "AQAB" };

const publicJwks = JSON.stringify({ keys: [publicKey] });

const ownedSecrets = ownedVariables.map((name) => ({
  secretKey: name,
  secretValue: name === "JWKS" ? publicJwks : `test-${name}`,
  secretValueHidden: false,
  environment: "dev",
  secretPath: "/convex",
}));

const sourceSecrets = [
  ...ownedSecrets,
  {
    secretKey: "UNRELATED_SECRET",
    secretValue: "Must not be copied",
    secretValueHidden: false,
    environment: "dev",
    secretPath: "/convex",
  },
];

test("reconciliation updates only owned development variables and skips unchanged values", () => {
  const writes: Request[] = [];

  const client = HttpClient.make(
    Effect.fnUntraced(function* (request) {
      const incoming = yield* HttpClientRequest.toWeb(request).pipe(Effect.orDie);

      if (incoming.method === "GET") {
        const url = new URL(incoming.url);
        expect(url.origin).toBe("https://app.infisical.com");
        expect(url.searchParams.get("environment")).toBe("dev");
        expect(url.searchParams.get("secretPath")).toBe("/convex");
        expect(url.searchParams.get("includeImports")).toBe("false");

        return HttpClientResponse.fromWeb(request, Response.json({ secrets: sourceSecrets }));
      }

      writes.push(incoming);

      return HttpClientResponse.fromWeb(request, new Response(null, { status: 200 }));
    }),
  );

  return Effect.runPromise(
    Effect.gen(function* () {
      const first = yield* syncDevelopmentSecrets(token, developmentKey, new Map());
      expect(first).toEqual({ changed: true });
      expect(writes).toHaveLength(1);
      expect(writes[0]?.url).toBe(
        `${developmentTarget.deploymentUrl}/api/update_environment_variables`,
      );

      const outgoing = yield* Effect.fromNullishOr(writes[0]);
      const body: unknown = yield* Effect.promise(() => outgoing.json());
      expect(body).toEqual({
        changes: ownedSecrets.map(({ secretKey, secretValue }) => ({
          name: secretKey,
          value: secretValue,
        })),
      });

      const current = new Map(
        ownedSecrets.map(({ secretKey, secretValue }) => [secretKey, Redacted.make(secretValue)]),
      );

      const second = yield* syncDevelopmentSecrets(token, developmentKey, current);
      expect(second).toEqual({ changed: false });
      expect(writes).toHaveLength(1);
    }).pipe(Effect.provideService(HttpClient.HttpClient, client)),
  );
});

test.each([
  { secrets: [] },
  { secrets: sourceSecrets.slice(1) },
  { secrets: [...sourceSecrets, sourceSecrets[0]] },
  { secrets: sourceSecrets.map((secret) => ({ ...secret, environment: "prod" })) },
  { secrets: sourceSecrets.map((secret) => ({ ...secret, secretValueHidden: true })) },
])("an incomplete or wrong-environment source cannot clear destination values: %j", (body) => {
  const methods: string[] = [];

  const client = HttpClient.make((request) =>
    Effect.sync(() => {
      methods.push(request.method);

      return HttpClientResponse.fromWeb(request, Response.json(body));
    }),
  );

  return Effect.runPromise(
    Effect.gen(function* () {
      yield* Effect.flip(syncDevelopmentSecrets(token, developmentKey, new Map()));
      expect(methods).toEqual(["GET"]);
    }).pipe(Effect.provideService(HttpClient.HttpClient, client)),
  );
});

test.each([
  publicJwks.replaceAll('"', '\\"'),
  JSON.stringify({ keys: [{ ...publicKey, d: "private-key-material" }] }),
])("invalid or private JWKS cannot replace working deployment configuration", (jwks) => {
  const methods: string[] = [];

  const client = HttpClient.make((request) =>
    Effect.sync(() => {
      methods.push(request.method);

      return HttpClientResponse.fromWeb(
        request,
        Response.json({
          secrets: sourceSecrets.map((secret) => {
            if (secret.secretKey === "JWKS") return { ...secret, secretValue: jwks };

            return secret;
          }),
        }),
      );
    }),
  );

  return Effect.runPromise(
    Effect.gen(function* () {
      const error = yield* Effect.flip(syncDevelopmentSecrets(token, developmentKey, new Map()));
      expect(error.message).toContain("JWKS");
      expect(methods).toEqual(["GET"]);
    }).pipe(Effect.provideService(HttpClient.HttpClient, client)),
  );
});

test("a production key is rejected before any network access", () => {
  const requested: HttpClientRequest.HttpClientRequest[] = [];

  const client = HttpClient.make((request) =>
    Effect.sync(() => {
      requested.push(request);

      return HttpClientResponse.fromWeb(request, Response.json({ secrets: sourceSecrets }));
    }),
  );

  return Effect.runPromise(
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        syncDevelopmentSecrets(token, Redacted.make("prod:other-deployment|test-only"), new Map()),
      );

      expect(error.message).toContain("designated development");
      expect(requested).toHaveLength(0);
    }).pipe(Effect.provideService(HttpClient.HttpClient, client)),
  );
});
