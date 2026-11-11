# Writ demo film: status (resume here)

**Goal:** a top-tier product-ad demo film (≤ 2:50, silent picture; the user records the voiceover) for the PayPal AI Hackathon. Submit by Nov 12, 21:00 IST.

## Where things are

| Item | Location | State |
|---|---|---|
| Film (Remotion 4.0.539) | `video/src/` | All 25 scenes written; timeline = **2:45** (`src/Film.tsx`, the EDL) |
| Footage (true 2560×1440, from the live app) | `video/public/footage/*.webm` + `*.json` markers | ✅ 7 takes recorded: attack, landing, tab, ledger, forensics, redteam, live. Gitignored, on disk, 361 MB. **Don't delete.** |
| Recorder (Playwright, drives the live site) | `video/recorder/rec.mjs`, `lib.mjs`, `stage.mjs` | Works. `state.json` (gitignored) holds staged mandate ids |
| Design system | `video/src/components/` (Paper, Rosette, Punch, BrowserFrame + camera, chips) | Done |

## Next steps

1. **QA pass:** render stills at each scene midpoint (`npx remotion still Writ out/x.png --frame=N --scale=0.25`), then fix framing. Scene midpoints: see `SCENES` in `src/Film.tsx`. Camera boxes are in source pixels (2560×1440).
2. **Render:** `cd video && npx remotion render Writ out/writ.mp4 --codec h264 --crf 16`. Expect it to take a while.
3. **Voiceover script with timecodes**, matching `SCENES`. Write it in `video/VOICEOVER.md` for the user.
4. YouTube title, description and thumbnail (see `docs/video/BRIEF.md` §6).

## Known facts in the footage (narrate only these)

- **Cold open:** a $389 "PRE-APPROVED" injected listing. DENIED by BUDGET_REMAINING · $0.00 moved · hold intact $120.
- **Live run:** $100 mission, ask above $15, never bulkbin.example. Passkey signed, PayPal hold, 3 agents. $15.67 captured, **$84.33 voided back**, no approval needed.
- **Red team:** **16/16 attacks blocked** (11 scripted + 5 from the adversarial AI), **$0.00 moved** (PayPal API before and after), **0 breaches**, **crash test 20/20 held**, certificate **PASSED**, then the kill switch: REVOKED, VOID · $100 returned.
- **Tab:** 3 paid API calls, 1 PayPal capture ($0.65), 1 Payouts batch to 2 providers.
- **Forensics:** the manipulated provider (insight-wire) is at fault, HIGH confidence. Refund $0.20 via the PayPal Agent Toolkit.
- **Ledger:** $1,525 authorized · $179.90 captured · 40 attack attempts blocked.

## Gotchas

- The PayPal popup video isn't saved: `ctx.pages()` omits closed pages. Collect videos via `ctx.on("page")` if you re-take it.
- The live site scales to zero, so the first request after idle is slow. The cost cap is $10–15: don't leave it busy.
- `/tmp` is wiped on reboot, so keep everything in this folder.
