import { createFileRoute } from "@tanstack/react-router";
import { CatalogPage } from "../features/purchasing/catalog-page";

export const Route = createFileRoute("/carro")({
  ssr: false,
  head: () => ({ meta: [{ title: "Tu carro · Dar Spa" }] }),
  component: CatalogPage,
});
