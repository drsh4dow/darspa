import { Link, createFileRoute } from "@tanstack/react-router";
import { site, specialties } from "../content/site";
import services from "../content/services.json";
import faq from "../content/faq.json";
import { BookingActions } from "../components/booking-actions";
import { ServiceRows } from "../components/public-content";
import { Testimonials } from "../components/testimonials";
import { SiteIcon, SocialIcon } from "../components/site-icon";
import { publicMetadata } from "../lib/metadata";
import { cn } from "../lib/utils";

export const Route = createFileRoute("/")({
  head: () =>
    publicMetadata(
      "Centro Nutricional Avanzado",
      "Dar Spa en Castro, Chiloé: nutrición avanzada, modelado corporal, servicios y exámenes. Conoce a nuestro equipo y agenda en Doctoralia.",
      "/",
    ),
  component: HomePage,
});

function InstagramFallback({ desktop = false }: { desktop?: boolean }) {
  return (
    <>
      <h2
        className={cn("text-3xl font-black text-heading", desktop && "mb-8 text-2xl text-primary")}
      >
        Novedades Instagram
      </h2>
      <div
        className={cn(
          "grid min-h-60 place-items-center text-primary",
          desktop && "mb-8 aspect-square min-h-0 w-full flex-1",
        )}
      >
        <a className="underline" href={site.instagram}>
          Ver publicaciones en Instagram
        </a>
      </div>
      <a
        className={cn(
          "inline-flex items-center gap-1 text-xl font-black text-primary",
          desktop && "self-end text-lg",
        )}
        href={site.instagram}
        target="_blank"
        rel="noreferrer"
      >
        <SiteIcon name="arrow" />
        <SocialIcon name="instagram" />
        darspa.cl
      </a>
    </>
  );
}

function HomePage() {
  return (
    <>
      <section className="relative bg-[url('/images/woman-shape-small.png')] bg-size-[auto_100%] bg-top-right bg-no-repeat shadow-xs shadow-muted-foreground/40 sm:bg-[url('/images/woman-shape-mid.png')] lg:bg-[url('/images/banner.png')] lg:bg-cover lg:bg-center lg:shadow-none">
        <div className="absolute inset-0 bg-muted/75 lg:hidden" aria-hidden="true" />
        <div className="relative mx-auto grid w-full max-w-384 grid-cols-1 gap-4 px-2 pt-20 pb-10 sm:gap-8 sm:px-4 sm:pt-32 lg:grid-cols-2 lg:pt-10 lg:pb-56">
          <div className="hidden pb-20 lg:block">
            <div className="hero-badge flex size-63.25 flex-col items-center bg-card pt-12.5">
              <img
                src="/images/darspa-logo.svg"
                alt="Dar Spa"
                width="170"
                height="127"
                fetchPriority="high"
              />
              <span className="mt-2 border-t-2 border-primary pt-1 text-center font-[Arial,sans-serif] text-[8px] leading-2.25 font-bold text-accent">
                ANSIEDAD ALIMENTARIA, OBESIDAD
                <br />Y MODELADO CORPORAL NO INVASIVO
              </span>
            </div>
          </div>
          <div className="font-display font-bold lg:sr-only">
            <h1 className="mb-1 text-4xl sm:text-5xl">
              Clínica <br className="sm:hidden" />
              DarSpa
            </h1>
            <h2 className="text-xl text-primary sm:text-2xl">
              Modelado Corporal <br />
              No Invasivo
            </h2>
          </div>
          <section className="hidden lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:flex lg:flex-col lg:items-center lg:rounded-lg lg:bg-card/80 lg:px-16 lg:py-8">
            <InstagramFallback desktop />
          </section>
          <div className="col-start-1 justify-self-start lg:self-center lg:rounded-lg lg:bg-secondary/40 lg:p-4">
            <article className="max-w-sm rounded-tl-[2.5rem] rounded-tr-xs rounded-br-[2.5rem] rounded-bl-xs bg-card p-4 text-card-foreground shadow-xs shadow-muted-foreground/40 lg:p-6">
              <p className="text-lg leading-snug">
                Si esta es tu<span className="font-bold"> “primera consulta”</span> en nuestra
                clínica te recomendamos que descargues las órdenes de examen previo a tu primera
                visita. Si ya eres paciente en control o bien ya tienes los resultados, puedes
                <span className="font-bold"> “Agendar Hora”</span>.
              </p>
            </article>
          </div>
          <BookingActions className="col-start-1 self-start" />
        </div>
        <div
          className="absolute bottom-0 left-0 hidden w-full overflow-hidden leading-none lg:block"
          aria-hidden="true"
        >
          <svg
            className="block h-18.25 w-[calc(170%+1.3px)] rotate-y-180 fill-background"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
          >
            <path d="M985.66,92.83C906.67,72,823.78,31,743.84,14.19c-82.26-17.34-168.06-16.33-250.45.39-57.84,11.73-114,31.07-172,41.86A600.21,600.21,0,0,1,0,27.35V120H1200V95.8C1132.19,118.92,1055.71,111.31,985.66,92.83Z" />
          </svg>
        </div>
      </section>
      <section className="rounded-bl-[5rem] pt-10 pb-16 shadow-md shadow-muted-foreground/40 lg:hidden">
        <div className="mx-auto w-full max-w-384 px-2 sm:px-4">
          <InstagramFallback />
        </div>
      </section>
      <section className="mx-auto w-full max-w-384 px-2 py-20 sm:px-4">
        <h2 className="mb-6 text-3xl font-black text-heading lg:mb-12 lg:text-5xl">
          ¿A Que Nos Dedicamos?
        </h2>
        <div className="mb-10 grid gap-10 sm:grid-cols-2 lg:mb-40 lg:gap-24">
          <div>
            <h3 className="mb-1 text-2xl font-bold text-primary">Nuestra Misión</h3>
            <p className="leading-snug">{site.mission}</p>
          </div>
          <div>
            <h3 className="mb-1 text-2xl font-bold text-primary">¿Quienes Somos?</h3>
            <p className="leading-snug">{site.about}</p>
          </div>
        </div>
        <ul className="mx-auto mb-12 text-center after:mx-auto after:block after:h-0.5 after:w-56 after:bg-primary sm:after:w-80 md:after:w-96 lg:after:w-160">
          {specialties.map(([name, description]) => (
            <li
              className="before:mx-auto before:mb-4 before:block before:h-0.5 before:w-56 before:bg-primary sm:before:w-80 md:before:mb-6 md:before:w-96 lg:before:mb-12 lg:before:w-160"
              key={name}
            >
              <h3 className="mb-1 font-display text-4xl font-bold">{name}</h3>
              <p className="mb-4 text-xs font-bold text-muted-foreground sm:text-sm md:mb-6 lg:mb-12">
                {description}
              </p>
            </li>
          ))}
        </ul>
      </section>
      <Testimonials />
      <section className="mx-auto w-full max-w-384 px-2 py-20 sm:px-4">
        <h2 className="mb-6 text-center text-3xl font-black text-heading lg:mb-12 lg:text-5xl">
          Algunos De Nuestros Servicios
        </h2>
        <ServiceRows items={services.slice(0, 2)} />
        <div className="mx-auto mt-8 flex max-w-4xl justify-end">
          <Link className="flex items-center gap-1 text-lg font-black text-primary" to="/servicios">
            <SiteIcon name="arrow" className="size-8" />
            Ver Mas Servicios
          </Link>
        </div>
      </section>
      <section className="bg-muted pt-10 pb-20">
        <div className="mx-auto w-full max-w-384 px-2 sm:px-4">
          <h2 className="mb-2 text-3xl font-black text-heading lg:text-5xl">
            Preguntas Frecuentes
          </h2>
          <p className="mb-8 text-sm font-bold text-muted-foreground">
            Si tiene alguna pregunta que no se responda aqui,{" "}
            <a className="text-accent underline" href={`mailto:${site.email}`}>
              contactenos
            </a>
            .
          </p>
          <div className="grid max-w-2xl gap-8 lg:max-w-none lg:grid-cols-3">
            {[
              { id: "first", items: faq.slice(0, 3) },
              { id: "second", items: faq.slice(3, 6) },
              { id: "third", items: faq.slice(6) },
            ].map((column) => (
              <div className="grid content-start gap-10" key={column.id}>
                {column.items.map((item) => (
                  <article key={item.question}>
                    <h3 className="text-lg leading-6 font-bold text-heading">{item.question}</h3>
                    <p className="mt-4 text-sm text-muted-foreground">{item.answer}</p>
                  </article>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
