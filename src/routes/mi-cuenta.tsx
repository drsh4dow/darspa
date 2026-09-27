import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { accountSearch } from "../lib/account-search";
import { SignIn } from "../components/sign-in";
import { SignOut } from "../components/sign-out";
import { useCustomer } from "../lib/session";

export const Route = createFileRoute("/mi-cuenta")({
  ssr: false,
  validateSearch: accountSearch,
  head: () => ({ meta: [{ title: "Mi cuenta · Dar Spa" }] }),
  component: AccountPage,
});

function AccountPage() {
  const customer = useCustomer();
  const { redirect } = Route.useSearch();

  if (customer === undefined) return <output>Verificando tu sesión…</output>;

  if (customer === null) return <SignIn />;

  if (redirect !== undefined) return <Navigate to={redirect} replace />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Mi cuenta</h1>
        <p className="mt-3 text-muted-foreground">{customer.email}</p>
      </div>
      <section className="border-t border-border pt-6" aria-labelledby="compras">
        <h2 id="compras" className="text-xl font-semibold">
          Mis compras
        </h2>
        <p className="mt-3 text-muted-foreground">
          Las compras todavía no están habilitadas en este entorno. Tu historial estará disponible
          aquí.
        </p>
      </section>
      {customer.role === "administrator" && (
        <Link to="/admin" className="inline-block underline underline-offset-4">
          Ir a administración
        </Link>
      )}
      <SignOut />
    </div>
  );
}
