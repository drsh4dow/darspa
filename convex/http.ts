import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { httpRouter } from "convex/server";
import { components } from "./_generated/api";
import { auth } from "./auth";
import { httpAction } from "./_generated/server";

const http = httpRouter();

auth.addHttpRoutes(http);

// The host reserves index.html for SPA fallback. Serve the prerendered homepage
// separately so account/admin deep links hydrate the generic shell instead.
http.route({
  path: "/",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const page = await ctx.runQuery(components.staticHosting.lib.resolveAssetForHttp, {
      path: "/home.html",
      spaFallback: false,
    });

    if (page?.storageUrl == null) {
      return new Response("El sitio todavía no está disponible.", {
        status: 503,
        headers: { "Cache-Control": "no-store", "Retry-After": "5" },
      });
    }

    const response = await fetch(page.storageUrl);

    if (!response.ok) {
      return new Response("No pudimos cargar la página.", {
        status: 502,
        headers: { "Cache-Control": "no-store" },
      });
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }),
});

registerStaticRoutes(http, components.staticHosting);

export default http;
