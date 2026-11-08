"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  colorSchemeDark,
  colorSchemeLight,
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
  type ValueFormatterParams,
} from "ag-grid-community";
import { Download } from "lucide-react";
import { Button, cn, usd } from "./ui";

ModuleRegistry.registerModules([AllCommunityModule]);

type EventRow = {
  id: string; ts: string; mandateId: string; goal: string; type: string; tool: string | null; title: string;
  verdict: string | null; rule: string | null; amount: number | null; merchant: string | null; paypalId: string | null; detail: unknown;
};
type MandateRow = {
  id: string; createdAt: string; rawText: string; status: string; budgetTotal: number; authorizedAmount: number;
  spentTotal: number; refundedTotal: number; itemsBought: number; authorizationId: string | null; summary: string | null;
};

const TYPES = ["ALL", "POLICY_VERDICT", "PAYPAL", "HUMAN", "TOOL_CALL", "THOUGHT"] as const;
const TYPE_LABEL: Record<string, string> = {
  ALL: "All", POLICY_VERDICT: "Verdicts", PAYPAL: "PayPal", HUMAN: "Human", TOOL_CALL: "Tool calls", THOUGHT: "Agent",
};

function useDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const read = () => {
      const forced = document.documentElement.dataset.theme;
      setDark(forced ? forced === "dark" : mq.matches);
    };
    read();
    mq.addEventListener("change", read);
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      mq.removeEventListener("change", read);
      mo.disconnect();
    };
  }, []);
  return dark;
}

function useNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return narrow;
}

const money = (p: ValueFormatterParams) => (p.value == null ? "" : usd(p.value));
const clock = (p: ValueFormatterParams) =>
  p.value ? new Date(p.value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "";
const time = (p: ValueFormatterParams) => {
  if (!p.value) return "";
  const d = new Date(p.value);
  return `${String(d.getDate()).padStart(2, "0")} ${d.toLocaleString("en-US", { month: "short" })} ${clock(p)}`;
};

const VERDICT_TONE: Record<string, string> = {
  ALLOW: "border-allow text-allow",
  APPROVED: "border-allow text-allow",
  ESCALATE: "border-escalate text-escalate",
  DENY: "border-deny text-deny",
};
/** Tiny stamp: uppercase mono word in a 1px colored border, no fill. Attacks tagged. */
function VerdictCell(p: ICellRendererParams<EventRow>) {
  if (!p.value) return null;
  const attack = p.data && isAttack(p.data);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("label rounded-[2px] border px-1 py-[3px] text-[10px]", VERDICT_TONE[p.value] ?? "border-line text-muted")}>{p.value}</span>
      {attack && <span className="label text-[9px] text-deny">attack</span>}
    </span>
  );
}
function isAttack(e: EventRow) {
  if (e.type !== "POLICY_VERDICT" || e.verdict !== "DENY") return false;
  const d = (e.detail ?? {}) as { injection?: unknown; product?: { id?: string; title?: string } };
  return !!d.injection || d.product?.id === "redteam_ultra_elite" || /\[RED TEAM\]/i.test(d.product?.title ?? "");
}
/** Tool-keyed events read by what they did (same names as the Mission Control log). */
const TOOL_TAG: Record<string, string> = { delegate: "DELEGATE", revoke: "REVOKE", verify: "VERIFY", passkey: "PASSKEY" };
function TypeCell(p: ICellRendererParams<EventRow>) {
  const tool = p.data?.tool ? TOOL_TAG[p.data.tool] : undefined;
  const tone = tool === "REVOKE" ? "text-deny" : p.value === "PAYPAL" ? "text-paypal" : tool || p.value === "HUMAN" || p.value === "POLICY_VERDICT" ? "text-ink" : "text-muted";
  return <span className={cn("label text-[10px]", tone)}>{tool ?? String(p.value ?? "").replace("POLICY_", "")}</span>;
}
function MandateCell(p: ICellRendererParams<EventRow | MandateRow>) {
  const id = (p.data as { mandateId?: string; id: string }).mandateId ?? p.data!.id;
  return <Link href={`/m/${id}`} className="text-ink underline decoration-line underline-offset-4 hover:decoration-ink">{p.value}</Link>;
}
function StatusCell(p: ICellRendererParams<MandateRow>) {
  const tone = p.value === "ACTIVE" ? "text-paypal border-paypal/50" : p.value === "REVOKED" ? "text-deny border-deny/60" : "text-muted border-line";
  return <span className={cn("label rounded-[2px] border px-1 py-[3px] text-[10px]", tone)}>{String(p.value).replace("_", " ")}</span>;
}
/** PayPal IDs: mono PayPal-blue, copy on click. */
function PayPalIdCell(p: ICellRendererParams) {
  const [copied, setCopied] = useState(false);
  if (!p.value) return null;
  const v = String(p.value);
  return (
    <button
      type="button"
      title={`Copy ${v}`}
      aria-label={`Copy PayPal ID ${v}`}
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(v).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        }).catch(() => {});
      }}
      className="num text-paypal underline decoration-paypal/40 decoration-dotted underline-offset-[3px] hover:decoration-solid"
    >
      {copied ? "copied" : v}
    </button>
  );
}

export function LedgerGrid() {
  const [data, setData] = useState<{ events: EventRow[]; mandates: MandateRow[] } | null>(null);
  const [tab, setTab] = useState<"events" | "mandates">("events");
  const [type, setType] = useState<(typeof TYPES)[number]>("ALL");
  const [quick, setQuick] = useState("");
  const [selected, setSelected] = useState<EventRow | null>(null);
  const grid = useRef<AgGridReact>(null);
  const dark = useDark();
  const narrow = useNarrow();

  useEffect(() => {
    const load = () => fetch("/api/ledger", { cache: "no-store" }).then((r) => r.json()).then(setData);
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const theme = useMemo(() => {
    const t = dark
      ? { bg: "#171714", head: "#1D1D19", line: "#2C2B26", ink: "#EDE9DF", muted: "#A8A396", hover: "#1D1D19" }
      : { bg: "#FBFAF6", head: "#ECE8DE", line: "#D8D2C4", ink: "#17150F", muted: "#5C574C", hover: "#F3F0E8" };
    return themeQuartz.withPart(dark ? colorSchemeDark : colorSchemeLight).withParams({
      backgroundColor: t.bg,
      foregroundColor: t.ink,
      textColor: t.ink,
      subtleTextColor: t.muted,
      headerBackgroundColor: t.head,
      headerTextColor: t.muted,
      chromeBackgroundColor: t.head,
      borderColor: t.line,
      rowBorder: { color: t.line },
      rowHoverColor: t.hover,
      selectedRowBackgroundColor: t.hover,
      accentColor: t.ink,
      fontFamily: "var(--font-plex-sans)",
      cellFontFamily: "var(--font-plex-mono)",
      headerFontFamily: "var(--font-plex-mono)",
      headerFontWeight: 500,
      headerFontSize: 11,
      fontSize: 13,
      wrapperBorderRadius: 0,
      borderRadius: 2,
      rowHeight: 36,
      headerHeight: 36,
      columnBorder: false,
      headerColumnBorder: false,
    });
  }, [dark]);

  const eventCols = useMemo<ColDef<EventRow>[]>(
    () => [
      { field: "ts", headerName: "Time", valueFormatter: narrow ? clock : time, width: narrow ? 96 : 160, sort: "desc", filter: "agDateColumnFilter" },
      { field: "goal", hide: narrow, headerName: "Mandate", cellRenderer: MandateCell, flex: 1.2, minWidth: 180, filter: true },
      { field: "type", hide: narrow, headerName: "Type", cellRenderer: TypeCell, width: 140, filter: true },
      { field: "title", headerName: "Event", flex: 2, minWidth: narrow ? 120 : 260, tooltipField: "title", filter: true },
      { field: "verdict", headerName: "Verdict", cellRenderer: VerdictCell, width: narrow ? 126 : 150, filter: true },
      { field: "rule", hide: narrow, headerName: "Rule", width: 170, filter: true, cellClass: "text-[12px]" },
      { field: "merchant", hide: narrow, headerName: "Merchant", width: 140, filter: true },
      { field: "amount", hide: narrow, headerName: "Amount", valueFormatter: money, width: 110, type: "rightAligned", filter: "agNumberColumnFilter", cellClass: "num" },
      { field: "paypalId", hide: narrow, headerName: "PayPal ID", width: 190, cellRenderer: PayPalIdCell, filter: true },
    ],
    [narrow],
  );

  const mandateCols = useMemo<ColDef<MandateRow>[]>(
    () => [
      { field: "createdAt", headerName: "Created", valueFormatter: time, width: 150, hide: narrow, sort: "desc" },
      { field: "rawText", headerName: "Mandate", cellRenderer: MandateCell, flex: 2, minWidth: narrow ? 150 : 260, tooltipField: "rawText", filter: true },
      { field: "status", headerName: "Status", cellRenderer: StatusCell, width: 130, filter: true },
      { field: "authorizedAmount", headerName: "Authorized", valueFormatter: money, width: 120, type: "rightAligned" },
      { field: "spentTotal", hide: narrow, headerName: "Captured", valueFormatter: money, width: 120, type: "rightAligned" },
      { field: "refundedTotal", hide: narrow, headerName: "Refunded", valueFormatter: money, width: 120, type: "rightAligned" },
      {
        headerName: "Released",
        hide: narrow,
        valueGetter: (p) => (p.data && (p.data.status === "FULFILLED" || (p.data.status === "REVOKED" && p.data.authorizationId)) ? Math.max(0, p.data.authorizedAmount - p.data.spentTotal) : null),
        valueFormatter: money,
        width: 120,
        type: "rightAligned",
      },
      { field: "itemsBought", hide: narrow, headerName: "Items", width: 90, type: "rightAligned" },
      { field: "authorizationId", hide: narrow, headerName: "PayPal authorization", width: 210, cellRenderer: PayPalIdCell },
    ],
    [narrow],
  );

  const rows = useMemo(() => (data?.events ?? []).filter((e) => type === "ALL" || e.type === type), [data, type]);

  const kpi = useMemo(() => {
    const ms = data?.mandates ?? [];
    const ev = data?.events ?? [];
    const sum = (f: (m: MandateRow) => number) => ms.reduce((a, m) => a + f(m), 0);
    return {
      authorized: sum((m) => m.authorizedAmount),
      captured: sum((m) => m.spentTotal),
      released: sum((m) => (m.status === "FULFILLED" || (m.status === "REVOKED" && m.authorizationId) ? Math.max(0, m.authorizedAmount - m.spentTotal) : 0)),
      refunded: sum((m) => m.refundedTotal),
      allow: ev.filter((e) => e.verdict === "ALLOW").length,
      escalate: ev.filter((e) => e.verdict === "ESCALATE").length,
      approved: ev.filter((e) => e.verdict === "APPROVED").length,
      deny: ev.filter((e) => e.verdict === "DENY").length,
      attacks: ev.filter(isAttack).length,
    };
  }, [data]);

  const stats: [string, string, string][] = [
    ["Authorized", usd(kpi.authorized), "text-paypal"],
    ["Captured", usd(kpi.captured), "text-ink"],
    ["Released", usd(kpi.released), "text-paypal"],
    ["Refunded", usd(kpi.refunded), "text-ink"],
    ["Attacks blocked", String(kpi.attacks), kpi.attacks > 0 ? "text-deny" : "text-ink"],
  ];

  return (
    <div className="space-y-5">
      {data && data.mandates.length === 0 && (
        <p className="border-y border-line py-4 text-[15px] text-muted">
          Nothing has been audited yet — run a mandate and every search, verdict and PayPal call lands here.{" "}
          <Link href="/demo" className="text-ink underline decoration-line underline-offset-4 hover:decoration-ink">Start the guided demo →</Link>
        </p>
      )}

      {/* Statement row, not tiles. */}
      <dl className="grid grid-cols-2 border-y border-ink sm:grid-cols-3 lg:grid-cols-5" aria-label="Totals">
        {stats.map(([label, value, tone], i) => (
          <div
            key={label}
            className={cn(
              "min-w-0 border-line px-0 py-3 sm:px-4",
              i > 0 && "lg:border-l",
              i % 2 === 1 && "max-sm:border-l max-sm:pl-4",
              i >= 2 && "max-sm:border-t",
              i % 3 !== 0 && "sm:max-lg:border-l",
              i >= 3 && "sm:max-lg:border-t",
              i === 0 && "sm:pl-0",
              label === "Attacks blocked" && "max-sm:col-span-2 max-sm:border-l-0 max-sm:pl-0",
            )}
          >
            <dt className="label text-[10px] text-muted">{label}</dt>
            <dd className={cn("num mt-1.5 truncate text-xl sm:text-2xl", tone)}>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="num text-[12px] text-muted">
        verdicts · <span className="text-allow">{kpi.allow} allowed</span> · <span className="text-escalate">{kpi.escalate} escalated</span> ·{" "}
        <span className="text-allow">{kpi.approved} human-approved</span> · <span className="text-deny">{kpi.deny} denied</span>
      </p>

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-line">
        <div className="flex gap-5" role="tablist" aria-label="Ledger view">
          {(["events", "mandates"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn("label -mb-px min-h-11 border-b-2 text-[11px]", tab === t ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink")}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex w-full items-center gap-2 pb-2 sm:w-auto">
          <label className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-[2px] border border-line bg-surface px-3 sm:flex-none">
            <span className="label text-[10px] text-muted">Find</span>
            <input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="rule, merchant, PayPal ID…" className="w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted sm:w-52 sm:text-sm" />
          </label>
          <Button variant="ghost" className="shrink-0" onClick={() => grid.current?.api.exportDataAsCsv({ fileName: `mandate-${tab}.csv` })}>
            <Download size={14} aria-hidden /> CSV
          </Button>
        </div>
      </div>

      {tab === "events" && (
        <div className="-mt-2 flex flex-wrap gap-x-4 gap-y-1" aria-label="Filter by type">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              aria-pressed={type === t}
              className={cn(
                "label min-h-8 text-[10px] underline-offset-[6px]",
                type === t ? "text-ink underline decoration-ink decoration-1" : "text-muted hover:text-ink",
              )}
            >
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      )}

      <div className="ledger-grid" style={{ height: 560 }}>
        <style>{`.ledger-grid .ag-header-cell-text{text-transform:uppercase;letter-spacing:.08em}
@media (max-width:767px){.ledger-grid .ag-paging-page-size{display:none}.ledger-grid .ag-paging-row-summary-panel{display:none}.ledger-grid .ag-paging-panel{justify-content:center;gap:4px}}`}</style>
        {tab === "events" ? (
          <AgGridReact<EventRow>
            ref={grid}
            theme={theme}
            rowData={rows}
            columnDefs={eventCols}
            quickFilterText={quick}
            getRowId={(p) => p.data.id}
            defaultColDef={{ resizable: true, sortable: true, floatingFilter: false }}
            pagination
            paginationPageSize={50}
            animateRows
            enableCellTextSelection
            tooltipShowDelay={300}
            onRowClicked={(e) => setSelected(e.data ?? null)}
            loading={!data}
          />
        ) : (
          <AgGridReact<MandateRow>
            ref={grid}
            theme={theme}
            rowData={data?.mandates ?? []}
            columnDefs={mandateCols}
            quickFilterText={quick}
            getRowId={(p) => p.data.id}
            defaultColDef={{ resizable: true, sortable: true }}
            pagination
            paginationPageSize={50}
            enableCellTextSelection
            tooltipShowDelay={300}
            loading={!data}
          />
        )}
      </div>

      {tab === "events" && selected && (
        <section className="border border-line bg-surface" aria-label="Entry detail">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
            <p className="min-w-0 truncate text-sm"><span className="label mr-2 text-[10px] text-muted">Entry</span>{selected.title}</p>
            <button onClick={() => setSelected(null)} className="label min-h-10 shrink-0 text-[10px] text-muted hover:text-ink">Close</button>
          </div>
          <pre className="num max-h-72 overflow-auto bg-surface-2 p-4 text-[11px] leading-relaxed text-muted">
            {JSON.stringify({ id: selected.id, mandate: selected.mandateId, tool: selected.tool, paypalId: selected.paypalId, detail: selected.detail }, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}
