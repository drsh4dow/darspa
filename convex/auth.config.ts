import type { AuthConfig } from "convex/server";
import { Config, Effect, Schema } from "effect";

const domain = Effect.runSync(
  Effect.gen(function* () {
    const value = yield* Config.String("CONVEX_SITE_URL");
    yield* Schema.decodeEffect(Schema.URLFromString)(value);

    // JWT issuer matching is exact: URL.href would add a trailing slash.
    return value;
  }),
);

export default {
  providers: [{ domain, applicationID: "convex" }],
} satisfies AuthConfig;
