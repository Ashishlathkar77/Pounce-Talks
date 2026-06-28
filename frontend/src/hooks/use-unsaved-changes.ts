import { useEffect } from "react";

export const UNSAVED_MESSAGE =
  "You have unsaved changes. Leave without saving? Your edits will be lost.";

/**
 * Guards against losing unsaved work while `dirty` is true.
 *
 * Covers the two navigation vectors that actually unmount/replace the editor:
 *
 *   1. **Hard navigation** — reload, tab close, address-bar change, external
 *      links. Handled with a `beforeunload` listener (the browser shows its
 *      own native confirm; the string is ignored by modern browsers but
 *      `returnValue` must be set to trigger the prompt).
 *
 *   2. **In-app SPA navigation** — clicking any internal `<a href>` (sidebar,
 *      breadcrumb, "New agent", etc.). The Next.js App Router intentionally
 *      ships no `router.events`/route-change blocker, so we intercept link
 *      clicks in the capture phase and `window.confirm` before the SPA
 *      navigates. Declining cancels the click so the route never changes.
 *
 * Programmatic `router.push` calls (e.g. the editor's own "Back" button) are
 * NOT anchor clicks, so guard those at the call site with `confirmDiscard()`.
 *
 * The listeners are only attached while `dirty` is true, so there's zero
 * overhead (and no spurious prompts) once everything is saved.
 */
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    const onClickCapture = (e: MouseEvent) => {
      // Ignore non-primary clicks and modifier clicks (new tab / new window).
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href, window.location.href);
      // Only guard internal navigations that actually leave the current page.
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;

      if (!window.confirm(UNSAVED_MESSAGE)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClickCapture, true);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, [dirty]);
}

/** Returns true if it's safe to proceed with a programmatic navigation. */
export function confirmDiscard(dirty: boolean): boolean {
  if (!dirty) return true;
  return window.confirm(UNSAVED_MESSAGE);
}
