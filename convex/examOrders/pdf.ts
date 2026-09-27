import { Config, DateTime, Effect, Match, Schema } from "effect";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";
import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { format as formatRut } from "rut.js";
import type { ExamOrder } from "../../shared/examOrder";

import { ExamDocumentError, ExamTextTooLong } from "./model";

function wrapAddress(address: string, font: PDFFont) {
  const lines: string[] = [];
  let line = "";

  for (const word of address.split(" ")) {
    const candidate = line ? `${line} ${word}` : word;

    if (font.widthOfTextAtSize(candidate, 9) > 420 && line) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }

  if (line) lines.push(line);

  return lines;
}

const populatePatient = Effect.fnUntraced(function* (
  page: PDFPage,
  font: PDFFont,
  patient: ExamOrder,
  date: string,
) {
  const nameSize = Math.min(11, (420 / font.widthOfTextAtSize(patient.fullName, 11)) * 11);
  const addressLines = wrapAddress(patient.address, font);

  if (nameSize < 8) {
    return yield* new ExamTextTooLong({
      field: "fullName",
      message: "Abrevia tu nombre para que se pueda imprimir de forma legible.",
    });
  }

  if (
    addressLines.length > 4 ||
    addressLines.some((line) => font.widthOfTextAtSize(line, 9) > 420)
  ) {
    return yield* new ExamTextTooLong({
      field: "address",
      message: "Abrevia tu dirección para que se pueda imprimir de forma legible.",
    });
  }

  const formattedRut = formatRut(patient.rut);

  // PDF coordinates start at the bottom, unlike the legacy PDFKit coordinates.
  page.drawText(patient.fullName, { x: 144, y: 638, size: nameSize, font });
  page.drawText(formattedRut, { x: 144, y: 623, size: 11, font });
  page.drawText(`${patient.age} años`, { x: 144, y: 608, size: 11, font });

  for (const [index, line] of addressLines.entries()) {
    // Continue long addresses in the blank space below the patient block,
    // without crossing its divider or overwriting approved medical text.
    const y = index === 0 ? 594 : 575 - index * 11;
    page.drawText(line, { x: 144, y, size: 9, font });
  }

  page.drawText(date, { x: 274, y: 75, size: 11, font });

  return yield* Effect.void;
});

export const renderExamOrder = Effect.fn("renderExamOrder")(
  function* (patient: ExamOrder) {
    const now = yield* DateTime.now;
    const zone = yield* DateTime.zoneMakeNamedEffect("America/Santiago");
    const local = DateTime.setZone(now, zone);

    const date = DateTime.format(local, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      locale: "es-CL",
    });

    const origin = yield* Config.schema(Schema.URL, "CONVEX_SITE_URL");
    const client = yield* HttpClient.HttpClient;

    const laboratory =
      patient.diabetes || patient.surgery ? "imagenLaboratorioTwo.png" : "imagenLaboratorioOne.png";

    const pdf = yield* Effect.tryPromise(() => PDFDocument.create());
    const font = yield* Effect.tryPromise(() => pdf.embedFont(StandardFonts.Helvetica));
    pdf.setTitle("Órdenes de examen");
    pdf.setAuthor("Dar Spa");
    // Deterministic metadata makes retries of the same order on the same local day
    // produce the same attachment and Resend idempotency key.
    const issuedAt = DateTime.toDateUtc(DateTime.startOf(local, "day"));
    pdf.setCreationDate(issuedAt);
    pdf.setModificationDate(issuedAt);

    for (const template of ["imagenEstudioMetabolico.png", laboratory]) {
      const response = yield* client
        .get(new URL(`/templates/${template}`, origin).href)
        .pipe(Effect.flatMap(HttpClientResponse.filterStatusOk), Effect.timeout("10 seconds"));

      const bytes = yield* response.arrayBuffer;
      const image = yield* Effect.tryPromise(() => pdf.embedPng(bytes));
      const page = pdf.addPage([612, 792]);
      page.drawImage(image, { x: 0, y: 0, width: 612, height: 792 });
      yield* populatePatient(page, font, patient, date);
    }

    return yield* Effect.tryPromise(() => pdf.save());
  },
  Effect.mapError((error) =>
    Match.value(error).pipe(
      Match.tag("ExamTextTooLong", (problem) => problem),
      Match.orElse(
        () =>
          new ExamDocumentError({ message: "No pudimos preparar el PDF. Inténtalo nuevamente." }),
      ),
    ),
  ),
);
