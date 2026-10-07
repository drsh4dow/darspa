import type catalog from "../../content/generated/catalog.json";
import { AddToCart } from "../features/purchasing/add-to-cart";
import { formatPrice } from "../lib/metadata";
import { MarkdownContent } from "./public-content";
import { DialogTitle } from "./ui/dialog";

export function OfferingContent({
  offering,
  inDialog = false,
}: {
  offering: (typeof catalog)[number];
  inDialog?: boolean;
}) {
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
        {inDialog ? (
          <DialogTitle layout="offering" className="text-2xl font-bold">
            {offering.name}
          </DialogTitle>
        ) : (
          <h1 className="text-2xl font-bold sm:pr-12">{offering.name}</h1>
        )}
        <p className="mt-2 text-2xl">{formatPrice(offering.priceClp)}</p>
        <MarkdownContent className="mt-10" html={offering.html} variant="offering" />
        {offering.available ? (
          <AddToCart offeringId={offering.id} priceClp={offering.priceClp} inDialog={inDialog} />
        ) : (
          <p className="mt-6 font-bold">No disponible para nuevas compras.</p>
        )}
      </div>
    </div>
  );
}
