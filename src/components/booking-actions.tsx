import { site } from "../content/site";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "./ui/dialog";
import { SiteIcon } from "./site-icon";
import { ExamOrderForm } from "../features/exam-orders/form";

export function BookingActions({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-4", className)}>
      <Dialog>
        <DialogTrigger asChild>
          <Button size="cta">Órdenes de examen</Button>
        </DialogTrigger>
        <DialogContent className="max-w-xl">
          <DialogTitle className="text-2xl font-bold text-heading">Órdenes de examen</DialogTitle>
          <DialogDescription className="mt-3 mb-5">
            Completa tus datos para descargar las órdenes que presentarás en tu primera consulta.
          </DialogDescription>
          <ExamOrderForm />
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
