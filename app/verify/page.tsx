import { VerifyDesk } from "./verify-desk";

export const metadata = { title: "Verify an agent order · Mandate" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const mandate = typeof sp.mandate === "string" ? sp.mandate : "";
  return (
    <div className="min-w-0">
      <header className="grid grid-cols-1 gap-6 pb-10 pt-2 sm:pt-6 lg:grid-cols-12 lg:gap-10">
        <div className="min-w-0 lg:col-span-8">
          <span className="label">For merchants · order verification</span>
          <h1 className="display-lg mt-6 text-ink">
            Is this agent order authorized?
          </h1>
          <p className="mt-5 max-w-[38rem] text-pretty text-[17px] leading-[1.55] text-muted">
            Agents will place orders with you. Before you ship, ask whether a human actually authorized it. You get a receipt signed with Ed25519 —
            keep it, and the order is defensible.
          </p>
        </div>
      </header>
      <VerifyDesk initialMandate={mandate} />
    </div>
  );
}
