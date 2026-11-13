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

test(
  "the feed is cached from the provider and survives transient failures",
  () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const backend = yield* fixture();
          const guest = yield* backend.client();

          expect(yield* guest.public.instagram()).toEqual([]);

          backend.instagram.publish([post(1), post(2, "VIDEO")]);
          yield* backend.refreshInstagram;

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
          yield* backend.advance(28_800_001);
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
  "refreshes are throttled and the renewed token replaces the seed in D1",
  () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const backend = yield* fixture();
          backend.instagram.publish([post(1)]);

          yield* backend.refreshInstagram;
          yield* backend.refreshInstagram;
          expect(backend.instagram.tokens).toEqual(["seed-token", "seed-token+"]);
          expect(backend.instagram.renewals).toBe(1);

          yield* backend.advance(28_800_001);
          yield* backend.refreshInstagram;
          // The renewed token is now authoritative; the 60-day expiry is far away.
          expect(backend.instagram.tokens.at(-1)).toBe("seed-token+");
          expect(backend.instagram.renewals).toBe(1);
        }),
      ),
    ),
  60_000,
);

test(
  "a failed renewal does not block the feed",
  () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const backend = yield* fixture();
          const guest = yield* backend.client();
          backend.instagram.renewable(false);
          backend.instagram.publish([post(1)]);

          yield* backend.refreshInstagram;
          expect(yield* guest.public.instagram()).toHaveLength(1);
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

          expect(yield* admin.api.operations.instagramStatus()).toEqual({
            status: "not_configured",
            lastSuccessAt: null,
          });

          backend.instagram.publish([post(1)]);
          yield* backend.refreshInstagram;
          expect((yield* admin.api.operations.instagramStatus()).status).toBe("ok");

          backend.instagram.mode("oauth");
          yield* backend.advance(28_800_001);
          yield* backend.refreshInstagram;

          expect((yield* admin.api.operations.instagramStatus()).status).toBe("reconnect_required");
          expect(yield* guest.public.instagram()).toHaveLength(1);

          const calls = backend.instagram.tokens.length;
          yield* backend.advance(28_800_001);
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
  "reconnecting with a new token resumes the feed",
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
          yield* backend.advance(28_800_001);
          yield* backend.refreshInstagram;
          expect((yield* admin.api.operations.instagramStatus()).status).toBe("reconnect_required");

          // The unchanged configured token must not undo the failure.
          backend.instagram.mode("ok");
          yield* backend.refreshInstagram;
          expect((yield* admin.api.operations.instagramStatus()).status).toBe("reconnect_required");

          backend.settings.INSTAGRAM_ACCESS_TOKEN = "reconnected-token";
          backend.instagram.publish([post(4)]);
          yield* backend.refreshInstagram;

          expect((yield* admin.api.operations.instagramStatus()).status).toBe("ok");
          expect(backend.instagram.tokens).toContain("reconnected-token");
          expect((yield* guest.public.instagram()).map((entry) => entry.id)).toEqual(["post-4"]);
        }),
      ),
    ),
  60_000,
);
