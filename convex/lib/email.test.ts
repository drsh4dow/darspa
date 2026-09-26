import { expect, test } from "vite-plus/test";
import { sendEmail } from "./email";
import { signInEmail } from "./signInEmail";

const message = {
  to: "recipient@example.com",
  subject: "Synthetic email",
  text: "No patient data",
  idempotencyKey: "synthetic-delivery-1",
};

test("email reports provider acceptance, preserves retry identity, and blocks uncontrolled recipients", async () => {
  const requests: Request[] = [];

  const request: typeof fetch = async (input, init) => {
    requests.push(new Request(input, init));

    return Response.json({ id: "provider-message-id" });
  };

  expect(await sendEmail(message, request)).toEqual({
    status: "accepted",
    id: "provider-message-id",
  });
  await sendEmail(message, request);
  expect(requests.map((entry) => entry.headers.get("Idempotency-Key"))).toEqual([
    message.idempotencyKey,
    message.idempotencyKey,
  ]);
  await expect(sendEmail({ ...message, to: "uncontrolled@example.com" }, request)).rejects.toThrow(
    "limitado",
  );
  expect(requests).toHaveLength(2);
});

test("sign-in delivery preserves the link in HTML and plain text and uses a hosted logo", async () => {
  const link = new URL("https://app.example.com/cuenta?code=single-use&method=email");
  const content = signInEmail(link, new URL("https://assets.example.com"));

  expect(content.html).toContain(
    'href="https://app.example.com/cuenta?code=single-use&amp;method=email"',
  );
  expect(content.html).toContain('src="https://assets.example.com/images/darspa-logo.png"');
  expect(content.text).toContain(link.href);

  const request: typeof fetch = async (input, init) => {
    const outgoing = new Request(input, init);

    expect(await outgoing.json()).toEqual({
      from: "Dar Spa <acceso@example.com>",
      to: [message.to],
      subject: content.subject,
      text: content.text,
      html: content.html,
    });

    return Response.json({ id: "sign-in-message-id" });
  };

  await sendEmail({ ...message, ...content }, request);
});

test.each([429, 500, 200])(
  "provider rejection or a malformed success is never reported as delivery (HTTP %i)",
  async (status) => {
    const request: typeof fetch = async () =>
      Response.json({ error: "Sensitive provider details" }, { status });

    await expect(sendEmail(message, request)).rejects.toThrow("No pudimos confirmar el envío");
  },
);
