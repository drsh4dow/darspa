import { NodeHttpServer } from "@effect/platform-node";
import { Effect } from "effect";
import { HttpServer, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { expect, test } from "vite-plus/test";

// Exercise the patched CLI's transport, not a separate application uploader.
import { uploadToStorage } from "../node_modules/@convex-dev/static-hosting/dist/cli/storageUpload.js";

test.for([
  {
    name: "recovers from the observed 502 and 520 failures",
    statuses: [502, 520, 200],
    expectedStatus: 200,
    expectedAttempts: 3,
  },
  {
    name: "returns the failure after three attempts so CLI cleanup can run",
    statuses: [503, 503, 503, 200],
    expectedStatus: 503,
    expectedAttempts: 3,
  },
  {
    name: "does not retry rejected upload authorization",
    statuses: [403, 200],
    expectedStatus: 403,
    expectedAttempts: 1,
  },
])("$name", ({ statuses, expectedStatus, expectedAttempts }) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const uploads: { method: string; contentType: string | undefined; body: Buffer }[] = [];
      const content = Buffer.from([0, 255, 127, 13, 10]);
      const server = yield* HttpServer.HttpServer;

      yield* server.serve(
        Effect.gen(function* () {
          const request = yield* HttpServerRequest.HttpServerRequest;
          const body = yield* request.arrayBuffer;
          uploads.push({
            method: request.method,
            contentType: request.headers["content-type"],
            body: Buffer.from(body),
          });

          return yield* HttpServerResponse.json(
            { storageId: "uploaded-file" },
            {
              status: statuses[uploads.length - 1] ?? 200,
            },
          );
        }),
      );

      const response = yield* Effect.promise(() =>
        uploadToStorage(
          `${HttpServer.formatAddress(server.address)}/upload`,
          content,
          "application/octet-stream",
        ),
      );

      const body: unknown = yield* Effect.promise(() => response.json());

      expect(response.status).toBe(expectedStatus);
      expect(body).toEqual({ storageId: "uploaded-file" });
      expect(uploads).toEqual(
        Array.from({ length: expectedAttempts }, () => ({
          method: "POST",
          contentType: "application/octet-stream",
          body: content,
        })),
      );
    }).pipe(
      Effect.scoped,
      // The test boundary owns the server; its scope closes after all assertions.
      // oxlint-disable-next-line effecttsgo/strict-effect-provide
      Effect.provide(NodeHttpServer.layerTest),
    ),
  ),
);
