import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@phosphor-icons/web/regular";
import "@phosphor-icons/web/fill";
// Hemut Design System primitives MUST load before globals.css so alias rules
// (e.g. `--bg: var(--bg-neutral-primary)`) can resolve. globals.css also
// imports it at the top, but the explicit import here ensures React/Next
// server-side ordering is correct.
import "./hemut-ds.css";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Pounce — AI Outbound SDR",
  description: "We call before they close the tab.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning because the anti-flash script below sets
    // data-theme on <html> before React hydrates, intentionally making the
    // server and client markup differ on this one attribute.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the persisted theme before first paint to avoid a light→dark
            flash on load. Mirrors the logic in the dashboard header's toggle. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("converse-theme");if(!t){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`,
          }}
        />
      </head>
      <body className={inter.variable}>
        {children}
      </body>
    </html>
  );
}
