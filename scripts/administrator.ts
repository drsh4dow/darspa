import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";
import { z } from "zod";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    deployment: { type: "string" },
    email: { type: "string" },
    operator: { type: "string" },
    reason: { type: "string" },
    help: { type: "boolean", short: "h" },
  },
});

if (values.help) {
  console.info(`Usage:
  vp run admin:grant --deployment <exact-name> --email <customer> --operator <email> --reason <text>
  vp run admin:revoke --deployment <exact-name> --email <customer> --operator <email> --reason <text>

Uses your authenticated Convex CLI session. The customer must have verified their email.
The deployment name must be explicit; dev/prod aliases are not accepted.
Operator is your declared audit identity, not an email attested by Convex.
Repeating an applied change is a no-op; retry against the same deployment if a response is lost.`);
  process.exit(0);
}

const options = z
  .object({
    deployment: z
      .string()
      .regex(/^[a-z]+(?:-[a-z]+)+-\d+$/, "Use the exact deployment name, not dev/prod aliases"),
    email: z.email(),
    operator: z.email(),
    reason: z.string().trim().min(1),
  })
  .parse(values);

const operation = z.enum(["grant", "revoke"]).parse(positionals[0]);

const role = operation === "grant" ? "administrator" : "customer";

console.info(
  `${operation}: ${options.email} on ${options.deployment}; operator ${options.operator}`,
);

// The installed CLI uses the operator's authenticated Convex session. No deploy keys in arguments.
const result = spawnSync(
  "vp",
  [
    "exec",
    "convex",
    "run",
    "administrators:setRole",
    JSON.stringify({
      email: options.email,
      operator: options.operator,
      reason: options.reason,
      role,
      deploymentUrl: `https://${options.deployment}.convex.cloud`,
    }),
    "--deployment",
    options.deployment,
  ],
  { stdio: "inherit" },
);

if (result.error) throw result.error;

process.exitCode = result.status ?? 1;
