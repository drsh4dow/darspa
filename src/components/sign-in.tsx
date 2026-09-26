import { useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useSearch } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

const invalidAttempt =
  "No pudimos completar el ingreso. El enlace puede haber vencido o ya fue utilizado. Solicita uno nuevo o ingresa con Google.";

export function SignIn() {
  const { signIn } = useAuthActions();
  const { metodo, redirect } = useSearch({ from: "/mi-cuenta" });
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"ready" | "sending" | "sent">("ready");
  const [error, setError] = useState(metodo === undefined ? null : invalidAttempt);

  function returnUrl(method: "email" | "google") {
    const url = new URL("/mi-cuenta", window.location.origin);
    url.searchParams.set("metodo", method);

    if (redirect !== undefined) url.searchParams.set("redirect", redirect);

    return url.href;
  }

  async function requestEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setError(null);

    try {
      await signIn("resend", {
        email: email.trim().toLowerCase(),
        redirectTo: returnUrl("email"),
      });
      setState("sent");
    } catch {
      setError(
        "No pudimos enviar el enlace. Revisa tu correo e inténtalo en un minuto. En desarrollo solo se permite el correo de prueba autorizado.",
      );
      setState("ready");
    }
  }

  async function google() {
    setState("sending");
    setError(null);

    try {
      await signIn("google", { redirectTo: returnUrl("google") });
    } catch {
      setError("No pudimos conectar con Google. Inténtalo nuevamente.");
      setState("ready");
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-7">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Ingresa a tu cuenta</h1>
        <p className="mt-3 text-muted-foreground">
          Usa el mismo correo con Google o con un enlace, sin contraseña.
        </p>
      </div>
      {error !== null && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <Button
        className="w-full"
        variant="outline"
        disabled={state === "sending"}
        onClick={() => {
          void google();
        }}
      >
        Continuar con Google
      </Button>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          void requestEmail(event);
        }}
      >
        <div className="space-y-2">
          <label htmlFor="email" className="block font-medium">
            Correo electrónico
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-md border border-input bg-card px-3 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
        </div>
        <Button type="submit" className="w-full" disabled={state === "sending"}>
          {state === "sending" ? "Conectando…" : "Enviar enlace de ingreso"}
        </Button>
      </form>
      {state === "sent" && (
        <output className="block">
          Solicitud enviada. Revisa tu correo y la carpeta de spam. El enlace vence en 15 minutos.
          Si no llega, espera un minuto antes de solicitar otro.
        </output>
      )}
    </div>
  );
}
