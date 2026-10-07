import { useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Effect } from "effect";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "../../components/ui/drawer";
import { Button } from "../../components/ui/button";
import { SiteIcon } from "../../components/site-icon";
import { useCart } from "./cart";
import { CartContents } from "./cart-contents";

export function CartDrawer({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = useLocation({ select: (location) => location.pathname });
  const navigate = useNavigate();

  return (
    <Drawer
      swipeDirection="right"
      open={open || pathname === "/carro"}
      onOpenChange={(next) => {
        setOpen(next);

        if (!next && pathname === "/carro")
          Effect.runFork(Effect.promise(() => navigate({ to: "/tienda", replace: true })));
      }}
    >
      {children}
      <DrawerContent>
        <header className="flex shrink-0 items-center justify-between border-b border-border px-6 py-5 sm:px-8">
          <DrawerTitle className="text-2xl font-extrabold">Tu carro</DrawerTitle>
          <DrawerClose
            aria-label="Cerrar carro"
            render={(props) => <Button {...props} variant="icon" size="icon" />}
          >
            <span aria-hidden="true" className="text-2xl">
              ×
            </span>
          </DrawerClose>
        </header>
        <CartContents onNavigate={() => setOpen(false)} />
      </DrawerContent>
    </Drawer>
  );
}

export function CartTrigger() {
  const { items } = useCart();
  const count = items.reduce((total, item) => total + item.quantity, 0);

  return (
    <DrawerTrigger
      aria-label={`Carro de compras${count > 0 ? `, ${count} productos` : ""}`}
      render={(props) => <Button {...props} variant="icon" size="icon-sm" />}
      className="relative"
    >
      <SiteIcon name="cart" />
      {count > 0 && (
        <span
          className="absolute -top-1 -right-1 grid min-w-4.5 place-items-center rounded-full bg-primary px-1 text-badge font-bold text-primary-foreground"
          aria-hidden="true"
        >
          {count}
        </span>
      )}
    </DrawerTrigger>
  );
}
