import type { ReactNode } from "react";
import type exams from "../content/exams.json";

export function PageHeading({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <header className="page-heading">
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </header>
  );
}

export function ServiceRows({ items }: { items: typeof exams }) {
  return (
    <div className="service-list">
      {items.map((item) => (
        <article className="service-row" key={item.nombre}>
          <div className="service-photo">
            <img src={item.src} alt={item.alt} width="264" height="264" loading="lazy" />
          </div>
          <div className="service-copy">
            <h3>{item.nombre}</h3>
            <p>{item.descripcion}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

// Only build-generated Markdown HTML is passed here. scripts/content.ts disables raw
// HTML; markdown-it also rejects unsafe URL schemes. Never use with provider HTML.
export function MarkdownContent({ html }: { html: string }) {
  return <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />;
}
