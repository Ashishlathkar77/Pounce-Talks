"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { useToast as useDsToast } from "@hemut2025/design-system";
import type { ToastApi } from "@hemut2025/design-system";

/**
 * Imperative toast bridge.
 *
 * Legacy call sites across the app do `import { toast } from "@/hooks/use-toast"`
 * and call `toast({ title, description, variant })` — an imperative singleton.
 * The Hemut DS toast system is hook/context based (`useToast()` → ToastApi), so
 * we bridge the two:
 *
 *   • `<ToastBridge />` is mounted once inside the DS `ToastProvider` (see
 *     layout.tsx). It captures the live `ToastApi` into a module variable.
 *   • `toast(...)` maps the legacy `{ variant }` vocabulary onto the DS tone
 *     shortcuts and forwards the call to that captured api.
 *
 * This replaces the old Radix-based `Toaster` (whose plain Tailwind color
 * classes didn't resolve under the DS theme, so toasts rendered invisibly).
 * Every existing `toast()` call now renders a real DS toast with no edits.
 */

interface LegacyToast {
  title?: ReactNode;
  description?: ReactNode;
  /** Legacy vocabulary: default | success | destructive | error | warning | info | brand */
  variant?: string;
}

let api: ToastApi | null = null;
// Calls made before the bridge mounts are queued and flushed once the api is
// captured, so no early toast is silently dropped.
const queue: LegacyToast[] = [];

function emit(t: LegacyToast) {
  if (!api) {
    queue.push(t);
    return;
  }
  const opts = { title: t.title ?? "", description: t.description };
  switch (t.variant) {
    case "destructive":
    case "error":   api.error(opts);   break;
    case "success": api.success(opts); break;
    case "warning": api.warning(opts); break;
    case "info":    api.info(opts);    break;
    // "brand" / unset / unknown → neutral (informational, never mis-toned)
    default:        api.neutral(opts); break;
  }
}

/** Fire a toast from anywhere (event handlers, async callbacks, etc.). */
export function toast(t: LegacyToast) {
  emit(t);
}

/**
 * Mounted once inside the DS `ToastProvider` to capture the live `ToastApi`
 * for the imperative `toast()` singleton above. Renders nothing.
 */
export function ToastBridge() {
  const ds = useDsToast();
  useEffect(() => {
    api = ds;
    while (queue.length) emit(queue.shift()!);
    return () => {
      if (api === ds) api = null;
    };
  }, [ds]);
  return null;
}

/** Re-export the DS hook for components that prefer the hook form. */
export { useDsToast as useToast };
