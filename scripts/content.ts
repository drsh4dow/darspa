import { NodeFileSystem, NodeRuntime } from "@effect/platform-node";
import { DateTime, Effect, FileSystem, Schema } from "effect";
import MarkdownIt from "markdown-it";
import { parse } from "yaml";
import { offeringMetadata, newsMetadata } from "../content/schema.ts";

// Raw HTML and executable Markdown are deliberately unsupported.
const markdown = new MarkdownIt({ html: false, linkify: false });

class ContentError extends Schema.TaggedError<ContentError>()("ContentError", {
  message: Schema.String,
}) {}

const readMarkdown = Effect.fnUntraced(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const files = yield* fs.readDirectory(directory);
  files.sort();

  return yield* Effect.forEach(
    files.filter((file) => file.endsWith(".md")),
    Effect.fnUntraced(function* (file) {
      const source = yield* fs.readFileString(`${directory}/${file}`);
      const match = /^---\n([\s\S]+?)\n---\n([\s\S]*)$/.exec(source);
      const metadata = match?.[1];
      const body = match?.[2]?.trim();

      if (!metadata || !body) {
        return yield* new ContentError({
          message: `Missing metadata or content: ${directory}/${file}`,
        });
      }

      return { file, metadata, description: body, html: markdown.render(body) };
    }),
    { concurrency: 8 },
  );
});

const generateContent = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const offerings = [];
  const offeringIds = new Set<string>();
  const legacyIds = new Set<string>();

  for (const document of yield* readMarkdown("content/offerings")) {
    const metadata = yield* Effect.try(() => offeringMetadata.parse(parse(document.metadata)));

    if (document.file !== `${metadata.id}.md` || offeringIds.has(metadata.id)) {
      return yield* new ContentError({
        message: `Offering filename/identity conflict: ${document.file}`,
      });
    }

    if (metadata.legacyId && legacyIds.has(metadata.legacyId)) {
      return yield* new ContentError({
        message: `Duplicate legacy offering identity: ${metadata.legacyId}`,
      });
    }

    offeringIds.add(metadata.id);

    if (metadata.legacyId) legacyIds.add(metadata.legacyId);

    offerings.push({ ...metadata, description: document.description, html: document.html });
  }

  offerings.sort(
    (a, b) =>
      a.priceClp - b.priceClp || a.displayOrder - b.displayOrder || a.id.localeCompare(b.id),
  );

  const articles = [];
  const newsSlugs = new Set<string>();

  for (const document of yield* readMarkdown("content/news")) {
    const metadata = yield* Effect.try(() => newsMetadata.parse(parse(document.metadata)));

    if (document.file !== `${metadata.slug}.md` || newsSlugs.has(metadata.slug)) {
      return yield* new ContentError({ message: `News filename/slug conflict: ${document.file}` });
    }

    newsSlugs.add(metadata.slug);

    const date = yield* Schema.decodeEffect(Schema.DateTimeUtcFromString)(metadata.publishedAt);
    articles.push({ date, article: { ...metadata, html: document.html } });
  }

  articles.sort((a, b) => DateTime.toEpochMillis(b.date) - DateTime.toEpochMillis(a.date));

  const news = articles.map(({ article }) => article);

  const images = new Set(offerings.map((offering) => offering.image));

  for (const article of news) {
    if (article.image !== null) images.add(article.image);
  }

  yield* Effect.forEach(images, (image) => fs.access(`public${image}`), {
    concurrency: 8,
    discard: true,
  });

  const legal = yield* Effect.forEach(
    ["privacy-policy", "terms-of-service"],
    Effect.fnUntraced(function* (slug) {
      const source = yield* fs.readFileString(`content/legal/${slug}.md`);

      return { slug, html: markdown.render(source) };
    }),
    { concurrency: 2 },
  );

  const publicPaths = [
    "/",
    "/nosotros",
    "/servicios",
    "/examenes",
    "/noticias",
    "/tienda",
    "/contacto",
    "/privacy-policy",
    "/terms-of-service",
    ...news.map((article) => `/noticias/${article.slug}`),
    ...offerings.map((offering) => `/tienda/${offering.id}`),
  ];

  // Validate everything before publishing. A failed write stops the build; rerunning
  // replaces all four owned outputs rather than attempting partial recovery.
  yield* fs.makeDirectory("content/generated", { recursive: true });
  yield* Effect.forEach(
    Object.entries({ catalog: offerings, news, legal, paths: publicPaths }),
    Effect.fnUntraced(function* ([name, data]) {
      const json = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown, { space: 2 }))(
        data,
      );

      yield* fs.writeFileString(`content/generated/${name}.json`, `${json}\n`);
    }),
    { concurrency: 4, discard: true },
  );

  return yield* Effect.logInfo(
    `Validated ${offerings.length} offerings, ${news.length} articles and ${publicPaths.length} public pages.`,
  );
});

// This CLI entry point owns the filesystem layer.
// oxlint-disable-next-line effecttsgo/strict-effect-provide
NodeRuntime.runMain(generateContent.pipe(Effect.provide(NodeFileSystem.layer)));
