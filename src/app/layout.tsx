import type { Metadata, Viewport } from "next";
// Same type as Seeens, self-hosted: Hanken Grotesk for display, IBM Plex Mono
// for everything else, Reenie Beanie for the handwritten hint.
import "@fontsource-variable/hanken-grotesk/wght.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@fontsource/ibm-plex-mono/latin-600.css";
import "@fontsource/reenie-beanie/latin-400.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stage Plop",
  description: "Make a stage plot your sound engineer can actually read. By Seeens.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Rub-down wear on the wordmark, like handled transfer lettering. Kept subtle. */}
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
          <filter id="rub-0" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves={2} seed={7} result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -12 0 0 0 9.6" result="m" />
            <feComposite in="SourceGraphic" in2="m" operator="in" />
          </filter>
        </svg>
        {children}
      </body>
    </html>
  );
}
