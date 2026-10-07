import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Voucher } from "../../../shared/contracts";
import { request } from "../../lib/api";
import { useAccountId } from "../../lib/session";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { formatPrice } from "../../lib/metadata";
import { VoucherContent } from "./voucher-content";

export function PurchaseVouchers({ purchaseId, email }: { purchaseId: string; email: string }) {
  const accountId = useAccountId();

  const { data: vouchers } = useQuery({
    queryKey: ["account", accountId, "purchase-vouchers", purchaseId],
    queryFn: ({ signal }) =>
      request((api) => api.purchases.vouchers({ params: { purchaseId } }), signal),
  });

  if (vouchers === undefined) return <output>Cargando vouchers…</output>;

  return (
    <section className="space-y-5" aria-labelledby="vouchers-title">
      <h2 id="vouchers-title" className="text-2xl font-bold text-heading">
        Tus vouchers
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2">
        {vouchers.map((voucher, index) => (
          <VoucherCard key={voucher.id} voucher={voucher} email={email} index={index} />
        ))}
      </ul>
    </section>
  );
}

function VoucherCard({
  voucher,
  email,
  index,
}: {
  voucher: Voucher;
  email: string;
  index: number;
}) {
  const title = useRef<HTMLHeadingElement>(null);

  return (
    <li className="flex flex-col rounded-xl border border-primary/20 bg-primary/5 p-5">
      <div className="mb-4 flex justify-between text-sm text-muted-foreground">
        <span>Voucher {String(index + 1).padStart(2, "0")}</span>
        <span>{formatPrice(voucher.terms.priceClp)}</span>
      </div>
      <h3 className="mb-5 flex-1 text-xl leading-snug font-extrabold text-heading">
        {voucher.terms.name}
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">
        Vence el{" "}
        {new Intl.DateTimeFormat("es-CL", {
          timeZone: "America/Santiago",
          dateStyle: "medium",
        }).format(voucher.expiresAt)}
      </p>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full border-primary/30 bg-background text-primary">
            Ver voucher<span className="sr-only"> {index + 1}</span>
          </Button>
        </DialogTrigger>
        <DialogContent
          layout="voucher"
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            title.current?.focus();
          }}
        >
          <p className="mb-2 text-sm font-bold text-primary">
            Dar Spa · Voucher {String(index + 1).padStart(2, "0")}
          </p>
          <DialogTitle ref={title} tabIndex={-1} className="text-2xl leading-tight font-extrabold">
            {voucher.terms.name}
          </DialogTitle>
          <VoucherContent voucher={voucher} email={email} />
        </DialogContent>
      </Dialog>
    </li>
  );
}
