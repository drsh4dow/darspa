import { Effect } from "effect";
import { expect, test } from "vite-plus/test";
import { Forbidden, Unauthorized } from "../shared/contracts";
import { fixture } from "./testing";

const post = (n: number, media_type: "IMAGE" | "VIDEO" = "IMAGE") => ({
  id: `post-${n}`,
  caption: `Publicación ${n}`,
  media_type,
  ...(media_type === "VIDEO"
    ? { thumbnail_url: `https://cdn.example/thumb-${n}.jpg` }
    : { media_url: `https://cdn.example/${n}.jpg` }),
  permalink: `https://www.instagram.com/p/${n}/`,
  timestamp: `2026-11-0${n}T12:00:00+0000`,
});

const eightHours = 28_800_001;

test(
  "the feed is read from the configured account and survives transient failures",
  () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const backend = yield* fixture();
          const guest = yield* backend.client();

          expect(yield* guest.public.instagram()).toEqual([]);

          backend.instagram.publish([post(1), post(2, "VIDEO")]);
          yield* backend.refreshInstagram;

          // Facebook's Graph host, the configured account, and the token in a header.
          expect(backend.instagram.paths).toEqual([
            "graph.facebook.com/v23.0/17841400000000001/media",
          ]);
          expect(backend.instagram.tokens).toEqual(["Bearer system-token"]);

          const feed = yield* guest.public.instagram();
          expect(feed.map((entry) => entry.id)).toEqual(["post-2", "post-1"]);
          expect(feed[0]?.thumbnailUrl).toBe("https://cdn.example/thumb-2.jpg");
          // Only display fields are public; no token or provider detail can ride along.
          expect(Object.keys(feed[0] ?? {}).toSorted()).toEqual([
            "caption",
            "id",
            "mediaType",
            "permalink",
            "postedAt",
            "thumbnailUrl",
          ]);

          backend.instagram.mode("down");
          yield* backend.advance(eightHours);
          yield* backend.refreshInstagram;
          expect(yield* guest.public.instagram()).toHaveLength(2);

          backend.instagram.mode("ok");
          backend.instagram.publish([post(3)]);
          yield* backend.advance(600_001);
          yield* backend.refreshInstagram;
          expect((yield* guest.public.instagram()).map((entry) => entry.id)).toEqual(["post-3"]);
        }),
      ),
    ),
  60_000,
);

test(
  "refreshes run once per eight hours",
  () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const backend = yield* fixture();
          backend.instagram.publish([post(1)]);

          yield* backend.refreshInstagram;
          yield* backend.refreshInstagram;
          expect(backend.instagram.tokens).toHaveLength(1);

          yield* backend.advance(28_000_000);
          yield* backend.refreshInstagram;
          expect(backend.instagram.tokens).toHaveLength(1);

          yield* backend.advance(1_000_000);
          yield* backend.refreshInstagram;
          expect(backend.instagram.tokens).toHaveLength(2);
        }),
      ),
    ),
  60_000,
);

test(
  "nothing is requested until a token and an account are configured",
  () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const backend = yield* fixture();
          const admin = yield* backend.signIn("admin@example.com", "administrator");

          backend.settings.INSTAGRAM_ACCESS_TOKEN = "";
          yield* backend.refreshInstagram;

          expect(backend.instagram.tokens).toHaveLength(0);
          expect(yield* admin.api.operations.instagramStatus()).toEqual({
            status: "not_configured",
            lastSuccessAt: null,
          });
        }),
      ),
    ),
  60_000,
);

test(
  "an authorization failure asks administrators to reconnect and keeps the last feed",
  () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const backend = yield* fixture();
          const guest = yield* backend.client();
          const admin = yield* backend.signIn("admin@example.com", "administrator");
          const customer = yield* backend.signIn("customer@example.com");

          backend.instagram.publish([post(1)]);
          yield* backend.refreshInstagram;
          expect((yield* admin.api.operations.instagramStatus()).status).toBe("ok");

          backend.instagram.mode("oauth");
          yield* backend.advance(eightHours);
          yield* backend.refreshInstagram;

          expect((yield* admin.api.operations.instagramStatus()).status).toBe("reconnect_required");
          expect(yield* guest.public.instagram()).toHaveLength(1);

          const calls = backend.instagram.tokens.length;
          yield* backend.advance(eightHours);
          yield* backend.refreshInstagram;
          expect(backend.instagram.tokens).toHaveLength(calls);

          expect(yield* guest.operations.instagramStatus().pipe(Effect.flip)).toBeInstanceOf(
            Unauthorized,
          );
          expect(yield* customer.api.operations.instagramStatus().pipe(Effect.flip)).toBeInstanceOf(
            Forbidden,
          );
        }),
      ),
    ),
  60_000,
);

test(
  "deploying a new token resumes the feed at once",
  () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const backend = yield* fixture();
          const guest = yield* backend.client();
          const admin = yield* backend.signIn("admin@example.com", "administrator");

          backend.instagram.publish([post(1)]);
          yield* backend.refreshInstagram;

          backend.instagram.mode("oauth");
          yield* backend.advance(eightHours);
          yield* backend.refreshInstagram;
          expect((yield* admin.api.operations.instagramStatus()).status).toBe("reconnect_required");

          // The same configured token must not undo the failure.
          backend.instagram.mode("ok");
          yield* backend.refreshInstagram;
          expect((yield* admin.api.operations.instagramStatus()).status).toBe("reconnect_required");

          backend.settings.INSTAGRAM_ACCESS_TOKEN = "reconnected-token";
          backend.instagram.publish([post(4)]);
          yield* backend.refreshInstagram;

          expect((yield* admin.api.operations.instagramStatus()).status).toBe("ok");
          expect(backend.instagram.tokens.at(-1)).toBe("Bearer reconnected-token");
          expect((yield* guest.public.instagram()).map((entry) => entry.id)).toEqual(["post-4"]);
        }),
      ),
    ),
  60_000,
);
