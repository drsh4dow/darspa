import type catalog from "../../content/generated/catalog.json";
import { site } from "../content/site";
import { formatPrice } from "../lib/metadata";
import { MarkdownContent } from "./public-content";
import { DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";

export function OfferingContent({
  offering,
  inDialog = false,
}: {
  offering: (typeof catalog)[number];
  inDialog?: boolean;
}) {
  const Heading = inDialog ? DialogTitle : "h1";

  return (
    <div className="grid w-full items-start gap-x-6 gap-y-8 sm:grid-cols-12 lg:gap-x-8">
      <img
        className="aspect-square w-full rounded-lg object-cover sm:col-span-4 lg:col-span-5"
        src={offering.image}
        alt={offering.imageAlt}
        width="320"
        height="320"
      />
      <div className="sm:col-span-8 lg:col-span-7">
        <Heading className="text-2xl font-bold sm:pr-12">{offering.name}</Heading>
        <p className="mt-2 text-2xl">{formatPrice(offering.priceClp)}</p>
        <MarkdownContent className="mt-10" html={offering.html} variant="offering" />
        {offering.available ? (
          <Button
            asChild
            variant="accent"
            className="mt-6 flex border border-transparent px-8 py-3 text-base"
          >
            <a href={site.whatsapp}>Consultar por este servicio</a>
          </Button>
        ) : (
          <p className="mt-6 font-bold">No disponible para nuevas compras.</p>
        )}
      </div>
    </div>
  );
}
