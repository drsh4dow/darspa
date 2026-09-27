import { Link } from "@tanstack/react-router";
import { Button } from "./ui/button";

export function PageNotFound() {
  return (
    <div className="mx-auto w-full max-w-384 space-y-4 px-2 py-20 sm:px-4">
      <h1 className="text-3xl font-semibold">Página no encontrada</h1>
      <p className="text-muted-foreground">La dirección no existe o ya no está disponible.</p>
      <Link to="/" className="inline-block underline underline-offset-4">
        Volver al inicio
      </Link>
    </div>
  );
}

export function PageError() {
  return (
    <div role="alert" className="mx-auto w-full max-w-384 space-y-4 px-2 py-20 sm:px-4">
      <h1 className="text-3xl font-semibold">No pudimos cargar esta página</h1>
      <p className="text-muted-foreground">Inténtalo nuevamente.</p>
      <Button onClick={() => window.location.reload()}>Volver a intentar</Button>
    </div>
  );
}
