import { useRef, useState, type FormEvent } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { Effect } from "effect";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { formatPrice } from "../../lib/metadata";
import { formatDate } from "../purchasing/format";
import { VoucherQr } from "./qr";

type Voucher = FunctionReturnType<typeof api.vouchers.vouchers.owned>;

export function PurchaseVouchers({
  purchaseId,
  email,
}: {
  purchaseId: Id<"purchases">;
  email: string;
}) {
  const vouchers = useQuery(api.vouchers.vouchers.forPurchase, { purchaseId });

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
          className="rounded-2xl px-6 pt-8 sm:px-8"
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            title.current?.focus();
          }}
        >
          <p className="mb-2 text-sm font-bold text-primary">
            Dar Spa · Voucher {String(index + 1).padStart(2, "0")}
          </p>
          <DialogTitle
            ref={title}
            tabIndex={-1}
            className="pr-7 text-2xl leading-tight font-extrabold text-heading outline-none"
          >
            {voucher.terms.name}
          </DialogTitle>
          <VoucherContent voucher={voucher} email={email} />
        </DialogContent>
      </Dialog>
    </li>
  );
}

function VoucherContent({ voucher, email }: { voucher: Voucher; email: string }) {
  const download = useAction(api.vouchers.documents.download);
  const send = useMutation(api.vouchers.deliveries.request);
  const delivery = useQuery(api.vouchers.deliveries.latest, { voucherId: voucher.id });
  const [recipient, setRecipient] = useState(email);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"pdf" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);

  let voucherStatus = "Disponible para canjear";

  if (voucher.expired) voucherStatus = "Vencido";

  if (voucher.redeemed) voucherStatus = "Canjeado";

  function preparePdf() {
    setBusy("pdf");
    setError(null);
    Effect.runFork(
      Effect.tryPromise(() => download({ voucherId: voucher.id })).pipe(
        Effect.match({
          onSuccess: (url) => {
            window.location.assign(url);
            setBusy(null);
          },
          onFailure: () => {
            setError("No pudimos preparar el PDF. Inténtalo de nuevo.");
            setBusy(null);
          },
        }),
      ),
    );
  }

  function emailVoucher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Browser request identity survives an ambiguous request failure until the recipient changes.
    // oxlint-disable-next-line effecttsgo/crypto-random-uuid
    const id = requestId ?? crypto.randomUUID();
    setRequestId(id);
    setBusy("email");
    setError(null);
    Effect.runFork(
      Effect.tryPromise(() => send({ voucherId: voucher.id, recipient, requestId: id })).pipe(
        Effect.match({
          onSuccess: () => {
            setBusy(null);
            setRequestId(null);
          },
          onFailure: () => {
            setError(
              "No se solicitó el envío. Revisa el correo y espera un minuto para reintentar.",
            );
            setBusy(null);
          },
        }),
      ),
    );
  }

  return (
    <div className="mt-6 space-y-5">
      <div className="flex flex-col items-center gap-2 rounded-xl border border-border p-4">
        <VoucherQr code={voucher.code} />
        <code className="break-all text-center text-xs text-muted-foreground select-all">
          {voucher.code}
        </code>
        <p className="text-center font-bold">{voucherStatus}</p>
      </div>
      <div className="space-y-2 text-sm">
        <p className="font-bold">Vence el {formatDate(voucher.expiresAt)} (Chile)</p>
      </div>
      <details>
        <summary className="cursor-pointer text-sm text-primary">Detalle del servicio</summary>
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">
          {voucher.terms.description}
        </p>
      </details>
      <Button className="w-full" disabled={busy !== null} onClick={preparePdf}>
        {busy === "pdf" ? "Preparando…" : "Descargar PDF"}
      </Button>
      <form onSubmit={emailVoucher} className="space-y-3 border-t border-border pt-5">
        <label htmlFor={`recipient-${voucher.id}`} className="block font-bold">
          Correo del destinatario
        </label>
        <input
          id={`recipient-${voucher.id}`}
          type="email"
          required
          maxLength={254}
          value={recipient}
          onChange={(event) => {
            setRecipient(event.target.value);
            setRequestId(null);
          }}
          className="w-full rounded-md border border-input bg-card px-3 py-3"
        />
        <p className="text-xs text-muted-foreground">Quien reciba el código podrá canjearlo.</p>
        <Button
          type="submit"
          variant="outline"
          className="w-full"
          disabled={busy !== null || delivery?.status === "queued"}
        >
          {busy === "email" ? "Enviando…" : "Enviar voucher"}
        </Button>
      </form>
      {delivery && (
        <output className="block text-sm">
          {delivery.status === "queued" && `Enviando a ${delivery.recipient}…`}
          {delivery.status === "accepted" &&
            `Envío aceptado para ${delivery.recipient}. Revisa tu bandeja y spam.`}
          {delivery.status === "unconfirmed" &&
            `Envío sin confirmar a ${delivery.recipient}. Revisa tu bandeja antes de reenviar.`}
        </output>
      )}
      {error !== null && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
