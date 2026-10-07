import { Effect, Schema } from "effect";

export class RequestBodyError extends Schema.TaggedError<RequestBodyError>()(
  "RequestBodyError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 413 },
) {}

// HttpApi's Web Request adapter and Better Auth both read complete request bodies.
// Bound the stream first; Content-Length alone does not cover chunked requests.
export const boundedRequest = Effect.fnUntraced(function* (request: Request) {
  const stream = request.body;

  if (stream === null) return request;

  const content = yield* Effect.acquireUseRelease(
    Effect.sync(() => stream.getReader()),
    Effect.fnUntraced(function* (reader) {
      const decoder = new TextDecoder();
      let body = "";
      let size = 0;

      while (true) {
        const chunk = yield* Effect.tryPromise(() => reader.read());

        if (chunk.done) return body + decoder.decode();

        const bytes = yield* Schema.decodeUnknownEffect(Schema.Uint8Array)(chunk.value).pipe(
          Effect.orDie,
        );

        size += bytes.byteLength;

        if (size > 8192)
          return yield* new RequestBodyError({
            message: "La solicitud supera el tamaño permitido.",
          });
        body += decoder.decode(bytes, { stream: true });
      }
    }),
    (reader) => Effect.promise(() => reader.cancel()),
  ).pipe(Effect.timeout("10 seconds"));

  return new Request(request, { body: content, method: request.method });
});
