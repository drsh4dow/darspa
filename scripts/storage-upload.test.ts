import { once } from "node:events";
import { createServer } from "node:http";
import { buffer } from "node:stream/consumers";
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
])("$name", async ({ statuses, expectedStatus, expectedAttempts }, { onTestFinished }) => {
  const uploads: { method: string | undefined; contentType: string | undefined; body: Buffer }[] =
    [];

  const content = Buffer.from([0, 255, 127, 13, 10]);

  const server = createServer((request, response) => {
    void buffer(request).then(
      (body) => {
        uploads.push({
          method: request.method,
          contentType: request.headers["content-type"],
          body,
        });
        response.writeHead(statuses[uploads.length - 1] ?? 200, {
          "Content-Type": "application/json",
        });
        response.end(JSON.stringify({ storageId: "uploaded-file" }));
      },
      () => response.destroy(),
    );
  });

  onTestFinished(() => server[Symbol.asyncDispose]());
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();

  // Validate Node's TCP-or-Unix-socket address at the fixture boundary.
  // oxlint-disable-next-line anti-slop/no-runtime-typeof
  if (!address || typeof address === "string") {
    throw new Error("Expected a TCP address for the upload fixture");
  }

  const response = await uploadToStorage(
    `http://127.0.0.1:${address.port}/upload`,
    content,
    "application/octet-stream",
  );

  expect(response.status).toBe(expectedStatus);
  expect(await response.json()).toEqual({ storageId: "uploaded-file" });
  expect(uploads).toEqual(
    Array.from({ length: expectedAttempts }, () => ({
      method: "POST",
      contentType: "application/octet-stream",
      body: content,
    })),
  );
});
