import { LedgerGrid } from "@/components/ledger-grid";

export const metadata = { title: "Ledger · Mandate" };

export default function LedgerPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-faint">Audit ledger</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Every decision your agents made</h1>
        <p className="mt-1 text-sm text-muted">
          Each search, policy verdict, human approval and PayPal money movement — append-only and traceable to a PayPal ID.
        </p>
      </div>
      <LedgerGrid />
    </div>
  );
}
