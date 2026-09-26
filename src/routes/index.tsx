import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { useConvexConnectionState } from "convex/react";
import { api } from "../../convex/_generated/api";

const developmentStatus = convexQuery(api.development.status, {});

export const Route = createFileRoute("/")({
  loader: async ({ context: { queryClient } }) => {
    // Finish the public query before rendering so static HTML needs no reveal script.
    await queryClient.query({ queryKey: developmentStatus.queryKey, staleTime: "static" });
  },
  component: DevelopmentPage,
});

function ConnectionWarning() {
  const connection = useConvexConnectionState();

  if (connection.isWebSocketConnected) return null;

  if (!connection.hasEverConnected && connection.connectionRetries < 3) return null;

  return (
    <output className="block text-destructive">
      Conexión interrumpida. Intentando reconectar; los datos pueden estar desactualizados.
    </output>
  );
}

function DevelopmentStatus() {
  const { data: status } = useSuspenseQuery(developmentStatus);

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
    </div>
  );
}

function DevelopmentPage() {
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Entorno de desarrollo</h1>
      <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
        Base técnica del nuevo sitio de Dar Spa. Este entorno usa datos de prueba y no permite
        realizar compras ni reservas.
      </p>
      <section
        aria-label="Estado del entorno"
        className="mt-10 space-y-6 rounded-lg border border-border bg-card p-6 text-card-foreground sm:p-8"
      >
        <DevelopmentStatus />
        <ClientOnly>
          <ConnectionWarning />
        </ClientOnly>
      </section>
    </>
  );
}
