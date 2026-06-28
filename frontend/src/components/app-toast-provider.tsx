"use client";

import { ToastProvider } from "@hemut2025/design-system";
import { ToastBridge } from "@/hooks/use-toast";

/**
 * Client boundary for the Hemut DS toast system.
 *
 * `ToastProvider` calls `createContext`, which isn't available in the React
 * Server Components runtime — so it can't be imported into the (server)
 * RootLayout directly. Wrapping it in this `"use client"` component keeps the
 * DS import on the client side. Mirrors how `PropelAuthProvider` is structured.
 *
 * `ToastBridge` lives inside the provider so the imperative `toast()` singleton
 * (see hooks/use-toast.ts) can capture the live ToastApi.
 */
export function AppToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider placement="top-right">
      {children}
      <ToastBridge />
    </ToastProvider>
  );
}
