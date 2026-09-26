import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

export function App({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#contenido"
        className="sr-only rounded-md bg-primary p-3 text-primary-foreground focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
      >
        Saltar al contenido
      </a>
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-7">
          <Link
            to="/"
            className="text-xl font-semibold tracking-tight underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            Dar Spa
          </Link>
          <nav aria-label="Navegación principal" className="flex items-center gap-4">
            <Link to="/mi-cuenta" className="underline underline-offset-4">
              Mi cuenta
            </Link>
            <span className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground">
              Desarrollo
            </span>
          </nav>
        </div>
      </header>
      <main
        id="contenido"
        tabIndex={-1}
        className="mx-auto max-w-3xl px-6 py-14 outline-none sm:py-20"
      >
        {children}
      </main>
      <footer className="mx-auto max-w-3xl px-6 pb-8 text-sm text-muted-foreground">
        Dar Spa · Castro, Chiloé
      </footer>
    </>
  );
}
