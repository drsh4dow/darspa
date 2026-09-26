import { createFileRoute } from "@tanstack/react-router";
import exams from "../content/exams.json";
import { PageHeading, ServiceRows } from "../components/public-content";
import { publicMetadata } from "../lib/metadata";

export const Route = createFileRoute("/examenes")({
  head: () =>
    publicMetadata(
      "Exámenes y procedimientos",
      "Conoce los exámenes de Dar Spa: electrocardiograma, bioimpedanciometría, holter de presión, calorimetría y evaluaciones.",
      "/examenes",
    ),
  component: ExamsPage,
});

function ExamsPage() {
  return (
    <div className="page-width section-space services-page">
      <PageHeading title="Nuestros Examenes & Procedimientos">
        Conoce los examenes con los que nuestro centro cuenta!
        <br />
        Ven, te contamos un poco sobre ellos.
      </PageHeading>
      <h2 className="sr-only">Exámenes disponibles en el centro</h2>
      <ServiceRows items={exams} />
    </div>
  );
}
