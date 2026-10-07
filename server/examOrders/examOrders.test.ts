import { NodeFileSystem } from "@effect/platform-node";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { PDFiumLibrary } from "@hyzyla/pdfium";
import { Effect, Encoding, FileSystem, ManagedRuntime, Schema } from "effect";
import { afterAll, expect, test } from "vite-plus/test";
import { examOrder } from "../../shared/examOrder";
import { RateLimited } from "../../shared/contracts";
import { fixture } from "../testing";

const files = ManagedRuntime.make(NodeFileSystem.layer);

const templates = await files.runPromise(
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const images = new Map<string, Uint8Array>();

    for (const name of [
      "imagenEstudioMetabolico.png",
      "imagenLaboratorioOne.png",
      "imagenLaboratorioTwo.png",
    ]) {
      images.set(name, yield* fs.readFile(`public/templates/${name}`));
    }

    return images;
  }),
);

const pdfium = await PDFiumLibrary.init();

const input = {
  fullName: "María Prueba Muñoz",
  rut: "12.345.678-5",
  age: "35",
  address: "Calle de Prueba 123, Castro",
  diabetes: false,
  surgery: false,
} satisfies typeof examOrder.Encoded;

afterAll(() => {
  pdfium.destroy();

  return files.dispose();
});

// Compare the medical content against the approved raster originals, independently
// of pdf-lib. The correct laboratory must also be closer than the alternative.
const imageDifference = Effect.fnUntraced(function* (bitmap: Uint8Array, template: string) {
  const source = templates.get(template);

  if (source === undefined) return yield* Effect.die(new Error("Missing approved image"));
  const image = yield* Effect.promise(() => loadImage(source));
  const canvas = createCanvas(306, 396);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, 306, 396);
  const pixels = context.getImageData(0, 130, 306, 210).data;
  let difference = 0;

  for (let pixel = 0; pixel < pixels.length; pixel += 4) {
    const offset = 130 * 306 * 4 + pixel;
    difference += Math.abs((bitmap[offset] ?? 0) - (pixels[pixel] ?? 0));
    difference += Math.abs((bitmap[offset + 1] ?? 0) - (pixels[pixel + 1] ?? 0));
    difference += Math.abs((bitmap[offset + 2] ?? 0) - (pixels[pixel + 2] ?? 0));
  }

  return difference / (pixels.length * 0.75);
});

test.each([
  [false, false, "imagenLaboratorioOne.png"],
  [false, true, "imagenLaboratorioTwo.png"],
  [true, false, "imagenLaboratorioTwo.png"],
  [true, true, "imagenLaboratorioTwo.png"],
] as const)(
  "anonymous PDF preserves the approved medical content: diabetes=%s, surgery=%s",
  (diabetes, surgery, laboratory) =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const backend = yield* fixture();
          yield* backend.advance(1718411400000);
          const api = yield* backend.client();
          const patient = yield* Schema.decodeEffect(examOrder)({ ...input, diabetes, surgery });
          const result = yield* api.public.examOrder({ payload: patient });
          expect(result.email).toBe("not-requested");
          yield* Effect.acquireUseRelease(
            Effect.promise(() => pdfium.loadDocument(result.pdf)),
            Effect.fnUntraced(function* (document) {
              expect(document.getPageCount()).toBe(2);

              for (const [index, name] of ["imagenEstudioMetabolico.png", laboratory].entries()) {
                const page = document.getPage(index);
                const text = page.getText();
                expect(text).toContain(input.fullName);
                expect(text).toContain(input.rut);
                expect(text).toContain("35 años");
                expect(text).toContain(input.address);
                // UTC is June 15; Santiago is still June 14.
                expect(text).toContain("14 jun 2024");

                const rendered = yield* Effect.promise(() =>
                  page.render({ scale: 0.5, render: "bitmap" }),
                );

                expect([rendered.originalWidth, rendered.originalHeight]).toEqual([612, 792]);
                const difference = yield* imageDifference(rendered.data, name);
                expect(difference).toBeLessThan(6);

                if (index === 1) {
                  const other =
                    name === "imagenLaboratorioOne.png"
                      ? "imagenLaboratorioTwo.png"
                      : "imagenLaboratorioOne.png";

                  expect(difference).toBeLessThan(yield* imageDifference(rendered.data, other));
                }
              }
            }),
            (document) => Effect.sync(() => document.destroy()),
          );
        }),
      ),
    ),
  30_000,
);

test(
  "email failure and the independent email quota never invalidate a PDF",
  () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const backend = yield* fixture();
          const api = yield* backend.client();

          const patient = yield* Schema.decodeEffect(examOrder)({
            ...input,
            email: "recipient@example.com",
          });

          backend.email.rejectNext();
          const first = yield* api.public.examOrder({ payload: patient });
          expect(first.email).toBe("unconfirmed");
          const second = yield* api.public.examOrder({ payload: patient });
          expect(second.email).toBe("accepted");
          expect(second.pdf).toEqual(first.pdf);
          expect(backend.email.messages.map((message) => message.key)).toEqual([
            backend.email.messages[0]?.key,
            backend.email.messages[0]?.key,
          ]);
          expect(backend.email.messages[0]?.attachments).toEqual([
            {
              filename: "orden-examen.pdf",
              content: Encoding.encodeBase64(first.pdf),
              content_type: "application/pdf",
            },
          ]);
          const third = yield* api.public.examOrder({ payload: patient });
          expect(third.email).toBe("limited");
          expect(third.pdf).toEqual(first.pdf);
          expect(backend.email.messages).toHaveLength(2);
          yield* api.public.examOrder({ payload: patient });
          yield* api.public.examOrder({ payload: patient });
          expect(
            yield* api.public.examOrder({ payload: patient }).pipe(Effect.flip),
          ).toBeInstanceOf(RateLimited);
        }),
      ),
    ),
  30_000,
);
