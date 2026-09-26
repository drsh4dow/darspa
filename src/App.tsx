import { Component, type ReactNode } from "react";
import { useConvexConnectionState, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Button } from "@/components/ui/button";

function reload() {
  window.location.reload();
}

export function ConnectionError() {
  return (
    <div role="alert" className="space-y-4">
      <h2 className="text-lg font-semibold">No pudimos cargar los datos</h2>
      <p className="text-muted-foreground">Revisa tu conexión e inténtalo nuevamente.</p>
      <Button onClick={reload}>Volver a intentar</Button>
    </div>
  );
}

class ConnectionBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    if (this.state.failed) return <ConnectionError />;

    return this.props.children;
  }
}

function DevelopmentStatus() {
  const status = useQuery(api.development.status);
  const connection = useConvexConnectionState();

  if (status === undefined) {
    if (connection.connectionRetries >= 3) return <ConnectionError />;

    return (
      <output className="block text-muted-foreground">
        Conectando con el entorno de desarrollo…
      </output>
    );
  }

  if (status === null) {
    return <output>Todavía no hay datos de prueba. Ejecuta la preparación del entorno.</output>;
  }

  return (
    <div className="space-y-6">
      <output className="block text-lg">{status.message}</output>
      <dl className="space-y-2 border-t border-border pt-5">
        <dt className="text-sm text-muted-foreground">Configuración de desarrollo</dt>
        <dd className="font-medium">{status.configuration}</dd>
      </dl>
      {!connection.isWebSocketConnected && (
        <output className="block text-destructive">
          Conexión interrumpida. Intentando reconectar; los datos pueden estar desactualizados.
        </output>
      )}
    </div>
  );
}

export function App({ children }: { children?: ReactNode }) {
  return (
    <>
      <a
        href="#contenido"
        className="sr-only rounded-md bg-primary p-3 text-primary-foreground focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
      >
        Saltar al contenido
      </a>
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-7">
          <a
            href="/"
            className="text-xl font-semibold tracking-tight underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            Dar Spa
          </a>
          <nav aria-label="Navegación principal" className="flex items-center gap-4">
            <a href="/cuenta" className="underline underline-offset-4">
              Mi cuenta
            </a>
            <span className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground">
              Desarrollo
            </span>
          </nav>
        </div>
      </header>
      <main
        id="contenido"
        tabIndex={-1}
        className="mx-auto max-w-3xl px-6 py-14 outline-none sm:py-20"
      >
        <ConnectionBoundary>
          {children ?? (
            <>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Entorno de desarrollo
              </h1>
              <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
                Base técnica del nuevo sitio de Dar Spa. Este entorno usa datos de prueba y no
                permite realizar compras ni reservas.
              </p>
              <section
                aria-label="Estado del entorno"
                className="mt-10 rounded-lg border border-border bg-card p-6 text-card-foreground sm:p-8"
              >
                <DevelopmentStatus />
              </section>
            </>
          )}
        </ConnectionBoundary>
      </main>
      <footer className="mx-auto max-w-3xl px-6 pb-8 text-sm text-muted-foreground">
        Dar Spa · Castro, Chiloé
      </footer>
    </>
  );
}
