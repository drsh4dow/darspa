import { createFileRoute } from "@tanstack/react-router";
import catalog from "../../content/generated/catalog.json";
import { PageHeading } from "../components/public-content";
import { OfferingContent } from "../components/offering-content";
import { Dialog, DialogContent, DialogTrigger } from "../components/ui/dialog";
import { formatPrice, publicMetadata } from "../lib/metadata";

export const Route = createFileRoute("/tienda/")({
  head: () =>
    publicMetadata(
      "Tienda y GiftCards",
      "Conoce los servicios y paquetes de Dar Spa, con precios en pesos chilenos y GiftCards para regalar o utilizar más adelante.",
      "/tienda",
    ),
  component: CatalogPage,
});

function CatalogPage() {
  const available = catalog.filter((offering) => offering.available);

  return (
    <section className="pt-20">
      <div className="mx-auto w-full max-w-384 px-2 sm:px-4">
        <PageHeading className="mb-2 text-center" title="Compra, Imprime y Regala una Gift-Card!">
          Conoce, compra, y regala nuestros servicios mediante GiftCards!
          <br />
          Muestra el QR de tu GiftCard y cobra tu regalo.
        </PageHeading>
      </div>
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24 lg:max-w-7xl lg:px-8">
        {available.length === 0 ? (
          <p>No hay servicios disponibles para la venta en este momento.</p>
        ) : (
          <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-x-8">
            {available.map((offering) => (
              <Dialog key={offering.id}>
                <DialogTrigger asChild>
                  <button className="group block w-full text-left">
                    <img
                      className="aspect-square w-full rounded-lg bg-secondary object-cover group-hover:opacity-75 xl:aspect-7/8"
                      src={offering.image}
                      alt={offering.imageAlt}
                      width="320"
                      height="320"
                      loading="lazy"
                    />
                    <span className="mt-4 block text-sm text-muted-foreground">
                      {offering.name}
                    </span>
                    <span className="mt-1 block text-lg font-medium">
                      {formatPrice(offering.priceClp)}
                    </span>
                  </button>
                </DialogTrigger>
                <DialogContent layout="offering" aria-describedby={undefined}>
                  <OfferingContent offering={offering} inDialog />
                </DialogContent>
              </Dialog>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
