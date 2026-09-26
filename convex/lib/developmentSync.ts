import { z } from "zod";

export const developmentTarget = {
  deploymentUrl: "https://industrious-retriever-886.convex.cloud",
  projectId: "b0bb221b-dffd-4c26-9600-6e5d9ea82205",
  environment: "dev",
  secretPath: "/convex",
} as const;

const responseSchema = z.object({
  secrets: z
    .array(
      z.object({
        secretKey: z.string(),
        secretValue: z.string(),
        secretValueHidden: z.literal(false),
        environment: z.literal(developmentTarget.environment),
        secretPath: z.literal(developmentTarget.secretPath),
      }),
    )
    .max(100),
});

const publicJwksSchema = z.strictObject({
  keys: z
    .array(
      z.strictObject({
        kty: z.literal("RSA"),
        use: z.literal("sig"),
        n: z.string().min(1),
        e: z.string().min(1),
        alg: z.optional(z.literal("RS256")),
        kid: z.optional(z.string()),
      }),
    )
    .min(1),
});

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

export async function syncDevelopmentSecrets(
  infisicalToken: string,
  convexKey: string,
  current: Partial<Record<OwnedVariable, string>>,
  request: typeof fetch,
) {
  if (!convexKey.startsWith("dev:industrious-retriever-886|")) {
    throw new Error("Secret sync requires the designated development deployment key");
  }

  const source = new URL("https://app.infisical.com/api/v4/secrets");
  source.search = new URLSearchParams({
    projectId: developmentTarget.projectId,
    environment: developmentTarget.environment,
    secretPath: developmentTarget.secretPath,
    expandSecretReferences: "false",
    includeImports: "false",
    includePersonalOverrides: "false",
    recursive: "false",
  }).toString();

  const response = await request(source, {
    headers: { Authorization: `Bearer ${infisicalToken}` },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) throw new Error(`Infisical read failed (HTTP ${response.status})`);

  const parsed = responseSchema.safeParse(await response.json());

  if (!parsed.success) throw new Error("Infisical returned an invalid development secret set");

  const changes: { name: OwnedVariable; value: string }[] = [];

  for (const name of ownedVariables) {
    const matches = parsed.data.secrets.filter((secret) => secret.secretKey === name);
    const secret = matches[0];

    if (matches.length !== 1 || secret === undefined || secret.secretValue.trim().length === 0) {
      throw new Error("Every owned development variable must exist exactly once and be nonempty");
    }

    if (name === "JWKS") {
      // This value is served publicly. Reject escaped JSON and private key fields before syncing.
      try {
        publicJwksSchema.parse(JSON.parse(secret.secretValue));
      } catch {
        throw new Error("JWKS must be JSON containing only public RSA signing keys");
      }
    }

    if (secret.secretValue !== current[name]) changes.push({ name, value: secret.secretValue });
  }

  if (changes.length === 0) return { changed: false };

  const update = await request(
    `${developmentTarget.deploymentUrl}/api/update_environment_variables`,
    {
      method: "POST",
      headers: { Authorization: `Convex ${convexKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ changes }),
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!update.ok) throw new Error(`Convex environment update failed (HTTP ${update.status})`);

  return { changed: true };
}
