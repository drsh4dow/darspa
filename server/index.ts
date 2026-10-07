import type { ExecutionContext, ScheduledController } from "@cloudflare/workers-types";
import { Effect, Layer, Option, Schema } from "effect";
import { HttpRouter, HttpServer, HttpServerResponse } from "effect/unstable/http";
import type { ApplicationEnv } from "../infra/application";
import publicPaths from "../content/generated/paths.json";
import { Auth } from "./auth";
import { ApiRoutes } from "./http";
import { BackgroundJobs, recoverJobs, runJob, type Job } from "./jobs";
import { receiveWebpayReturn, webpayReturn } from "./purchasing/returns";
import { boundedRequest } from "./request";
import { applicationLayer } from "./runtime";

const documentPath = Schema.String.check(
  Schema.isPattern(/^\/documents\/vouchers\/[a-f0-9]{32}\.pdf$/),
);

const unavailable = () =>
  Response.json(
    { message: "No pudimos completar la solicitud. Inténtalo nuevamente." },
    { status: 503 },
  );

function background(env: ApplicationEnv, jobs: readonly Job[] | "recover") {
  const program =
    jobs === "recover"
      ? recoverJobs
      : Effect.forEach(jobs, runJob, { concurrency: 2, discard: true });

  return Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const services = yield* Layer.build(applicationLayer(env));

        return yield* program.pipe(Effect.provideContext(services));
      }),
    ).pipe(
      Effect.catchCause(() =>
        Effect.logError("Background work failed; D1 retains the recovery schedule."),
      ),
    ),
  );
}

const handleRequest = Effect.fn("handleRequest")(function* (
  original: Request,
  env: ApplicationEnv,
  ctx: ExecutionContext,
) {
  const url = new URL(original.url);
  const isReadRequest = original.method === "GET" || original.method === "HEAD";

  if (isReadRequest && url.pathname === "/robots.txt") {
    const text =
      env.APP_ENVIRONMENT === "production"
        ? "User-agent: *\nAllow: /\nSitemap: https://darspa.cl/sitemap.xml\n"
        : "User-agent: *\nDisallow: /\n";

    return new Response(original.method === "HEAD" ? null : text, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  if (isReadRequest && url.pathname === "/sitemap.xml") {
    const entries = publicPaths
      .map((path) => `<url><loc>https://darspa.cl${path === "/" ? "" : path}</loc></url>`)
      .join("");

    return new Response(
      original.method === "HEAD"
        ? null
        : `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`,
      { headers: { "Content-Type": "application/xml; charset=utf-8" } },
    );
  }

  if (isReadRequest && Schema.is(documentPath)(url.pathname)) {
    const object = yield* Effect.tryPromise(() =>
      env.DOCUMENTS.get(url.pathname.slice("/documents/".length)),
    );

    if (object === null) return new Response("Documento no encontrado.", { status: 404 });

    return new Response(original.method === "HEAD" ? null : object.body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${url.pathname.split("/").at(-1)}"`,
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  if (!url.pathname.startsWith("/api/")) return new Response("No encontrado.", { status: 404 });
  const isWebpayReturn = url.pathname === "/api/webpay/return";
  const origin = original.headers.get("Origin");

  if (
    !isWebpayReturn &&
    original.method !== "GET" &&
    original.method !== "HEAD" &&
    ((origin !== null && origin !== new URL(env.SITE_URL).origin) ||
      original.headers.get("Sec-Fetch-Site") === "cross-site")
  ) {
    return Response.json({ message: "Origen no permitido." }, { status: 403 });
  }

  const request = yield* boundedRequest(original);
  const jobs: Job[] = [];
  const services = applicationLayer(env);

  return yield* Effect.gen(function* () {
    if (url.pathname.startsWith("/api/auth/") || isWebpayReturn) {
      const context = yield* Layer.build(services);

      if (!isWebpayReturn)
        return yield* Auth.use((auth) => Effect.tryPromise(() => auth.handler(request))).pipe(
          Effect.provideContext(context),
        );
      const destination = new URL("/pagos/confirmacion", env.SITE_URL);

      const params =
        request.method === "POST"
          ? new URLSearchParams(yield* Effect.tryPromise(() => request.text()))
          : url.searchParams;

      const input = Schema.decodeOption(webpayReturn)(Object.fromEntries(params));

      if (Option.isSome(input)) {
        const purchaseId = yield* receiveWebpayReturn(input.value).pipe(
          Effect.provideContext(context),
        );

        if (purchaseId !== null) {
          destination.searchParams.set("compra", purchaseId);
          jobs.push({ kind: "payment", id: purchaseId });
        }
      }

      return Response.redirect(destination.href, 303);
    }

    const queue = Layer.succeed(
      BackgroundJobs,
      BackgroundJobs.of({
        schedule: (job) =>
          Effect.sync(() => {
            jobs.push(job);
          }),
      }),
    );

    const routes = ApiRoutes.pipe(Layer.provide([services, queue, HttpServer.layerServices]));

    const server = yield* Effect.acquireRelease(
      Effect.sync(() =>
        HttpRouter.toWebHandler(routes, {
          disableLogger: true,
          middleware: (next) =>
            next.pipe(
              Effect.catchCause(() =>
                Effect.gen(function* () {
                  yield* Effect.logError("API request failed.");

                  return yield* HttpServerResponse.json(
                    { message: "No pudimos completar la solicitud." },
                    { status: 503 },
                  );
                }),
              ),
            ),
        }),
      ),
      (resource) => Effect.promise(resource.dispose),
    );

    return yield* Effect.tryPromise(() => server.handler(request));
  }).pipe(
    Effect.ensuring(
      Effect.sync(() => {
        if (jobs.length > 0) ctx.waitUntil(background(env, jobs));
      }),
    ),
  );
});

export default {
  fetch: (request: Request, env: ApplicationEnv, ctx: ExecutionContext) =>
    Effect.runPromise(
      handleRequest(request, env, ctx).pipe(
        Effect.scoped,
        Effect.catchTag("RequestBodyError", (error) =>
          Effect.succeed(Response.json({ message: error.message }, { status: 413 })),
        ),
        Effect.catchCause(() =>
          Effect.gen(function* () {
            yield* Effect.logError("Worker request failed.");

            return unavailable();
          }),
        ),
        Effect.map((response) => {
          const headers = new Headers(response.headers);
          headers.set("Cache-Control", "private, no-store");
          headers.set("X-Content-Type-Options", "nosniff");
          headers.set("Referrer-Policy", "no-referrer");

          return new Response(response.body, { status: response.status, headers });
        }),
      ),
    ),
  scheduled: (_event: ScheduledController, env: ApplicationEnv, ctx: ExecutionContext) => {
    ctx.waitUntil(background(env, "recover"));
  },
};
