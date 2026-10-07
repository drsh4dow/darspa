import { useState } from "react";
import { Button } from "../../components/ui/button";
import { ManualIssuance } from "./manual-issuance";
import { QrReader } from "./qr-reader";
import {
  CustomerList,
  PurchaseDetail,
  PurchaseList,
  PurchaseSearch,
  VoucherList,
} from "./record-lists";
import { VoucherDetail } from "./voucher-detail";

type View =
  | { kind: "vouchers" }
  | { kind: "issue" }
  | { kind: "customers" }
  | { kind: "purchases" }
  | { kind: "voucher"; code: string }
  | { kind: "purchase"; id: string }
  | { kind: "customer"; id: string; email: string };

export function OperationsWorkspace() {
  const [view, setView] = useState<View>({ kind: "vouchers" });
  const [code, setCode] = useState("");
  const [source, setSource] = useState<"all" | "webpay" | "manual">("all");

  function openVoucher(value: string) {
    const trimmed = value.trim();

    if (!trimmed) return;
    setCode(trimmed);
    setView({ kind: "voucher", code: trimmed });
  }

  function openPurchase(id: string) {
    setView({ kind: "purchase", id });
  }

  let section = view.kind;

  if (section === "voucher") section = "vouchers";

  if (section === "customer") section = "customers";

  if (section === "purchase") section = "purchases";

  return (
    <div className="space-y-8">
      <nav aria-label="Operaciones" className="flex flex-wrap gap-2 border-b border-border pb-4">
        <Button
          variant={section === "vouchers" ? "default" : "outline"}
          aria-current={section === "vouchers" ? "page" : undefined}
          onClick={() => setView({ kind: "vouchers" })}
        >
          Vouchers
        </Button>
        <Button
          variant={section === "issue" ? "default" : "outline"}
          aria-current={section === "issue" ? "page" : undefined}
          onClick={() => setView({ kind: "issue" })}
        >
          Emitir voucher
        </Button>
        <Button
          variant={section === "customers" ? "default" : "outline"}
          aria-current={section === "customers" ? "page" : undefined}
          onClick={() => setView({ kind: "customers" })}
        >
          Clientes
        </Button>
        <Button
          variant={section === "purchases" ? "default" : "outline"}
          aria-current={section === "purchases" ? "page" : undefined}
          onClick={() => setView({ kind: "purchases" })}
        >
          Compras y pagos
        </Button>
      </nav>
      {(view.kind === "vouchers" || view.kind === "voucher") && (
        <section className="space-y-4" aria-label="Buscar voucher">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              openVoucher(code);
            }}
          >
            <div className="min-w-0 flex-1 space-y-2">
              <label htmlFor="voucher-code" className="block font-bold">
                Código del voucher
              </label>
              <input
                id="voucher-code"
                required
                maxLength={200}
                autoCapitalize="none"
                autoComplete="off"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="w-full rounded-md border border-input bg-card p-3 font-mono"
              />
            </div>
            <Button type="submit">Consultar</Button>
          </form>
          <QrReader onCode={openVoucher} />
          <p className="text-sm text-muted-foreground">
            Consultar o escanear no canjea el voucher.
          </p>
        </section>
      )}
      {view.kind === "vouchers" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-2xl font-bold text-heading">Vouchers</h2>
            <div className="flex items-center gap-2">
              <label htmlFor="voucher-source">Origen</label>
              <select
                id="voucher-source"
                value={source}
                onChange={(event) => {
                  const value = event.target.value;

                  if (value === "all" || value === "webpay" || value === "manual") setSource(value);
                }}
                className="rounded-md border border-input bg-card p-2"
              >
                <option value="all">Todos</option>
                <option value="webpay">Webpay</option>
                <option value="manual">Emisión manual</option>
              </select>
            </div>
          </div>
          <VoucherList
            scope={source === "all" ? { kind: "all" } : { kind: "source", source }}
            onVoucher={openVoucher}
          />
        </section>
      )}
      {view.kind === "voucher" && <VoucherDetail key={view.code} code={view.code} />}
      {view.kind === "issue" && <ManualIssuance onIssued={openVoucher} />}
      {view.kind === "customers" && (
        <CustomerList onCustomer={(customer) => setView({ kind: "customer", ...customer })} />
      )}
      {view.kind === "purchases" && <PurchaseSearch onPurchase={openPurchase} />}
      {view.kind === "purchase" && <PurchaseDetail purchaseId={view.id} onVoucher={openVoucher} />}
      {view.kind === "customer" && (
        <section className="space-y-6">
          <h2 className="break-all text-2xl font-bold text-heading">{view.email}</h2>
          <h3 className="text-xl font-bold">Compras</h3>
          <PurchaseList customerId={view.id} onPurchase={openPurchase} />
          <h3 className="text-xl font-bold">Vouchers comprados</h3>
          <VoucherList scope={{ kind: "customer", customerId: view.id }} onVoucher={openVoucher} />
        </section>
      )}
    </div>
  );
}
