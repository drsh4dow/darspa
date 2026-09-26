import { mkdir, readFile, readdir, access, writeFile } from "node:fs/promises";
import MarkdownIt from "markdown-it";
import { parse } from "yaml";
import { offeringMetadata, newsMetadata } from "../content/schema.ts";

// Raw HTML and executable Markdown are deliberately unsupported.
const markdown = new MarkdownIt({ html: false, linkify: false });

async function readMarkdown(directory: string) {
  const documents = [];

  const files = await readdir(directory);

  files.sort();

  for (const file of files) {
    if (!file.endsWith(".md")) continue;

    const source = await readFile(`${directory}/${file}`, "utf8");
    const match = /^---\n([\s\S]+?)\n---\n([\s\S]*)$/.exec(source);
    const metadata = match?.[1];
    const body = match?.[2]?.trim();

    if (!metadata || !body) throw new Error(`Missing metadata or content: ${directory}/${file}`);

    documents.push({ file, metadata, description: body, html: markdown.render(body) });
  }

  return documents;
}

const offerings = [];

const offeringIds = new Set<string>();

const legacyIds = new Set<string>();

for (const document of await readMarkdown("content/offerings")) {
  const metadata = offeringMetadata.parse(parse(document.metadata));

  if (document.file !== `${metadata.id}.md` || offeringIds.has(metadata.id)) {
    throw new Error(`Offering filename/identity conflict: ${document.file}`);
  }

  if (metadata.legacyId && legacyIds.has(metadata.legacyId)) {
    throw new Error(`Duplicate legacy offering identity: ${metadata.legacyId}`);
  }

  offeringIds.add(metadata.id);

  if (metadata.legacyId) legacyIds.add(metadata.legacyId);

  await access(`public${metadata.image}`);
  offerings.push({ ...metadata, description: document.description, html: document.html });
}

offerings.sort(
  (a, b) => a.priceClp - b.priceClp || a.displayOrder - b.displayOrder || a.id.localeCompare(b.id),
);

const news = [];

const newsSlugs = new Set<string>();

for (const document of await readMarkdown("content/news")) {
  const metadata = newsMetadata.parse(parse(document.metadata));

  if (document.file !== `${metadata.slug}.md` || newsSlugs.has(metadata.slug)) {
    throw new Error(`News filename/slug conflict: ${document.file}`);
  }

  newsSlugs.add(metadata.slug);

  if (metadata.image) await access(`public${metadata.image}`);

  news.push({ ...metadata, html: document.html });
}

news.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

const legal = [];

for (const slug of ["privacy-policy", "terms-of-service"]) {
  const source = await readFile(`content/legal/${slug}.md`, "utf8");
  legal.push({ slug, html: markdown.render(source) });
}

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

await mkdir("content/generated", { recursive: true });

for (const [name, data] of Object.entries({
  catalog: offerings,
  news,
  legal,
  paths: publicPaths,
})) {
  await writeFile(`content/generated/${name}.json`, `${JSON.stringify(data, null, 2)}\n`);
}

console.log(
  `Validated ${offerings.length} offerings, ${news.length} articles and ${publicPaths.length} public pages.`,
);
