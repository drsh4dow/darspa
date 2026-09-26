import { expect, test } from "vite-plus/test";
import { developmentTarget, ownedVariables, syncDevelopmentSecrets } from "./developmentSync";

const developmentKey = "dev:industrious-retriever-886|test-only";

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

test("reconciliation updates only owned development variables and skips unchanged values", async () => {
  const writes: Request[] = [];

  const request: typeof fetch = async (input, init) => {
    const incoming = new Request(input, init);

    if (incoming.method === "GET") {
      const url = new URL(incoming.url);
      expect(url.origin).toBe("https://app.infisical.com");
      expect(url.searchParams.get("environment")).toBe("dev");
      expect(url.searchParams.get("secretPath")).toBe("/convex");
      expect(url.searchParams.get("includeImports")).toBe("false");

      return Response.json({ secrets: sourceSecrets });
    }

    writes.push(incoming);

    return new Response(null, { status: 200 });
  };

  expect(await syncDevelopmentSecrets("test-token", developmentKey, {}, request)).toEqual({
    changed: true,
  });
  expect(writes).toHaveLength(1);
  expect(writes[0]?.url).toBe(
    `${developmentTarget.deploymentUrl}/api/update_environment_variables`,
  );
  expect(await writes[0]?.json()).toEqual({
    changes: ownedSecrets.map(({ secretKey, secretValue }) => ({
      name: secretKey,
      value: secretValue,
    })),
  });

  expect(
    await syncDevelopmentSecrets(
      "test-token",
      developmentKey,
      Object.fromEntries(
        ownedSecrets.map(({ secretKey, secretValue }) => [secretKey, secretValue]),
      ),
      request,
    ),
  ).toEqual({ changed: false });
  expect(writes).toHaveLength(1);
});

test.each([
  { secrets: [] },
  { secrets: sourceSecrets.slice(1) },
  { secrets: [...sourceSecrets, sourceSecrets[0]] },
  { secrets: sourceSecrets.map((secret) => ({ ...secret, environment: "prod" })) },
  { secrets: sourceSecrets.map((secret) => ({ ...secret, secretValueHidden: true })) },
])(
  "an incomplete or wrong-environment source cannot clear destination values: %j",
  async (body) => {
    const methods: string[] = [];

    const request: typeof fetch = async (input, init) => {
      methods.push(new Request(input, init).method);

      return Response.json(body);
    };

    await expect(
      syncDevelopmentSecrets("test-token", developmentKey, {}, request),
    ).rejects.toThrow();
    expect(methods).toEqual(["GET"]);
  },
);

test.each([
  publicJwks.replaceAll('"', '\\"'),
  JSON.stringify({ keys: [{ ...publicKey, d: "private-key-material" }] }),
])("invalid or private JWKS cannot replace working deployment configuration", async (jwks) => {
  const methods: string[] = [];

  const request: typeof fetch = async (input, init) => {
    methods.push(new Request(input, init).method);

    return Response.json({
      secrets: sourceSecrets.map((secret) => {
        if (secret.secretKey === "JWKS") return { ...secret, secretValue: jwks };

        return secret;
      }),
    });
  };

  await expect(syncDevelopmentSecrets("test-token", developmentKey, {}, request)).rejects.toThrow(
    "JWKS",
  );
  expect(methods).toEqual(["GET"]);
});

test("a production key is rejected before any network access", async () => {
  const requested: Request[] = [];

  const request: typeof fetch = async (input, init) => {
    requested.push(new Request(input, init));

    return Response.json({ secrets: sourceSecrets });
  };

  await expect(
    syncDevelopmentSecrets("test-token", "prod:other-deployment|test-only", {}, request),
  ).rejects.toThrow("designated development");
  expect(requested).toHaveLength(0);
});
