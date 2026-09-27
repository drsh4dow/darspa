import { site } from "../content/site";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "./ui/dialog";
import { SiteIcon } from "./site-icon";

export function BookingActions({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-4", className)}>
      <Dialog>
        <DialogTrigger asChild>
          <Button size="cta">Ordenes De Examen</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle className="text-2xl font-bold text-heading">Órdenes de examen</DialogTitle>
          <DialogDescription className="my-6">
            La generación de órdenes aún no está habilitada. Consulta con nuestro equipo por
            WhatsApp.
          </DialogDescription>
          <Button asChild>
            <a href={site.whatsapp}>Consultar por WhatsApp</a>
          </Button>
        </DialogContent>
      </Dialog>
      <Button asChild size="cta">
        <a href={site.booking} target="_blank" rel="noreferrer">
          Agendar Hora <SiteIcon name="link" className="size-4 stroke-3" />
        </a>
      </Button>
    </div>
  );
}
