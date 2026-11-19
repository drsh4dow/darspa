import { createFileRoute } from "@tanstack/react-router";
import { site } from "../content/site";
import { PageHeading } from "../components/public-content";
import { Button } from "../components/ui/button";
import { publicMetadata } from "../lib/metadata";

export const Route = createFileRoute("/contacto")({
  head: () =>
    publicMetadata(
      "Contacto",
      "Visítanos en E. Sotomayor 576, Castro. Contacta a Clínica DarSpa por WhatsApp o correo y agenda tu consulta médica en Doctoralia.",
      "/contacto",
    ),
  component: ContactPage,
});

function ContactPage() {
  return (
    <div className="mx-auto w-full max-w-384 px-2 py-20 sm:px-4">
      <PageHeading title="Contacto" />
      <div className="grid gap-10 sm:grid-cols-2 lg:gap-24">
        <section>
          <h2 className="mb-1 text-2xl font-bold text-primary">Visítanos</h2>
          <address className="not-italic">
            <p className="leading-snug">{site.address}</p>
            <p className="leading-snug">Castro, Chiloé, Chile</p>
          </address>
          <p className="mt-5 leading-snug">{site.schedule}</p>
          <a
            className="mt-5 inline-block font-extrabold text-primary underline"
            href="https://www.google.com/maps/search/?api=1&query=Sotomayor+576+Castro+Chile"
          >
            Ver ubicación en el mapa ↗
          </a>
        </section>
        <section>
          <h2 className="mb-1 text-2xl font-bold text-primary">Contacto directo</h2>
          <p className="leading-snug">
            <a className="font-extrabold text-primary underline" href={site.whatsapp}>
              WhatsApp de recepción {site.phone} ↗
            </a>
            <span className="block text-sm">
              Agenda y precios, por mensaje, de {site.receptionHours}.
            </span>
          </p>
          <p className="mt-3 leading-snug">
            <a className="font-extrabold text-primary underline" href={site.doctorWhatsapp}>
              WhatsApp del Dr. Moretti {site.doctorPhone} ↗
            </a>
            <span className="block text-sm">
              Consultas clínicas y generales, por mensaje. No se usa para precios ni para agendar.
            </span>
          </p>
          {site.emails.map((email) => (
            <p className="mt-3 leading-snug" key={email}>
              <a className="font-extrabold text-primary underline" href={`mailto:${email}`}>
                {email}
              </a>
            </p>
          ))}
          <Button asChild className="mt-7">
            <a href={site.booking}>Agendar hora en Doctoralia ↗</a>
          </Button>
          <p className="mt-2 text-sm">
            Doctoralia es para la consulta médica del Dr. Moretti. Los demás servicios se agendan
            por el WhatsApp de recepción.
          </p>
        </section>
      </div>
      <section className="mt-14 border-t border-border pt-8">
        <h2 className="text-xl font-extrabold text-heading">
          Encuéntranos también en redes sociales
        </h2>
        <div className="mt-4 flex gap-6">
          <a className="font-extrabold text-primary underline" href={site.instagram}>
            Instagram ↗
          </a>
          <a className="font-extrabold text-primary underline" href={site.facebook}>
            Facebook ↗
          </a>
        </div>
      </section>
    </div>
  );
}
