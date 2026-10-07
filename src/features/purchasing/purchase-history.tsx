import { Link } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { request } from "../../lib/api";
import { useAccountId } from "../../lib/session";
import { Button } from "../../components/ui/button";
import { formatPrice } from "../../lib/metadata";
import { formatShortDate, paymentLabels } from "./format";

export function PurchaseHistory() {
  const accountId = useAccountId();

  const history = useInfiniteQuery({
    queryKey: ["account", accountId, "purchases"],
    initialPageParam: null,
    queryFn: ({ pageParam, signal }: { pageParam: string | null; signal: AbortSignal }) =>
      request((api) => api.purchases.history({ payload: { cursor: pageParam } }), signal),
    getNextPageParam: (page) => page.nextCursor,
  });

  const results = history.data?.pages.flatMap((page) => page.items) ?? [];

  if (history.isPending) return <output>Cargando tus compras…</output>;

  if (results.length === 0)
    return (
      <div className="space-y-4">
        <p>Aún no tienes compras registradas.</p>
        <Link to="/tienda" className="text-primary underline">
          Explorar servicios
        </Link>
      </div>
    );

  return (
    <div className="space-y-5">
      <ul className="divide-y divide-border">
        {results.map((purchase) => (
          <li key={purchase.id}>
            <Link
              to="/pagos/confirmacion"
              search={{ compra: purchase.id }}
              className="group flex items-center justify-between gap-4 rounded-lg py-6 transition-colors hover:bg-muted sm:px-4"
            >
              <div className="min-w-0 space-y-2">
                <p className="text-sm text-muted-foreground">
                  {formatShortDate(purchase.createdAt)}
                </p>
                <h3 className="text-base leading-snug font-bold text-heading">
                  {purchase.lines
                    .map((line) => `${line.quantity} × ${line.terms.name}`)
                    .join(" · ")}
                </h3>
                <p
                  className={
                    purchase.status === "paid"
                      ? "text-sm text-primary"
                      : "text-sm text-muted-foreground"
                  }
                >
                  {paymentLabels[purchase.status]}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <strong className="block text-lg text-heading tabular-nums">
                  {formatPrice(purchase.totalClp)}
                </strong>
                <span
                  aria-hidden="true"
                  className="mt-2 block text-primary transition-transform group-hover:translate-x-1"
                >
                  →
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {history.hasNextPage && (
        <Button
          variant="outline"
          disabled={history.isFetching}
          onClick={() => {
            void history.fetchNextPage();
          }}
        >
          {history.isFetchingNextPage ? "Cargando…" : "Ver más compras"}
        </Button>
      )}
    </div>
  );
}
