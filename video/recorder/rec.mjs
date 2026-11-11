// Automated take recorder: each take drives the live app and records a true 2560×1440 video plus a
// markers JSON (seconds into the take, element boxes in video pixels) that the film's scenes cut against.
// Usage: node rec.mjs attack landing tab ledger forensics redteam live
import { launch, approveHold, api, setState, BUYER, BASE, FOOTAGE, state } from "./lib.mjs";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";

mkdirSync(FOOTAGE, { recursive: true });

// A visible cursor (headless Chrome draws none): glides to targets, pulses on click.
const CURSOR = `(() => {
  if (window.__cur) return; window.__cur = 1;
  const add = () => {
    const c = document.createElement('div'); c.id='__cursor';
    c.style.cssText='position:fixed;left:-50px;top:-50px;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;border:3px solid #121210;background:rgba(248,246,239,.6);box-shadow:0 2px 10px rgba(0,0,0,.25);z-index:2147483647;pointer-events:none;transition:transform .12s ease, background .12s ease;zoom:1';
    document.documentElement.appendChild(c);
    const z = () => parseFloat(document.documentElement.style.zoom || '1') || 1;
    addEventListener('mousemove', e => { c.style.left=(e.clientX/z())+'px'; c.style.top=(e.clientY/z())+'px'; }, true);
    addEventListener('mousedown', () => { c.style.transform='scale(.65)'; c.style.background='rgba(18,18,16,.35)'; }, true);
    addEventListener('mouseup', () => { c.style.transform='scale(1)'; c.style.background='rgba(248,246,239,.6)'; }, true);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', add); else add();
})();`;

async function take(name, fn) {
  const raw = `${FOOTAGE}/.raw-${name}`;
  const { browser, ctx } = await launch({ record: raw });
  await ctx.addInitScript(CURSOR);
  const allPages = [];
  const opened = {};
  ctx.on("page", (p) => { allPages.push(p); opened[allPages.length - 1] = (Date.now() - t0) / 1000; });
  const t0 = Date.now();
  const page = await ctx.newPage();
  const marks = [];
  const mark = async (label, sel) => {
    let box = null;
    if (sel) box = await (typeof sel === "string" ? page.locator(sel).first() : sel).boundingBox().catch(() => null);
    marks.push({ t: (Date.now() - t0) / 1000, label, box });
    console.log(`[${name}] ${((Date.now() - t0) / 1000).toFixed(1)}s ${label}`);
  };
  const ease = `(k) => k < .5 ? 2*k*k : 1 - Math.pow(-2*k + 2, 2) / 2`;
  const h = {
    page, ctx, mark,
    wait: (ms) => page.waitForTimeout(ms),
    async go(path) { await page.goto(BASE + path, { waitUntil: "load", timeout: 120000 }); await page.waitForTimeout(2500); await page.mouse.move(1280, 720); },
    async scrollTo(sel, ms = 1200, block = "center") {
      // Let the browser compute the target (it understands CSS zoom), then animate to it with easing.
      await page.evaluate(async ([sel, ms, block, easeSrc]) => {
        const ez = eval(easeSrc);
        const el = document.querySelector(sel); if (!el) return;
        const from = window.scrollY;
        el.scrollIntoView({ block });
        const target = window.scrollY;
        window.scrollTo(0, from);
        const d = target - from, t0 = performance.now();
        await new Promise((res) => { const step = (t) => { const k = Math.min(1, (t - t0) / ms); scrollTo(0, from + d * ez(k)); k < 1 ? requestAnimationFrame(step) : res(); }; requestAnimationFrame(step); });
      }, [sel, ms, block, ease]);
    },
    async scrollBy(dy, ms = 1500) {
      await page.evaluate(async ([dy, ms, easeSrc]) => {
        const ez = eval(easeSrc);
        const from = window.scrollY, t0 = performance.now();
        await new Promise((res) => { const step = (t) => { const k = Math.min(1, (t - t0) / ms); scrollTo(0, from + dy * ez(k)); k < 1 ? requestAnimationFrame(step) : res(); }; requestAnimationFrame(step); });
      }, [dy, ms, ease]);
    },
    async click(loc, label) {
      const l = typeof loc === "string" ? page.locator(loc).first() : loc;
      await l.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(300);
      const b = await l.boundingBox();
      if (b) await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 30 });
      await page.waitForTimeout(350);
      if (label) await mark(label, l);
      await l.click();
    },
    async type(loc, text, delay = 55) { const l = typeof loc === "string" ? page.locator(loc).first() : loc; await h.click(l); await l.pressSequentially(text, { delay }); },
  };
  try { await fn(h); } catch (e) { console.error(`[${name}] ERROR`, e.message.split("\n")[0]); await mark("ERROR " + e.message.split("\n")[0].slice(0, 140)); }
  await ctx.close();
  const videos = [];
  for (const [i, p] of allPages.entries()) {
    const v = p.video(); if (!v) continue;
    const dest = `${FOOTAGE}/${name}${i ? "-popup" + i : ""}.webm`;
    await v.saveAs(dest).catch(() => {});
    videos.push({ file: dest.split("/").pop(), openedAt: opened[i] });
  }
  writeFileSync(`${FOOTAGE}/${name}.json`, JSON.stringify({ name, marks, videos }, null, 1));
  rmSync(raw, { recursive: true, force: true });
  await browser.close();
}

const S = state();
const TAKES = {
  async paypal(h) {
    const { id } = await api("/api/mandates", { text: "Research the best cloud infrastructure for our AI product. $100 total: buy research data, plus a USB-C hub and a webcam. Ask me before anything over $15. Nothing from bulkbin.example." });
    await api(`/api/mandates/${id}`, { agentMode: "external" }, "PATCH");
    setState({ paypal: id });
    await h.go(`/m/${id}`);
    await h.page.locator("paypal-button").first().scrollIntoViewIfNeeded();
    await h.wait(2000);
    const pb = await h.page.locator("paypal-button").first().boundingBox();
    await h.page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2, { steps: 30 });
    await h.mark("paypal button", "paypal-button");
    await h.wait(800);
    const popP = h.ctx.waitForEvent("page", { timeout: 45000 });
    await h.page.locator("paypal-button").first().click();
    const pop = await popP;
    await pop.setViewportSize({ width: 900, height: 1080 });
    await h.mark("popup opened");
    const email = pop.locator("#email");
    await email.waitFor({ timeout: 45000 }).catch(() => {});
    await h.wait(1500);
    if (await email.isVisible().catch(() => false)) {
      await email.pressSequentially(BUYER.email, { delay: 45 });
      await h.mark("email typed");
      await h.wait(600);
      await pop.locator("#btnNext").click().catch(() => {});
    }
    const pw = pop.locator("#password");
    await pw.waitFor({ timeout: 45000 });
    await h.wait(800);
    await pw.pressSequentially(BUYER.password, { delay: 70 });
    await h.mark("password typed");
    await h.wait(600);
    await pop.locator("#btnLogin").click();
    const submit = pop.locator('[data-testid="submit-button-initial"]');
    await submit.waitFor({ timeout: 60000 });
    await h.mark("review screen");
    await h.wait(3500);
    await submit.click();
    await h.mark("complete purchase");
    await pop.waitForEvent("close", { timeout: 90000 }).catch(() => {});
    await h.mark("popup closed");
    await h.page.waitForSelector("text=/Decision log/i", { timeout: 120000 }).catch(() => {});
    await h.mark("mission control");
    await h.wait(4000);
  },
  async attack(h) {
    await h.go(`/m/${S.attack}`);
    await h.scrollTo("[id^=atk-]", 10, "start");
    await h.wait(800);
    await h.page.reload({ waitUntil: "load" });
    await h.wait(400);
    await h.scrollTo("[id^=atk-]", 10, "start");
    await h.mark("punch animates", "[id^=atk-]");
    await h.wait(8000);
  },
  async landing(h) {
    await h.go("/");
    await h.mark("hero");
    await h.wait(7000);
    await h.scrollTo("#audience", 2400, "start");
    await h.mark("audience");
    await h.wait(5000);
    await h.scrollTo("#bench-price", 2200, "end");
    await h.mark("bench", "#bench-price");
    await h.wait(1500);
    const slider = h.page.locator("#bench-price");
    const xFor = async (v) => { const b = await slider.boundingBox(); return { x: b.x + ((v - 1) / 399) * b.width, y: b.y + b.height / 2 }; };
    const cur = await xFor(Number(await slider.inputValue()));
    await h.page.mouse.move(cur.x, cur.y, { steps: 25 });
    await h.page.mouse.down();
    for (const v of [60, 101, 140]) {
      const p = await xFor(v);
      await h.page.mouse.move(p.x, p.y, { steps: 28 });
      await h.mark(`bench ${v}`, "#bench-price");
      await h.wait(3400);
    }
    await h.page.mouse.up();
    await h.wait(1200);
  },
  async tab(h) {
    await h.go(`/m/${S.hero}`);
    await h.scrollTo("#writ-tab", 1500, "start");
    await h.mark("tab", "#writ-tab");
    await h.wait(3500);
    await h.scrollBy(420, 3500);
    await h.mark("tab settled");
    await h.wait(4500);
  },
  async ledger(h) {
    await h.go("/ledger");
    await h.wait(3000);
    await h.mark("ledger");
    await h.scrollBy(520, 4500);
    await h.wait(3500);
  },
  async forensics(h) {
    await h.go(`/forensics/${S.frx}`);
    await h.mark("forensics top");
    await h.wait(5500);
    await h.scrollBy(460, 2600);
    await h.mark("questions");
    await h.wait(4500);
    const chip = h.page.locator("button[aria-label^='Show evidence']").last();
    await h.click(chip, "chip click").catch(() => {});
    await h.wait(3500);
    await h.mark("chip target");
    const refund = h.page.getByRole("button", { name: /^Refund \$/ }).first();
    await refund.scrollIntoViewIfNeeded().catch(() => {});
    await h.wait(2200);
    await h.click(refund, "refund click");
    await h.wait(8000);
    await h.mark("refunded");
    await h.wait(3000);
  },
  async redteam(h) {
    await h.go(`/m/${S.rt}`);
    await h.scrollTo("#rt-head", 1, "start");
    await h.wait(1500);
    await h.mark("rt head", "#rt-head");
    await h.wait(2500);
    await h.click(h.page.getByRole("button", { name: /Run red-team suite/ }).filter({ hasNotText: "again" }).first(), "run click");
    await h.wait(1500);
    await h.mark("confirm", "#rt-confirm");
    await h.wait(2800);
    await h.click(h.page.getByRole("button", { name: "Start the attack" }), "start click");
    await h.page.waitForSelector("#redteam-scorecard", { timeout: 360000 });
    await h.wait(1000);
    await h.scrollTo("#redteam-scorecard", 1500, "start");
    await h.mark("scorecard", "#redteam-scorecard");
    await h.wait(5500);
    for (let i = 0; i < 10; i++) { await h.scrollBy(340, 1700); await h.mark(`sc scroll ${i}`); await h.wait(1700); }
    await h.wait(1500);
    await h.click(h.page.getByRole("button", { name: "Revoke mandate" }).first(), "revoke click");
    await h.wait(1300);
    await h.type('input[placeholder="e.g. plans changed"]', "Mission over");
    await h.click(h.page.getByRole("button", { name: "Revoke now" }).first(), "revoke now");
    await h.wait(6000);
    await h.mark("revoked");
    await h.scrollTo("body", 1600, "start");
    await h.mark("top after revoke");
    await h.wait(6500);
  },
  async live(h) {
    const mission = "Research the best cloud infrastructure for our AI product. $100 total: buy research data, plus a USB-C hub and a webcam. Ask me before anything over $15. Nothing from bulkbin.example.";
    const cdp = await h.ctx.newCDPSession(h.page);
    await cdp.send("WebAuthn.enable");
    await cdp.send("WebAuthn.addVirtualAuthenticator", { options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
    await h.go(`/?prompt=${encodeURIComponent(mission)}#compose`);
    await h.scrollTo("#compose", 900, "start");
    await h.mark("composer");
    await h.wait(3000);
    await h.click(h.page.getByRole("button", { name: "Draft the mandate" }), "draft click");
    await h.page.waitForURL(/\/m\/man_/, { timeout: 300000 });
    await h.wait(2500);
    await h.mark("review loaded");
    await h.wait(3500);
    await h.mark("void box", h.page.getByText(/Void until signed/i));
    await h.scrollBy(560, 2600);
    await h.mark("clauses");
    await h.wait(4000);
    await h.click(h.page.getByRole("radio", { name: /A team of agents/ }), "team click");
    await h.wait(2500);
    await h.click(h.page.getByRole("button", { name: /Sign with passkey/ }), "passkey click");
    await h.wait(5500);
    await h.mark("sealed");
    await h.page.locator("paypal-button").first().scrollIntoViewIfNeeded();
    await h.wait(1500);
    const pb = await h.page.locator("paypal-button").first().boundingBox();
    if (pb) await h.page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2, { steps: 30 });
    await h.mark("paypal click", "paypal-button");
    await approveHold(h.ctx, h.page, { log: (m) => h.mark(m) });
    await h.mark("paypal approved");
    await h.page.waitForSelector("text=/Decision log/i", { timeout: 180000 }).catch(() => {});
    await h.mark("mission control");
    let slips = 0;
    const deadline = Date.now() + 9 * 60_000;
    while (Date.now() < deadline) {
      const slip = h.page.getByText("Your signature required").first();
      if (await slip.isVisible().catch(() => false)) {
        slips++;
        await h.scrollTo("[id^=slip-]", 1000);
        await h.mark(`slip ${slips}`, "[id^=slip-]");
        await h.wait(4500);
        if (slips === 1) {
          await h.click(h.page.getByRole("button", { name: /^Approve \$/ }).first(), "approve click");
          await h.page.getByText("Your signature required").first().waitFor({ state: "detached", timeout: 90000 }).catch(() => {});
        } else {
          const dec = h.page.getByRole("button", { name: "Decline" }).first();
          for (let i = 0; i < 60 && !(await dec.isEnabled().catch(() => false)); i++) await h.wait(1000);
          await h.type('input[placeholder="e.g. want a better-known brand"]', "Over my line. Find one under $15.");
          await h.click(dec, "decline click");
          await h.wait(4000);
        }
        await h.wait(3000);
        continue;
      }
      if (await h.page.getByText(/Mandate closed|FULFILLED/).first().isVisible().catch(() => false)) { await h.mark("closed"); await h.wait(5000); break; }
      await h.wait(2000);
    }
    await h.scrollTo("body", 1600, "start");
    await h.mark("top");
    await h.wait(6000);
  },
};

for (const name of process.argv.slice(2)) await take(name, TAKES[name]);
