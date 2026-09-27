import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SignOut } from "../components/sign-out";
import { useCustomer } from "../lib/session";
import { OperationsWorkspace } from "../features/operations/workspace";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({ meta: [{ title: "Administración · Dar Spa" }] }),
  component: AdminPage,
});

function AdminPage() {
  const customer = useCustomer();

  if (customer === undefined) return <output>Verificando tu sesión…</output>;

  if (customer === null) {
    return <Navigate to="/mi-cuenta" search={{ redirect: "/admin" }} replace />;
  }

  if (customer.role !== "administrator") {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold">Acceso restringido</h1>
        <p>Tu cuenta no tiene permisos de administración.</p>
        <Link to="/mi-cuenta" className="inline-block underline underline-offset-4">
          Volver a mi cuenta
        </Link>
      </div>
    );
  }

  // Mount private queries only after reactive session and role checks settle.
  // Convex still authorizes every backend request independently.
  return <Administration />;
}

function Administration() {
  const access = useQuery(api.accounts.administration);

  if (access === undefined) return <output>Verificando permisos…</output>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Administración</h1>
        <p className="mt-4">Acceso autorizado para {access.email}.</p>
      </div>
      <OperationsWorkspace />
      <SignOut />
    </div>
  );
}
