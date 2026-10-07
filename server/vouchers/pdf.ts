import { DateTime, Effect, Schema } from "effect";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import type { Voucher } from "../../shared/contracts";
import { DocumentAssets } from "../documents/assets";

export class VoucherDocumentError extends Schema.TaggedError<VoucherDocumentError>()(
  "VoucherDocumentError",
  {
    message: Schema.String,
  },
) {}

export const renderVoucher = Effect.fn("renderVoucher")(
  function* (voucher: Voucher) {
    const assets = yield* DocumentAssets;
    const template = yield* assets.read("voucher");

    const doc = yield* Effect.tryPromise(() =>
      PDFDocument.load(template, { updateMetadata: false }),
    );

    const regular = yield* Effect.promise(() => doc.embedFont(StandardFonts.Helvetica));
    const bold = yield* Effect.promise(() => doc.embedFont(StandardFonts.HelveticaBold));

    const qrBytes = yield* Effect.promise(() =>
      QRCode.toBuffer(voucher.code, { width: 400, margin: 2, errorCorrectionLevel: "M" }),
    );

    const qr = yield* Effect.promise(() => doc.embedPng(qrBytes));

    const expiry = new Intl.DateTimeFormat("es-CL", {
      timeZone: "America/Santiago",
      dateStyle: "short",
      timeStyle: "short",
    }).format(voucher.expiresAt);

    const page = doc.getPage(0);
    page.drawImage(qr, { x: 24, y: 326, width: 84, height: 84 });
    page.drawText(voucher.terms.name, {
      x: 155,
      y: 249,
      font: bold,
      size: 15,
      maxWidth: 430,
      lineHeight: 19,
    });
    page.drawText(expiry, { x: 425, y: 24, font: regular, size: 10, color: rgb(0, 0, 0) });

    const terms = doc.addPage([595, 842]);
    terms.drawText("Tu voucher Dar Spa", { x: 45, y: 790, font: bold, size: 22 });

    const price = new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }).format(voucher.terms.priceClp);

    const priceLabel =
      voucher.source === "webpay" ? "Valor comprado" : "Valor de referencia del servicio";

    const text = `${voucher.terms.name}\n\nCódigo: ${voucher.code}\n${priceLabel}: ${price} CLP\nVence: ${expiry} (hora de Chile continental).\n\nVálido durante 60 días desde su emisión.\nTransferible: quien presenta este código puede usarlo.\nUn paquete se canjea una sola vez al iniciar el tratamiento.\nReserva tu hora con Dar Spa. No requiere cuenta para canjearlo.\n\nDescripción del servicio:\n${voucher.terms.description}\n\nEste voucher no es un documento tributario.`;
    // Wrap explicitly and paginate long purchased descriptions rather than clipping them.
    let current = terms;
    let y = 750;

    for (const paragraph of text.split("\n")) {
      let line = "";

      for (const word of paragraph.split(" ")) {
        const candidate = line ? `${line} ${word}` : word;

        if (regular.widthOfTextAtSize(candidate, 11) > 500 && line) {
          current.drawText(line, { x: 45, y, font: regular, size: 11 });
          y -= 17;

          if (y < 50) {
            current = doc.addPage([595, 842]);
            y = 790;
          }

          line = word;
        } else line = candidate;
      }

      current.drawText(line, { x: 45, y, font: regular, size: 11 });
      y -= 17;

      if (y < 50) {
        current = doc.addPage([595, 842]);
        y = 790;
      }
    }

    doc.setTitle(`Voucher ${voucher.terms.name}`);
    doc.setAuthor("Dar Spa");
    const issuedAt = DateTime.toDateUtc(DateTime.makeUnsafe(voucher.issuedAt));
    doc.setCreationDate(issuedAt);
    doc.setModificationDate(issuedAt);

    return yield* Effect.promise(() => doc.save());
  },
  Effect.mapError(
    () =>
      new VoucherDocumentError({
        message: "No pudimos preparar el PDF. Tu voucher sigue disponible.",
      }),
  ),
);
