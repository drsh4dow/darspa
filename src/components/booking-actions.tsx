import { site } from "../content/site";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "./ui/dialog";
import { SiteIcon } from "./site-icon";

export function BookingActions() {
  return (
    <div className="booking-actions">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="brand">Ordenes De Examen</Button>
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
      <Button asChild variant="brand">
        <a href={site.booking} target="_blank" rel="noreferrer">
          Agendar Hora <SiteIcon name="link" />
        </a>
      </Button>
    </div>
  );
}
