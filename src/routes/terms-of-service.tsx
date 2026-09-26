import { createFileRoute } from "@tanstack/react-router";
import legal from "../../content/generated/legal.json";
import { MarkdownContent } from "../components/public-content";
import { publicMetadata } from "../lib/metadata";

export const Route = createFileRoute("/terms-of-service")({
  head: () =>
    publicMetadata(
      "Términos y condiciones",
      "Términos y condiciones de uso del sitio web de Dar Spa.",
      "/terms-of-service",
    ),
  component: TermsPage,
});

function TermsPage() {
  const document = legal.find((item) => item.slug === "terms-of-service");

  if (!document) throw new Error("Faltan los términos de uso publicados");

  return (
    <article className="legal-page">
      <MarkdownContent html={document.html} />
    </article>
  );
}
