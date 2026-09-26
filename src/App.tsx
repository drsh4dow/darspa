import type { ReactNode } from "react";
import { useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { navigation, site } from "./content/site";
import { Button } from "./components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "./components/ui/dialog";
import { BookingActions } from "./components/booking-actions";
import { SiteIcon, SocialIcon } from "./components/site-icon";
import { PromotionBanner } from "./components/promotion-banner";

export function App({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = useLocation({ select: (location) => location.pathname });
  const privatePage = pathname === "/mi-cuenta" || pathname === "/admin";

  return (
    <>
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
            <DialogTrigger asChild>
              <button className="menu-trigger">
                <SiteIcon name="menu" />
                Menú
              </button>
            </DialogTrigger>
            <DialogContent
              className="navigation-drawer"
              overlayClassName="navigation-overlay"
              aria-describedby={undefined}
            >
              <div>
                <DialogTitle>Menú</DialogTitle>
                <nav aria-label="Navegación móvil" className="mobile-navigation">
                  {navigation.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      activeOptions={{ exact: item.to === "/" }}
                      activeProps={{ className: "active" }}
                      onClick={() => setMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </div>
              <Button asChild variant="brand" className="sign-in-button rounded-xl px-10 py-3">
                <Link to="/mi-cuenta" onClick={() => setMenuOpen(false)}>
                  Iniciar Sesión
                </Link>
              </Button>
            </DialogContent>
          </Dialog>
          <nav aria-label="Navegación principal" className="desktop-navigation">
            {navigation.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                activeProps={{ className: "active" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <Link to="/tienda" className="icon-link" aria-label="Tienda" title="Tienda">
              <SiteIcon name="shop" />
            </Link>
            <Dialog>
              <DialogTrigger asChild>
                <button
                  className="icon-link"
                  aria-label="Carrito de compras"
                  title="Carrito de compras"
                >
                  <SiteIcon name="cart" />
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogTitle className="text-2xl font-bold text-heading">
                  Carrito de compras
                </DialogTitle>
                <DialogDescription className="my-6">
                  La compra en línea aún no está habilitada.
                </DialogDescription>
                <Button asChild>
                  <a href={site.whatsapp}>Consultar por WhatsApp</a>
                </Button>
              </DialogContent>
            </Dialog>
            <Link to="/mi-cuenta" className="icon-link" aria-label="Mi cuenta" title="Mi cuenta">
              <SiteIcon name="account" />
            </Link>
            <Link to="/" aria-label="Dar Spa, inicio" className="brand">
              <img src="/images/darspa-logo.svg" alt="Dar Spa" width="54" height="40" />
            </Link>
          </div>
        </div>
      </header>
      <main id="contenido" tabIndex={-1} className={privatePage ? "private-page" : undefined}>
        {children}
      </main>
      <section className="booking-banner" aria-labelledby="booking-title">
        <div className="page-width booking-inner">
          <h2 id="booking-title">
            Listo para iniciar tu cambio?<span>Agenda tu hora.</span>
          </h2>
          <BookingActions />
        </div>
      </section>
      <footer className="site-footer">
        <div className="page-width footer-inner">
          <div className="footer-grid">
            <Link to="/" aria-label="Dar Spa, inicio" className="footer-brand">
              <img
                src="/images/darspa-logo.svg"
                width="96"
                height="72"
                alt="Dar Spa"
                loading="lazy"
              />
              <span>
                ANSIEDAD ALIMENTARIA, OBESIDAD
                <br />Y MODELADO CORPORAL NO INVASIVO
              </span>
            </Link>
            <div className="footer-contact">
              <div>
                <h2>WhatsApp</h2>
                <a href={site.whatsapp}>{site.phone}</a>
              </div>
              <div>
                <h2>Dias de Atención</h2>
                <p>{site.days}</p>
              </div>
              <div>
                <h2>Ubicación</h2>
                <Link to="/contacto">{site.address}</Link>
              </div>
              <div>
                <h2>Horario de Atención</h2>
                <p>8:00hrs - 20:00hrs</p>
              </div>
              <Link to="/privacy-policy">Politica de Privacidad</Link>
              <Link to="/terms-of-service">Terminos &amp; Condiciones</Link>
            </div>
            <div className="footer-social">
              <a href={site.instagram} target="_blank" rel="noreferrer" aria-label="Instagram">
                <SocialIcon name="instagram" />
              </a>
              <a href={site.facebook} target="_blank" rel="noreferrer" aria-label="Facebook">
                <SocialIcon name="facebook" />
              </a>
              <a href={site.whatsapp} target="_blank" rel="noreferrer" aria-label="WhatsApp">
                <SocialIcon name="whatsapp" />
              </a>
            </div>
          </div>
          <p className="footer-credit">
            Designed &amp; Developed with <span>♥</span> by{" "}
            <a href="https://danielmoretti.com">Daniel Moretti V.</a>
          </p>
        </div>
      </footer>
      {!privatePage && <PromotionBanner />}
    </>
  );
}
