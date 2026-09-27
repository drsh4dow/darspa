import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import news from "../../content/generated/news.json";
import { PageHeading, MarkdownContent } from "../components/public-content";
import { formatPublicationDate, publicMetadata } from "../lib/metadata";

export const Route = createFileRoute("/noticias/$slug")({
  loader: ({ params }) => {
    const article = news.find((item) => item.slug === params.slug);

    if (!article) throw notFound();

    return article;
  },
  head: ({ loaderData }) =>
    loaderData
      ? publicMetadata(
          loaderData.title,
          `${loaderData.title}. Noticias y novedades de Dar Spa, Castro, Chiloé.`,
          `/noticias/${loaderData.slug}`,
          loaderData.image ?? undefined,
        )
      : {},
  component: NewsArticle,
});

function NewsArticle() {
  const article = Route.useLoaderData();

  return (
    <article className="mx-auto w-full max-w-3xl px-2 py-20 sm:px-4">
      <Link to="/noticias" className="mb-8 inline-block font-extrabold text-primary underline">
        ← Todas las noticias
      </Link>
      <PageHeading title={article.title} />
      <p className="mb-8 text-muted-foreground">
        <time dateTime={article.publishedAt}>{formatPublicationDate(article.publishedAt)}</time>
      </p>
      {article.image && (
        <img
          src={article.image}
          alt={article.imageAlt}
          className="mb-8 max-h-96 rounded-lg object-contain"
        />
      )}
      <MarkdownContent html={article.html} />
    </article>
  );
}
