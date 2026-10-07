import { ConfigProvider, Context, Effect, Layer } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";
import { expect, test } from "vite-plus/test";
import { Webpay } from "./webpay";

const config = ConfigProvider.fromEnvRecord({
  WEBPAY_ENVIRONMENT: "integration",
  WEBPAY_COMMERCE_CODE: "synthetic-commerce",
  WEBPAY_API_KEY: "synthetic-key",
  SITE_URL: "https://synthetic.example.com",
});

test.each([
  ["https://webpay3gint.transbank.cl/webpayserver/initTransaction", true],
  ["https://unexpected.example.com/pay", false],
])("Webpay create decodes its documented URL string and restricts redirects: %s", (url, valid) => {
  const client = HttpClient.make(
    Effect.fnUntraced(function* (request) {
      const outgoing = yield* HttpClientRequest.toWeb(request).pipe(Effect.orDie);
      expect(outgoing.method).toBe("POST");
      expect(outgoing.url).toBe(
        "https://webpay3gint.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions",
      );
      expect(yield* Effect.promise(() => outgoing.json())).toEqual({
        buy_order: "synthetic-order",
        session_id: "synthetic-session",
        amount: 73000,
        return_url: "https://synthetic.example.com/api/webpay/return",
      });

      return HttpClientResponse.fromWeb(request, Response.json({ token: "synthetic-token", url }));
    }),
  );

  return Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const context = yield* Layer.build(Webpay.layer);
        const provider = Context.get(context, Webpay);

        const result = yield* provider
          .create({ buyOrder: "synthetic-order", sessionId: "synthetic-session", amount: 73000 })
          .pipe(Effect.match({ onSuccess: (session) => session, onFailure: () => null }));

        expect(result).toEqual(valid ? { token: "synthetic-token", url } : null);
      }),
    ).pipe(
      Effect.provideService(HttpClient.HttpClient, client),
      Effect.provideService(ConfigProvider.ConfigProvider, config),
    ),
  );
});
