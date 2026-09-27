import { NodeFileSystem } from "@effect/platform-node";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { PDFiumLibrary } from "@hyzyla/pdfium";
import { register } from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { ConfigProvider, Effect, Encoding, FileSystem, ManagedRuntime, Schema } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";
import { afterAll, afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { internal } from "../_generated/api";
import schema from "../schema";
import type { examOrder } from "../../shared/examOrder";
import { examProblem } from "../../shared/examOrder";
import { handleExamRequest } from "./http";
import { ExamLimits, ExamOrders, ExamRateLimited } from "./model";
import { generateExamOrder } from "./workflow";

const modules = import.meta.glob("/convex/**/*.ts");

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

const patient = {
  fullName: "María Prueba Muñoz",
  rut: "12.345.678-5",
  age: "35",
  address: "Calle de Prueba 123, Castro",
  diabetes: false,
  surgery: false,
} satisfies typeof examOrder.Encoded;

beforeEach(() => vi.useFakeTimers({ toFake: ["Date"], now: 1718411400000 }));

afterEach(() => vi.useRealTimers());

afterAll(() => {
  pdfium.destroy();

  return files.dispose();
});

const request = Effect.fnUntraced(function* (input: typeof examOrder.Encoded = patient) {
  const body = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(input);

  return new Request("https://synthetic.convex.site/api/exam-orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://synthetic.convex.site" },
    body,
  });
});

function transport(messages: Request[] = [], mailStatus = 200) {
  return HttpClient.make(
    Effect.fnUntraced(function* (outgoing) {
      if (outgoing.url === "https://api.resend.com/emails") {
        messages.push(yield* HttpClientRequest.toWeb(outgoing).pipe(Effect.orDie));

        return HttpClientResponse.fromWeb(
          outgoing,
          Response.json({ id: "synthetic-message" }, { status: mailStatus }),
        );
      }

      const name = new URL(outgoing.url).pathname.split("/").at(-1);
      const image = name === undefined ? undefined : templates.get(name);

      if (image === undefined) return yield* Effect.die(new Error("Unexpected template URL"));

      return HttpClientResponse.fromWeb(outgoing, new Response(new Uint8Array(image)));
    }),
  );
}

const limits = ExamLimits.of({ consume: () => Effect.void });

const runRequest = (incoming: ReturnType<typeof request>, client = transport(), budget = limits) =>
  incoming.pipe(
    Effect.flatMap(handleExamRequest),
    Effect.provideService(ExamOrders, {
      generate: (input) =>
        generateExamOrder(input).pipe(
          Effect.provideService(HttpClient.HttpClient, client),
          Effect.provideService(ExamLimits, budget),
        ),
    }),
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromUnknown({
        SITE_URL: "https://synthetic.convex.site",
        CONVEX_SITE_URL: "https://synthetic.convex.site",
        CONVEX_CLOUD_URL: "https://industrious-retriever-886.convex.cloud",
        DEVELOPMENT_EMAIL_RECIPIENTS: "recipient@example.com",
        RESEND_API_KEY: "synthetic-key",
        AUTH_EMAIL_FROM: "Dar Spa <test@example.com>",
      }),
    ),
  );

// Compare printed medical content independently of the PDF generation library.
// Different image resamplers produce small edge differences. Requiring the
// approved template to be the closest match prevents a generous tolerance from
// accepting the other laboratory's clinically different order.
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
    // pdfium's wrapper sets REVERSE_BYTE_ORDER, so both buffers are RGBA.
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
  "anonymous PDF: diabetes=%s, surgery=%s",
  (diabetes, surgery, laboratory) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const response = yield* runRequest(request({ ...patient, diabetes, surgery }));
        expect(response.status).toBe(200);
        expect(response.headers.get("Cache-Control")).toBe("no-store");
        expect(response.headers.get("X-Exam-Email")).toBe("not-requested");
        const bytes = new Uint8Array(yield* Effect.promise(() => response.arrayBuffer()));

        yield* Effect.acquireUseRelease(
          Effect.promise(() => pdfium.loadDocument(bytes)),
          Effect.fnUntraced(function* (document) {
            expect(document.getPageCount()).toBe(2);

            for (const [index, name] of ["imagenEstudioMetabolico.png", laboratory].entries()) {
              const page = document.getPage(index);
              const text = page.getText();
              expect(text).toContain(patient.fullName);
              expect(text).toContain(patient.rut);
              expect(text).toContain("35 años");
              expect(text).toContain(patient.address);
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
  30_000,
);

test("invalid patient inputs are rejected before document or email work", () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const response = yield* runRequest(
        request({ ...patient, age: "", rut: "12.345.678-9", fullName: " ", email: "invalid" }),
      );

      expect(response.status).toBe(400);
      const body: unknown = yield* Effect.promise(() => response.json());
      const problem = yield* Schema.decodeUnknownEffect(examProblem)(body);
      expect(problem.fields.map((error) => error.field)).toEqual([
        "fullName",
        "rut",
        "age",
        "email",
      ]);
    }),
  ));

test.each([200, 500])(
  "email HTTP %i preserves the PDF; accepted retries keep the same attachment and key",
  (status) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const messages: Request[] = [];
        const client = transport(messages, status);

        const response = yield* runRequest(
          request({ ...patient, email: "recipient@example.com" }),
          client,
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("X-Exam-Email")).toBe(
          status === 200 ? "accepted" : "unconfirmed",
        );
        const pdf = new Uint8Array(yield* Effect.promise(() => response.arrayBuffer()));
        expect(messages).toHaveLength(1);
        const message = messages[0];

        if (message === undefined) return yield* Effect.die(new Error("Missing email"));
        const body: unknown = yield* Effect.promise(() => message.clone().json());
        expect(body).toHaveProperty(
          "text",
          expect.stringContaining("Imprime ambas páginas en tamaño carta."),
        );
        expect(body).toHaveProperty(
          "html",
          expect.stringContaining('src="https://synthetic.convex.site/images/darspa-logo.png"'),
        );
        expect(body).toMatchObject({
          subject: "Tus órdenes de examen — Dar Spa",
          attachments: [
            {
              filename: "orden-examen.pdf",
              content: Encoding.encodeBase64(pdf),
              content_type: "application/pdf",
            },
          ],
        });

        if (status === 200) {
          yield* runRequest(request({ ...patient, email: "recipient@example.com" }), client);
          const retry = messages[1];

          if (retry === undefined) return yield* Effect.die(new Error("Missing retry"));
          expect(retry.headers.get("Idempotency-Key")).toBe(message.headers.get("Idempotency-Key"));
          expect(yield* Effect.promise(() => retry.text())).toBe(
            yield* Effect.promise(() => message.text()),
          );
        }

        return yield* Effect.void;
      }),
    ),
  30_000,
);

test(
  "generation throttles with retry guidance; email throttling never blocks download",
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const blocked = ExamLimits.of({
          consume: () => Effect.fail(new ExamRateLimited({ retryAfter: 60_000 })),
        });

        const response = yield* runRequest(request(), transport(), blocked);
        expect(response.status).toBe(429);
        expect(response.headers.get("Retry-After")).toBe("60");

        const emailBlocked = ExamLimits.of({
          consume: (operation) =>
            operation === "examEmail"
              ? Effect.fail(new ExamRateLimited({ retryAfter: 60_000 }))
              : Effect.void,
        });

        const downloaded = yield* runRequest(
          request({ ...patient, email: "recipient@example.com" }),
          transport(),
          emailBlocked,
        );

        expect(downloaded.status).toBe(200);
        expect(downloaded.headers.get("X-Exam-Email")).toBe("limited");
      }),
    ),
  30_000,
);

test("the Convex budget is shared across anonymous callers and email has an independent quota", () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const backend = convexTest(schema, modules);
      register(backend);

      const results = yield* Effect.promise(() =>
        Promise.all(
          Array.from({ length: 6 }, () =>
            backend.mutation(internal.examOrders.limits.consume, { operation: "examGeneration" }),
          ),
        ),
      );

      expect(results.filter((result) => result.ok)).toHaveLength(5);
      expect(results.some((result) => !result.ok && result.retryAfter > 0)).toBe(true);
      expect(
        yield* Effect.promise(() =>
          backend.mutation(internal.examOrders.limits.consume, { operation: "examEmail" }),
        ),
      ).toMatchObject({ ok: true });
    }),
  ));
