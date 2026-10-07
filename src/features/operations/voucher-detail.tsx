import { useRef, useState, type FormEvent } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OperationalVoucher } from "../../../shared/contracts";
import { Effect } from "effect";
import { request } from "../../lib/api";
import { useAccountId } from "../../lib/session";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import { VoucherContent } from "../vouchers/voucher-content";
import { formatDate } from "../purchasing/format";

export function voucherSource(voucher: OperationalVoucher) {
  if (voucher.source === "webpay") return "Webpay";

  if (voucher.category === "complimentary") return "Cortesía";

  if (voucher.category === "external_payment") return "Pago externo";

  return "Emisión manual · clasificación no registrada";
}

const outcomes = {
  redeemed: "Voucher canjeado. Tratamiento iniciado.",
  reversed: "Canje revertido. Se conserva el vencimiento original.",
  expired: "El voucher está vencido. No se realizó el canje.",
  already_redeemed: "El voucher ya estaba canjeado. No se realizó un nuevo canje.",
  not_redeemed: "El voucher no tiene un canje activo que revertir.",
  stale: "El voucher cambió desde tu confirmación. Revisa su estado antes de continuar.",
};

export function VoucherDetail({ code }: { code: string }) {
  const accountId = useAccountId();

  const { data: voucher } = useQuery({
    queryKey: ["account", accountId, "operations", "voucher", code],
    queryFn: ({ signal }) => request((api) => api.operations.voucher({ params: { code } }), signal),
  });

  if (voucher === undefined) return <output>Cargando voucher…</output>;

  if (voucher === null)
    return <output>No encontramos ese código. Revisa el voucher e inténtalo de nuevo.</output>;

  return (
    <section className="space-y-6">
      <header>
        <p className="mb-2 text-sm font-bold text-primary">{voucherSource(voucher)}</p>
        <h2 className="text-2xl font-bold text-heading">{voucher.terms.name}</h2>
        {voucher.customer && (
          <p className="mt-2 text-muted-foreground">Comprador: {voucher.customer.email}</p>
        )}
      </header>
      <div className="grid items-start gap-10 lg:grid-cols-2">
        <div className="max-w-lg">
          <VoucherContent key={voucher.id} voucher={voucher} email="" />
        </div>
        <div className="space-y-8">
          <Redemption key={voucher.id} voucher={voucher} />
          <section className="space-y-3 border-t border-border pt-6">
            <h3 className="text-lg font-bold">Historial</h3>
            <p className="text-sm">
              Emitido el {formatDate(voucher.issuedAt)}
              {voucher.issuedBy && ` por ${voucher.issuedBy}`}.
            </p>
            {voucher.issuanceReason && (
              <p className="text-sm whitespace-pre-wrap">Motivo: {voucher.issuanceReason}</p>
            )}
            {voucher.source === "manual" && voucher.issuedBy === null && (
              <p className="text-sm text-muted-foreground">Autor de emisión no registrado.</p>
            )}
            <VoucherHistory voucher={voucher} />
          </section>
        </div>
      </div>
    </section>
  );
}

function Redemption({ voucher }: { voucher: OperationalVoucher }) {
  const accountId = useAccountId();
  const queryClient = useQueryClient();
  const actionButton = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const [confirmation, setConfirmation] = useState<{
    kind: "redeem" | "reverse";
    revision: number;
  } | null>(null);

  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (confirmation === null) return;
    const input = { voucherId: voucher.id, revision: confirmation.revision };
    setBusy(true);
    setError("");
    Effect.runFork(
      Effect.tryPromise(() =>
        request((api) =>
          confirmation.kind === "redeem"
            ? api.operations.redeem({ payload: input })
            : api.operations.reverse({ payload: { ...input, reason } }),
        ),
      ).pipe(
        Effect.tap(() =>
          Effect.tryPromise(() =>
            queryClient.invalidateQueries({ queryKey: ["account", accountId] }),
          ),
        ),
        Effect.match({
          onSuccess: (outcome) => {
            setMessage(outcomes[outcome]);
            setConfirmation(null);
            setReason("");
            setBusy(false);
          },
          onFailure: () => {
            setError(
              "No pudimos confirmar la operación. Revisa el estado y el motivo antes de reintentar.",
            );
            setBusy(false);
          },
        }),
      ),
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <h3 ref={heading} tabIndex={-1} className="text-lg font-bold">
        Canje del voucher
      </h3>
      <p className="text-sm">
        Confirma el canje solo cuando comienza el tratamiento. En paquetes, se canjea una vez al
        iniciar; las sesiones restantes se controlan fuera de la aplicación.
      </p>
      {voucher.expired && (
        <p className="font-bold text-destructive">
          Vencido. No admite nuevos canjes, incluso si se revierte uno anterior.
        </p>
      )}
      {voucher.redeemed ? (
        <>
          <p className="font-bold">Este voucher ya fue canjeado.</p>
          <Button
            ref={actionButton}
            variant="outline"
            onClick={() => {
              setError("");
              setConfirmation({ kind: "reverse", revision: voucher.revision });
            }}
          >
            Corregir canje accidental
          </Button>
        </>
      ) : (
        <Button
          ref={actionButton}
          disabled={voucher.expired}
          onClick={() => {
            setError("");
            setConfirmation({ kind: "redeem", revision: voucher.revision });
          }}
        >
          Canjear al iniciar tratamiento
        </Button>
      )}
      {message && <output className="block text-sm font-bold">{message}</output>}
      <Dialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirmation(null);
        }}
      >
        <DialogContent
          className="space-y-4"
          onCloseAutoFocus={(event) => {
            event.preventDefault();

            // The action can change or become disabled after a successful correction.
            if (actionButton.current !== null && !actionButton.current.disabled) {
              actionButton.current.focus();
            } else heading.current?.focus();
          }}
        >
          <DialogTitle className="pr-8 text-xl font-bold text-heading">
            {confirmation?.kind === "reverse"
              ? "Revertir canje accidental"
              : "Confirmar inicio del tratamiento"}
          </DialogTitle>
          <DialogDescription>
            {voucher.terms.name}. Vence el {formatDate(voucher.expiresAt)}. Esta acción quedará
            registrada con tu cuenta.
          </DialogDescription>
          <form onSubmit={confirm} className="space-y-4">
            {confirmation?.kind === "reverse" && (
              <div className="space-y-2">
                <label htmlFor="reversal-reason" className="block font-bold">
                  Motivo de la corrección
                </label>
                <textarea
                  id="reversal-reason"
                  required
                  maxLength={1000}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="min-h-24 w-full rounded-md border border-input bg-background p-3"
                />
                <p className="text-sm">
                  No se borrará el canje anterior ni se extenderá la vigencia.
                </p>
              </div>
            )}
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={busy}>
                {busy ? "Confirmando…" : "Confirmar"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setConfirmation(null)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function VoucherHistory({ voucher }: { voucher: OperationalVoucher }) {
  const accountId = useAccountId();

  const history = useInfiniteQuery({
    queryKey: ["account", accountId, "operations", "voucher-history", voucher.id],
    initialPageParam: null,
    queryFn: ({ pageParam, signal }: { pageParam: string | null; signal: AbortSignal }) =>
      request(
        (api) =>
          api.operations.history({
            params: { voucherId: voucher.id },
            payload: { cursor: pageParam },
          }),
        signal,
      ),
    getNextPageParam: (page) => page.nextCursor,
  });

  const results = history.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      {results.length === 0 && !history.isPending && (
        <p className="text-sm text-muted-foreground">
          Sin acciones de canje registradas. Los registros históricos pueden no indicar autor, fecha
          o motivo.
        </p>
      )}
      <ol className="space-y-4">
        {results.map((event) => (
          <li key={event.id} className="border-l-2 border-primary/30 pl-4 text-sm">
            <p className="font-bold">
              {event.kind === "redeemed" ? "Canje" : "Reversión"} · {formatDate(event.at)}
            </p>
            <p className="break-all text-muted-foreground">{event.actor}</p>
            {event.reason && <p className="mt-1 whitespace-pre-wrap">{event.reason}</p>}
          </li>
        ))}
      </ol>
      {history.hasNextPage && (
        <Button
          variant="outline"
          disabled={history.isFetching}
          onClick={() => {
            void history.fetchNextPage();
          }}
        >
          Más historial
        </Button>
      )}
    </>
  );
}
