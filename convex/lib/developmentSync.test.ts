import { expect, test } from "vite-plus/test";
import { developmentTarget, syncDevelopmentLabel } from "./developmentSync";

const developmentKey = "dev:industrious-retriever-886|test-only";

const sourceSecrets = [
  {
    secretKey: "DARSPA_DEVELOPMENT_LABEL",
    secretValue: "Prueba de sincronización",
    secretValueHidden: false,
    environment: "dev",
    secretPath: "/convex",
  },
  {
    secretKey: "UNRELATED_SECRET",
    secretValue: "Must not be copied",
    secretValueHidden: false,
    environment: "dev",
    secretPath: "/convex",
  },
];

test("reconciliation updates only the owned development variable and skips unchanged values", async () => {
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

  expect(await syncDevelopmentLabel("test-token", developmentKey, "Previous", request)).toEqual({
    changed: true,
  });
  expect(writes).toHaveLength(1);
  expect(writes[0]?.url).toBe(
    `${developmentTarget.deploymentUrl}/api/update_environment_variables`,
  );
  expect(await writes[0]?.json()).toEqual({
    changes: [{ name: "DARSPA_DEVELOPMENT_LABEL", value: "Prueba de sincronización" }],
  });

  expect(
    await syncDevelopmentLabel("test-token", developmentKey, "Prueba de sincronización", request),
  ).toEqual({ changed: false });
  expect(writes).toHaveLength(1);
});

test.each([
  { secrets: [] },
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
      syncDevelopmentLabel("test-token", developmentKey, "Previous", request),
    ).rejects.toThrow();
    expect(methods).toEqual(["GET"]);
  },
);

test("a production key is rejected before any network access", async () => {
  const requested: Request[] = [];

  const request: typeof fetch = async (input, init) => {
    requested.push(new Request(input, init));

    return Response.json({ secrets: sourceSecrets });
  };

  await expect(
    syncDevelopmentLabel("test-token", "prod:other-deployment|test-only", undefined, request),
  ).rejects.toThrow("designated development");
  expect(requested).toHaveLength(0);
});
