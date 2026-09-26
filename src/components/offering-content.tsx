import type { ReactNode } from "react";
import type catalog from "../../content/generated/catalog.json";
import { site } from "../content/site";
import { formatPrice } from "../lib/metadata";
import { MarkdownContent } from "./public-content";

export function OfferingContent({
  offering,
  title,
}: {
  offering: (typeof catalog)[number];
  title: ReactNode;
}) {
  return (
    <div className="offering-content">
      <img src={offering.image} alt={offering.imageAlt} width="320" height="320" />
      <div>
        {title}
        <p className="offering-price">{formatPrice(offering.priceClp)}</p>
        <div className="offering-description">
          <MarkdownContent html={offering.html} />
        </div>
        {offering.available ? (
          <a className="offering-action" href={site.whatsapp}>
            Consultar por este servicio
          </a>
        ) : (
          <p className="mt-6 font-bold">No disponible para nuevas compras.</p>
        )}
      </div>
    </div>
  );
}
