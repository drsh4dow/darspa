import { createFileRoute } from "@tanstack/react-router";
import legal from "../../content/generated/legal.json";
import { MarkdownContent } from "../components/public-content";
import { publicMetadata } from "../lib/metadata";

export const Route = createFileRoute("/privacy-policy")({
  head: () =>
    publicMetadata(
      "Política de privacidad",
      "Política de privacidad de Dar Spa: recopilación, uso y protección de datos personales y vías de contacto.",
      "/privacy-policy",
    ),
  component: PrivacyPage,
});

function PrivacyPage() {
  const document = legal.find((item) => item.slug === "privacy-policy");

  if (!document) throw new Error("Falta la política de privacidad publicada");

  return (
    <article className="legal-page privacy-document">
      <MarkdownContent html={document.html} />
    </article>
  );
}
