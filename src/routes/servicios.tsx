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
    <div className="mx-auto w-full max-w-384 px-2 py-20 sm:px-4">
      <PageHeading className="text-center lg:mb-24" title="Servicios, Terapias, & Prestaciones">
        Contamos con múltiples servicios y terapias que te ayudaran a conseguir la mejor versión de
        ti!
        <br />
        Ven, te contamos un poco sobre ellas.
      </PageHeading>
      {serviceCategories.map((category) => (
        <section
          key={category.id}
          id={category.id}
          className="mx-auto max-w-4xl not-first-of-type:mt-18 lg:not-first-of-type:mt-28"
        >
          <h2 className="mb-10 text-2xl font-black text-primary lg:text-4xl">{category.name}</h2>
          <ServiceRows items={services.filter((service) => service.tipo === category.id)} />
        </section>
      ))}
    </div>
  );
}
