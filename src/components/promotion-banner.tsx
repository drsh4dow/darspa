import { useEffect, useRef, useState } from "react";
import { auth } from "../lib/auth";
import { Link } from "@tanstack/react-router";
import { Button } from "./ui/button";

export function PromotionBanner() {
  const session = auth.useSession();
  const sentinel = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  // Match the legacy banner's 80vh threshold without subscribing to every scroll event.
  useEffect(() => {
    const element = sentinel.current;

    if (!element) return undefined;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry) setVisible(!entry.isIntersecting);
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div
        ref={sentinel}
        className="pointer-events-none absolute top-0 left-0 h-[80vh] w-px"
        aria-hidden="true"
      />
      {session.data === null && (
        <aside
          className="promotion-banner invisible sticky bottom-0 z-20 h-0 translate-y-full bg-card text-card-foreground shadow-2xl shadow-foreground/25 data-[visible=true]:visible data-[visible=true]:h-16 data-[visible=true]:translate-y-0 data-[visible=true]:delay-0 motion-reduce:transition-none"
          data-visible={visible}
          inert={!visible}
          aria-label="Tienda y cuenta"
        >
          <div className="mx-auto flex h-full max-w-7xl items-center justify-center px-6 md:justify-between">
            <p className="hidden font-display text-sm font-bold tracking-tight text-heading md:block">
              Crea tu cuenta y regala una GiftCard de nuestros servicios.
              <br />
              Prueba visitar la nueva tienda online
            </p>
            <div className="flex gap-4">
              <Button asChild size="cta" className="px-3 py-2">
                <Link to="/tienda">Visitar Tienda</Link>
              </Button>
              <Button asChild variant="accent" size="cta" className="px-3 py-2">
                <Link to="/mi-cuenta">Iniciar Sesión</Link>
              </Button>
            </div>
          </div>
        </aside>
      )}
    </>
  );
}
