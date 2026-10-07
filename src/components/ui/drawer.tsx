import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

export const Drawer = DrawerPrimitive.Root;

export const DrawerTrigger = DrawerPrimitive.Trigger;

export const DrawerClose = DrawerPrimitive.Close;

export function DrawerTitle({
  className,
  ...props
}: Omit<DrawerPrimitive.Title.Props, "className"> & { className?: string }) {
  return <DrawerPrimitive.Title className={cn("text-heading", className)} {...props} />;
}

const descriptionVariants = cva("", {
  variants: {
    variant: {
      default: "",
      // A description that stands in for the drawer's main content, such as an empty state.
      heading: "text-xl font-bold text-heading",
    },
  },
  defaultVariants: { variant: "default" },
});

export function DrawerDescription({
  className,
  variant,
  ...props
}: Omit<DrawerPrimitive.Description.Props, "className"> & {
  className?: string;
} & VariantProps<typeof descriptionVariants>) {
  return (
    <DrawerPrimitive.Description
      className={cn(descriptionVariants({ variant }), className)}
      {...props}
    />
  );
}

export function DrawerContent({ className, children, ...props }: DrawerPrimitive.Popup.Props) {
  return (
    <DrawerPrimitive.Portal>
      <DrawerPrimitive.Backdrop className="fixed inset-0 z-60 bg-heading/20 opacity-[calc(1-var(--drawer-swipe-progress))] transition-opacity duration-300 data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none supports-[-webkit-touch-callout:none]:absolute" />
      <DrawerPrimitive.Viewport className="fixed inset-0 z-60 flex justify-end">
        <DrawerPrimitive.Popup
          className={cn(
            "h-dvh w-full max-w-lg translate-x-(--drawer-swipe-movement-x) border-l border-border bg-background text-foreground shadow-2xl transition-transform duration-300 ease-out outline-none data-starting-style:translate-x-full data-ending-style:translate-x-full data-swiping:transition-none motion-reduce:transition-none sm:rounded-l-2xl",
            className,
          )}
          {...props}
        >
          <DrawerPrimitive.Content className="flex h-full min-h-0 flex-col">
            {children}
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPrimitive.Portal>
  );
}
