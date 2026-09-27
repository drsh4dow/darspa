import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Effect, Schema } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { parseArgs } from "node:util";
import { z } from "zod";

const main = Effect.gen(function* () {
  const { values, positionals } = yield* Effect.try(() =>
    parseArgs({
      allowPositionals: true,
      options: {
        deployment: { type: "string" },
        email: { type: "string" },
        operator: { type: "string" },
        reason: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    }),
  );

  if (values.help) {
    yield* Console.log(`Usage:
  vp run admin:grant --deployment <exact-name> --email <customer> --operator <email> --reason <text>
  vp run admin:revoke --deployment <exact-name> --email <customer> --operator <email> --reason <text>

Uses your authenticated Convex CLI session. The customer must have verified their email.
The deployment name must be explicit; dev/prod aliases are not accepted.
Operator is your declared audit identity, not an email attested by Convex.
Repeating an applied change is a no-op; retry against the same deployment if a response is lost.`);

    return 0;
  }

  const options = yield* Effect.try(() =>
    z
      .object({
        deployment: z
          .string()
          .regex(/^[a-z]+(?:-[a-z]+)+-\d+$/, "Use the exact deployment name, not dev/prod aliases"),
        email: z.email(),
        operator: z.email(),
        reason: z.string().trim().min(1),
      })
      .parse(values),
  );

  const operation = yield* Effect.try(() => z.enum(["grant", "revoke"]).parse(positionals[0]));

  const role = operation === "grant" ? "administrator" : "customer";

  yield* Console.log(
    `${operation}: ${options.email} on ${options.deployment}; operator ${options.operator}`,
  );

  const payload = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Json))({
    email: options.email,
    operator: options.operator,
    reason: options.reason,
    role,
    deploymentUrl: `https://${options.deployment}.convex.cloud`,
  });

  // The installed CLI uses the operator's authenticated Convex session. No deploy keys in arguments.
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

  const exitCode = yield* spawner.exitCode(
    ChildProcess.make(
      "vp",
      [
        "exec",
        "convex",
        "run",
        "administrators:setRole",
        payload,
        "--deployment",
        options.deployment,
      ],
      { stdin: "inherit", stdout: "inherit", stderr: "inherit" },
    ),
  );

  process.exitCode = exitCode;

  return exitCode;
});

// This CLI entry point owns the lifetime of the Node services.
// oxlint-disable-next-line effecttsgo/strict-effect-provide
NodeRuntime.runMain(main.pipe(Effect.provide(NodeServices.layer)));
