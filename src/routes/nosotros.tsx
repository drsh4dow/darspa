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
      <section className="page-width section-space about-intro">
        <PageHeading title="Sobre Nosotros" />
        <div className="intro-grid">
          <div>
            <h2>¿Quiénes Somos?</h2>
            <p>{site.about}</p>
          </div>
          <div>
            <h2>¿Por qué somos Diferentes?</h2>
            <p>{site.difference}</p>
          </div>
        </div>
      </section>
      <section className="team-section section-space">
        <div className="page-width">
          <h2 className="section-title">Conoce a Nuestro Equipo</h2>
          <p className="section-caption">Conoce al equipo que hace posible tus tratamientos</p>
          <div className="team-grid">
            {orderedTeam.map((member) => (
              <article key={member.legacyId}>
                <div className="team-photo">
                  <img
                    src={member.image}
                    alt={member.name}
                    width="320"
                    height="320"
                    loading="lazy"
                  />
                </div>
                <h3>{member.name}</h3>
                <p>{member.title}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
