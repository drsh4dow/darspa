import * as d1 from "@distilled.cloud/cloudflare/d1";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { AuthProviders } from "alchemy/Auth";
import * as Cloudflare from "alchemy/Cloudflare";
import { Clock, ConfigProvider, Console, Crypto, Effect, Layer, Schema } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { parseArgs } from "node:util";
import { viewer } from "../shared/contracts.ts";
import { normalizedEmailAddress } from "../shared/email.ts";

const administratorOptions = Schema.Struct({
  database: Schema.String.check(Schema.isUUID()),
  email: normalizedEmailAddress,
  operator: normalizedEmailAddress,
  reason: Schema.Trim.check(Schema.isNonEmpty(), Schema.isMaxLength(1000)),
});

const customer = Schema.Struct({
  id: Schema.String,
  role: viewer.fields.role,
  emailVerified: Schema.Literals([0, 1]),
});

const decodeCustomers = Schema.decodeUnknownEffect(Schema.Array(customer));

class AdministratorError extends Schema.TaggedError<AdministratorError>()("AdministratorError", {
  message: Schema.String,
}) {}

const setRole = Effect.fn("Administrator.setRole")(function* (
  options: typeof administratorOptions.Type,
  role: typeof customer.Type.role,
) {
  const credentials = yield* yield* Cloudflare.CloudflareEnvironment;

  if (credentials.accountId !== "608fec448e528dd49e20c25638b8b238")
    return yield* new AdministratorError({
      message: "Administrator changes require the Darspa account.",
    });

  const target = { accountId: credentials.accountId, databaseId: options.database };
  const database = yield* d1.getDatabase(target);

  if (database.name !== "darspa-dev" && database.name !== "darspa-prod")
    return yield* new AdministratorError({
      message: "The database is not a Darspa application deployment.",
    });

  yield* Console.log(
    `${role}: ${options.email} on ${database.name} (${options.database}); operator ${options.operator}`,
  );

  const select = "SELECT id, role, emailVerified FROM user WHERE email = ?";
  const current = yield* d1.queryDatabase({ ...target, sql: select, params: [options.email] });
  const [account] = yield* decodeCustomers(current.result[0]?.results);

  if (account === undefined || account.emailVerified !== 1)
    return yield* new AdministratorError({
      message: "The customer must first sign in and verify their email.",
    });

  const id = yield* (yield* Crypto.Crypto).randomUUIDv4;
  const at = yield* Clock.currentTimeMillis;

  const result = yield* d1.queryDatabase({
    ...target,
    batch: [
      {
        sql: `INSERT INTO roleChanges (id, userId, "from", "to", operator, reason, at)
          SELECT ?, id, role, ?, ?, ?, ? FROM user
          WHERE id = ? AND email = ? AND emailVerified = 1 AND role != ?`,
        params: [id, role, options.operator, options.reason, at, account.id, options.email, role],
      },
      {
        sql: `UPDATE user SET role = ?, updatedAt = ?
          WHERE id = ? AND email = ? AND emailVerified = 1 AND role != ?`,
        params: [role, at, account.id, options.email, role],
      },
      { sql: select, params: [options.email] },
    ],
  });

  const [updated] = yield* decodeCustomers(result.result[2]?.results);

  if (updated?.role !== role || updated.emailVerified !== 1)
    return yield* new AdministratorError({
      message: "The account changed during the operation; inspect it before retrying.",
    });

  const write = yield* Schema.decodeUnknownEffect(
    Schema.Struct({
      success: Schema.Literal(true),
      meta: Schema.Struct({ changes: Schema.Int }),
    }),
  )(result.result[1]);

  return yield* Console.log(
    write.meta.changes === 0
      ? "Already applied; no audit entry added."
      : `Applied; audit entry ${id}.`,
  );
});

const main = Effect.gen(function* () {
  const { values, positionals } = yield* Effect.try(() =>
    parseArgs({
      allowPositionals: true,
      options: {
        database: { type: "string" },
        email: { type: "string" },
        operator: { type: "string" },
        reason: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    }),
  );

  if (values.help) {
    yield* Console.log(`Usage:
  vp run admin:grant --database <D1 UUID> --email <customer> --operator <email> --reason <text>
  vp run admin:revoke --database <D1 UUID> --email <customer> --operator <email> --reason <text>

Uses the local Alchemy 'darspa' profile, not ambient deployment credentials.
The database UUID must be explicit and belong to darspa-dev or darspa-prod.
The customer must have verified their email. Role changes and their audit entries are atomic.
Operator is your declared audit identity, not an email attested by Cloudflare.
Repeating an applied change is a no-op; retry against the same database if a response is lost.`);

    return;
  }

  const options = yield* Schema.decodeUnknownEffect(administratorOptions)(values);

  const operation = yield* Schema.decodeUnknownEffect(Schema.Literals(["grant", "revoke"]))(
    positionals[0],
  );

  const services = yield* Layer.build(
    Cloudflare.CloudflareApiLive().pipe(
      Layer.provideMerge(FetchHttpClient.layer),
      Layer.provideMerge(NodeServices.layer),
      Layer.provide(Layer.sync(AuthProviders, () => ({}))),
    ),
  ).pipe(
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromUnknown({ ALCHEMY_PROFILE: "darspa" }),
    ),
  );

  yield* setRole(options, operation === "grant" ? "administrator" : "customer").pipe(
    Effect.provideContext(services),
  );
});

NodeRuntime.runMain(main.pipe(Effect.scoped));
