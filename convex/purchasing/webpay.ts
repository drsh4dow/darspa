import { Config, Context, Effect, Layer, Redacted, Schema } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";
import type { ProviderResult } from "./model";

const environment = Schema.Literals(["integration", "production"]);

export const webpayEnvironment = Config.schema(environment, "WEBPAY_ENVIRONMENT");

export type WebpayEnvironment = typeof environment.Type;

export class WebpayError extends Schema.TaggedError<WebpayError>()("WebpayError", {
  message: Schema.String,
}) {}

const failure = () => new WebpayError({ message: "No pudimos confirmar la respuesta de Webpay." });

const response = Schema.Struct({
  buy_order: Schema.NonEmptyString,
  session_id: Schema.NonEmptyString,
  amount: Schema.Int.check(Schema.isGreaterThan(0)),
  status: Schema.NonEmptyString,
  response_code: Schema.optionalKey(Schema.Int),
  authorization_code: Schema.optionalKey(Schema.String),
  transaction_date: Schema.optionalKey(Schema.String),
  payment_type_code: Schema.optionalKey(Schema.String),
  card_detail: Schema.optionalKey(Schema.Struct({ card_number: Schema.String })),
});

const created = Schema.Struct({ token: Schema.NonEmptyString, url: Schema.String });

export interface CreatePayment {
  buyOrder: string;
  sessionId: string;
  amount: number;
}

export class Webpay extends Context.Service<
  Webpay,
  {
    environment: WebpayEnvironment;
    create: (payment: CreatePayment) => Effect.Effect<typeof created.Type, WebpayError>;
    status: (token: string) => Effect.Effect<ProviderResult, WebpayError>;
    commit: (token: string) => Effect.Effect<ProviderResult, WebpayError>;
  }
>()("darspa/purchasing/Webpay") {
  static readonly layer = Layer.effect(
    Webpay,
    Effect.gen(function* () {
      const mode = yield* webpayEnvironment;
      const commerceCode = yield* Config.schema(Schema.NonEmptyString, "WEBPAY_COMMERCE_CODE");
      const key = yield* Config.schema(Schema.Redacted(Schema.NonEmptyString), "WEBPAY_API_KEY");
      const site = yield* Config.schema(Schema.URL, "CONVEX_SITE_URL");

      const origin =
        mode === "integration"
          ? "https://webpay3gint.transbank.cl"
          : "https://webpay3g.transbank.cl";

      const path = `${origin}/rswebpaytransaction/api/webpay/v1.2/transactions`;
      const client = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk);

      const execute = Effect.fnUntraced(function* (request: HttpClientRequest.HttpClientRequest) {
        return yield* client
          .execute(
            request.pipe(
              HttpClientRequest.setHeaders({
                "Tbk-Api-Key-Id": commerceCode,
                "Tbk-Api-Key-Secret": Redacted.value(key),
              }),
            ),
          )
          .pipe(Effect.timeout("10 seconds"));
      });

      return Webpay.of({
        environment: mode,
        create: Effect.fn("Webpay.create")(function* (payment: CreatePayment) {
          const request = yield* HttpClientRequest.bodyJson(HttpClientRequest.post(path), {
            buy_order: payment.buyOrder,
            session_id: payment.sessionId,
            amount: payment.amount,
            return_url: new URL("/api/webpay/return", site).href,
          });

          const result = yield* execute(request).pipe(
            Effect.flatMap(HttpClientResponse.schemaBodyJson(created)),
          );

          const url = yield* Schema.decodeEffect(Schema.URLFromString)(result.url);

          if (url.origin !== origin || url.username || url.password) {
            return yield* failure();
          }

          return result;
        }, Effect.mapError(failure)),
        status: Effect.fn("Webpay.status")(function* (token: string) {
          return yield* execute(HttpClientRequest.get(`${path}/${encodeURIComponent(token)}`)).pipe(
            Effect.flatMap(HttpClientResponse.schemaBodyJson(response)),
          );
        }, Effect.mapError(failure)),
        commit: Effect.fn("Webpay.commit")(function* (token: string) {
          return yield* execute(HttpClientRequest.put(`${path}/${encodeURIComponent(token)}`)).pipe(
            Effect.flatMap(HttpClientResponse.schemaBodyJson(response)),
          );
        }, Effect.mapError(failure)),
      });
    }),
  );
}
