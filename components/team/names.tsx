"use client";
import { createContext, useContext } from "react";
import type { View } from "../mandate-screen";

export type TreeNode = View["tree"][number];

/**
 * Who said it: maps a mandateId in the subtree to a short actor name.
 * `self` is the mandate being viewed (its rows carry no prefix); `root` names the top of the chain.
 */
export type Names = { self: string; byId: Record<string, string>; rootLabel: string; hostile?: Record<string, boolean> };
const Ctx = createContext<Names | null>(null);
export const NamesProvider = Ctx.Provider;
export const useNames = () => useContext(Ctx);

export function namesFor(view: View): Names {
  const m = view.mandate as View["mandate"] & { name?: string | null; agentMode?: string | null; parentId?: string | null };
  const team = m.agentMode === "team" || (view.tree?.length ?? 0) > 0;
  const byId: Record<string, string> = {};
  byId[m.id] = m.parentId ? m.name || "Sub-agent" : team ? "Orchestrator" : "You";
  for (const t of view.tree ?? []) byId[t.id] = t.name || `Sub-agent ${t.id.slice(-4)}`;
  // Red-team agents and anything they delegated to: labelled as hostile in the log.
  const hostile: Record<string, boolean> = {};
  for (const t of view.tree ?? []) if (t.name === "Red-team agent") hostile[t.id] = true;
  for (let grew = true; grew; ) {
    grew = false;
    for (const t of view.tree ?? [])
      if (!hostile[t.id] && t.parentId && hostile[t.parentId]) {
        hostile[t.id] = true;
        grew = true;
      }
  }
  if (m.name === "Red-team agent") hostile[m.id] = true;
  return { self: m.id, byId, rootLabel: m.parentId ? "Parent mandate" : "Your mandate", hostile };
}

/** "Monitor agent" → "MONITOR" for the 4.75rem tag column. */
export const shortName = (n: string) => n.replace(/\s+agent$/i, "").trim() || n;

export function runLabel(t: Pick<TreeNode, "status" | "runStatus">): { text: string; tone: string; live: boolean } {
  if (t.status === "REVOKED") return { text: "stopped", tone: "text-muted", live: false };
  if (t.status === "FULFILLED") return { text: "done", tone: "text-muted", live: false };
  switch (t.runStatus) {
    case "RUNNING":
      return { text: "shopping", tone: "text-ink", live: true };
    case "WAITING_APPROVAL":
      return { text: "waiting for you", tone: "text-escalate", live: false };
    case "DONE":
      return { text: "done", tone: "text-muted", live: false };
    case "ERROR":
      return { text: "run failed", tone: "text-deny", live: false };
    default:
      return { text: "not started", tone: "text-muted", live: false };
  }
}
