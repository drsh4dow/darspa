import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { retain } from "alchemy/RemovalPolicy";
import { Config, Effect } from "effect";
import publicPaths from "../content/generated/paths.json";

const privatePaths = ["/mi-cuenta", "/admin", "/carro", "/pagos/confirmacion"];

const pages = [
  ...publicPaths.map((path) => ({
    path,
    asset: path === "/" ? "/pages/home.html" : `/pages${path}.html`,
  })),
  ...privatePaths.map((path) => ({ path, asset: "/index.html" })),
];

const redirects = pages
  .flatMap(({ path, asset }) => {
    const rules = [`${path} ${asset} 200`];

    if (path !== "/") rules.push(`${path}/ ${path} 308`);

    return rules;
  })
  .join("\n");

export const Application = Effect.gen(function* () {
  const stage = yield* Alchemy.Stage;
  const live = stage === "prod";
  let domain: Cloudflare.WorkerDomainConfig | null = null;
  let siteUrl = "https://darspa.cl";

  if (stage === "dev") {
    domain = { name: "dev.darspa.cl" };
    siteUrl = "https://dev.darspa.cl";
  }

  if (stage === "local") siteUrl = "http://localhost:5173";

  if (live) domain = { name: "darspa.cl", redirects: ["www.darspa.cl"] };

  const database = yield* Cloudflare.D1.Database("Database", {
    name: `darspa-${stage}`,
    primaryLocationHint: "enam",
    // Cloudflare returns this default explicitly; match it in Alchemy's stored state.
    readReplication: { mode: "disabled" },
    migrations: "./server/db/migrations",
  }).pipe(retain());

  const documents = yield* Cloudflare.R2.Bucket("Documents", {
    name: `darspa-${stage}-documents`,
  }).pipe(retain());

  const worker = yield* Cloudflare.Worker("Application", {
    name: `darspa-${stage}`,
    main: "./server/index.ts",
    compatibility: { date: "2026-09-28", flags: ["nodejs_compat"] },
    limits: { cpuMs: 30_000 },
    dev: { port: 8787, strictPort: true },
    assets: {
      directory: stage === "local" ? "./public" : "./dist/client",
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/api/*", "/documents/vouchers/*", "/robots.txt", "/sitemap.xml"],
      redirects,
      headers:
        stage === "prod"
          ? privatePaths.map((path) => `${path}\n  X-Robots-Tag: noindex, nofollow`).join("\n")
          : "/*\n  X-Robots-Tag: noindex, nofollow",
    },
    env: {
      DB: database,
      DOCUMENTS: documents,
      SITE_URL: siteUrl,
      APP_ENVIRONMENT: stage === "prod" ? "production" : "development",
      DEVELOPMENT_EMAIL_RECIPIENTS: Config.String("DEVELOPMENT_EMAIL_RECIPIENTS").pipe(
        Config.withDefault(""),
      ),
      BETTER_AUTH_SECRET: Config.Redacted("BETTER_AUTH_SECRET"),
      AUTH_GOOGLE_ID: Config.Redacted("AUTH_GOOGLE_ID"),
      AUTH_GOOGLE_SECRET: Config.Redacted("AUTH_GOOGLE_SECRET"),
      RESEND_API_KEY: Config.Redacted("RESEND_API_KEY"),
      AUTH_EMAIL_FROM: Config.String("AUTH_EMAIL_FROM"),
      WEBPAY_ENVIRONMENT: Config.String("WEBPAY_ENVIRONMENT"),
      WEBPAY_COMMERCE_CODE: Config.Redacted("WEBPAY_COMMERCE_CODE"),
      WEBPAY_API_KEY: Config.Redacted("WEBPAY_API_KEY"),
    },
    crons: ["* * * * *"],
    domain,
    workersDev: !live,
    observability: {
      enabled: true,
      // Callback URLs contain authentication/payment tokens. Keep only our redacted logs.
      logs: { enabled: true, invocationLogs: false },
      traces: { enabled: false },
    },
  });

  return { worker, database };
});

export type ApplicationEnv = Cloudflare.InferEnv<Effect.Success<typeof Application>["worker"]>;
