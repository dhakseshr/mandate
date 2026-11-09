import type { Metadata } from "next";
import Link from "next/link";
import { Archivo, Bodoni_Moda, IBM_Plex_Mono } from "next/font/google";
import { SiteNav } from "@/components/landing/site-nav";
import { ThemeToggle, THEME_BOOT } from "@/components/theme-toggle";
import "./globals.css";

// "Intaglio" type: Bodoni Moda (display), Archivo (text + condensed labels), IBM Plex Mono (figures). All SIL OFL 1.1.
const display = Bodoni_Moda({ variable: "--font-bodoni", subsets: ["latin"], style: ["normal", "italic"], axes: ["opsz"], display: "swap" });
const sans = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"], display: "swap" });
const mono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });

export const metadata: Metadata = {
  title: "Writ",
  description:
    "Your AI can shop. It can’t overspend. You write the rule, PayPal holds the budget, and thirteen deterministic checks — not a model — decide every cent.",
};

const MICRO = "Writ · limited authority to purchase · void unless signed · decided by code, not a model · money held by PayPal · ";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className={`${display.variable} ${sans.variable} ${mono.variable} antialiased min-h-screen`}>
        {/* Shared SVG filter: distressed rubber-stamp edge (used by <Stamp/>). */}
        <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
          <filter id="stamp-rough" x="-5%" y="-20%" width="110%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
        <a href="#main" className="label sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:bg-ink focus:px-3 focus:py-3 focus:text-on-accent">
          Skip to content
        </a>
        {/* Microprint band — security-print detail, decorative. */}
        <div aria-hidden className="microprint border-b border-line py-[3px]">{MICRO.repeat(14)}</div>
        <header className="border-b border-ink">
          <div className="mx-auto flex h-16 max-w-[1240px] items-stretch justify-between gap-2 px-4 sm:px-6">
            <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="Writ, home">
              <span className="display text-[2rem] leading-none tracking-[-0.03em] text-ink">Writ</span>
              <span className="label hidden border-l border-line pl-3 text-[10px] leading-[1.25] text-muted md:inline-block">
                Limited authority
                <br />
                for AI agents
              </span>
            </Link>
            <div className="flex items-stretch">
              <SiteNav />
              <span className="my-4 w-px bg-line" aria-hidden />
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6 sm:py-10">
          {children}
        </main>
        <footer className="mt-12">
          <div aria-hidden className="lathe text-ink/80" />
          <div className="border-t border-ink">
            <div className="mx-auto grid max-w-[1240px] gap-6 px-4 py-10 sm:px-6 md:grid-cols-12 md:gap-10">
              <div className="md:col-span-4">
                <p className="display text-[2.5rem] leading-none tracking-[-0.03em] text-ink">Writ</p>
                <p className="mt-3 max-w-[22rem] text-sm leading-relaxed text-muted">
                  We don&rsquo;t trust the AI. We trust the enforcement boundary.
                </p>
              </div>
              <div className="min-w-0 space-y-2 md:col-span-8">
                <p className="font-mono text-[11px] leading-relaxed tracking-[0.04em] text-muted">
                  Built on PayPal Orders v2 · Payments v2 · Payouts · Disputes · Agent Toolkit · JS SDK v6 · Channel3 · AG Grid · Render
                </p>
                <p className="font-mono text-[11px] leading-relaxed tracking-[0.04em] text-muted">
                  An implementation of the Intent Mandate idea from AP2, enforced on real PayPal rails. Sandbox only; no real money moves.
                </p>
                <p className="font-mono text-[11px] leading-relaxed tracking-[0.04em] text-muted">
                  Merchant?{" "}
                  <Link href="/verify" className="inline-flex min-h-11 items-center text-ink underline decoration-line underline-offset-4 hover:decoration-ink sm:min-h-0">
                    Verify an agent&apos;s order before you ship →
                  </Link>
                </p>
                <p className="micr pt-4 text-faint" aria-hidden>
                  ⑆ WRIT ⑆ 13 RULES ⑈ 0 MODELS IN THE DECISION PATH ⑈
                </p>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
