import type { ReactNode } from "react";
import { useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { navigation, site } from "./content/site";
import { cn } from "./lib/utils";
import { Button } from "./components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./components/ui/dialog";
import { BookingActions } from "./components/booking-actions";
import { SiteIcon, SocialIcon } from "./components/site-icon";
import { PromotionBanner } from "./components/promotion-banner";
import { CartDrawer, CartTrigger } from "./features/purchasing/cart-drawer";

export function App({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = useLocation({ select: (location) => location.pathname });
  const privatePage = ["/mi-cuenta", "/admin", "/pagos/confirmacion"].includes(pathname);

  return (
    <CartDrawer>
      <a
        href="#contenido"
        className="fixed -top-30 left-4 z-100 border-2 border-primary bg-background p-4 text-heading focus:top-4"
      >
        Saltar al contenido
      </a>
      <header className="fixed inset-x-0 top-0 z-40 h-14 bg-muted shadow-xs shadow-muted-foreground/40">
        <div className="mx-auto flex h-full max-w-384 items-center justify-between px-2 sm:px-4">
          <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-1 rounded-3xl border border-primary px-3 py-1 text-sm font-bold text-primary md:hidden">
                <SiteIcon name="menu" />
                Menú
              </button>
            </DialogTrigger>
            <DialogContent layout="drawer" aria-describedby={undefined}>
              <div>
                <DialogTitle className="mb-6 text-3xl font-bold text-heading">Menú</DialogTitle>
                <nav
                  aria-label="Navegación móvil"
                  className="grid gap-4 text-center text-2xl font-bold text-primary"
                >
                  {navigation.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      activeOptions={{ exact: item.to === "/" }}
                      activeProps={{ className: "text-accent" }}
                      onClick={() => setMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </div>
              <Button
                asChild
                variant="accent"
                size="cta"
                className="mt-10 self-center rounded-xl px-10 py-3"
              >
                <Link to="/mi-cuenta" onClick={() => setMenuOpen(false)}>
                  Iniciar Sesión
                </Link>
              </Button>
            </DialogContent>
          </Dialog>
          <nav
            aria-label="Navegación principal"
            className="hidden items-center gap-4 text-2xl font-bold text-primary md:flex"
          >
            {navigation.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="hover:text-heading md:last:hidden min-[54rem]:last:block"
                activeOptions={{ exact: item.to === "/" }}
                activeProps={{ className: "text-accent" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <Link
              to="/tienda"
              className="flex min-h-8 min-w-6 items-center justify-center text-primary"
              aria-label="Tienda"
              title="Tienda"
            >
              <SiteIcon name="shop" />
            </Link>
            <CartTrigger />
            <Link
              to="/mi-cuenta"
              className="flex min-h-8 min-w-6 items-center justify-center text-primary"
              aria-label="Mi cuenta"
              title="Mi cuenta"
            >
              <SiteIcon name="account" />
            </Link>
            <Link to="/" aria-label="Dar Spa, inicio" className="shrink-0">
              <img
                className="h-10 w-13.5"
                src="/images/darspa-logo.svg"
                alt="Dar Spa"
                width="54"
                height="40"
              />
            </Link>
          </div>
        </div>
      </header>
      <main
        id="contenido"
        tabIndex={-1}
        className={cn(
          "pt-14 focus:outline-none",
          privatePage && "mx-auto min-h-dvh max-w-3xl px-6 pt-30 pb-16",
        )}
      >
        {children}
      </main>
      {!privatePage && (
        <section className="bg-secondary" aria-labelledby="booking-title">
          <div className="mx-auto w-full max-w-384 px-4 py-12 sm:px-6 lg:flex lg:items-center lg:justify-between lg:px-8 lg:py-16">
            <h2
              id="booking-title"
              className="font-display text-3xl font-bold tracking-tight text-heading sm:text-4xl"
            >
              Listo para iniciar tu cambio?
              <span className="block text-2xl text-primary sm:text-3xl">Agenda tu hora.</span>
            </h2>
            <BookingActions className="mt-8 lg:mt-0 lg:shrink-0" />
          </div>
        </section>
      )}
      <footer className="bg-secondary">
        <div className="relative mx-auto w-full max-w-384 px-2 py-10 sm:px-4">
          <div className="grid grid-cols-2 items-center gap-4 sm:grid-cols-3">
            <Link
              to="/"
              aria-label="Dar Spa, inicio"
              className="col-start-1 row-start-3 mx-4 w-24 justify-self-end sm:row-span-2 sm:row-start-1 sm:justify-self-start"
            >
              <img
                src="/images/darspa-logo.svg"
                width="96"
                height="72"
                alt="Dar Spa"
                loading="lazy"
              />
              <span className="mt-1 block border-t border-primary pt-0.5 text-center font-[Arial,sans-serif] text-[3.5px] leading-[1.1] font-bold text-accent">
                ANSIEDAD ALIMENTARIA, OBESIDAD
                <br />Y MODELADO CORPORAL NO INVASIVO
              </span>
            </Link>
            <div className="col-span-2 mx-auto grid max-w-105 grid-cols-2 items-center gap-4 font-bold text-primary sm:col-span-1 sm:col-start-2 sm:w-full sm:min-w-0 sm:max-w-none sm:grid-cols-3 sm:gap-2 md:gap-6 lg:gap-8">
              <div>
                <h2 className="text-base text-accent">WhatsApp</h2>
                <a className="text-sm hover:underline" href={site.whatsapp}>
                  {site.phone}
                </a>
              </div>
              <div>
                <h2 className="text-base text-accent">Dias de Atención</h2>
                <p className="text-sm">{site.days}</p>
              </div>
              <div>
                <h2 className="text-base text-accent">Ubicación</h2>
                <Link className="text-sm hover:underline" to="/contacto">
                  {site.address}
                </Link>
              </div>
              <div>
                <h2 className="text-base text-accent">Horario de Atención</h2>
                <p className="text-sm">8:00hrs - 20:00hrs</p>
              </div>
              <Link className="text-base text-accent hover:underline" to="/privacy-policy">
                Politica de Privacidad
              </Link>
              <Link className="text-base text-accent hover:underline" to="/terms-of-service">
                Terminos &amp; Condiciones
              </Link>
            </div>
            <div className="col-start-2 row-start-3 flex gap-2 text-primary sm:col-start-3 sm:row-start-1 sm:justify-end">
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
          <p className="absolute bottom-0 left-0 w-full text-center text-xs font-black text-muted-foreground">
            Designed &amp; Developed with <span className="text-destructive">♥</span> by{" "}
            <a className="underline" href="https://danielmoretti.com">
              Daniel Moretti V.
            </a>
          </p>
        </div>
      </footer>
      {!privatePage && <PromotionBanner />}
    </CartDrawer>
  );
}
