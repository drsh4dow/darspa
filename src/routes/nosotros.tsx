import { createFileRoute } from "@tanstack/react-router";
import team from "../content/team.json";
import { site } from "../content/site";
import { PageHeading } from "../components/public-content";
import { publicMetadata } from "../lib/metadata";

export const Route = createFileRoute("/nosotros")({
  head: () =>
    publicMetadata(
      "Nuestro equipo",
      "Conoce a los profesionales, técnicos y administrativos de Dar Spa. Atención integral y cercana en Castro, Chiloé.",
      "/nosotros",
    ),
  component: AboutPage,
});

const orderedTeam = [...team];

orderedTeam.sort((a, b) => a.order - b.order);

function AboutPage() {
  return (
    <>
      <section className="mx-auto w-full max-w-384 px-2 py-20 sm:px-4">
        <PageHeading className="lg:mb-20" title="Sobre Nosotros" />
        <div className="mb-10 grid gap-10 sm:grid-cols-2 lg:mb-40 lg:gap-24">
          <div>
            <h2 className="mb-1 text-2xl font-bold text-primary">¿Quiénes Somos?</h2>
            <p className="leading-snug">{site.about}</p>
          </div>
          <div>
            <h2 className="mb-1 text-2xl font-bold text-primary">¿Por qué somos Diferentes?</h2>
            <p className="leading-snug">{site.difference}</p>
          </div>
        </div>
      </section>
      <section className="bg-muted py-20">
        <div className="mx-auto w-full max-w-384 px-2 sm:px-4">
          <h2 className="mb-2 text-2xl font-black text-heading lg:text-4xl">
            Conoce a Nuestro Equipo
          </h2>
          <p className="mb-10 text-sm font-bold text-muted-foreground lg:mb-20">
            Conoce al equipo que hace posible tus tratamientos
          </p>
          <div className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 sm:gap-y-16 md:grid-cols-3">
            {orderedTeam.map((member) => (
              <article
                className="group rounded-2xl bg-card p-8 text-center text-card-foreground shadow-xs shadow-foreground/5 hover:shadow-md hover:shadow-foreground/5"
                key={member.legacyId}
              >
                <div className="mx-auto mb-8 size-56 max-w-full overflow-hidden rounded-full border border-border bg-muted shadow-sm shadow-foreground/15">
                  <img
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
                    src={member.image}
                    alt={member.name}
                    width="320"
                    height="320"
                    loading="lazy"
                  />
                </div>
                <h3 className="font-display text-xl font-bold text-heading">{member.name}</h3>
                <p className="font-display text-base font-bold text-muted-foreground">
                  {member.title}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
