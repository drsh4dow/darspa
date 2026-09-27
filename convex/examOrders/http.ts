import { Config, Effect, Match, Schema } from "effect";
import { internal } from "../_generated/api";
import { httpAction, type ActionCtx } from "../_generated/server";
import { examOrder, validationErrors } from "../../shared/examOrder";
import { runConvex } from "../lib/runtime";
import { developmentTarget } from "../lib/developmentSync";
import { ExamDocumentError, ExamOrders, ExamRateLimited, ExamTextTooLong } from "./model";

const requestOrders = (ctx: ActionCtx) =>
  ExamOrders.of({
    generate: Effect.fnUntraced(function* (patient) {
      const encoded = yield* Schema.encodeEffect(Schema.fromJsonString(examOrder))(patient).pipe(
        Effect.orDie,
      );

      const result = yield* Effect.promise(() =>
        ctx.runAction(internal.examOrders.generate.generate, { patient: encoded }),
      );

      return yield* Match.value(result).pipe(
        Match.when({ kind: "document" }, (document) =>
          Effect.succeed({ pdf: new Uint8Array(document.pdf), email: document.email }),
        ),
        Match.when({ kind: "invalid" }, (error) =>
          Effect.fail(new ExamTextTooLong({ field: error.field, message: error.message })),
        ),
        Match.when({ kind: "limited" }, (error) =>
          Effect.fail(new ExamRateLimited({ retryAfter: error.retryAfter })),
        ),
        Match.when({ kind: "unavailable" }, () =>
          Effect.fail(
            new ExamDocumentError({ message: "No pudimos preparar el PDF. Inténtalo nuevamente." }),
          ),
        ),
        Match.exhaustive,
      );
    }),
  });

class InvalidExamRequest extends Schema.TaggedError<InvalidExamRequest>()("InvalidExamRequest", {
  message: Schema.String,
}) {}

const readBody = Effect.fnUntraced(function* (request: Request) {
  const stream = request.body;

  if (stream === null) return yield* new InvalidExamRequest({ message: "Completa el formulario." });

  return yield* Effect.acquireUseRelease(
    Effect.sync(() => stream.getReader()),
    Effect.fnUntraced(function* (reader) {
      const decoder = new TextDecoder();
      let body = "";
      let size = 0;

      while (true) {
        const chunk = yield* Effect.tryPromise(() => reader.read());

        if (chunk.done) return body + decoder.decode();
        size += chunk.value.byteLength;

        if (size > 8192)
          return yield* new InvalidExamRequest({
            message: "El formulario supera el tamaño permitido.",
          });
        body += decoder.decode(chunk.value, { stream: true });
      }
    }),
    (reader) => Effect.promise(() => reader.cancel()),
  );
});

export const handleExamRequest = Effect.fnUntraced(function* (request: Request) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin",
  });

  const site = yield* Config.schema(Schema.URL, "SITE_URL");
  const deployment = yield* Config.String("CONVEX_CLOUD_URL").pipe(Config.withDefault(""));
  const origin = request.headers.get("Origin");
  const allowed = [site.origin, new URL(request.url).origin];

  if (deployment === developmentTarget.deploymentUrl) allowed.push("http://localhost:5173");

  if (origin !== null && !allowed.includes(origin)) {
    return Response.json({ message: "Origen no permitido.", fields: [] }, { status: 403, headers });
  }

  if (origin !== null) headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Expose-Headers", "X-Exam-Email, Retry-After");

  if (request.method === "OPTIONS") {
    headers.set("Access-Control-Allow-Methods", "POST");
    headers.set("Access-Control-Allow-Headers", "Content-Type");

    return new Response(null, { status: 204, headers });
  }

  if (request.headers.get("Content-Type")?.split(";")[0]?.trim() !== "application/json") {
    return Response.json(
      { message: "Formato de formulario no permitido.", fields: [] },
      { status: 415, headers },
    );
  }

  return yield* Effect.gen(function* () {
    const body = yield* readBody(request).pipe(Effect.timeout("10 seconds"));

    const patient = yield* Schema.decodeEffect(Schema.fromJsonString(examOrder), {
      errors: "all",
    })(body);

    const orders = yield* ExamOrders;
    const result = yield* orders.generate(patient);
    headers.set("Content-Type", "application/pdf");
    headers.set("Content-Disposition", 'attachment; filename="orden-examen.pdf"');
    headers.set("X-Exam-Email", result.email);

    return new Response(new Uint8Array(result.pdf), { headers });
  }).pipe(
    Effect.catchTags({
      SchemaError: (error) =>
        Effect.succeed(
          Response.json(
            { message: "Revisa los datos del formulario.", fields: validationErrors(error) },
            { status: 400, headers },
          ),
        ),
      InvalidExamRequest: (error) =>
        Effect.succeed(
          Response.json({ message: error.message, fields: [] }, { status: 400, headers }),
        ),
      ExamTextTooLong: (error) =>
        Effect.succeed(
          Response.json(
            { message: error.message, fields: [{ field: error.field, message: error.message }] },
            { status: 400, headers },
          ),
        ),
      ExamRateLimited: (error) => {
        headers.set("Retry-After", String(Math.ceil(error.retryAfter / 1000)));

        return Effect.succeed(
          Response.json(
            {
              message: "Hay muchas solicitudes. Espera un momento y vuelve a intentarlo.",
              fields: [],
            },
            { status: 429, headers },
          ),
        );
      },
      ExamDocumentError: (error) =>
        Effect.succeed(
          Response.json({ message: error.message, fields: [] }, { status: 503, headers }),
        ),
    }),
  );
});

export const examOrders = httpAction((ctx, request) =>
  runConvex(
    handleExamRequest(request).pipe(
      Effect.provideService(ExamOrders, requestOrders(ctx)),
      // Never serialize a cause: schema/library errors can contain patient inputs.
      Effect.catchCause(() =>
        Effect.succeed(
          Response.json(
            { message: "No pudimos completar la solicitud. Inténtalo nuevamente.", fields: [] },
            { status: 503, headers: { "Cache-Control": "no-store" } },
          ),
        ),
      ),
    ),
  ),
);
