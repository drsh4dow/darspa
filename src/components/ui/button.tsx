import type { ComponentProps } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // A 90% teal fill falls below AA for small labels on light surfaces.
        default: "bg-primary text-primary-foreground hover:bg-primary/95",
        accent: "bg-accent text-accent-foreground hover:bg-accent/90",
        outline:
          "border border-input bg-background hover:bg-secondary hover:text-secondary-foreground",
      },
      size: {
        default: "px-4 py-2 text-sm font-medium",
        cta: "rounded-lg px-4 py-4 text-base font-black shadow-md shadow-heading/25 lg:text-lg",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
