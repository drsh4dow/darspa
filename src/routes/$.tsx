import { createFileRoute } from "@tanstack/react-router";
import { PageNotFound } from "../components/route-feedback";

// Unknown URLs also arrive through the static SPA shell. Render their fallback after hydration.
export const Route = createFileRoute("/$")({
  ssr: false,
  component: PageNotFound,
  head: () => ({ meta: [{ title: "Página no encontrada · Dar Spa" }] }),
});
