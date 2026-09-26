import { useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Button } from "@/components/ui/button";

const invalidAttempt =
  "No pudimos completar el ingreso. El enlace puede haber vencido o ya fue utilizado. Solicita uno nuevo o ingresa con Google.";

function SignIn({ initialError }: { initialError: string | null }) {
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"ready" | "sending" | "sent">("ready");
  const [error, setError] = useState(initialError);

  async function requestEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setError(null);

    try {
      await signIn("resend", {
        email: email.trim().toLowerCase(),
        redirectTo: `${window.location.origin}/cuenta`,
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
      await signIn("google", { redirectTo: `${window.location.origin}/cuenta?metodo=google` });
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

function Administration() {
  const access = useQuery(api.accounts.administration);

  if (access === undefined) return <output>Verificando permisos…</output>;

  return (
    <>
      <h1 className="text-3xl font-semibold">Administración</h1>
      <p className="mt-4">Acceso autorizado para {access.email}.</p>
      <p className="mt-3 text-muted-foreground">
        Las herramientas de atención y gestión estarán disponibles en las próximas etapas.
      </p>
    </>
  );
}

export function Account({
  administrator = false,
  signInReturn,
}: {
  administrator?: boolean;
  signInReturn: boolean;
}) {
  const { signOut } = useAuthActions();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const customer = useQuery(api.accounts.viewer, isAuthenticated ? {} : "skip");
  const [wasSignInReturn, setWasSignInReturn] = useState(signInReturn);

  if (isLoading || (isAuthenticated && customer === undefined)) {
    return <output>Verificando tu sesión…</output>;
  }

  if (!isAuthenticated || customer == null) {
    return <SignIn initialError={wasSignInReturn ? invalidAttempt : null} />;
  }

  if (administrator && customer.role !== "administrator") {
    return (
      <>
        <h1 className="text-3xl font-semibold">Acceso restringido</h1>
        <p className="mt-4">Tu cuenta no tiene permisos de administración.</p>
        <a className="mt-6 inline-block underline" href="/cuenta">
          Volver a mi cuenta
        </a>
      </>
    );
  }

  return (
    <div className="space-y-8">
      {administrator ? (
        <Administration />
      ) : (
        <>
          <div>
            <h1 className="text-3xl font-semibold">Mi cuenta</h1>
            <p className="mt-3 text-muted-foreground">{customer.email}</p>
          </div>
          <section className="border-t border-border pt-6" aria-labelledby="compras">
            <h2 id="compras" className="text-xl font-semibold">
              Mis compras
            </h2>
            <p className="mt-3 text-muted-foreground">
              Las compras todavía no están habilitadas en este entorno. Tu historial estará
              disponible aquí.
            </p>
          </section>
          {customer.role === "administrator" && (
            <a href="/admin" className="inline-block underline underline-offset-4">
              Ir a administración
            </a>
          )}
        </>
      )}
      <div>
        <Button
          variant="outline"
          onClick={() => {
            window.history.replaceState(null, "", window.location.pathname);
            setWasSignInReturn(false);
            void signOut();
          }}
        >
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}
