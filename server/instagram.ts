import { and, desc, eq, lte, notInArray, sql } from "drizzle-orm";
import { Clock, Config, Context, Effect, Layer, Option, Redacted, Schema } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";
import type { Viewer } from "../shared/contracts";
import { Database, execute } from "./db/database";
import { instagramConnection, instagramPosts } from "./db/schema";
import { requireAdministrator } from "./lib/identity";

// A system user token reads media through the Instagram Graph API on Facebook's host.
const graph = "https://graph.facebook.com/v23.0";

const postLimit = 9;

const refreshEvery = 8 * 3_600_000;

const retryAfterFailure = 600_000;

const leaseFor = 120_000;

const oauthErrorCode = 190;

const media = Schema.Struct({
  data: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      caption: Schema.optionalKey(Schema.String),
      media_type: Schema.Literals(["IMAGE", "VIDEO", "CAROUSEL_ALBUM"]),
      media_url: Schema.optionalKey(Schema.String),
      thumbnail_url: Schema.optionalKey(Schema.String),
      permalink: Schema.String,
      timestamp: Schema.String,
    }),
  ),
});

const providerError = Schema.Struct({ error: Schema.Struct({ code: Schema.Finite }) });

// Identifies the configured credential without keeping the token in D1.
const fingerprint = (userId: string, token: string) =>
  Effect.promise(() =>
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${userId}:${token}`)),
  ).pipe(
    Effect.map((digest) =>
      Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(""),
    ),
  );

export class Instagram extends Context.Service<Instagram>()("darspa/Instagram", {
  make: Effect.gen(function* () {
    const db = yield* Database;
    const http = yield* HttpClient.HttpClient;

    const posts = Effect.fn("Instagram.posts")(function* () {
      return yield* execute(() =>
        db
          .select({
            id: instagramPosts.id,
            caption: instagramPosts.caption,
            mediaType: instagramPosts.mediaType,
            thumbnailUrl: instagramPosts.thumbnailUrl,
            permalink: instagramPosts.permalink,
            postedAt: instagramPosts.postedAt,
          })
          .from(instagramPosts)
          .orderBy(desc(instagramPosts.postedAt))
          .limit(postLimit),
      );
    });

    const status = Effect.fn("Instagram.status")(function* (actor: Viewer) {
      yield* requireAdministrator(actor);

      const [connection] = yield* execute(() =>
        db
          .select({
            status: instagramConnection.status,
            lastSuccessAt: instagramConnection.lastSuccessAt,
          })
          .from(instagramConnection)
          .where(eq(instagramConnection.id, 1))
          .limit(1),
      );

      return connection ?? { status: "not_configured" as const, lastSuccessAt: null };
    });

    // The token travels in a header, never in a URL that could reach a log.
    const fetchPosts = (userId: string, token: string) =>
      HttpClientRequest.get(`${graph}/${userId}/media`).pipe(
        HttpClientRequest.setHeader("Authorization", `Bearer ${token}`),
        HttpClientRequest.setUrlParams({
          fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp",
          limit: String(postLimit),
        }),
        http.execute,
        Effect.timeout("10 seconds"),
      );

    const store = Effect.fn("Instagram.store")(function* (items: (typeof media.Type)["data"]) {
      const rows = items.flatMap((item) => {
        const thumbnailUrl = item.thumbnail_url ?? item.media_url;
        const postedAt = Date.parse(item.timestamp);

        return thumbnailUrl === undefined || Number.isNaN(postedAt)
          ? []
          : [
              {
                id: item.id,
                caption: item.caption ?? "",
                mediaType: item.media_type,
                thumbnailUrl,
                permalink: item.permalink,
                postedAt,
              },
            ];
      });

      const keep = rows.map((row) => row.id);

      // D1 runs a batch as one transaction, so readers never see a half-updated feed.
      if (rows.length === 0) {
        yield* execute(() => db.delete(instagramPosts));

        return;
      }

      yield* execute(() =>
        db.batch([
          db
            .insert(instagramPosts)
            .values(rows)
            .onConflictDoUpdate({
              target: instagramPosts.id,
              set: {
                caption: sql`excluded.caption`,
                mediaType: sql`excluded.mediaType`,
                thumbnailUrl: sql`excluded.thumbnailUrl`,
                permalink: sql`excluded.permalink`,
                postedAt: sql`excluded.postedAt`,
              },
            }),
          db.delete(instagramPosts).where(notInArray(instagramPosts.id, keep)),
        ]),
      );
    });

    const release = (changes: Partial<typeof instagramConnection.$inferInsert>) =>
      execute(() =>
        db
          .update(instagramConnection)
          .set({ ...changes, lease: 0 })
          .where(eq(instagramConnection.id, 1)),
      );

    const synchronize = Effect.fn("Instagram.synchronize")(function* (
      userId: string,
      token: string,
    ) {
      const response = yield* fetchPosts(userId, token).pipe(Effect.option);

      if (Option.isNone(response)) return "unavailable";

      if (response.value.status >= 400) {
        const failure = yield* HttpClientResponse.schemaBodyJson(providerError)(
          response.value,
        ).pipe(Effect.option);

        return Option.isSome(failure) && failure.value.error.code === oauthErrorCode
          ? "reconnect"
          : "unavailable";
      }

      const body = yield* HttpClientResponse.schemaBodyJson(media)(response.value).pipe(
        Effect.option,
      );

      if (Option.isNone(body)) return "unavailable";
      yield* store(body.value.data);

      return "stored";
    });

    /** Refreshes the cached feed when it is due. Safe to call every minute. */
    const refresh = Effect.fn("Instagram.refresh")(function* () {
      const now = yield* Clock.currentTimeMillis;

      // Infisical is the only store of the token. It reaches the Worker on deploy.
      const token = Redacted.value(
        yield* Config.schema(Schema.Redacted(Schema.String), "INSTAGRAM_ACCESS_TOKEN").pipe(
          Config.withDefault(Redacted.make("")),
        ),
      );

      const userId = yield* Config.String("INSTAGRAM_USER_ID").pipe(Config.withDefault(""));

      if (token === "" || userId === "") return;
      const credential = yield* fingerprint(userId, token);

      const [current] = yield* execute(() =>
        db.select().from(instagramConnection).where(eq(instagramConnection.id, 1)).limit(1),
      );

      if (current === undefined) {
        yield* execute(() =>
          db
            .insert(instagramConnection)
            .values({ id: 1, credential, status: "ok" })
            .onConflictDoNothing(),
        );
      } else if (current.credential !== credential) {
        // A different token or account means the operator reconnected: try at once.
        yield* execute(() =>
          db
            .update(instagramConnection)
            .set({ credential, status: "ok", nextRefreshAt: 0, lease: 0 })
            .where(eq(instagramConnection.id, 1)),
        );
      }

      const [claimed] = yield* execute(() =>
        db
          .update(instagramConnection)
          .set({ lease: now + leaseFor })
          .where(
            and(
              eq(instagramConnection.id, 1),
              lte(instagramConnection.nextRefreshAt, now),
              lte(instagramConnection.lease, now),
            ),
          )
          .returning(),
      );

      if (claimed === undefined) return;

      if (claimed.status === "reconnect_required") {
        yield* release({ nextRefreshAt: now + refreshEvery });

        return;
      }

      const outcome = yield* synchronize(userId, token).pipe(
        Effect.catchCause(() => Effect.succeed("unavailable")),
      );

      const finished = yield* Clock.currentTimeMillis;

      if (outcome === "stored")
        yield* release({
          status: "ok",
          lastSuccessAt: finished,
          nextRefreshAt: finished + refreshEvery,
        });
      else if (outcome === "reconnect")
        yield* release({ status: "reconnect_required", nextRefreshAt: finished + refreshEvery });
      else yield* release({ nextRefreshAt: finished + retryAfterFailure });
    });

    return { posts, status, refresh };
  }),
}) {
  static readonly layer = Layer.effect(Instagram, Instagram.make);
}
