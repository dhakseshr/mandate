"use client";
import { useEffect, useState } from "react";

type Mode = "system" | "light" | "dark";
const KEY = "writ.theme";
const NEXT: Record<Mode, Mode> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<Mode, string> = { system: "Auto", light: "Paper", dark: "Night" };

/** Inline, pre-paint: apply a stored theme before React hydrates (no flash). */
export const THEME_BOOT = `try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");
  useEffect(() => {
    try {
      const t = localStorage.getItem(KEY);
      if (t === "light" || t === "dark") setMode(t);
    } catch {}
  }, []);
  function cycle() {
    const next = NEXT[mode];
    setMode(next);
    const root = document.documentElement;
    if (next === "system") delete root.dataset.theme;
    else root.dataset.theme = next;
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {}
  }
  return (
    <button
      type="button"
      onClick={cycle}
      className="label inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 px-2 text-muted hover:text-ink"
      aria-label={`Theme: ${LABEL[mode]}. Switch to ${LABEL[NEXT[mode]]}`}
      title={`Theme: ${LABEL[mode]}`}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
        <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1" />
        {mode !== "light" && <path d="M8 1.5a6.5 6.5 0 0 1 0 13z" fill="currentColor" />}
        {mode === "system" && <circle cx="8" cy="8" r="2" fill="none" stroke="currentColor" strokeWidth="1" />}
      </svg>
      <span className="hidden lg:inline">{LABEL[mode]}</span>
    </button>
  );
}
