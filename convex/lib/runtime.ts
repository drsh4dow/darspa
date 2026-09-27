import { ConfigProvider, Effect } from "effect";

/** Convex exposes process.env through a lazy proxy: keys are readable but are not
 * own properties. Effect's fromEnvRecord uses Object.hasOwn; its default provider
 * also probes import.meta.env, which Convex rejects. All application configuration
 * is flat string keys, so the native lookup-provider interface fits this host.
 */
export const convexConfig = ConfigProvider.make((path) =>
  Effect.sync(() => {
    // This is the host adapter for Effect Config, not a domain configuration read.
    // oxlint-disable-next-line effecttsgo/process-env-in-effect
    const value = process.env[path.join("_")];

    return value === undefined ? undefined : ConfigProvider.makeValue(value);
  }),
);

export function runConvex<A, E>(program: Effect.Effect<A, E>) {
  return Effect.runPromise(
    program.pipe(Effect.provideService(ConfigProvider.ConfigProvider, convexConfig)),
  );
}
