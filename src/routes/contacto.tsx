import { createFileRoute } from "@tanstack/react-router";
import { site } from "../content/site";
import { PageHeading } from "../components/public-content";
import { Button } from "../components/ui/button";
import { publicMetadata } from "../lib/metadata";

export const Route = createFileRoute("/contacto")({
  head: () =>
    publicMetadata(
      "Contacto",
      "Visítanos en E. Sotomayor 576, Castro. Contacta a Dar Spa por WhatsApp o correo y agenda tu hora en Doctoralia.",
      "/contacto",
    ),
  component: ContactPage,
});

function ContactPage() {
  return (
    <div className="page-width section-space">
      <PageHeading title="Contacto" />
      <div className="intro-grid">
        <section>
          <h2>Visítanos</h2>
          <address className="not-italic">
            <p>{site.address}</p>
            <p>Castro, Chiloé, Chile</p>
          </address>
          <p className="mt-5 font-bold">{site.days}</p>
          <p>{site.hours}</p>
          <a
            className="text-link mt-5 inline-block"
            href="https://www.google.com/maps/search/?api=1&query=Sotomayor+576+Castro+Chile"
          >
            Ver ubicación en el mapa ↗
          </a>
        </section>
        <section>
          <h2>Contacto directo</h2>
          <p>
            <a className="text-link" href={site.whatsapp}>
              WhatsApp {site.phone} ↗
            </a>
          </p>
          <p className="mt-3">
            <a className="text-link" href={`mailto:${site.email}`}>
              {site.email}
            </a>
          </p>
          <p className="mt-3">
            <a href={site.telephone} className="text-link">
              Llamar al {site.phone}
            </a>
          </p>
          <Button asChild className="mt-7">
            <a href={site.booking}>Agendar hora en Doctoralia ↗</a>
          </Button>
        </section>
      </div>
      <section className="mt-14 border-t border-border pt-8">
        <h2 className="text-xl font-extrabold text-heading">
          Encuéntranos también en redes sociales
        </h2>
        <div className="mt-4 flex gap-6">
          <a className="text-link" href={site.instagram}>
            Instagram ↗
          </a>
          <a className="text-link" href={site.facebook}>
            Facebook ↗
          </a>
        </div>
      </section>
    </div>
  );
}
