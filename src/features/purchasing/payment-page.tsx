import { useState } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { request } from "../../lib/api";
import { Button } from "../../components/ui/button";
import { paymentLabels } from "./format";
import { PurchaseVouchers } from "../vouchers/purchase-vouchers";
import { useCart } from "./cart";
import { formatPrice } from "../../lib/metadata";
import { useAccountId, useCustomer } from "../../lib/session";

export function PaymentPage() {
  const { compra } = useSearch({ from: "/pagos/confirmacion" });
  const customer = useCustomer();

  if (customer === undefined) return <output>Verificando tu sesión…</output>;

  if (customer === null)
    return (
      <div className="space-y-5">
        <h1 className="text-3xl font-extrabold text-heading">Consulta tu pago</h1>
        <p>Ingresa con el correo de tu compra para ver el resultado.</p>
        <Button asChild>
          <Link to="/mi-cuenta">Ingresar</Link>
        </Button>
      </div>
    );

  if (compra === undefined)
    return (
      <div className="space-y-5">
        <h1 className="text-3xl font-extrabold text-heading">Consulta tus compras</h1>
        <p>Revisa el estado antes de volver a pagar.</p>
        <Link to="/mi-cuenta" className="text-primary underline">
          Ver mis compras
        </Link>
      </div>
    );

  return <PaymentDetails purchaseId={compra} email={customer.email} />;
}

function PaymentDetails({ purchaseId, email }: { purchaseId: string; email: string }) {
  const accountId = useAccountId();
  const queryClient = useQueryClient();
  const queryKey = ["account", accountId, "purchase", purchaseId];

  const { data: purchase } = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      request((api) => api.purchases.get({ params: { purchaseId } }), signal),
    refetchInterval: (query) => {
      const status = query.state.data?.status;

      return status === undefined ||
        status === "creating" ||
        status === "pending" ||
        status === "unknown"
        ? 3_000
        : false;
    },
  });

  const cart = useCart();
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (purchase === undefined) return <output>Cargando tu compra…</output>;

  const unresolved =
    purchase.status === "pending" ||
    purchase.status === "unknown" ||
    purchase.status === "creating";

  function check() {
    if (purchase === undefined) return;
    setChecking(true);
    setFeedback(null);
    Effect.runFork(
      Effect.tryPromise(() =>
        request((api) => api.purchases.reconcile({ params: { purchaseId: purchase.id } })),
      ).pipe(
        Effect.tap(() => Effect.tryPromise(() => queryClient.invalidateQueries({ queryKey }))),
        Effect.match({
          onSuccess: () => {
            setChecking(false);
            setFeedback("Consultando a Webpay. No vuelvas a pagar mientras esté por confirmar.");
          },
          onFailure: () => {
            setChecking(false);
            setFeedback("No pudimos consultar. Inténtalo de nuevo.");
          },
        }),
      ),
    );
  }

  return (
    <div className="space-y-8">
      <Link to="/mi-cuenta" className="inline-flex text-sm text-primary hover:underline">
        ← Mis compras
      </Link>
      <header className="space-y-3 border-b border-border pb-8">
        {purchase.status === "paid" && (
          <span
            aria-hidden="true"
            className="mb-5 grid size-12 place-items-center rounded-full bg-primary/10 text-2xl text-primary"
          >
            ✓
          </span>
        )}
        <h1
          className="text-3xl font-extrabold tracking-tight text-heading sm:text-4xl"
          aria-live="polite"
        >
          {paymentLabels[purchase.status]}
        </h1>
        {purchase.environment === "integration" && (
          <p className="text-sm text-muted-foreground">Webpay · Modo de prueba, sin cobro real</p>
        )}
      </header>
      <details open={purchase.status !== "paid"}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-heading">
          <span className="text-sm font-bold underline decoration-border underline-offset-4">
            Detalle de compra <span aria-hidden="true">⌄</span>
          </span>
          <strong className="text-2xl font-extrabold tabular-nums">
            {formatPrice(purchase.totalClp)}
          </strong>
        </summary>
        <ul className="mt-4 divide-y divide-border">
          {purchase.lines.map((line) => (
            <li key={line.terms.offeringId} className="flex justify-between gap-5 py-4">
              <span>
                {line.quantity} × {line.terms.name}
              </span>
              <strong className="shrink-0">
                {formatPrice(line.terms.priceClp * line.quantity)}
              </strong>
            </li>
          ))}
        </ul>
        <p className="mt-4 break-all text-xs text-muted-foreground">Orden {purchase.buyOrder}</p>
      </details>
      {purchase.checkout !== null && (
        <form action={purchase.checkout.url} method="POST">
          <input type="hidden" name="token_ws" value={purchase.checkout.token} />
          <Button type="submit" size="lg" className="w-full">
            Pagar {formatPrice(purchase.totalClp)} en Webpay
          </Button>
        </form>
      )}
      {unresolved && (
        <div className="space-y-4 rounded-xl bg-secondary p-5">
          <p>Si ya pagaste, no lo repitas. Estamos esperando la confirmación de Webpay.</p>
          <Button variant="outline" disabled={checking} onClick={check}>
            {checking ? "Consultando…" : "Consultar estado"}
          </Button>
        </div>
      )}
      {purchase.status === "paid" && (
        <>
          <PurchaseVouchers purchaseId={purchase.id} email={email} />
          <Link
            to="/tienda"
            onClick={() => {
              if (cart.requestId === purchase.requestId) cart.clear();
            }}
            className="text-sm text-primary underline"
          >
            Seguir comprando
          </Link>
        </>
      )}
      {!unresolved && purchase.status !== "paid" && (
        <div className="space-y-3">
          <p>
            No se emitieron vouchers.{" "}
            {purchase.status === "error"
              ? "Puedes volver a intentarlo."
              : "Si ves un cargo, contacta a Dar Spa antes de pagar de nuevo."}
          </p>
          <Link to="/carro" onClick={() => cart.newAttempt()} className="text-primary underline">
            Volver al carro
          </Link>
        </div>
      )}
      {purchase.problem !== null && (
        <p role="alert" className="text-destructive">
          {purchase.problem}
        </p>
      )}
      {feedback !== null && <output>{feedback}</output>}
      <p className="text-xs text-muted-foreground">No es un documento tributario.</p>
    </div>
  );
}
