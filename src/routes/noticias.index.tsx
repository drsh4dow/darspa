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
    <div className="page-width section-space news-page">
      <PageHeading
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
        <div className="news-list">
          {news.map((article) => (
            <article key={article.slug}>
              <time dateTime={article.publishedAt}>
                {formatPublicationDate(article.publishedAt)}
              </time>
              <div className="news-copy">
                <h2>
                  <Link to="/noticias/$slug" params={{ slug: article.slug }}>
                    {article.title}
                  </Link>
                </h2>
                <MarkdownContent html={article.html} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
