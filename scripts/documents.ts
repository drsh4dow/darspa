import { NodeFileSystem, NodeRuntime } from "@effect/platform-node";
import { DateTime, Effect, FileSystem, Layer } from "effect";
import { PDFDocument } from "pdf-lib";
import artwork from "../content/voucher-artwork.json" with { type: "json" };

// Embed the approved raster artwork at build time. Workers only copy compressed
// PDF pages and add patient/voucher text, avoiding large PNG decoder allocations.
const buildDocuments = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory("public/documents/templates", { recursive: true });
  const background = artwork[0];

  if (background === undefined) return yield* Effect.die(new Error("Voucher artwork missing"));

  const templates = [
    {
      name: "metabolic",
      images: ["/templates/imagenEstudioMetabolico.png"],
      width: 612,
      height: 792,
    },
    {
      name: "laboratory",
      images: ["/templates/imagenLaboratorioOne.png"],
      width: 612,
      height: 792,
    },
    {
      name: "laboratory-extended",
      images: ["/templates/imagenLaboratorioTwo.png"],
      width: 612,
      height: 792,
    },
    {
      name: "voucher",
      images: [background.image, "/templates/giftcardForeground.png"],
      width: 620,
      height: 437,
    },
  ];

  for (const template of templates) {
    const pdf = yield* Effect.tryPromise(() => PDFDocument.create());
    const page = pdf.addPage([template.width, template.height]);
    const timestamp = DateTime.toDateUtc(DateTime.makeUnsafe(0));
    pdf.setCreationDate(timestamp);
    pdf.setModificationDate(timestamp);

    for (const path of template.images) {
      const bytes = yield* fs.readFile(`public${path}`);
      const image = yield* Effect.tryPromise(() => pdf.embedPng(bytes));
      page.drawImage(image, { x: 0, y: 0, width: template.width, height: template.height });
    }

    const bytes = yield* Effect.tryPromise(() => pdf.save());
    yield* fs.writeFile(`public/documents/templates/${template.name}.pdf`, bytes);
  }

  return yield* Effect.logInfo("Built four PDF artwork templates.");
});

NodeRuntime.runMain(
  Effect.scoped(
    Effect.gen(function* () {
      const services = yield* Layer.build(NodeFileSystem.layer);

      return yield* buildDocuments.pipe(Effect.provideContext(services));
    }),
  ),
);
