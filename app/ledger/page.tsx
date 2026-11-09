import { LedgerGrid } from "@/components/ledger-grid";

export const metadata = { title: "Ledger · Writ" };

export default function LedgerPage() {
  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <p className="label text-[10px] text-muted">Audit ledger · append-only · traceable to PayPal IDs</p>
        <h1 className="display-lg mt-4 text-ink">The ledger.</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted">
          Every search, verdict, approval and PayPal movement. Nothing is edited; nothing is deleted.
        </p>
      </header>
      <LedgerGrid />
    </div>
  );
}
