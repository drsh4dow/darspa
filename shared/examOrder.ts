import { Schema, SchemaIssue } from "effect";
import { validate as validateRut } from "rut.js";
import { normalizedEmailAddress } from "./email";

const printableText = Schema.Trim.check(
  Schema.isMinLength(1),
  // The approved documents use Helvetica's Latin character set. Reject control
  // characters rather than allowing line breaks to overwrite template content.
  Schema.isPattern(/^[\x20-\x7e\u00a0-\u00ff]+$/),
);

// Preserve the legacy RUT validator rather than owning a second checksum policy.
const rut = Schema.Trim.check(
  Schema.isMinLength(8),
  Schema.isMaxLength(14),
  Schema.makeFilter(validateRut),
);

export const examOrder = Schema.Struct({
  fullName: printableText.check(Schema.isMaxLength(80)),
  rut,
  age: Schema.String.check(Schema.isPattern(/^\d{1,3}$/)).pipe(
    Schema.decodeTo(
      Schema.NumberFromString.check(Schema.isInt(), Schema.isBetween({ minimum: 0, maximum: 130 })),
    ),
  ),
  address: printableText.check(Schema.isMaxLength(240)),
  diabetes: Schema.Boolean,
  surgery: Schema.Boolean,
  email: Schema.optional(normalizedEmailAddress.check(Schema.isMaxLength(254))),
});

export type ExamOrder = typeof examOrder.Type;

export const fieldMessages = {
  fullName: "Ingresa tu nombre completo (máximo 80 caracteres, con letras latinas).",
  rut: "Ingresa un RUT válido, incluido su dígito verificador.",
  age: "Ingresa una edad entera entre 0 y 130 años.",
  address: "Ingresa tu dirección (máximo 240 caracteres, con letras latinas).",
  diabetes: "Indica si tienes diabetes.",
  surgery: "Indica si te has sometido a una cirugía de control de peso en los últimos 3 años.",
  email: "Ingresa un correo electrónico válido para recibir tu copia.",
} as const;

const fieldNames = ["fullName", "rut", "age", "address", "diabetes", "surgery", "email"] as const;

export const fieldError = Schema.Struct({
  field: Schema.Literals(fieldNames),
  message: Schema.String,
});

export type FieldError = typeof fieldError.Type;

export function validationErrors(error: Schema.SchemaError): FieldError[] {
  const formatted = SchemaIssue.makeFormatterStandardSchemaV1()(error.issue);
  const errors: FieldError[] = [];

  for (const field of fieldNames) {
    if (formatted.issues.some((issue) => issue.path?.[0] === field)) {
      errors.push({ field, message: fieldMessages[field] });
    }
  }

  return errors;
}

export const examProblem = Schema.Struct({
  message: Schema.String,
  fields: Schema.Array(fieldError),
});

export const emailOutcome = Schema.Literals([
  "not-requested",
  "accepted",
  "unconfirmed",
  "limited",
]);

export type EmailOutcome = typeof emailOutcome.Type;
