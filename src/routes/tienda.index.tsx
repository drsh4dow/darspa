import { createFileRoute } from "@tanstack/react-router";
import catalog from "../../content/generated/catalog.json";
import { PageHeading } from "../components/public-content";
import { OfferingContent } from "../components/offering-content";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "../components/ui/dialog";
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
    <section className="catalog-page">
      <div className="page-width">
        <PageHeading title="Compra, Imprime y Regala una Gift-Card!">
          Conoce, compra, y regala nuestros servicios mediante GiftCards!
          <br />
          Muestra el QR de tu GiftCard y cobra tu regalo.
        </PageHeading>
      </div>
      <div className="catalog-container">
        {available.length === 0 ? (
          <p>No hay servicios disponibles para la venta en este momento.</p>
        ) : (
          <div className="catalog-grid">
            {available.map((offering) => (
              <Dialog key={offering.id}>
                <DialogTrigger asChild>
                  <button className="offering-card">
                    <img
                      src={offering.image}
                      alt={offering.imageAlt}
                      width="320"
                      height="320"
                      loading="lazy"
                    />
                    <span className="offering-name">{offering.name}</span>
                    <span className="price">{formatPrice(offering.priceClp)}</span>
                  </button>
                </DialogTrigger>
                <DialogContent className="offering-dialog" aria-describedby={undefined}>
                  <OfferingContent
                    offering={offering}
                    title={<DialogTitle>{offering.name}</DialogTitle>}
                  />
                </DialogContent>
              </Dialog>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
