"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

const LINKS = [
  { href: "/demo", label: "Demo", match: (p: string) => p.startsWith("/demo") },
  { href: "/#compose", label: "Draft", match: (p: string) => p === "/" || p.startsWith("/m/") },
  { href: "/ledger", label: "Ledger", match: (p: string) => p.startsWith("/ledger") },
];

export function SiteNav() {
  const path = usePathname() ?? "/";
  return (
    <nav aria-label="Primary" className="flex h-full items-stretch">
      {LINKS.map((l) => {
        const on = l.match(path);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "label -mb-px inline-flex min-w-11 items-center justify-center border-b px-2.5 sm:px-4",
              on ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
