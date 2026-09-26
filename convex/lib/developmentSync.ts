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

// One deliberately public marker is the entire allowlist for this slice.
const ownedVariable = "DARSPA_DEVELOPMENT_LABEL";

export async function syncDevelopmentLabel(
  infisicalToken: string,
  convexKey: string,
  currentLabel: string | undefined,
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

  const matches = parsed.data.secrets.filter((secret) => secret.secretKey === ownedVariable);
  const secret = matches[0];

  if (matches.length !== 1 || secret === undefined || secret.secretValue.trim().length === 0) {
    throw new Error("The owned development marker must exist exactly once and be nonempty");
  }

  if (secret.secretValue === currentLabel) return { changed: false };

  const update = await request(
    `${developmentTarget.deploymentUrl}/api/update_environment_variables`,
    {
      method: "POST",
      headers: { Authorization: `Convex ${convexKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ changes: [{ name: ownedVariable, value: secret.secretValue }] }),
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!update.ok) throw new Error(`Convex environment update failed (HTTP ${update.status})`);

  return { changed: true };
}
