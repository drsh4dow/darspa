import { createFileRoute, Link } from "@tanstack/react-router";
import news from "../../content/generated/news.json";
import { PageHeading, MarkdownContent } from "../components/public-content";
import { formatPublicationDate, publicMetadata } from "../lib/metadata";

export const Route = createFileRoute("/noticias/")({
  head: () =>
    publicMetadata(
      "Noticias y novedades",
      "Archivo de noticias, notificaciones, ofertas y actualizaciones de Dar Spa, ordenadas cronológicamente.",
      "/noticias",
    ),
  component: NewsPage,
});

function NewsPage() {
  return (
    <div className="mx-auto w-full max-w-384 px-2 py-20 sm:px-4">
      <PageHeading
        className="mb-20"
        captionClassName="mt-4 font-normal md:text-base lg:mt-6"
        title={
          <>
            Ultimas Noticias, Notificaciones,
            <br />
            Ofertas, y Actualizaciones
            <br />
            Sobre DarSpa
          </>
        }
      >
        Archivo de las ultimas noticias ordenado cronologicamente para que pueda enterarse de las
        novedades
      </PageHeading>
      {news.length === 0 ? (
        <p>Todavía no hay noticias publicadas.</p>
      ) : (
        <div className="max-w-198.5 space-y-16 md:border-l md:border-secondary md:pl-6">
          {news.map((article) => (
            <article
              className="md:grid md:grid-cols-[1fr_3fr] md:items-baseline"
              key={article.slug}
            >
              <time
                className="mb-3 block border-l-2 border-border pl-3.5 text-sm text-muted-foreground md:mt-1 md:border-0 md:p-0"
                dateTime={article.publishedAt}
              >
                {formatPublicationDate(article.publishedAt)}
              </time>
              <div className="relative before:absolute before:-inset-x-2 before:-inset-y-6 before:-z-1 before:rounded-2xl before:bg-muted before:opacity-0 hover:before:opacity-100">
                <h2 className="text-base font-semibold tracking-tight text-heading">
                  <Link to="/noticias/$slug" params={{ slug: article.slug }}>
                    {article.title}
                  </Link>
                </h2>
                <MarkdownContent className="mt-2" html={article.html} variant="summary" />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
