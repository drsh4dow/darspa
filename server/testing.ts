import { NodeCrypto, NodeFileSystem } from "@effect/platform-node";
import { migrate } from "drizzle-orm/d1/migrator";
import { eq } from "drizzle-orm";
import { ConfigProvider, Context, Effect, FileSystem, Layer, Match, Schema } from "effect";
import { TestClock } from "effect/testing";
import {
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
  HttpServer,
} from "effect/unstable/http";
import { HttpApiMiddleware, HttpApiTest } from "effect/unstable/httpapi";
import { Miniflare } from "miniflare";
import { Api } from "../shared/api";
import { Authentication, type ProviderResult } from "../shared/contracts";
import { Auth } from "./auth";
import { connect, Database } from "./db/database";
import { user } from "./db/schema";
import { AssetError, DocumentAssets } from "./documents/assets";
import { ApiHandlers } from "./http";
import { BackgroundJobs, recoverJobs, runJob, type Job } from "./jobs";
import { Webpay, WebpayError } from "./purchasing/webpay";
import { receiveWebpayReturn, type webpayReturn } from "./purchasing/returns";
import { Instagram } from "./instagram";
import { ApplicationLive } from "./runtime";
import { DocumentBucket } from "./vouchers/documents";

const mail = Schema.Struct({
  to: Schema.Array(Schema.String),
  text: Schema.String,
  attachments: Schema.optionalKey(
    Schema.Array(
      Schema.Struct({
        filename: Schema.String,
        content: Schema.String,
        content_type: Schema.String,
      }),
    ),
  ),
});

function mailbox() {
  const messages: (typeof mail.Type & { key: string | null })[] = [];
  let rejectNext = false;

  const client = HttpClient.make(
    Effect.fnUntraced(function* (request) {
      const outgoing = yield* HttpClientRequest.toWeb(request).pipe(Effect.orDie);
      const body = yield* Effect.promise(() => outgoing.json());
      const message = yield* Schema.decodeUnknownEffect(mail)(body).pipe(Effect.orDie);
      messages.push({ ...message, key: outgoing.headers.get("Idempotency-Key") });
      const status = rejectNext ? 503 : 200;
      rejectNext = false;

      return HttpClientResponse.fromWeb(
        request,
        Response.json({ id: "synthetic-message" }, { status }),
      );
    }),
  );

  return {
    client,
    messages,
    rejectNext: () => {
      rejectNext = true;
    },
  };
}

type GraphPost = {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
};

// A synthetic Instagram Graph API. It records the tokens it receives so tests can
// prove which credential the service used, and never calls Meta.
function graph() {
  const tokens: string[] = [];
  let renewals = 0;
  let posts: GraphPost[] = [];
  let mode: "ok" | "oauth" | "down" = "ok";
  let renewable = true;

  const client = HttpClient.make((request, url) => {
    const token = url.searchParams.get("access_token") ?? "";
    tokens.push(token);

    if (url.pathname === "/refresh_access_token") {
      renewals++;

      return Effect.succeed(
        HttpClientResponse.fromWeb(
          request,
          renewable
            ? Response.json({ access_token: `${token}+`, expires_in: 5_184_000 })
            : Response.json({ error: { code: 10 } }, { status: 400 }),
        ),
      );
    }

    const response = Match.value(mode).pipe(
      Match.when("oauth", () =>
        Response.json({ error: { code: 190, message: "secret-detail" } }, { status: 400 }),
      ),
      Match.when("down", () => new Response("unavailable", { status: 503 })),
      Match.when("ok", () => Response.json({ data: posts })),
      Match.exhaustive,
    );

    return Effect.succeed(HttpClientResponse.fromWeb(request, response));
  });

  return {
    client,
    tokens,
    get renewals() {
      return renewals;
    },
    publish: (next: GraphPost[]) => {
      posts = next;
    },
    mode: (next: typeof mode) => {
      mode = next;
    },
    renewable: (next: boolean) => {
      renewable = next;
    },
  };
}

function gateway() {
  const sessions = new Map<string, ProviderResult>();
  let loseNextCommit = false;
  let commits = 0;

  const read = (token: string) => {
    const result = sessions.get(token);

    if (result === undefined) throw new Error("Unknown synthetic payment token");

    return result;
  };

  const provider = Webpay.of({
    environment: "integration",
    create: (input) =>
      Effect.sync(() => {
        const token = `synthetic-token-${sessions.size + 1}`;
        sessions.set(token, {
          buy_order: input.buyOrder,
          session_id: input.sessionId,
          amount: input.amount,
          status: "INITIALIZED",
        });

        return { token, url: "https://webpay3gint.transbank.cl/pay" };
      }),
    status: (token) => Effect.sync(() => read(token)),
    commit: (token) =>
      Effect.suspend(() => {
        commits++;
        const result = { ...read(token), status: "AUTHORIZED", response_code: 0 };
        sessions.set(token, result);

        if (loseNextCommit) {
          loseNextCommit = false;

          return Effect.fail(new WebpayError({ message: "Synthetic lost provider response" }));
        }

        return Effect.succeed(result);
      }),
  });

  return {
    provider,
    get commits() {
      return commits;
    },
    report: (token: string, result: Partial<ProviderResult>) =>
      sessions.set(token, { ...read(token), ...result }),
    loseNextCommit: () => {
      loseNextCommit = true;
    },
  };
}

export const fixture = Effect.fnUntraced(function* () {
  const worker = yield* Effect.acquireRelease(
    Effect.sync(
      () =>
        new Miniflare({
          modules: true,
          script: "export default { fetch() { return new Response('test'); } }",
          d1Databases: ["DB"],
          r2Buckets: ["DOCUMENTS"],
        }),
    ),
    (resource) => Effect.promise(() => resource.dispose()),
  );

  const binding = yield* Effect.promise(() => worker.getD1Database("DB"));
  const bucket = yield* Effect.promise(() => worker.getR2Bucket("DOCUMENTS"));
  const db = connect(binding);
  yield* Effect.promise(() => migrate(db, { migrationsFolder: "server/db/migrations" }));
  const email = mailbox();
  const instagram = graph();
  const webpay = gateway();
  const jobs: Job[] = [];

  // Mutable so a test can change deployment settings, such as a reconnected token.
  const settings = {
    SITE_URL: "https://darspa.test",
    APP_ENVIRONMENT: "production",
    BETTER_AUTH_SECRET: "test-only-secret-not-used-outside-tests",
    AUTH_GOOGLE_ID: "test-google-client",
    AUTH_GOOGLE_SECRET: "test-google-secret",
    RESEND_API_KEY: "test-resend-key",
    AUTH_EMAIL_FROM: "Dar Spa <acceso@example.com>",
    WEBPAY_ENVIRONMENT: "integration",
    INSTAGRAM_ACCESS_TOKEN: "seed-token",
  };

  const platform = Layer.mergeAll(
    Layer.succeed(Database, db),
    Layer.succeed(DocumentBucket, bucket),
    Layer.succeed(Webpay, webpay.provider),
    Layer.succeed(
      HttpClient.HttpClient,
      HttpClient.make((request, url) =>
        (url.hostname === "graph.instagram.com" ? instagram.client : email.client).execute(request),
      ),
    ),
    Layer.succeed(
      BackgroundJobs,
      BackgroundJobs.of({
        schedule: (job) =>
          Effect.sync(() => {
            jobs.push(job);
          }),
      }),
    ),
    Layer.effect(
      DocumentAssets,
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;

        return DocumentAssets.of({
          read: (name) =>
            fs
              .readFile(`public/documents/templates/${name}.pdf`)
              .pipe(
                Effect.mapError(
                  () => new AssetError({ message: "Missing document template fixture" }),
                ),
              ),
        });
      }),
    ).pipe(Layer.provide(NodeFileSystem.layer)),
    NodeCrypto.layer,
    HttpServer.layerServices,
    ConfigProvider.layer(ConfigProvider.fromUnknown(settings)),
  );

  const services = ApplicationLive.pipe(Layer.provideMerge(platform));

  const context = yield* Layer.build(
    ApiHandlers.pipe(Layer.provideMerge(services), Layer.provideMerge(TestClock.layer())),
  );

  const auth = yield* Auth.pipe(Effect.provideContext(context));

  const client = Effect.fnUntraced(function* (cookie: string = "") {
    const cookies = yield* Layer.build(
      HttpApiMiddleware.layerClient(Authentication, ({ request, next }) =>
        next(HttpClientRequest.setHeader(request, "cookie", cookie)),
      ),
    );

    return yield* HttpApiTest.groups(Api, [
      "public",
      "account",
      "purchases",
      "vouchers",
      "operations",
    ]).pipe(Effect.provideContext(Context.merge(context, cookies)));
  });

  const signIn = Effect.fnUntraced(function* (
    address: string,
    role: "administrator" | "customer" = "customer",
  ) {
    const body = yield* Schema.encodeEffect(
      Schema.fromJsonString(Schema.Struct({ email: Schema.String, callbackURL: Schema.String })),
    )({ email: address, callbackURL: "https://darspa.test/mi-cuenta" });

    const requested = yield* Effect.promise(() =>
      auth.handler(
        new Request("https://darspa.test/api/auth/sign-in/magic-link", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "https://darspa.test",
            "cf-connecting-ip": "192.0.2.1",
          },
          body,
        }),
      ),
    );

    if (!requested.ok)
      return yield* Effect.die(
        new Error(
          `Magic link request failed (${requested.status}): ${yield* Effect.promise(() => requested.text())}`,
        ),
      );
    const message = email.messages.findLast((entry) => entry.to.includes(address));

    const link = message?.text.match(
      /https:\/\/darspa\.test\/api\/auth\/magic-link\/verify\?\S+/u,
    )?.[0];

    if (link === undefined)
      return yield* Effect.die(new Error("Magic link missing from the delivered email"));
    const response = yield* Effect.promise(() => auth.handler(new Request(link)));

    const cookie = response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");

    if (!cookie)
      return yield* Effect.die(new Error(`Magic link verification failed (${response.status})`));

    if (role === "administrator")
      yield* Effect.promise(() => db.update(user).set({ role }).where(eq(user.email, address)));

    return { api: yield* client(cookie), cookie, link };
  });

  return {
    db,
    auth,
    email,
    instagram,
    settings,
    refreshInstagram: Instagram.use((service) => service.refresh()).pipe(
      Effect.provideContext(context),
    ),
    webpay,
    bucket,
    jobs,
    client,
    signIn,
    run: (job: Job) => runJob(job).pipe(Effect.provideContext(context)),
    recover: recoverJobs.pipe(Effect.provideContext(context)),
    receiveReturn: (input: typeof webpayReturn.Type) =>
      receiveWebpayReturn(input).pipe(Effect.provideContext(context)),
    advance: (milliseconds: number) =>
      TestClock.adjust(milliseconds).pipe(Effect.provideContext(context)),
  };
});
