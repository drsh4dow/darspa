import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import type { Voucher } from "../../../shared/contracts";
import { request } from "../../lib/api";
import { useAccountId } from "../../lib/session";
import { Button } from "../../components/ui/button";
import { formatDate } from "../purchasing/format";
import { VoucherQr } from "./qr";

export function VoucherContent({ voucher, email }: { voucher: Voucher; email: string }) {
  const accountId = useAccountId();
  const queryClient = useQueryClient();
  const deliveryKey = ["account", accountId, "delivery", voucher.id];

  const { data: delivery } = useQuery({
    queryKey: deliveryKey,
    queryFn: ({ signal }) =>
      request((api) => api.vouchers.delivery({ params: { voucherId: voucher.id } }), signal),
    refetchInterval: (query) => (query.state.data?.status === "queued" ? 3_000 : 30_000),
  });

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
      Effect.tryPromise(() =>
        request((api) => api.vouchers.document({ params: { voucherId: voucher.id } })),
      ).pipe(
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
      Effect.tryPromise(() =>
        request((api) =>
          api.vouchers.send({
            params: { voucherId: voucher.id },
            payload: { recipient, requestId: id },
          }),
        ),
      ).pipe(
        Effect.tap(() =>
          Effect.tryPromise(() => queryClient.invalidateQueries({ queryKey: deliveryKey })),
        ),
        Effect.match({
          onSuccess: () => {
            setBusy(null);
            setRequestId(null);
          },
          onFailure: () => {
            setError(
              "No pudimos confirmar el envío. Revisa el correo y espera un minuto para reintentar.",
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
