import { Effect } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";
import { expect, test } from "vite-plus/test";
import { sendEmail } from "./email";
import { signInEmail } from "./signInEmail";

const message = {
  to: "recipient@example.com",
  subject: "Synthetic email",
  text: "No patient data",
  idempotencyKey: "synthetic-delivery-1",
};

test("email reports provider acceptance, preserves retry identity, and blocks uncontrolled recipients", () => {
  const requests: Request[] = [];

  const client = HttpClient.make(
    Effect.fnUntraced(function* (request) {
      const outgoing = yield* HttpClientRequest.toWeb(request).pipe(Effect.orDie);
      requests.push(outgoing);

      return HttpClientResponse.fromWeb(request, Response.json({ id: "provider-message-id" }));
    }),
  );

  return Effect.runPromise(
    Effect.gen(function* () {
      const accepted = yield* sendEmail(message);
      expect(accepted).toEqual({ status: "accepted", id: "provider-message-id" });

      yield* sendEmail(message);
      expect(requests.map((entry) => entry.headers.get("Idempotency-Key"))).toEqual([
        message.idempotencyKey,
        message.idempotencyKey,
      ]);

      const error = yield* Effect.flip(sendEmail({ ...message, to: "uncontrolled@example.com" }));
      expect(error.message).toContain("limitado");
      expect(requests).toHaveLength(2);
    }).pipe(Effect.provideService(HttpClient.HttpClient, client)),
  );
});

test("sign-in delivery preserves the link in HTML and plain text and uses a hosted logo", () => {
  const link = new URL("https://app.example.com/mi-cuenta?code=single-use&metodo=email");
  const content = signInEmail(link, new URL("https://assets.example.com"));

  expect(content.html).toContain(
    'href="https://app.example.com/mi-cuenta?code=single-use&amp;metodo=email"',
  );
  expect(content.html).toContain('src="https://assets.example.com/images/darspa-logo.png"');
  expect(content.text).toContain(link.href);

  const client = HttpClient.make(
    Effect.fnUntraced(function* (request) {
      const outgoing = yield* HttpClientRequest.toWeb(request).pipe(Effect.orDie);
      const body: unknown = yield* Effect.promise(() => outgoing.json());

      expect(body).toEqual({
        from: "Dar Spa <acceso@example.com>",
        to: [message.to],
        subject: content.subject,
        text: content.text,
        html: content.html,
      });

      return HttpClientResponse.fromWeb(request, Response.json({ id: "sign-in-message-id" }));
    }),
  );

  return Effect.runPromise(
    sendEmail({ ...message, ...content }).pipe(
      Effect.provideService(HttpClient.HttpClient, client),
    ),
  );
});

test.each([429, 500, 200])(
  "provider rejection or a malformed success is never reported as delivery (HTTP %i)",
  (status) => {
    const client = HttpClient.make((request) =>
      Effect.succeed(
        HttpClientResponse.fromWeb(
          request,
          Response.json({ error: "Sensitive provider details" }, { status }),
        ),
      ),
    );

    return Effect.runPromise(
      Effect.gen(function* () {
        const error = yield* Effect.flip(sendEmail(message));
        expect(error.message).toContain("No pudimos confirmar el envío");
      }).pipe(Effect.provideService(HttpClient.HttpClient, client)),
    );
  },
);
