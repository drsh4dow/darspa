import { DateTime } from "effect";
import { site } from "../content/site";

export function publicMetadata(
  title: string,
  description: string,
  path: string,
  image = "/images/group-logo.png",
) {
  const url = `${site.origin}${path === "/" ? "" : path}`;
  const fullTitle = `${title} | Dar Spa`;

  return {
    meta: [
      { title: fullTitle },
      { name: "description", content: description },
      { name: "robots", content: "index, follow" },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "es_CL" },
      { property: "og:site_name", content: "Dar Spa" },
      { property: "og:title", content: fullTitle },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:image", content: `${site.origin}${image}` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}

const pesoFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

export function formatPrice(priceClp: number) {
  return pesoFormatter.format(priceClp);
}

const monthFormatter = new Intl.DateTimeFormat("es-CL", { month: "long", timeZone: "UTC" });

export function formatPublicationDate(value: string) {
  // Content generation validates publishedAt; invalid input still throws at this render boundary.
  const date = DateTime.makeUnsafe(value);
  const month = DateTime.formatIntl(date, monthFormatter);
  const parts = DateTime.toPartsUtc(date);
  const day = String(parts.day).padStart(2, "0");

  return `${day} de ${month.slice(0, 1).toUpperCase()}${month.slice(1)}, ${parts.year}`;
}
