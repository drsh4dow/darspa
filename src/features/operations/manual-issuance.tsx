import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { request } from "../../lib/api";
import { useAccountId } from "../../lib/session";
import { Button } from "../../components/ui/button";
import { formatPrice } from "../../lib/metadata";

export function ManualIssuance({ onIssued }: { onIssued: (code: string) => void }) {
  const accountId = useAccountId();
  const queryClient = useQueryClient();

  const { data: offerings } = useQuery({
    queryKey: ["catalog"],
    queryFn: ({ signal }) => request((api) => api.public.catalog(), signal),
  });

  const [offeringId, setOfferingId] = useState("");

  const [category, setCategory] = useState<"external_payment" | "complimentary">(
    "external_payment",
  );

  const [reason, setReason] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Preserve the request identity across uncertain responses; editing starts a new request.
    // oxlint-disable-next-line effecttsgo/crypto-random-uuid
    const id = requestId ?? crypto.randomUUID();
    setRequestId(id);
    setBusy(true);
    setError("");
    Effect.runFork(
      Effect.gen(function* () {
        const voucherId = yield* Effect.tryPromise(() =>
          request((api) =>
            api.operations.issue({ payload: { offeringId, category, reason, requestId: id } }),
          ),
        );

        const voucher = yield* Effect.tryPromise(() =>
          request((api) => api.vouchers.get({ params: { voucherId } })),
        );

        yield* Effect.tryPromise(() =>
          queryClient.invalidateQueries({ queryKey: ["account", accountId] }),
        );
        onIssued(voucher.code);
      }).pipe(
        Effect.catch(() =>
          Effect.sync(() => {
            setError(
              "No pudimos confirmar la emisión. Revisa el servicio y el motivo. Reintentar sin modificar el formulario recupera la misma emisión.",
            );
            setBusy(false);
          }),
        ),
      ),
    );
  }

  return (
    <section className="max-w-xl space-y-6">
      <h2 className="text-2xl font-bold text-heading">Emitir voucher</h2>
      <p>
        Para pagos realizados fuera de Webpay o tratamientos de cortesía. No crea una compra ni una
        transacción de pago en línea.
      </p>
      <form onSubmit={submit} className="space-y-5">
        <fieldset disabled={busy} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="manual-offering" className="block font-bold">
              Servicio publicado
            </label>
            <select
              id="manual-offering"
              required
              value={offeringId}
              onChange={(event) => {
                setOfferingId(event.target.value);
                setRequestId(null);
              }}
              className="w-full rounded-md border border-input bg-card p-3"
            >
              <option value="">Selecciona un servicio</option>
              {offerings?.map((offering) => (
                <option key={offering.id} value={offering.id}>
                  {offering.name} · {formatPrice(offering.priceClp)}
                </option>
              ))}
            </select>
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-2 font-bold">Tipo de emisión</legend>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="category"
                checked={category === "external_payment"}
                onChange={() => {
                  setCategory("external_payment");
                  setRequestId(null);
                }}
              />
              Pago externo
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="category"
                checked={category === "complimentary"}
                onChange={() => {
                  setCategory("complimentary");
                  setRequestId(null);
                }}
              />
              Cortesía
            </label>
          </fieldset>
          <div className="space-y-2">
            <label htmlFor="issuance-reason" className="block font-bold">
              Motivo de emisión
            </label>
            <textarea
              id="issuance-reason"
              required
              maxLength={1000}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setRequestId(null);
              }}
              className="min-h-28 w-full rounded-md border border-input bg-card p-3"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Vigencia: 60 días desde la emisión. Transferible, sin cuenta de destinatario. Después
            podrás descargarlo o enviarlo por correo.
          </p>
          <Button type="submit" disabled={!offeringId || !reason.trim() || busy}>
            {busy ? "Emitiendo…" : "Emitir voucher"}
          </Button>
        </fieldset>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
