import { createFileRoute } from "@tanstack/react-router";
import { CatalogPage } from "../features/purchasing/catalog-page";
import { publicMetadata } from "../lib/metadata";

export const Route = createFileRoute("/tienda/")({
  head: () =>
    publicMetadata(
      "Tienda y GiftCards",
      "Conoce los servicios y paquetes de Dar Spa, con precios en pesos chilenos y GiftCards para regalar o utilizar más adelante.",
      "/tienda",
    ),
  component: CatalogPage,
});
