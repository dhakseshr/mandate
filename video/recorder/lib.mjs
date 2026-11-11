// Shared helpers for recording the live app. Reads the sandbox buyer password from ../../.env (never printed).
import { chromium } from "playwright-core";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const HERE = dirname(fileURLToPath(import.meta.url));
export const FOOTAGE = join(HERE, "..", "public", "footage");
export const STATE = join(HERE, "state.json"); // staged mandate ids (gitignored)
export const BASE = "https://writ-307007912526.us-central1.run.app";

const envFile = join(HERE, "..", "..", ".env");
const env = existsSync(envFile)
  ? Object.fromEntries(readFileSync(envFile, "utf8").split("\n").filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.split("=")[0], l.slice(l.indexOf("=") + 1).replace(/\s+#.*$/, "").trim()]))
  : {};
export const BUYER = { email: "sb-u4310o53776285@personal.example.com", password: env.PAYPAL_SANDBOX_BUYER_PASSWORD };

export const state = () => (existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {});
export const setState = (patch) => writeFileSync(STATE, JSON.stringify({ ...state(), ...patch }, null, 1));

/** True 2560×1440 pixels with the app's 1536-wide layout: viewport 2560, CSS zoom 2560/1536. */
export async function launch({ record = null } = {}) {
  const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox", "--hide-scrollbars", "--force-color-profile=srgb"] });
  if (record) mkdirSync(record, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1, colorScheme: "light", ...(record ? { recordVideo: { dir: record, size: { width: 2560, height: 1440 } } } : {}) });
  await ctx.addInitScript(() => {
    const z = () => { if (location.hostname.endsWith("run.app")) document.documentElement.style.zoom = String(2560 / 1536); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", z); else z();
  });
  return { browser, ctx };
}

/** Click the PayPal button on a mandate review page and approve the hold as the sandbox buyer. */
export async function approveHold(ctx, page, { log = console.log } = {}) {
  const popP = ctx.waitForEvent("page", { timeout: 45000 });
  await page.locator("paypal-button").first().click();
  const pop = await popP;
  await pop.waitForLoadState("domcontentloaded");
  const email = pop.locator("#email");
  await email.waitFor({ timeout: 45000 }).catch(() => {});
  if (await email.isVisible().catch(() => false)) {
    await email.fill(BUYER.email);
    await pop.locator("#btnNext").click().catch(() => {});
  }
  const pw = pop.locator("#password");
  await pw.waitFor({ timeout: 45000 });
  await pw.fill(BUYER.password);
  await pop.locator("#btnLogin").click();
  const submit = pop.locator('[data-testid="submit-button-initial"]');
  await submit.waitFor({ timeout: 60000 });
  await pop.waitForTimeout(1200);
  await log("paypal: review screen, approving");
  await submit.click();
  await pop.waitForEvent("close", { timeout: 90000 }).catch(() => log("paypal: popup did not close"));
  return pop;
}

/** API helper with a timeout. */
export async function api(path, body, method) {
  const r = await fetch(BASE + path, {
    method: method ?? (body ? "POST" : "GET"),
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(300000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${path} ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  return j;
}

/** Create a mandate from text, set its agent mode, and approve its PayPal hold with a headless browser. */
export async function stageMandate(text, agentMode) {
  const { id } = await api("/api/mandates", { text });
  if (agentMode) await api(`/api/mandates/${id}`, { agentMode }, "PATCH");
  const { browser, ctx } = await launch();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/m/${id}`, { waitUntil: "load", timeout: 90000 });
  await page.waitForSelector("paypal-button", { timeout: 60000 });
  await page.waitForTimeout(2500);
  await approveHold(ctx, page, { log: () => {} });
  await page.waitForTimeout(6000);
  await browser.close();
  return id;
}
