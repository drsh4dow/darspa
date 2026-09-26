import { useEffect, useRef, useState } from "react";
import { useConvexAuth } from "convex/react";
import { Link } from "@tanstack/react-router";
import { Button } from "./ui/button";

export function PromotionBanner() {
  const { isAuthenticated } = useConvexAuth();
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
      <div ref={sentinel} className="promotion-sentinel" aria-hidden="true" />
      {!isAuthenticated && (
        <aside
          className="promotion-banner"
          data-visible={visible}
          inert={!visible}
          aria-label="Tienda y cuenta"
        >
          <div>
            <p>
              Crea tu cuenta y regala una GiftCard de nuestros servicios.
              <br />
              Prueba visitar la nueva tienda online
            </p>
            <div className="promotion-actions">
              <Button asChild variant="brand" className="px-3 py-2">
                <Link to="/tienda">Visitar Tienda</Link>
              </Button>
              <Button asChild variant="brand" className="sign-in-button px-3 py-2">
                <Link to="/mi-cuenta">Iniciar Sesión</Link>
              </Button>
            </div>
          </div>
        </aside>
      )}
    </>
  );
}
