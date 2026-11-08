import type { Metadata } from "next";
import Link from "next/link";
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google";
import { SiteNav } from "@/components/landing/site-nav";
import "./globals.css";

const display = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], style: ["normal", "italic"], axes: ["opsz"] });
const sans = IBM_Plex_Sans({ variable: "--font-plex-sans", subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "Mandate",
  description:
    "Your AI can shop. It can’t overspend. You write the rule, PayPal holds the budget, and thirteen deterministic checks — not a model — decide every cent.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable} ${mono.variable} antialiased min-h-screen`}>
        {/* Shared SVG filter: distressed rubber-stamp edge (used by <Stamp/>). */}
        <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
          <filter id="stamp-rough" x="-5%" y="-20%" width="110%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
        <header className="border-b border-line">
          <div className="mx-auto flex h-14 max-w-[1200px] items-stretch justify-between gap-4 px-4 sm:px-6">
            <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="Mandate, home">
              <span className="display text-[1.6rem] leading-none text-ink">Mandate</span>
              <span className="label hidden border-l border-line pl-3 text-muted sm:inline">№ for AI agents</span>
            </Link>
            <SiteNav />
          </div>
        </header>
        <main className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10">{children}</main>
        <footer className="mt-8 border-t border-line">
          <div className="mx-auto grid max-w-[1200px] gap-3 px-4 py-8 sm:px-6 md:grid-cols-12 md:gap-10">
            <p className="display text-lg leading-none text-ink md:col-span-3">Mandate</p>
            <div className="min-w-0 space-y-2 md:col-span-9">
              <p className="font-mono text-[11px] leading-relaxed tracking-[0.04em] text-muted">
                Built on PayPal Orders v2 · Agent Toolkit · JS SDK v6 · Channel3 · AG Grid · Render
              </p>
              <p className="font-mono text-[11px] leading-relaxed tracking-[0.04em] text-muted">
                An implementation of the Intent Mandate idea from AP2, enforced on real PayPal rails.
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
