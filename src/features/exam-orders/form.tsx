import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Effect, Schema } from "effect";
import {
  examOrder,
  validationErrors,
  type EmailOutcome,
  type FieldError,
} from "../../../shared/examOrder";
import { Button } from "../../components/ui/button";
import { requestExamOrder } from "./client";

const emailMessages: Record<EmailOutcome, string> = {
  "not-requested": "",
  accepted:
    "El proveedor aceptó el correo para envío. Revisa tu bandeja de entrada y spam; esto no confirma su entrega.",
  unconfirmed: "No pudimos confirmar el envío del correo. Puedes descargar tu PDF aquí.",
  limited: "El envío de correos alcanzó su límite temporal. Puedes descargar tu PDF aquí.",
};

function Download({ pdf }: { pdf: Blob }) {
  const url = useRef<string | null>(null);
  const button = useRef<HTMLButtonElement>(null);

  // Synchronize browser focus and release the download resource on close.
  useEffect(() => {
    const next = URL.createObjectURL(pdf);
    url.current = next;
    button.current?.focus();

    return () => {
      URL.revokeObjectURL(next);
      url.current = null;
    };
  }, [pdf]);

  function download() {
    if (url.current === null) return;
    const link = document.createElement("a");
    link.href = url.current;
    link.download = "orden-examen.pdf";
    document.body.append(link);
    link.click();
    link.remove();
  }

  return (
    <Button ref={button} onClick={download}>
      Descargar PDF
    </Button>
  );
}

function PatientField({
  name,
  label,
  error,
  type = "text",
  maxLength,
  autoComplete,
}: {
  name: "fullName" | "rut" | "age" | "address" | "email";
  label: string;
  error: FieldError | undefined;
  type?: "text" | "email";
  maxLength?: number;
  autoComplete?: string;
}) {
  const id = useId();

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block font-bold">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        inputMode={name === "age" ? "numeric" : undefined}
        autoComplete={autoComplete}
        maxLength={maxLength}
        required
        aria-invalid={error !== undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="w-full rounded-md border border-input bg-card px-3 py-2.5"
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error.message}
        </p>
      )}
    </div>
  );
}

export function ExamOrderForm() {
  const [byEmail, setByEmail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<{ pdf: Blob; email: EmailOutcome } | null>(null);
  const errorSummary = useRef<HTMLDivElement>(null);

  function showErrors(fields: FieldError[], text: string) {
    setErrors(fields);
    setMessage(text);
    setBusy(false);
    // The summary is always mounted, so focus does not depend on a later render.
    errorSummary.current?.focus();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy) return;
    const data = new FormData(event.currentTarget);

    const input = {
      fullName: data.get("fullName"),
      rut: data.get("rut"),
      age: data.get("age"),
      address: data.get("address"),
      diabetes: data.has("diabetes"),
      surgery: data.has("surgery"),
      email: byEmail ? data.get("email") : undefined,
    };

    setBusy(true);
    setErrors([]);
    setMessage("");
    Effect.runFork(
      Effect.gen(function* () {
        const patient = yield* Schema.decodeUnknownEffect(examOrder, { errors: "all" })(input);
        const response = yield* Effect.tryPromise(() => requestExamOrder(patient));

        if ("problem" in response) {
          showErrors([...response.problem.fields], response.problem.message);

          return;
        }

        setResult(response);
        setBusy(false);
      }).pipe(
        Effect.catchTag("SchemaError", (error) =>
          Effect.sync(() =>
            showErrors(validationErrors(error), "Revisa los datos del formulario."),
          ),
        ),
        Effect.catch(() =>
          Effect.sync(() =>
            showErrors(
              [],
              "No pudimos completar la solicitud. Si pediste correo, no podemos confirmar su envío. Inténtalo nuevamente; repetir los mismos datos hoy no vuelve a enviar un correo ya aceptado.",
            ),
          ),
        ),
      ),
    );
  }

  if (result !== null) {
    return (
      <div className="space-y-5">
        <div aria-live="polite" className="space-y-2">
          <h3 className="text-xl font-bold text-heading">Tu PDF está listo</h3>
          <p>
            Incluye la orden de estudio metabólico y la orden de laboratorio. Imprime ambas páginas
            en tamaño carta.
          </p>
          {result.email !== "not-requested" && <p>{emailMessages[result.email]}</p>}
        </div>
        <div className="flex flex-wrap gap-3">
          <Download pdf={result.pdf} />
          <Button
            variant="outline"
            onClick={() => {
              setResult(null);
              setByEmail(false);
            }}
          >
            Generar otra orden
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div ref={errorSummary} tabIndex={-1} role="alert" className="text-destructive outline-none">
        {message}
      </div>
      <fieldset disabled={busy} className="space-y-5">
        <legend className="sr-only">Datos de la persona que realizará los exámenes</legend>
        <PatientField
          name="fullName"
          label="Nombre completo"
          autoComplete="name"
          maxLength={80}
          error={errors.find((error) => error.field === "fullName")}
        />
        <div className="grid grid-cols-2 gap-4">
          <PatientField
            name="rut"
            label="RUT"
            maxLength={14}
            error={errors.find((error) => error.field === "rut")}
          />
          <PatientField
            name="age"
            label="Edad (años)"
            maxLength={3}
            error={errors.find((error) => error.field === "age")}
          />
        </div>
        <PatientField
          name="address"
          label="Dirección"
          autoComplete="street-address"
          maxLength={240}
          error={errors.find((error) => error.field === "address")}
        />
        <fieldset className="space-y-3">
          <legend className="mb-3 font-bold">Marca lo que corresponda</legend>
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" name="diabetes" className="size-5 shrink-0 accent-primary" />
            Tengo diabetes.
          </label>
          <label className="flex min-h-11 items-start gap-3">
            <input type="checkbox" name="surgery" className="mt-1 size-5 shrink-0 accent-primary" />
            Me he sometido a una cirugía de control de peso en los últimos 3 años.
          </label>
        </fieldset>
        <div className="space-y-3 border-t border-border pt-4">
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              checked={byEmail}
              onChange={(event) => setByEmail(event.target.checked)}
              className="size-5 shrink-0 accent-primary"
            />
            Enviar también una copia a mi correo
          </label>
          {byEmail && (
            <PatientField
              name="email"
              label="Correo electrónico"
              type="email"
              autoComplete="email"
              maxLength={254}
              error={errors.find((error) => error.field === "email")}
            />
          )}
          <p className="text-sm text-muted-foreground">
            No necesitas una cuenta. No guardamos tus datos ni tu PDF. Si eliges correo, Resend
            procesará el envío y el archivo adjunto.
          </p>
        </div>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Preparando órdenes…" : "Generar PDF"}
        </Button>
        {busy && (
          <output className="block text-sm">Espera mientras preparamos tus dos páginas.</output>
        )}
      </fieldset>
    </form>
  );
}
