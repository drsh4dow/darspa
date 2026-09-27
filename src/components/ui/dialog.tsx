import type { ComponentProps } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

export {
  Root as Dialog,
  Trigger as DialogTrigger,
  Close as DialogClose,
  Title as DialogTitle,
  Description as DialogDescription,
} from "@radix-ui/react-dialog";

const contentVariants = cva("fixed z-50 overflow-y-auto shadow-2xl shadow-foreground/25", {
  variants: {
    layout: {
      default:
        "top-1/2 left-1/2 max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-1/2 rounded-lg bg-card px-6 py-8 text-card-foreground",
      drawer: "inset-y-0 left-0 flex h-dvh w-3/4 max-w-sm flex-col justify-between bg-muted p-6",
      offering:
        "inset-0 flex max-h-dvh w-full items-center-safe rounded-xs bg-card px-4 pt-14 pb-8 text-card-foreground sm:px-6 sm:py-8 md:inset-auto md:top-1/2 md:left-1/2 md:max-h-[calc(100dvh-4rem)] md:w-[calc(100%-3rem)] md:max-w-2xl md:-translate-1/2 md:p-6 lg:max-w-216 lg:p-8",
    },
  },
  defaultVariants: { layout: "default" },
});

export function DialogContent({
  children,
  className,
  layout = "default",
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & VariantProps<typeof contentVariants>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          "fixed inset-0 z-50 bg-muted-foreground/75",
          layout === "drawer" && "bg-muted-foreground/20",
        )}
      />
      <DialogPrimitive.Content className={cn(contentVariants({ layout }), className)} {...props}>
        {children}
        <DialogPrimitive.Close
          className={cn(
            "absolute top-2 right-2 grid size-11 place-items-center rounded-md text-[1.75rem] text-muted-foreground hover:bg-muted",
            layout === "offering" && "md:top-3 md:right-3 lg:top-5 lg:right-5",
          )}
          aria-label="Cerrar"
        >
          <span aria-hidden="true">×</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
