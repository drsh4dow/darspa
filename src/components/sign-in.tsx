import { useState, type FormEvent } from "react";
import { Effect } from "effect";
import { auth } from "../lib/auth";
import { useSearch } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

const invalidAttempt = "Este enlace venció o ya fue utilizado. Solicita uno nuevo.";

export function SignIn() {
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

  function requestEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setError(null);

    Effect.runFork(
      Effect.tryPromise(() =>
        auth.signIn.magicLink(
          {
            email: email.trim().toLowerCase(),
            callbackURL: returnUrl("email"),
            errorCallbackURL: returnUrl("email"),
          },
          { throw: true },
        ),
      ).pipe(
        Effect.match({
          onSuccess: () => setState("sent"),
          onFailure: () => {
            setError("No pudimos enviar el enlace. Revisa el correo e inténtalo en un minuto.");
            setState("ready");
          },
        }),
      ),
    );
  }

  function google() {
    setState("sending");
    setError(null);

    Effect.runFork(
      Effect.tryPromise(() =>
        auth.signIn.social(
          {
            provider: "google",
            callbackURL: returnUrl("google"),
            errorCallbackURL: returnUrl("google"),
          },
          { throw: true },
        ),
      ).pipe(
        Effect.catch(() =>
          Effect.sync(() => {
            setError("No pudimos conectar con Google. Inténtalo nuevamente.");
            setState("ready");
          }),
        ),
      ),
    );
  }

  if (state === "sent")
    return (
      <div className="mx-auto max-w-sm space-y-6 py-6">
        <h1 className="text-3xl font-extrabold text-heading">Revisa tu correo</h1>
        <output className="block space-y-2">
          <span className="block font-bold">{email}</span>
          <span className="block text-sm text-muted-foreground">
            Solicitud enviada. Revisa también spam. El enlace dura 15 minutos.
          </span>
        </output>
        <button
          type="button"
          onClick={() => setState("ready")}
          className="min-h-11 text-sm text-primary underline"
        >
          Usar otro correo o reenviar
        </button>
      </div>
    );

  return (
    <div className="mx-auto max-w-sm space-y-6 py-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-heading">Ingresa a tu cuenta</h1>
      </div>
      {error !== null && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <Button
        className="w-full py-3"
        variant="outline"
        disabled={state === "sending"}
        onClick={google}
      >
        Continuar con Google
      </Button>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />o con tu correo
        <span className="h-px flex-1 bg-border" />
      </div>
      <form className="space-y-4" onSubmit={requestEmail}>
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
        <Button type="submit" className="w-full py-3" disabled={state === "sending"}>
          {state === "sending" ? "Conectando…" : "Enviar enlace de ingreso"}
        </Button>
      </form>
    </div>
  );
}
