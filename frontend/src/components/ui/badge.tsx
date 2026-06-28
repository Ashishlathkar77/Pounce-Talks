import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide transition-colors",
  {
    variants: {
      variant: {
        default: "",
        success: "",
        warning: "",
        destructive: "",
        outline: "",
        blue: "",
        purple: "",
        orange: "",
        accent: "",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const badgeInlineStyles: Record<string, React.CSSProperties> = {
  default: { background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)" },
  accent: { background: "var(--accent-muted)", color: "var(--accent)", border: "1px solid var(--accent-subtle)" },
  success: { background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" },
  warning: { background: "rgba(234,179,8,0.12)", color: "#eab308", border: "1px solid rgba(234,179,8,0.2)" },
  destructive: { background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" },
  outline: { background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border)" },
  blue: { background: "rgba(59,130,246,0.12)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)" },
  purple: { background: "rgba(168,85,247,0.12)", color: "#c084fc", border: "1px solid rgba(168,85,247,0.2)" },
  orange: { background: "rgba(249,115,22,0.12)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.2)" },
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant = "default", style, ...props }: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({ variant }), className)}
      style={{ ...badgeInlineStyles[variant ?? "default"], ...style }}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
