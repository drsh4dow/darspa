import { Config, Effect, Option, Redacted, Schema } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";
import { developmentTarget } from "./developmentSync";
import { normalizedEmailAddress } from "../../shared/email";

const acceptedEmail = Schema.Struct({ id: Schema.NonEmptyString });

class EmailError extends Schema.TaggedError<EmailError>()("EmailError", {
  message: Schema.String,
}) {}

export const checkDevelopmentRecipient = Effect.fnUntraced(function* (email: string) {
  const deployment = yield* Config.String("CONVEX_CLOUD_URL").pipe(Config.option);

  if (Option.getOrUndefined(deployment) !== developmentTarget.deploymentUrl)
    return yield* Effect.void;

  const allowed = yield* Config.String("DEVELOPMENT_EMAIL_RECIPIENTS").pipe(Config.withDefault(""));

  const parsed = Schema.decodeOption(Schema.Array(normalizedEmailAddress))(
    allowed.split(",").map((recipient) => recipient.trim()),
  );

  if (Option.isNone(parsed) || !parsed.value.includes(email)) {
    return yield* new EmailError({
      message: "El envío de correos está limitado en este entorno de prueba.",
    });
  }

  return yield* Effect.void;
});

/** Acceptance by Resend is not proof of delivery. Callers retain their business record on failure.
 * Reuse the key for retries of the same message (Resend retains keys for 24 hours).
 * This boundary does not retry ambiguous network failures or schedule background work.
 */
export const sendEmail = Effect.fnUntraced(function* (message: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: ReadonlyArray<{ filename: string; content: string; content_type: string }>;
  idempotencyKey: string;
}) {
  const to = yield* Schema.decodeEffect(normalizedEmailAddress)(message.to);
  yield* checkDevelopmentRecipient(to);

  const { key, from } = yield* Config.all({
    key: Config.schema(Schema.Redacted(Schema.NonEmptyString), "RESEND_API_KEY"),
    from: Config.schema(Schema.NonEmptyString, "AUTH_EMAIL_FROM"),
  }).pipe(Effect.mapError(() => new EmailError({ message: "El correo no está configurado." })));

  const client = yield* HttpClient.HttpClient;

  const accepted = yield* HttpClientRequest.post("https://api.resend.com/emails").pipe(
    HttpClientRequest.setHeaders({
      Authorization: `Bearer ${Redacted.value(key)}`,
      "Idempotency-Key": message.idempotencyKey,
    }),
    HttpClientRequest.bodyJson({
      from,
      to: [to],
      subject: message.subject,
      text: message.text,
      html: message.html,
      attachments: message.attachments,
    }),
    Effect.flatMap(client.execute),
    Effect.flatMap(HttpClientResponse.filterStatusOk),
    Effect.flatMap(HttpClientResponse.schemaBodyJson(acceptedEmail)),
    Effect.timeout("10 seconds"),
    // Provider errors can contain recipient details, credentials, or authentication links.
    Effect.mapError(
      () =>
        new EmailError({
          message: "No pudimos confirmar el envío del correo. Inténtalo nuevamente.",
        }),
    ),
  );

  return { status: "accepted" as const, id: accepted.id };
});
