import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { httpRouter } from "convex/server";
import { Effect, Stream } from "effect";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";
import { components } from "./_generated/api";
import { auth } from "./auth";
import { httpAction } from "./_generated/server";
import publicPaths from "../content/generated/paths.json";
import { webpayReturn } from "./purchasing/returns";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({ path: "/api/webpay/return", method: "GET", handler: webpayReturn });

http.route({ path: "/api/webpay/return", method: "POST", handler: webpayReturn });

// static-hosting 0.2.1 resolves exact assets but not directory indexes. Keep the
// exception limited to prerendered documents; the component owns all asset serving.
function serveDocument(assetPath: string, privatePage = false) {
  return httpAction((ctx, request) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const page = yield* Effect.promise(() =>
          ctx.runQuery(components.staticHosting.lib.resolveAssetForHttp, {
            path: assetPath,
            spaFallback: false,
          }),
        );

        if (!page?.storageUrl) {
          return new Response("El sitio todavía no está disponible.", {
            status: 503,
            headers: { "Cache-Control": "no-store", "Retry-After": "5" },
          });
        }

        const client = yield* HttpClient.HttpClient;
        const response = yield* client.get(page.storageUrl);

        if (response.status < 200 || response.status >= 300) {
          return new Response("No pudimos cargar la página.", {
            status: 502,
            headers: { "Cache-Control": "no-store" },
          });
        }

        const headers = new Headers({
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache",
          "X-Content-Type-Options": "nosniff",
        });

        // Development stays unindexed even though the production documents have SEO metadata.
        if (privatePage || new URL(request.url).hostname !== "darspa.cl") {
          headers.set("X-Robots-Tag", "noindex, nofollow");
        }

        const body = yield* Stream.toReadableStreamEffect(response.stream);

        return new Response(body, { headers });
      }).pipe(
        // Each HTTP action is an entry point. Fetch has no scoped resources to retain.
        // oxlint-disable-next-line effecttsgo/strict-effect-provide
        Effect.provide(FetchHttpClient.layer),
      ),
    ),
  );
}

for (const path of publicPaths) {
  const assetPath = path === "/" ? "/pages/home.html" : `/pages${path}.html`;
  http.route({ path, method: "GET", handler: serveDocument(assetPath) });

  if (path !== "/") {
    http.route({
      path: `${path}/`,
      method: "GET",
      handler: httpAction((_ctx, request) => {
        const url = new URL(request.url);
        url.pathname = path;

        return Promise.resolve(Response.redirect(url, 308));
      }),
    });
  }
}

for (const path of ["/mi-cuenta", "/admin", "/carro", "/pagos/confirmacion"]) {
  http.route({ path, method: "GET", handler: serveDocument("/index.html", true) });
}

http.route({
  path: "/sitemap.xml",
  method: "GET",
  handler: httpAction(() =>
    Promise.resolve(
      new Response(
        `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${publicPaths.map((path) => `<url><loc>https://darspa.cl${path === "/" ? "" : path}</loc></url>`).join("")}</urlset>`,
        {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "no-cache",
          },
        },
      ),
    ),
  ),
});

http.route({
  path: "/robots.txt",
  method: "GET",
  handler: httpAction((_ctx, request) => {
    const production = new URL(request.url).hostname === "darspa.cl";

    const rules = production
      ? "User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /mi-cuenta\nDisallow: /api/\nDisallow: /pages/\nSitemap: https://darspa.cl/sitemap.xml\n"
      : "User-agent: *\nDisallow: /\n";

    return Promise.resolve(
      new Response(rules, {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
      }),
    );
  }),
});

// Only the two known client-only pages receive the SPA shell. Unknown URLs are 404s.
registerStaticRoutes(http, components.staticHosting, { spaFallback: false });

export default http;
