"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

/**
 * TabsList — underline style: transparent bg, bottom border separator.
 * Pass className to override if you need the pill/filled variant.
 */
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "flex flex-row items-end",
      className
    )}
    style={{ borderBottom: "1px solid var(--border)" }}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

/**
 * TabsTrigger — golden underline active state.
 * data-state="active"  → border-bottom: var(--accent), color: var(--text-primary)
 * data-state="inactive" → border-bottom: transparent, color: var(--text-muted)
 *
 * Add className="hemut-tab" to use the filled pill style instead.
 */

const TABS_STYLE_ID = "hemut-tabs-underline-style";

function ensureTabsStyle() {
  if (typeof document === "undefined") return;
  if (document.getElementById(TABS_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = TABS_STYLE_ID;
  style.textContent = `
    /* Underline tab trigger */
    .hemut-tab-underline {
      border-bottom: 2px solid transparent;
      transition: border-color 0.15s ease, color 0.15s ease;
    }
    .hemut-tab-underline[data-state="active"] {
      border-bottom-color: var(--accent) !important;
      color: var(--text-primary) !important;
      font-weight: 600;
    }
    .hemut-tab-underline[data-state="inactive"] {
      border-bottom-color: transparent !important;
      color: var(--text-muted) !important;
    }
    .hemut-tab-underline[data-state="inactive"]:hover {
      color: var(--text-secondary) !important;
    }

    /* Filled pill tab trigger */
    .hemut-tab[data-state="active"] {
      background: var(--accent);
      color: #000000;
      font-weight: 600;
    }
    .hemut-tab[data-state="inactive"] {
      background: transparent;
      color: var(--text-muted);
    }
    .hemut-tab[data-state="inactive"]:hover {
      color: var(--text-secondary);
      background: var(--bg-hover);
    }
  `;
  document.head.appendChild(style);
}

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => {
  React.useEffect(() => {
    ensureTabsStyle();
  }, []);

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "hemut-tab-underline",
        "inline-flex items-center justify-center whitespace-nowrap",
        "text-sm py-2.5 px-4",
        "disabled:pointer-events-none disabled:opacity-50",
        "focus-visible:outline-none",
        "transition-all",
        className
      )}
      {...props}
    />
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("mt-0 focus-visible:outline-none", className)}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
