import { createFileRoute } from "@tanstack/react-router";
import services from "../content/services.json";
import { serviceCategories } from "../content/site";
import { PageHeading, ServiceRows } from "../components/public-content";
import { publicMetadata } from "../lib/metadata";

export const Route = createFileRoute("/servicios")({
  head: () =>
    publicMetadata(
      "Servicios y técnicas",
      "Servicios, terapias y prestaciones de Dar Spa: modelado corporal, tratamientos faciales, masajes, entrenamiento y más.",
      "/servicios",
    ),
  component: ServicesPage,
});

function ServicesPage() {
  return (
    <div className="page-width section-space services-page">
      <PageHeading title="Servicios, Terapias, & Prestaciones">
        Contamos con múltiples servicios y terapias que te ayudaran a conseguir la mejor versión de
        ti!
        <br />
        Ven, te contamos un poco sobre ellas.
      </PageHeading>
      {serviceCategories.map((category) => (
        <section key={category.id} id={category.id} className="service-category">
          <h2>{category.name}</h2>
          <ServiceRows items={services.filter((service) => service.tipo === category.id)} />
        </section>
      ))}
    </div>
  );
}
