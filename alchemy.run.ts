import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Command from "alchemy/Command";
import { retain } from "alchemy/RemovalPolicy";
import { localState } from "alchemy/State/LocalState";
import { Effect, Layer } from "effect";
import { Application } from "./infra/application";
import { dnsRecords } from "./infra/dns";

export default Alchemy.Stack(
  "darspa",
  { providers: Layer.mergeAll(Cloudflare.providers(), Command.providers()), state: localState() },
  Effect.gen(function* () {
    const stage = yield* Alchemy.Stage;
    const resolveCredentials = yield* Cloudflare.CloudflareEnvironment;
    const credentials = yield* resolveCredentials.pipe(Effect.orDie);

    if (
      (stage !== "prod" && stage !== "dev" && stage !== "local") ||
      credentials.accountId !== "608fec448e528dd49e20c25638b8b238"
    ) {
      return yield* Effect.die(
        new Error("Darspa requires the local, dev or prod stage and the Darspa account."),
      );
    }

    if (stage === "prod") {
      const zone = yield* Cloudflare.Zone.Zone("Domain", { name: "darspa.cl" });

      for (const { id, ...record } of dnsRecords) {
        yield* Cloudflare.DNS.Record(id, {
          ...record,
          zoneId: zone.zoneId,
          proxied: false,
          ttl: 300,
        }).pipe(retain());
      }
    }

    const application = yield* Application;
    let url = application.worker.url;

    if (stage === "local") {
      const frontend = yield* Command.Dev("Frontend", { command: "vp dev" });
      url = frontend.url;
    }

    return { url, databaseId: application.database.databaseId };
  }),
);
