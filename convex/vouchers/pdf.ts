import { Config, Effect, Schema } from "effect";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import type { Infer } from "convex/values";
import type { voucherDetails } from "./model";
import artwork from "../../content/voucher-artwork.json";

export class VoucherDocumentError extends Schema.TaggedError<VoucherDocumentError>()(
  "VoucherDocumentError",
  {
    message: Schema.String,
  },
) {}

export const renderVoucher = Effect.fn("renderVoucher")(
  function* (voucher: Infer<typeof voucherDetails>) {
    const origin = yield* Config.schema(Schema.URL, "CONVEX_SITE_URL");
    const client = yield* HttpClient.HttpClient;
    const background = artwork[0];

    if (background === undefined) return yield* Effect.die(new Error("Voucher artwork missing"));
    const images: Uint8Array[] = [];

    for (const path of [background.image, "/templates/giftcardForeground.png"]) {
      const response = yield* client
        .get(new URL(path, origin).href)
        .pipe(Effect.flatMap(HttpClientResponse.filterStatusOk), Effect.timeout("10 seconds"));

      images.push(new Uint8Array(yield* response.arrayBuffer));
    }

    const [backgroundBytes, overlayBytes] = images;

    if (backgroundBytes === undefined || overlayBytes === undefined)
      return yield* Effect.die(new Error("Voucher images missing"));

    const doc = yield* Effect.promise(() => PDFDocument.create());
    const regular = yield* Effect.promise(() => doc.embedFont(StandardFonts.Helvetica));
    const bold = yield* Effect.promise(() => doc.embedFont(StandardFonts.HelveticaBold));

    const qrBytes = yield* Effect.promise(() =>
      QRCode.toBuffer(voucher.code, { width: 400, margin: 2, errorCorrectionLevel: "M" }),
    );

    const bg = yield* Effect.promise(() => doc.embedPng(backgroundBytes));
    const overlay = yield* Effect.promise(() => doc.embedPng(overlayBytes));
    const qr = yield* Effect.promise(() => doc.embedPng(qrBytes));

    const expiry = new Intl.DateTimeFormat("es-CL", {
      timeZone: "America/Santiago",
      dateStyle: "short",
      timeStyle: "short",
    }).format(voucher.expiresAt);

    const page = doc.addPage([620, 437]);
    page.drawImage(bg, { x: 0, y: 0, width: 620, height: 437 });
    page.drawImage(overlay, { x: 0, y: 0, width: 620, height: 437 });
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

    const text = `${voucher.terms.name}\n\nCódigo: ${voucher.code}\nValor comprado: ${price} CLP\nVence: ${expiry} (hora de Chile continental).\n\nVálido durante 60 días desde su emisión.\nTransferible: quien presenta este código puede usarlo.\nUn paquete se canjea una sola vez al iniciar el tratamiento.\nReserva tu hora con Dar Spa. No requiere cuenta para canjearlo.\n\nDescripción al comprar:\n${voucher.terms.description}\n\nEste voucher no es un documento tributario.`;
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

    return yield* Effect.promise(() => doc.save());
  },
  Effect.mapError(
    () =>
      new VoucherDocumentError({
        message: "No pudimos preparar el PDF. Tu voucher sigue disponible.",
      }),
  ),
);
