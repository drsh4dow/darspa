import type { ReactNode } from "react";
import type exams from "../content/exams.json";
import { cn } from "../lib/utils";

export function PageHeading({
  title,
  children,
  className,
  captionClassName,
}: {
  title: ReactNode;
  children?: ReactNode;
  className?: string;
  captionClassName?: string;
}) {
  return (
    <header className={cn("mb-10", className)}>
      <h1 className="text-3xl font-black text-heading lg:text-5xl">{title}</h1>
      {children && (
        <p className={cn("mt-2 text-sm font-bold text-muted-foreground", captionClassName)}>
          {children}
        </p>
      )}
    </header>
  );
}

export function ServiceRows({ items }: { items: typeof exams }) {
  return (
    <div className="mx-auto grid max-w-4xl gap-8">
      {items.map((item) => (
        <article
          className="group relative flex flex-col-reverse items-center gap-4 rounded-3xl border-4 border-primary p-4 md:min-h-66 md:flex-row md:justify-between md:gap-6 md:rounded-l-service-row md:p-0 md:odd:rounded-l-3xl md:odd:rounded-r-service-row"
          key={item.nombre}
        >
          <div className="size-56 shrink-0 overflow-hidden rounded-full border-4 border-primary bg-primary sm:h-66 sm:w-65 md:absolute md:-left-1 md:group-odd:-right-1 md:group-odd:left-auto">
            <img
              className="size-full object-cover"
              src={item.src}
              alt={item.alt}
              width="264"
              height="264"
              loading="lazy"
            />
          </div>
          <div className="min-w-0 max-w-full wrap-anywhere md:p-4 md:pl-74 md:group-odd:pr-74 md:group-odd:pl-4">
            <h3 className="mb-4 font-display text-2xl font-bold text-heading">{item.nombre}</h3>
            <p className="text-base font-bold">{item.descripcion}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

// Only build-generated Markdown HTML is passed here. scripts/content.ts disables raw
// HTML; markdown-it also rejects unsafe URL schemes. Never use with provider HTML.
export function MarkdownContent({
  html,
  variant = "article",
  className,
}: {
  html: string;
  variant?: "article" | "summary" | "offering" | "legal" | "privacy";
  className?: string;
}) {
  return (
    <div
      className={cn("markdown", className)}
      data-variant={variant}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
