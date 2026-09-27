import { createFileRoute } from "@tanstack/react-router";
import { CatalogPage } from "./tienda.index";

export const Route = createFileRoute("/carro")({
  ssr: false,
  head: () => ({ meta: [{ title: "Tu carro · Dar Spa" }] }),
  component: CatalogPage,
});
