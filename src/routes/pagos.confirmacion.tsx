import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { PaymentPage } from "../features/purchasing/payment-page";

export const Route = createFileRoute("/pagos/confirmacion")({
  ssr: false,
  validateSearch: Schema.toStandardSchemaV1(
    Schema.Struct({ compra: Schema.optional(Schema.String) }),
  ),
  head: () => ({ meta: [{ title: "Resultado del pago · Dar Spa" }] }),
  component: PaymentPage,
});
