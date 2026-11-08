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
import { Download, Search } from "lucide-react";
import { Badge, Button, Card, cn, usd, verdictTone } from "./ui";

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
  ALL: "All", POLICY_VERDICT: "Policy verdicts", PAYPAL: "PayPal", HUMAN: "Human", TOOL_CALL: "Tool calls", THOUGHT: "Agent thoughts",
};

function useDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setDark(mq.matches);
    const on = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return dark;
}

const money = (p: ValueFormatterParams) => (p.value == null ? "" : usd(p.value));
const time = (p: ValueFormatterParams) =>
  p.value ? new Date(p.value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";

function VerdictCell(p: ICellRendererParams<EventRow>) {
  if (!p.value) return null;
  return <Badge tone={verdictTone(p.value)}>{p.value}</Badge>;
}
function TypeCell(p: ICellRendererParams<EventRow>) {
  const tone = p.value === "PAYPAL" ? "text-paypal" : p.value === "HUMAN" ? "text-ink" : p.value === "POLICY_VERDICT" ? "text-accent" : "text-muted";
  return <span className={cn("font-mono text-[11px]", tone)}>{p.value}</span>;
}
function MandateCell(p: ICellRendererParams<EventRow | MandateRow>) {
  const id = (p.data as { mandateId?: string; id: string }).mandateId ?? p.data!.id;
  return <Link href={`/m/${id}`} className="text-accent hover:underline">{p.value}</Link>;
}
function StatusCell(p: ICellRendererParams<MandateRow>) {
  const tone = p.value === "ACTIVE" ? "allow" : p.value === "FULFILLED" ? "accent" : "neutral";
  return <Badge tone={tone}>{String(p.value).replace("_", " ")}</Badge>;
}

export function LedgerGrid() {
  const [data, setData] = useState<{ events: EventRow[]; mandates: MandateRow[] } | null>(null);
  const [tab, setTab] = useState<"events" | "mandates">("events");
  const [type, setType] = useState<(typeof TYPES)[number]>("ALL");
  const [quick, setQuick] = useState("");
  const [selected, setSelected] = useState<EventRow | null>(null);
  const grid = useRef<AgGridReact>(null);
  const dark = useDark();

  useEffect(() => {
    const load = () => fetch("/api/ledger", { cache: "no-store" }).then((r) => r.json()).then(setData);
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const theme = useMemo(
    () =>
      themeQuartz.withPart(dark ? colorSchemeDark : colorSchemeLight).withParams({
        accentColor: dark ? "#8b8cff" : "#4338ca",
        backgroundColor: dark ? "#131624" : "#ffffff",
        headerBackgroundColor: dark ? "#1a1e2f" : "#f1f3f9",
        borderColor: dark ? "#262b40" : "#e3e6ef",
        foregroundColor: dark ? "#eceef6" : "#0f1222",
        fontFamily: "var(--font-geist-sans)",
        fontSize: 13,
        rowHeight: 40,
        headerHeight: 40,
        wrapperBorderRadius: 16,
      }),
    [dark],
  );

  const eventCols = useMemo<ColDef<EventRow>[]>(
    () => [
      { field: "ts", headerName: "Time", valueFormatter: time, width: 160, sort: "desc", filter: "agDateColumnFilter" },
      { field: "goal", headerName: "Mandate", cellRenderer: MandateCell, flex: 1.2, minWidth: 180, filter: true },
      { field: "type", headerName: "Type", cellRenderer: TypeCell, width: 140, filter: true },
      { field: "title", headerName: "Event", flex: 2, minWidth: 260, tooltipField: "title", filter: true },
      { field: "verdict", headerName: "Verdict", cellRenderer: VerdictCell, width: 120, filter: true },
      { field: "rule", headerName: "Rule", width: 170, filter: true, cellClass: "font-mono text-[11px]" },
      { field: "merchant", headerName: "Merchant", width: 140, filter: true },
      { field: "amount", headerName: "Amount", valueFormatter: money, width: 110, type: "rightAligned", filter: "agNumberColumnFilter" },
      { field: "paypalId", headerName: "PayPal ID", width: 190, cellClass: "font-mono text-[11px]", filter: true },
    ],
    [],
  );

  const mandateCols = useMemo<ColDef<MandateRow>[]>(
    () => [
      { field: "createdAt", headerName: "Created", valueFormatter: time, width: 160, sort: "desc" },
      { field: "rawText", headerName: "Mandate", cellRenderer: MandateCell, flex: 2, minWidth: 260, tooltipField: "rawText", filter: true },
      { field: "status", headerName: "Status", cellRenderer: StatusCell, width: 130, filter: true },
      { field: "authorizedAmount", headerName: "Authorized", valueFormatter: money, width: 120, type: "rightAligned" },
      { field: "spentTotal", headerName: "Captured", valueFormatter: money, width: 120, type: "rightAligned" },
      { field: "refundedTotal", headerName: "Refunded", valueFormatter: money, width: 120, type: "rightAligned" },
      {
        headerName: "Released",
        valueGetter: (p) => (p.data && p.data.status === "FULFILLED" ? Math.max(0, p.data.authorizedAmount - p.data.spentTotal) : null),
        valueFormatter: money,
        width: 120,
        type: "rightAligned",
      },
      { field: "itemsBought", headerName: "Items", width: 90, type: "rightAligned" },
      { field: "authorizationId", headerName: "PayPal authorization", width: 200, cellClass: "font-mono text-[11px]" },
    ],
    [],
  );

  const rows = useMemo(() => (data?.events ?? []).filter((e) => type === "ALL" || e.type === type), [data, type]);

  const kpi = useMemo(() => {
    const ms = data?.mandates ?? [];
    const ev = data?.events ?? [];
    const sum = (f: (m: MandateRow) => number) => ms.reduce((a, m) => a + f(m), 0);
    return {
      authorized: sum((m) => m.authorizedAmount),
      captured: sum((m) => m.spentTotal),
      released: sum((m) => (m.status === "FULFILLED" ? Math.max(0, m.authorizedAmount - m.spentTotal) : 0)),
      refunded: sum((m) => m.refundedTotal),
      allow: ev.filter((e) => e.verdict === "ALLOW").length,
      escalate: ev.filter((e) => e.verdict === "ESCALATE").length,
      approved: ev.filter((e) => e.verdict === "APPROVED").length,
      deny: ev.filter((e) => e.verdict === "DENY").length,
    };
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Authorized via PayPal", usd(kpi.authorized), "text-ink"],
          ["Captured by agents", usd(kpi.captured), "text-accent"],
          ["Released back (voided)", usd(kpi.released), "text-allow"],
          ["Refunded", usd(kpi.refunded), "text-muted"],
        ].map(([label, value, tone]) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-muted">{label}</p>
            <p className={cn("mt-1 text-2xl font-semibold tracking-tight tabular-nums", tone)}>{value}</p>
          </Card>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted">Policy verdicts:</span>
        <Badge tone="allow">{kpi.allow} allowed</Badge>
        <Badge tone="escalate">{kpi.escalate} escalated</Badge>
        <Badge tone="allow">{kpi.approved} human-approved</Badge>
        <Badge tone="deny">{kpi.deny} blocked</Badge>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl border border-line p-1">
          {(["events", "mandates"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn("rounded-lg px-3 py-1.5 text-sm capitalize", tab === t ? "bg-surface-2 font-medium" : "text-muted")}>
              {t}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-1.5">
            <Search size={14} className="text-faint" />
            <input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Search everything…" className="w-48 bg-transparent text-sm outline-none" />
          </label>
          <Button variant="ghost" className="py-1.5" onClick={() => grid.current?.api.exportDataAsCsv({ fileName: `mandate-${tab}.csv` })}>
            <Download size={14} /> CSV
          </Button>
        </div>
      </div>

      {tab === "events" && (
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={cn("rounded-full border px-3 py-1 text-xs", type === t ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-ink")}
            >
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      )}

      <div style={{ height: 560 }}>
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
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">{selected.title}</p>
            <button onClick={() => setSelected(null)} className="text-xs text-muted hover:text-ink">Close</button>
          </div>
          <pre className="max-h-72 overflow-auto rounded-lg bg-surface-2 p-3 font-mono text-[11px] text-muted">
            {JSON.stringify({ id: selected.id, mandate: selected.mandateId, tool: selected.tool, paypalId: selected.paypalId, detail: selected.detail }, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  );
}
