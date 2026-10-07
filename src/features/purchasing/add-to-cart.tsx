import { Button } from "../../components/ui/button";
import { DialogClose } from "../../components/ui/dialog";
import { DrawerTrigger } from "../../components/ui/drawer";
import { useCart } from "./cart";

export function AddToCart({
  offeringId,
  priceClp,
  inDialog = false,
}: {
  offeringId: string;
  priceClp: number;
  inDialog?: boolean;
}) {
  const cart = useCart();
  const full = cart.items.reduce((total, item) => total + item.quantity, 0) >= 20;

  const action = (
    <DrawerTrigger
      render={(props) => <Button {...props} size="lg" />}
      onClick={() => {
        if (!full) cart.add(offeringId, priceClp);
      }}
    >
      {full ? "Ver carro · 20 vouchers" : "Agregar al carro"}
    </DrawerTrigger>
  );

  return (
    <div className="mt-8 space-y-3">
      <p className="text-sm text-muted-foreground">Voucher transferible · Vigencia de 60 días</p>
      {inDialog ? <DialogClose asChild>{action}</DialogClose> : action}
    </div>
  );
}
