import type { PaymentStatus } from "../../../shared/contracts";

export const paymentLabels = {
  creating: "Preparando Webpay",
  pending: "Pago pendiente",
  unknown: "Pago por confirmar",
  paid: "Pago confirmado",
  declined: "Pago rechazado",
  aborted: "Pago cancelado",
  timed_out: "Tiempo de pago agotado",
  error: "No se pudo iniciar el pago",
} satisfies Record<PaymentStatus, string>;

export function formatShortDate(timestamp: number) {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    dateStyle: "medium",
  }).format(timestamp);
}

export function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    dateStyle: "long",
    timeStyle: "short",
  }).format(timestamp);
}
