import { z } from "zod";
import { developmentTarget } from "./developmentSync";
import { emailAddress } from "./identity";

const acceptedEmail = z.object({ id: z.string().min(1) });

export function checkDevelopmentRecipient(email: string) {
  if (process.env["CONVEX_CLOUD_URL"] !== developmentTarget.deploymentUrl) return;

  const allowed = process.env["DEVELOPMENT_EMAIL_RECIPIENT"];

  if (!allowed || email !== emailAddress.parse(allowed)) {
    throw new Error("El envío de correos está limitado en este entorno de prueba.");
  }
}

/** Acceptance by Resend is not proof of delivery. Callers retain their business record on failure.
 * Reuse the key for retries of the same message (Resend retains keys for 24 hours).
 * This boundary does not retry ambiguous network failures or schedule background work.
 */
export async function sendEmail(
  message: { to: string; subject: string; text: string; html?: string; idempotencyKey: string },
  request: typeof fetch = fetch,
) {
  const to = emailAddress.parse(message.to);
  checkDevelopmentRecipient(to);

  const key = process.env["RESEND_API_KEY"];
  const from = process.env["AUTH_EMAIL_FROM"];

  if (!key || !from) throw new Error("El correo no está configurado.");

  try {
    const response = await request("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": message.idempotencyKey,
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) throw new Error("Provider rejected email");

    const accepted = acceptedEmail.parse(await response.json());

    return { status: "accepted" as const, id: accepted.id };
  } catch {
    // Never expose provider responses, recipient details, or authentication links in errors.
    throw new Error("No pudimos confirmar el envío del correo. Inténtalo nuevamente.");
  }
}
