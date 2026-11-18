import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-xl border px-4 py-3 text-sm flex items-start gap-3",
  {
    variants: {
      variant: {
        default: "border-border bg-card text-foreground",
        info: "border-cyan-500/30 bg-cyan-500/10 text-cyan-800 dark:text-cyan-200",
        success:
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
        warning:
          "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200",
        destructive:
          "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
));
Alert.displayName = "Alert";

export { Alert };
