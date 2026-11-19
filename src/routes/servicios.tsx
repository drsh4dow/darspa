import { createFileRoute } from "@tanstack/react-router";
import services from "../content/services.json";
import { consultations, serviceCategories } from "../content/site";
import { PageHeading, ServiceRows } from "../components/public-content";
import { publicMetadata } from "../lib/metadata";

export const Route = createFileRoute("/servicios")({
  head: () =>
    publicMetadata(
      "Servicios y técnicas",
      "Servicios, terapias y prestaciones de Clínica DarSpa: modelado corporal, HIFU facial, masajes, entrenamiento y consultas de kinesiología y nutrición.",
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
      <section id="consultas" className="mx-auto mb-18 max-w-4xl lg:mb-28">
        <h2 className="mb-6 text-2xl font-black text-primary lg:text-4xl">Consultas</h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {consultations.map((consultation) => (
            <li className="rounded-3xl border-4 border-primary p-4" key={consultation.name}>
              <h3 className="font-display text-2xl font-bold text-heading">{consultation.name}</h3>
              <p className="mt-2 text-lg font-black text-primary">{consultation.price}</p>
              {consultation.note ? (
                <p className="mt-2 text-base font-bold">{consultation.note}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
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
