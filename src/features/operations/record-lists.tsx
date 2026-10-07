import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { VoucherScope } from "../../../shared/contracts";
import { request } from "../../lib/api";
import { useAccountId } from "../../lib/session";
import { Button } from "../../components/ui/button";
import { formatPrice } from "../../lib/metadata";
import { formatDate, formatShortDate, paymentLabels } from "../purchasing/format";
import { voucherSource } from "./voucher-detail";

export function VoucherList({
  scope,
  onVoucher,
}: {
  scope: VoucherScope;
  onVoucher: (code: string) => void;
}) {
  const accountId = useAccountId();

  const vouchers = useInfiniteQuery({
    queryKey: ["account", accountId, "operations", "vouchers", scope],
    initialPageParam: null,
    queryFn: ({ pageParam, signal }: { pageParam: string | null; signal: AbortSignal }) =>
      request((api) => api.operations.vouchers({ payload: { scope, cursor: pageParam } }), signal),
    getNextPageParam: (page) => page.nextCursor,
  });

  const results = vouchers.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-border">
        {results.map((voucher) => (
          <li key={voucher.id}>
            <button
              onClick={() => onVoucher(voucher.code)}
              className="flex w-full flex-wrap items-center justify-between gap-3 rounded-md px-2 py-4 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span className="min-w-0 basis-full sm:flex-1 sm:basis-0">
                <span className="block font-bold text-heading">{voucher.terms.name}</span>
                <span className="block text-sm text-muted-foreground">
                  {voucherSource(voucher)} · {formatShortDate(voucher.issuedAt)}
                </span>
                <code className="break-all text-xs">{voucher.code}</code>
              </span>
              <span className="text-sm font-bold">
                {voucher.redeemed ? "Canjeado" : "Sin canjear"}
                {voucher.expired && " · Vencido"}
              </span>
              <span className="text-sm text-primary">Ver voucher →</span>
            </button>
          </li>
        ))}
      </ul>
      {results.length === 0 && !vouchers.isPending && <p>No hay vouchers para esta consulta.</p>}
      <More
        loading={vouchers.isPending || vouchers.isFetching}
        hasMore={vouchers.hasNextPage}
        loadMore={() => {
          void vouchers.fetchNextPage();
        }}
      />
    </div>
  );
}

export function CustomerList({
  onCustomer,
}: {
  onCustomer: (customer: { id: string; email: string }) => void;
}) {
  const [email, setEmail] = useState("");
  const [search, setSearch] = useState("");

  const accountId = useAccountId();

  const customers = useInfiniteQuery({
    queryKey: ["account", accountId, "operations", "customers", search],
    initialPageParam: null,
    queryFn: ({ pageParam, signal }: { pageParam: string | null; signal: AbortSignal }) =>
      request(
        (api) => api.operations.customers({ payload: { email: search, cursor: pageParam } }),
        signal,
      ),
    getNextPageParam: (page) => page.nextCursor,
  });

  const results = customers.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <section className="space-y-5">
      <h2 className="text-2xl font-bold text-heading">Clientes</h2>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(email.trim());
        }}
      >
        <div className="space-y-2">
          <label htmlFor="customer-email" className="block font-bold">
            Correo o inicio del correo
          </label>
          <input
            id="customer-email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-md border border-input bg-card p-3"
          />
        </div>
        <Button type="submit">Buscar</Button>
      </form>
      <ul className="divide-y divide-border">
        {results.map((customer) => (
          <li key={customer.id}>
            <button
              onClick={() => onCustomer(customer)}
              className="flex w-full flex-wrap justify-between gap-3 rounded-md p-4 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span className="break-all font-bold">{customer.email}</span>
              <span className="text-primary">Ver compras y vouchers →</span>
            </button>
          </li>
        ))}
      </ul>
      {results.length === 0 && !customers.isPending && (
        <p>No encontramos clientes con ese correo.</p>
      )}
      <More
        loading={customers.isPending || customers.isFetching}
        hasMore={customers.hasNextPage}
        loadMore={() => {
          void customers.fetchNextPage();
        }}
      />
    </section>
  );
}

export function PurchaseList({
  customerId,
  onPurchase,
}: {
  customerId?: string;
  onPurchase: (id: string) => void;
}) {
  const accountId = useAccountId();
  const filter = customerId === undefined ? {} : { customerId };

  const purchases = useInfiniteQuery({
    queryKey: ["account", accountId, "operations", "purchases", filter],
    initialPageParam: null,
    queryFn: ({ pageParam, signal }: { pageParam: string | null; signal: AbortSignal }) =>
      request(
        (api) => api.operations.purchases({ payload: { ...filter, cursor: pageParam } }),
        signal,
      ),
    getNextPageParam: (page) => page.nextCursor,
  });

  const results = purchases.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-border">
        {results.map((purchase) => (
          <li key={purchase.id}>
            <button
              onClick={() => onPurchase(purchase.id)}
              className="flex w-full flex-wrap items-center justify-between gap-3 rounded-md px-2 py-4 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span className="min-w-0">
                <span className="block break-all font-bold">{purchase.customer.email}</span>
                <span className="block text-sm wrap-anywhere text-muted-foreground">
                  {formatShortDate(purchase.createdAt)} · Orden {purchase.buyOrder}
                </span>
              </span>
              <span className="text-sm">
                <span className="block font-bold">{formatPrice(purchase.totalClp)}</span>
                {paymentLabels[purchase.status]}
              </span>
              <span className="text-sm text-primary">Ver compra →</span>
            </button>
          </li>
        ))}
      </ul>
      {results.length === 0 && !purchases.isPending && <p>No hay compras registradas.</p>}
      <More
        loading={purchases.isPending || purchases.isFetching}
        hasMore={purchases.hasNextPage}
        loadMore={() => {
          void purchases.fetchNextPage();
        }}
      />
    </div>
  );
}

export function PurchaseSearch({ onPurchase }: { onPurchase: (id: string) => void }) {
  const [input, setInput] = useState("");
  const [order, setOrder] = useState("");

  const accountId = useAccountId();

  const { data: purchaseId } = useQuery({
    queryKey: ["account", accountId, "operations", "order", order],
    queryFn: ({ signal }) =>
      request((api) => api.operations.findPurchase({ params: { buyOrder: order } }), signal),
    enabled: order.length > 0,
  });

  return (
    <section className="space-y-5">
      <h2 className="text-2xl font-bold text-heading">Compras y pagos</h2>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setOrder(input.trim());
        }}
      >
        <div className="space-y-2">
          <label htmlFor="buy-order" className="block font-bold">
            Número de orden Webpay
          </label>
          <input
            id="buy-order"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="w-full rounded-md border border-input bg-card p-3"
          />
        </div>
        <Button type="submit">Buscar</Button>
      </form>
      {order && purchaseId === undefined && <output>Buscando…</output>}
      {order && purchaseId === null && <output>No encontramos esa orden.</output>}
      {purchaseId && (
        <Button variant="outline" onClick={() => onPurchase(purchaseId)}>
          Ver orden {order}
        </Button>
      )}
      <PurchaseList onPurchase={onPurchase} />
    </section>
  );
}

export function PurchaseDetail({
  purchaseId,
  onVoucher,
}: {
  purchaseId: string;
  onVoucher: (code: string) => void;
}) {
  const accountId = useAccountId();

  const { data: purchase } = useQuery({
    queryKey: ["account", accountId, "operations", "purchase", purchaseId],
    queryFn: ({ signal }) =>
      request((api) => api.operations.purchase({ params: { purchaseId } }), signal),
  });

  if (purchase === undefined) return <output>Cargando compra…</output>;

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold wrap-anywhere text-heading">Orden {purchase.buyOrder}</h2>
        <p className="mt-2 break-all">
          {purchase.customer.email} · {formatDate(purchase.createdAt)}
        </p>
      </header>
      <div className="space-y-2 rounded-xl border border-border p-5">
        <p className="text-lg font-bold">
          {paymentLabels[purchase.status]} · {formatPrice(purchase.totalClp)}
        </p>
        <p className="text-sm">
          Webpay · {purchase.environment === "integration" ? "Integración (pruebas)" : "Producción"}
        </p>
        <p className="break-all text-sm text-muted-foreground">
          Transacción: {purchase.transactionId}
        </p>
        {purchase.result && (
          <p className="text-sm">
            Respuesta: {purchase.result.status} · Código{" "}
            {purchase.result.response_code ?? "no informado"}
            {purchase.result.authorization_code &&
              ` · Autorización ${purchase.result.authorization_code}`}
          </p>
        )}
        {purchase.lastCheckedAt !== null && (
          <p className="text-sm">Última consulta: {formatDate(purchase.lastCheckedAt)}</p>
        )}
        {purchase.problem && <output className="block text-destructive">{purchase.problem}</output>}
      </div>
      <ul className="space-y-3">
        {purchase.lines.map((line) => (
          <li key={line.terms.offeringId}>
            <p className="font-bold">
              {line.quantity} × {line.terms.name} · {formatPrice(line.terms.priceClp)} c/u
            </p>
            <details className="text-sm">
              <summary className="cursor-pointer text-primary">Descripción comprada</summary>
              <p className="mt-2 whitespace-pre-line">{line.terms.description}</p>
            </details>
          </li>
        ))}
      </ul>
      <h3 className="text-xl font-bold">Vouchers de la compra</h3>
      <VoucherList scope={{ kind: "purchase", purchaseId }} onVoucher={onVoucher} />
    </section>
  );
}

function More({
  loading,
  hasMore,
  loadMore,
}: {
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
}) {
  if (loading) return <output>Cargando registros…</output>;

  if (hasMore)
    return (
      <Button variant="outline" onClick={loadMore}>
        Cargar más
      </Button>
    );

  return null;
}
