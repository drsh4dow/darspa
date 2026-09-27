import type { AuthConfig } from "convex/server";
import { Config, Effect, Schema } from "effect";
import { convexConfig } from "./lib/runtime";

// Auth evaluation exposes known environment keys but not the default import.meta
// probe. Keep the issuer string unchanged: URL.href would add a trailing slash.
const domain = Effect.runSync(
  Config.String("CONVEX_SITE_URL")
    .parse(convexConfig)
    .pipe(Effect.tap(Schema.decodeEffect(Schema.URLFromString))),
);

export default {
  providers: [{ domain, applicationID: "convex" }],
} satisfies AuthConfig;
