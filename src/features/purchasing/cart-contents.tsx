import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Effect } from "effect";
import { request } from "../../lib/api";
import { Button } from "../../components/ui/button";
import { DrawerClose, DrawerDescription } from "../../components/ui/drawer";
import { formatPrice } from "../../lib/metadata";
import { useCustomer } from "../../lib/session";
import { useCart } from "./cart";

export function CartContents({ onNavigate }: { onNavigate: () => void }) {
  const cart = useCart();
  const customer = useCustomer();

  const { data: catalog } = useQuery({
    queryKey: ["catalog"],
    queryFn: ({ signal }) => request((api) => api.public.catalog(), signal),
  });

  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offerings = new Map(catalog?.map((offering) => [offering.id, offering]));
  let total = 0;
  let units = 0;
  let changed = false;
  let unavailable = false;

  for (const item of cart.items) {
    total += item.expectedPriceClp * item.quantity;
    units += item.quantity;
    const offering = offerings.get(item.offeringId);

    if (offering === undefined) unavailable = true;
    else if (offering.priceClp !== item.expectedPriceClp) changed = true;
  }

  function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    Effect.runFork(
      Effect.tryPromise(() =>
        request((api) =>
          api.purchases.start({ payload: { items: cart.items, requestId: cart.requestId } }),
        ),
      ).pipe(
        Effect.flatMap((purchaseId) =>
          Effect.tryPromise(() => {
            onNavigate();

            return navigate({ to: "/pagos/confirmacion", search: { compra: purchaseId } });
          }),
        ),
        Effect.catch(() =>
          Effect.sync(() => {
            setError("No pudimos iniciar el pago. Revisa tu carro e inténtalo de nuevo.");
            setBusy(false);
          }),
        ),
      ),
    );
  }

  if (cart.items.length === 0)
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 pb-20 text-center">
        <DrawerDescription variant="heading">Tu carro está vacío</DrawerDescription>
        <DrawerClose render={(props) => <Button {...props} variant="outline" />}>
          Seguir explorando
        </DrawerClose>
      </div>
    );

  return (
    <form onSubmit={checkout} className="flex min-h-0 flex-1 flex-col">
      <DrawerDescription className="sr-only">
        Revisa tus servicios y cantidades antes de pagar.
      </DrawerDescription>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 sm:px-8">
        {catalog === undefined ? (
          <output className="block py-8 text-muted-foreground">Cargando tu carro…</output>
        ) : (
          <ul className="divide-y divide-border">
            {cart.items.map((item) => {
              const offering = offerings.get(item.offeringId);
              const name = offering?.name ?? "Servicio no disponible";
              const image = offering?.image;

              return (
                <li key={item.offeringId} className="flex gap-4 py-6">
                  {image && (
                    <img
                      src={image}
                      alt=""
                      width="88"
                      height="104"
                      className="h-26 w-22 shrink-0 rounded-lg object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="pr-1 text-base leading-snug font-bold text-heading">{name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatPrice(item.expectedPriceClp)}
                    </p>
                    {offering === undefined && (
                      <p role="alert" className="mt-1 text-sm text-destructive">
                        Retíralo para continuar.
                      </p>
                    )}
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="inline-flex items-center rounded-full border border-border">
                        <button
                          type="button"
                          disabled={busy || item.quantity === 1}
                          aria-label={`Reducir cantidad de ${name}`}
                          onClick={() => cart.setQuantity(item.offeringId, item.quantity - 1)}
                          className="size-9 rounded-full text-lg text-primary hover:bg-secondary disabled:opacity-35"
                        >
                          −
                        </button>
                        <output
                          aria-label={`Cantidad de ${name}`}
                          className="min-w-6 text-center text-sm tabular-nums"
                        >
                          {item.quantity}
                        </output>
                        <button
                          type="button"
                          disabled={busy || units >= 20}
                          aria-label={`Aumentar cantidad de ${name}`}
                          onClick={() => cart.setQuantity(item.offeringId, item.quantity + 1)}
                          className="size-9 rounded-full text-lg text-primary hover:bg-secondary disabled:opacity-35"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => cart.setQuantity(item.offeringId, 0)}
                        className="min-h-9 text-sm text-muted-foreground underline hover:text-destructive"
                        aria-label={`Quitar ${name}`}
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <footer className="shrink-0 space-y-4 border-t border-border bg-muted px-6 pt-5 pb-safe sm:px-8">
        {changed && (
          <div role="alert" className="space-y-2 text-sm">
            <p>Hay precios nuevos. Revísalos antes de pagar.</p>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                cart.refreshPrices(new Map(catalog?.map((item) => [item.id, item.priceClp])))
              }
            >
              Actualizar precios
            </Button>
          </div>
        )}
        {error !== null && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {units > 20 && (
          <p role="alert" className="text-sm text-destructive">
            Máximo 20 vouchers por compra.
          </p>
        )}
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-bold text-heading">Total</span>
          <strong className="text-3xl font-extrabold tracking-tight text-heading tabular-nums">
            {formatPrice(total)}
          </strong>
        </div>
        <p className="text-sm text-muted-foreground">
          Vouchers transferibles · 60 días desde el pago
        </p>
        {customer === null ? (
          <Button asChild size="lg" className="w-full">
            <Link to="/mi-cuenta" search={{ redirect: "/carro" }} onClick={onNavigate}>
              Ingresar para comprar
            </Link>
          </Button>
        ) : (
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={
              busy ||
              customer === undefined ||
              catalog === undefined ||
              changed ||
              unavailable ||
              units > 20
            }
          >
            {busy ? "Preparando…" : "Continuar a Webpay"}
          </Button>
        )}
      </footer>
    </form>
  );
}
