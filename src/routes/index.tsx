import { Link, createFileRoute } from "@tanstack/react-router";
import { site, specialties } from "../content/site";
import services from "../content/services.json";
import faq from "../content/faq.json";
import { BookingActions } from "../components/booking-actions";
import { ServiceRows } from "../components/public-content";
import { Testimonials } from "../components/testimonials";
import { SiteIcon, SocialIcon } from "../components/site-icon";
import { publicMetadata } from "../lib/metadata";

export const Route = createFileRoute("/")({
  head: () =>
    publicMetadata(
      "Centro Nutricional Avanzado",
      "Dar Spa en Castro, Chiloé: nutrición avanzada, modelado corporal, servicios y exámenes. Conoce a nuestro equipo y agenda en Doctoralia.",
      "/",
    ),
  component: HomePage,
});

function InstagramFallback() {
  return (
    <>
      <h2>Novedades Instagram</h2>
      <div className="instagram-fallback">
        <a href={site.instagram}>Ver publicaciones en Instagram</a>
      </div>
      <a className="instagram-link" href={site.instagram} target="_blank" rel="noreferrer">
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
      <section className="hero">
        <div className="page-width hero-grid">
          <div className="hero-brand">
            <div className="hero-badge">
              <img
                src="/images/darspa-logo.svg"
                alt="Dar Spa"
                width="170"
                height="127"
                fetchPriority="high"
              />
              <span>
                ANSIEDAD ALIMENTARIA, OBESIDAD
                <br />Y MODELADO CORPORAL NO INVASIVO
              </span>
            </div>
          </div>
          <div className="hero-mobile-heading">
            <h1>
              Clínica <br />
              DarSpa
            </h1>
            <h2>
              Modelado Corporal <br />
              No Invasivo
            </h2>
          </div>
          <section className="instagram-panel">
            <InstagramFallback />
          </section>
          <div className="hero-message-wrap">
            <article className="hero-message">
              <p>
                Si esta es tu<span className="font-bold"> “primera consulta”</span> en nuestra
                clínica te recomendamos que descargues las órdenes de examen previo a tu primera
                visita. Si ya eres paciente en control o bien ya tienes los resultados, puedes
                <span className="font-bold"> “Agendar Hora”</span>.
              </p>
            </article>
          </div>
          <BookingActions />
        </div>
        <div className="hero-wave" aria-hidden="true">
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M985.66,92.83C906.67,72,823.78,31,743.84,14.19c-82.26-17.34-168.06-16.33-250.45.39-57.84,11.73-114,31.07-172,41.86A600.21,600.21,0,0,1,0,27.35V120H1200V95.8C1132.19,118.92,1055.71,111.31,985.66,92.83Z" />
          </svg>
        </div>
      </section>
      <section className="instagram-mobile">
        <div className="page-width">
          <InstagramFallback />
        </div>
      </section>
      <section className="page-width section-space home-about">
        <h2 className="section-title">¿A Que Nos Dedicamos?</h2>
        <div className="intro-grid">
          <div>
            <h3>Nuestra Misión</h3>
            <p>{site.mission}</p>
          </div>
          <div>
            <h3>¿Quienes Somos?</h3>
            <p>{site.about}</p>
          </div>
        </div>
        <ul className="specialties">
          {specialties.map(([name, description]) => (
            <li key={name}>
              <h3>{name}</h3>
              <p>{description}</p>
            </li>
          ))}
        </ul>
      </section>
      <Testimonials />
      <section className="page-width section-space home-services">
        <h2 className="section-title">Algunos De Nuestros Servicios</h2>
        <ServiceRows items={services.slice(0, 2)} />
        <div className="service-more">
          <Link to="/servicios">
            <SiteIcon name="arrow" />
            Ver Mas Servicios
          </Link>
        </div>
      </section>
      <section className="faq-section">
        <div className="page-width">
          <h2 className="section-title">Preguntas Frecuentes</h2>
          <p className="section-caption">
            Si tiene alguna pregunta que no se responda aqui,{" "}
            <a href={`mailto:${site.email}`}>contactenos</a>.
          </p>
          <div className="faq-grid">
            {[faq.slice(0, 3), faq.slice(3, 6), faq.slice(6)].map((items, index) => (
              <div key={index}>
                {items.map((item) => (
                  <article key={item.question}>
                    <h3>{item.question}</h3>
                    <p>{item.answer}</p>
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
