import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Anatomy 3D — for BAMS & MBBS students",
    template: "%s · Anatomy 3D",
  },
  description:
    "Learn anatomy from real, anatomically segmented 3D models. Every structure is individually named with its Terminologia Anatomica term and explained in simple English. Free and open.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /*
     * suppressHydrationWarning on <html> and <body> ONLY.
     *
     * Browser extensions inject attributes into these two elements before React
     * hydrates, so React sees markup the server never sent:
     *
     *   <html>  data-scribe-recorder-ready      (Scribe)
     *   <body>  data-new-gr-c-s-check-loaded    (Grammarly)
     *           data-gr-ext-installed           (Grammarly)
     *
     * Nothing in this app is non-deterministic during render — no Date.now,
     * Math.random, locale formatting or `typeof window` branching — and
     * `npm run check:hydration` confirms zero mismatches in an extension-free
     * Chromium, where <html> carries only `lang` and <body> only `class`.
     *
     * This flag is SHALLOW: it covers each element's own attributes and text,
     * not its descendants. So genuine hydration bugs anywhere inside the app
     * still surface normally — this silences the extension noise without
     * blinding us to real problems.
     */
    <html lang="en" suppressHydrationWarning>
      {/*
        h-dvh, not min-h-screen: the explorer is a full-height app view, and the
        dynamic viewport unit accounts for mobile browser chrome that appears and
        disappears. With min-h-screen the phone layout overflowed and the page
        scrolled underneath the 3D canvas.
      */}
      <body className="flex h-dvh flex-col overflow-hidden" suppressHydrationWarning>
        <header className="sticky top-0 z-30 flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-white/85 px-5 py-3 backdrop-blur">
          <Link
            href="/"
            className="flex items-baseline gap-2 text-[15px] font-semibold tracking-tight text-[var(--ink)]"
          >
            <span>Anatomy</span>
            <span className="rounded bg-[var(--accent)] px-1.5 py-0.5 text-xs font-bold text-white">
              3D
            </span>
          </Link>
          <nav className="flex items-center gap-5 text-sm text-[var(--ink-soft)]">
            <Link href="/" className="transition hover:text-[var(--accent)]">
              Models
            </Link>
            <Link href="/attributions" className="transition hover:text-[var(--accent)]">
              Sources
            </Link>
          </nav>
        </header>
        {/* Pages that are documents scroll inside main; the explorer fills it. */}
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</main>
      </body>
    </html>
  );
}
