import { Context, Effect, Layer, ManagedRuntime } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";
import { Api } from "../../shared/api";

class ApiClient extends Context.Service<ApiClient, HttpApiClient.ForApi<typeof Api>>()(
  "darspa/client/Api",
) {
  static readonly layer = Layer.effect(
    ApiClient,
    HttpApiClient.make(Api, {
      baseUrl: import.meta.env.SSR ? "https://darspa.cl" : window.location.origin,
    }),
  ).pipe(Layer.provide(FetchHttpClient.layer));
}

const runtime = ManagedRuntime.make(ApiClient.layer);

export function request<A, E>(
  execute: (api: ApiClient["Service"]) => Effect.Effect<A, E>,
  signal?: AbortSignal,
) {
  return runtime.runPromise(
    Effect.gen(function* () {
      const api = yield* ApiClient;

      return yield* execute(api);
    }),
    { signal },
  );
}
