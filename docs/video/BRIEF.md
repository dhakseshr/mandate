# Writ demo video: strategy brief

> **What this is:** the strategy behind the video. The shot list lives in `docs/VIDEO.md`; this brief overrides it wherever they disagree.
>
> **Upload deadline:** public on YouTube by **12 Nov, 17:00 IST**, so HD processing finishes before the 21:00 IST submission. The hard close is 13 Nov, 01:30 IST.
>
> **Sources:**
> - The official rules at paypalaihackathon.devpost.com/rules (fetched 11 Nov).
> - `BUILT.md`, `README.md` and `docs/DEVPOST.md`.

---

## 0. The decision in one paragraph

Don't open on "AI agents will spend money." Every entry called Mandate, Mandat or Your Mandate opens that way, and AP2 already gave everyone the "signed mandate" idea. **Open on the result instead.** A deliberately compromised AI agent holds a real, signed $100 slice of a PayPal sandbox hold and is told to steal. Every attempt is punched DENIED, and *PayPal's own API* confirms **$0.00 moved**. That's the one thing the lookalike entries can't show.

Everything else in the video earns that moment:
- the human signs;
- PayPal holds;
- agents delegate narrower authority;
- 13 rules check every level.

Cut Writ Tab, Forensics, Passport, MCP, KYM, photo and voice from the video. AgentTab and Witness occupy the Tab and Forensics space anyway, so leave those features to the Devpost text.

---

## 1. Rules compliance checklist

| Rule (official wording) | How we comply | Status |
|---|---|---|
| "should be less than three (3) minutes" | Target **2:45**, with a hard edit cap of 2:55. Judges stop at 3:00 | ☐ |
| "footage that shows the Project functioning on the device for which it was built" | It's a web app in desktop Chrome. The **first app shot shows the address bar** with `writ-…run.app`, which proves it's live and not localhost or a mockup; after that, go full-screen. All money moments come from one real, continuous Cloud Run session | ☐ |
| "uploaded to and made publicly visible on YouTube" | Set it to **Public**, not Unlisted. Set "Not made for kids". Check playback in a logged-out incognito window | ☐ |
| "must not include third party trademarks, or copyrighted music or other material unless … permission" | See the risk table below. **No music by default** | ☐ |
| "must function as depicted in the video" (Functionality clause) | Show only ✅ features. **Freeze `main` after recording** so the live site keeps matching the video through judging | ☐ |
| English language | Use English narration and burned-in English captions, and upload an `.srt` | ☐ |

**Trademark and material risks in *our* footage, with the decision for each:**

| Risk | Where it shows | Decision |
|---|---|---|
| **"Nothing from Amazon"** in the Procurement prompt and the `§ Never from amazon.com` clause. With Amazon blocked, the crash test also generates look-alikes such as `amaz0n` | `/demo` prefill, the review instrument, the crash-test matrix, and the landing bench ("Running shoes… Nothing from Amazon") | **Rename for the recording.** After Prefill, change the last sentence to **"Nothing from bulkbin.example."** The `.example` TLD is reserved, so it can never be a trademark. `crosscheck.ts` catches lowercase domain exclusions, so the clause, the A4 attack and the look-alike crash cases (`bu1kbin…`) all still work. **Dry-run once** to confirm. Keep the landing bench out of frame |
| **Real product photos** (Channel3 thumbnails, 24–64px, `components/log/shared.tsx` `Thumb`). These are box art and brand logos | Decision log, approval slip, side panel | **Blur every thumbnail in the edit** with a mosaic mask in Kdenlive. A cheaper option is a 5-line, temporary `?video=1` flag that renders `Thumb` as the empty placeholder; that's your call, since this brief doesn't touch code |
| **Real product and merchant names** in agent text (for example, "Bose $169 exceeds your $150 line") | Agent log, approval slip, `/verify` merchant field (default `bestbuy.com`) | Text names from listings are factual, nominative use, and Channel3's data *is* the sponsor feature, so leave them at normal size. **Never zoom in on, or say aloud, a third-party brand or merchant.** Frame `/verify` on the stamp and signature, not the merchant field |
| Chrome, Linux desktop and OS passkey dialog | Browser chrome and the passkey prompt | Use a clean Chrome profile: no extensions, no bookmarks bar, Do Not Disturb on, full-screen after the address-bar shot. A passkey dialog that flashes past is incidental UI. If it turns into a phone-QR flow, record it once or skip the passkey (it's optional) |
| **Sponsor marks** (PayPal, AG Grid, Channel3, Render) | The PayPal button and popup, the closing card | PayPal UI is the product under test, so it's fine. Name the other sponsors **as plain text**, with no pasted logos. Plain text is safer and also matches Intaglio's "no decoration" rule |
| **Google / Gemini / Vertex AI / Cloud Run.** Google is **not** a listed sponsor | The closing card | The rules require us to name the AI tool, so a **plain-text** "Gemini 3 Flash on Vertex AI" is a necessary disclosure. Use no Google or Gemini logos |
| Sandbox buyer credentials | PayPal popup | The email is already public in the README. **Never show the password**: cut away while typing it, or log in before recording |
| Fonts and textures | Everywhere | Fonts are OFL and the ABNC lathe and paper grain are CC0 (`DESIGN.md`), so they're fine |
| Music | — | **None.** If you want a bed anyway, use one YouTube Audio Library track filtered to "Attribution not required", mixed at −30 dB under the voice. Never use a commercial track, because Content ID claims can block or demonetise the video |

---

## 2. Judging criteria and the moment that scores each one

All five criteria are **equally weighted** (rules §6, Stage Two). Stage One is a pass/fail check that the project "reasonably applies the required APIs", so make PayPal API names visible on screen early.

| Criterion | The moment | What must be visibly true |
|---|---|---|
| **Technological Implementation** | **0:58–1:35.** The refused over-reaching delegation, the verdict block with 13 ✓ "checked at Monitor agent ✓ → Your mandate ✓", and the partial capture with its **capture ID and `CAPTURE` API string** in PayPal blue. Then the webhook line "PayPal confirmed …" | It's real PayPal Orders and Payments v2 plus the Agent Toolkit (`create_shipment_tracking`), with AI and code split visibly. Narrate "the model proposes; plain code decides" |
| **Design** | **0:28–0:58.** One sentence becomes the engraved instrument: § clauses, the rosette engraving on signing, the PayPal button as the signature. **2:15** has the VOID punch and the release collapse | A complete product, not a console. Let one Engrave and one Punch play at full speed (≈1s each) |
| **Potential Impact** | **0:10–0:28.** Name the specific audience: "procurement teams who won't hand an AI agent a corporate card". Echo it at the approval slip ("anything above my line comes to me") | A named buyer, a named fear and a named fix. Don't use "everyone" language |
| **Innovation / Idea** | **1:35–2:15.** The red team: *we attack our own product with an adversarial AI, then ask PayPal, not our database, whether money moved,* then sign an Assurance Certificate | This is the differentiator from the Mandate-named entries. Say "We don't ask our own database. We ask PayPal." |
| **Presentation** | **The whole video.** The cold open lands the result in ≤10s, it's one continuous story on one hold, it closes on the line and the URL | It's end-to-end: sign → hold → spend → attack → revoke → void → ledger |

---

## 3. Prize targeting

The video has one story. Prizes are served by **what is on screen**, not by naming the prizes.

| Prize | Serve explicitly? | How |
|---|---|---|
| **Overall (1st/2nd/3rd)** | Yes | The whole arc |
| **Best Use of Agentic Commerce** | **Primary** | Agents delegate, shop and pay under human-signed, attenuated authority, and the merchant can verify the order. Say "agentic commerce" once, at the thesis |
| **Best Use of PayPal + AI** | **Primary** | The line "AI decides what to buy. Writ decides whether it's allowed. **PayPal enforces the boundary.**" Back it visually: the hold, partial captures, void, webhooks and Agent Toolkit calls, each with an on-screen PayPal ID |
| **Best Demo Delivery** | Yes, through craft | The cold open, captions, no dead air, and a 2:45 runtime |
| **Most Impactful** | Yes, briefly | Procurement as the audience. The 18s problem beat |
| **Most Creative** | Implicitly | The red team plus the certificate, and the Intaglio art direction. Don't claim creativity; show it |
| **AG Grid** (1st is $5k, and their judge is the community manager) | **Yes, one deliberate 6s shot** | In `/ledger`: filter the verdict column to DENY so the red-team rows appear, then open a row detail. It's a real interaction, not a static pan. Say "every cent and every verdict, in an append-only ledger" |
| **Channel3** (their judge is a founding engineer) | Yes, 3s | During shopping, a caption reads "Real catalogs · Channel3 product search". Show the agent's comparison sentence on screen |
| **Render** | **No video time** | Production runs on Cloud Run; Render is the Blueprint mirror. Mention it only in the YouTube and Devpost text. Keep the opt-in **only if** the mirror stays healthy through 15 Dec (the free DB expires around 8 Dec, so upgrade it or drop the opt-in) |

**Anti-laundry-list rule:** the closing card has **one text line** of credits: *PayPal · Gemini 3 Flash on Vertex AI · Channel3 · AG Grid*. No logo wall.

---

## 4. Positioning

**The problem, in one sentence:** Today, letting an AI agent pay means handing it a card, and nothing stops it when it's fooled.

**Who it's for:** procurement and finance teams that want AI buying agents but won't hand one a corporate card. Agent developers come second: they get a single scoped MCP endpoint, but **don't demo that**.

**Why now:** PayPal is pushing agentic commerce publicly:
- the Agent Toolkit;
- Agent Ready for merchants;
- adopting Google's AP2 signed-mandate model.

AP2 standardises *how to express* intent. Writ is the runtime that *enforces* it on PayPal rails, even when the agent itself is compromised.

**The single idea judges should repeat:**
> *"They gave a rogue AI agent real PayPal authority, told it to steal, and asked PayPal to prove nothing moved: $0.00."*

The tagline that carries it: **"We don't trust the AI. We trust the boundary."**

**The 3 proof points that are hardest to fake** (all ✅ in `BUILT.md`):
1. **PayPal as the independent witness.** The red-team suite calls `GET /v2/checkout/orders/{id}` before and after, and the scorecard shows PayPal's numbers, not ours. If you can, add a 2s cut to the **sandbox merchant dashboard** showing the same authorization ID (verify this in the dry run).
2. **One hold behind a tree of agents.** It's a single `AUTHORIZE` hold, with several **partial captures** from different sub-agents, each with its own capture ID. The remainder is **voided**, and **signature-verified webhooks** confirm each step. The live run showed this: $600 hold, 3 captures, $301.53 voided.
3. **A refusal you can read.** A REFUSED delegation card ("asks for $X but only $Y is left to delegate"), plus 13 deterministic checks evaluated at the sub-mandate *and* the root.

**Honesty guardrails (say or show exactly this):**
- **Sandbox.** Put a small persistent caption on the first PayPal shot: *"PayPal sandbox: real API calls, test money. Writ acts as merchant; nothing ships."*
- **Red-team numbers.** The suite has never been run live on Cloud Run; the 15/15 and 13/13 results come from a local run and a backend test. **Run it live in the dry run**, and in the VO read only the N/N figures **on screen**. Don't script "fifteen".
- **The kill switch** has never been clicked in the live UI. Click it in the dry run first. If it misbehaves, cut that shot rather than fake it.
- **AP2.** Say "an AP2-style signed intent mandate", never "AP2-compliant". The Cart and Payment chain isn't built.
- **Delegation.** Say "each sub-agent is *checked* to be narrower on every rule", not "mathematically".
- **The cross-check** restoring a dropped clause is nondeterministic. Mention it only if it fires on camera.
- **Never mention** disputes (the live test is pending) or MCP with Claude (not tried).
- **Simulated data.** If Writ Tab is mentioned at all, it must say the providers are simulated.

**What to cut from the video** (it stays in Devpost and the README):
- Writ Tab, Forensics and disputes (they overlap AgentTab and Witness, and they dilute the story)
- Passport, KYM, autonomy profiles, photo and voice, MCP
- the landing-page tour
- `/verify` as a standalone scene: fold it into a 2s receipt stamp
- architecture diagrams and code
- "13 rules" read out as a list

---

## 5. Narrative arc and timing (target 2:45)

| Time | Beat | Emotion | Content |
|---|---|---|---|
| **0:00–0:10** | **Cold open** | Tension | Mission Control, red-team panel. The adversarial agent's own words in the log, then two DENIED punches, then a hard cut to **"$0.00 moved · confirmed by PayPal"**. VO: *"This AI agent has a hundred dollars of real PayPal authority, and it's been told to steal. It moved zero. This is Writ."* |
| 0:10–0:28 | Problem, audience, why now | Recognition | VO: card-handing today; procurement teams; "AI decides what to buy. Writ decides whether it's allowed. PayPal enforces the boundary." Use the landing hero only, never the bench |
| 0:28–0:58 | Sign and hold (address-bar shot here) | Control | Prefill Procurement (with the bulkbin.example edit) → compile → § clauses (zoom on "ask above $200") → team of agents → passkey → PayPal popup → **$1,500 hold** with its authorization ID zoomed. Rosette engraving |
| 0:58–1:35 | Delegate and spend | Competence | The tree builds; a REFUSED card; Channel3 caption; one verdict block (13 ✓, checked at both levels); a capture lands (ID zoomed); the receipt stamp (2s); the approval slip → Approve |
| **1:35–2:15** | **The proof** | **Peak, then relief** | Run red-team suite → the PayPal "before" line → a rhythmic montage of 4–5 attacks, each punched (the injected $389 listing, the forged $1, self-delegated money, revoking the human, spending after the kill switch) → the crash-test matrix fills in → **a beat of silence** → the scorecard: N/N blocked · $0.00 moved · PayPal before = after → Certificate ✓ Verified |
| 2:15–2:32 | Human stays in charge | Closure | Revoke a sub-agent (REVOKED punch) → close → the release collapses, **VOID · $X returned** → AG Grid ledger, DENY filter, row detail (6s) |
| 2:32–2:45 | Close | Conviction | The instrument, then the text card: *"Writ. Signed by a human. Bounded by PayPal. Provable."* Below it: the URL, the repo, and one credits line |

**Rhythm:**
- one idea per sentence;
- about 140 words per minute, so roughly 380 words in total;
- the VO never describes what's already obvious on screen; it says *why* it matters.

---

## 6. YouTube packaging

**Title (59 chars):** `Writ: a rogue AI agent, a $100 PayPal hold, and $0.00 moved`

**Alternate:** `Writ: spending permission for AI agents | PayPal AI Hackathon` (61)

**Description:**
```
Writ is the financial permission layer for autonomous AI agents. You write a spending rule in plain English; Gemini compiles it into a policy; you sign it with a passkey and approve a PayPal authorization hold. Agents (and the sub-agents they delegate to) can only partially capture from that hold, and only when a deterministic 13-rule engine allows it at every level of the delegation chain. Then we hand a deliberately compromised AI agent a real slice of the hold, tell it to steal, and ask PayPal's own API whether anything moved.

We don't trust the AI. We trust the boundary.

▶ Live demo: https://writ-307007912526.us-central1.run.app/demo
▶ Code (MIT): https://github.com/dhakseshr/mandate
▶ Devpost: <submission URL>

Built for the PayPal AI Hackathon 2026. Runs entirely on the PayPal sandbox (test money, real API calls); Writ acts as merchant of record and fulfilment is simulated.

Built with: PayPal Orders v2 (AUTHORIZE) · Payments v2 (partial capture, void, refund) · PayPal Agent Toolkit · PayPal webhooks · JS SDK v6 · Gemini 3 Flash on Vertex AI · Channel3 product search · AG Grid · Google Cloud Run · Render (mirror) · WebAuthn · Ed25519

0:00 A compromised agent with a real budget
0:10 The problem: agents need permission, not a card
0:28 Sign the rule, approve the PayPal hold
0:58 A team of agents, narrower authority, 13 checks
1:35 Red team: PayPal confirms $0.00 moved
2:15 Kill switch, void, audit ledger
2:32 Writ
```
YouTube chapters need the first one at 0:00, at least three chapters, and each at least 10s. **Re-time them to the final cut.**

**Thumbnail** (1280×720, made from a *real* screenshot):
- **Background:** the paper-coloured instrument (light mode) with the agent log down the left.
- **Centre:** a large punched **DENIED** across one attack line.
- **Right:** in Bodoni, **"$0.00 MOVED"** in ink, with **"$100 held · PayPal"** below it in PayPal blue.
- **Bottom:** microprint reading "confirmed by PayPal's API · sandbox".
- **Readability:** no more than 4 big words, legible at 320px wide.
- **Exclusions:** no face, no third-party product images.

**Tags:**
- PayPal AI Hackathon, PayPal, agentic commerce, AI agents, AI agent payments
- PayPal Agent Toolkit, AP2, Agent Payments Protocol, autonomous agents
- AI safety, red team, prompt injection, spending limits
- procurement AI, Gemini, Vertex AI
- AG Grid, Channel3, Devpost, hackathon demo, Writ

---

## 7. Recording logistics (solo)

**Capture:**
- **OBS:** 1920×1080 canvas and output at **60 fps** (cursor and scroll stay smooth).
- **Encoding:** NVENC or x264, CQP/CRF 18, recorded as **MKV**, then *File → Remux* to MP4.
- **Source:** on Linux/Wayland, use the *Screen Capture (PipeWire)* source.
- **Audio:** the mic on its own track. Better still, don't record the mic in OBS at all (see voice).
- **If the monitor is 1440p or larger:** record at native resolution and export at 1080p. The headroom makes the post zooms crisp.

**Browser:**
- Use a fresh Chrome profile in **light mode**; paper reads as "instrument".
- Set browser zoom to **110%** for Mission Control and **125%** for the signing and review screens.
- Check that the tree, log and envelope fit without scrolling at 110%.
- Increase the OS cursor size (GNOME Accessibility, 32–48px).

**Takes:**
- Record **section by section**, not one 3-minute take.
- Keep two mandates ready: one fresh Procurement draft for signing, and one **already-authorized team mandate that has finished shopping**, for the red team and kill switch.
- Let Mission Control run in a single uninterrupted take and cut it afterwards.

**Waits:**
- Cut Gemini and PayPal waits with jump cuts.
- If you speed footage up, put a small "×4" tag in the corner. Honesty protects the "functions as depicted" clause.
- **Never** speed up the audio.

**Voice: your own voice, recorded separately, is the recommendation.**

The judges are mostly developer advocates and PayPal engineers. A real founder's voice reads as authentic, while stock TTS reads as "generated". An Indian English accent is not a handicap if the delivery is slow and clear, and burned-in captions remove any comprehension risk.

How to record it:
1. Record against the locked script after the picture edit.
2. Use a USB mic, or a phone voice memo in a soft-furnished room, 15 cm from your mouth.
3. In Audacity: noise reduction, then normalise to −16 LUFS.
4. Do 2–3 takes per section and keep the best one.

The fallback is a neutral TTS voice, but only if your own audio is noisy; you'd lose authenticity points for Best Demo Delivery. Optionally, add a 2s on-camera line at the very end ("I built Writ solo"), which adds credibility.

**Edit (Kdenlive, which is free on Linux; avoid free DaVinci Resolve on Linux, which has no H.264/AAC export):**
- **Zoom-ins:** 1.5–2× on IDs and amounts, with a 0.3s ease, held for at least 1.5s, and no more than one every 5s. Pan on: authorization ID, capture ID, REFUSED reason, "$0.00 moved", the certificate ✓.
- **Cursor:** move it deliberately, then park it off the content while the VO speaks.
- **Captions:** burned in, at the bottom, in Archivo, 2 lines maximum. Also upload them as an `.srt` file.
- **Blur:** blur the product thumbnails (§1).

**Export:** H.264 MP4, 1080p60, 16–20 Mbps, AAC 320k.

**Dry-run checklist (Nov 12 morning, live Cloud Run):**
- ☐ the Procurement prompt with bulkbin.example compiles, and the clause appears
- ☐ the passkey works in real Chrome
- ☐ the red-team suite runs live, and you note the N/N figures
- ☐ the kill switch works in the UI
- ☐ the void shows
- ☐ the ledger DENY filter shows the attack rows
- ☐ the sandbox dashboard shows the same authorization ID

---

## 8. Does the hosted demo need to stay online, and until when?

**Yes. Keep it online until at least Tue 15 Dec 2026, 08:00 PT (21:30 IST)**, which is when the Judging Period ends.

The rules allow either run instructions *or* a hosted URL for the "functional demo". But the Testing clause says the entrant "must make the Project available free of charge and without any restriction, for testing, evaluation and use by the Sponsor, Administrator and Judges **until the Judging Period ends**." Because our submission offers the hosted URL as the way in, it has to work for that whole window.

The README run instructions are the backup if it doesn't, not the plan. Judges "may choose to judge based solely on the text description, images, and video", which is another reason the video must stand alone.

**Official dates** (from the rules):

| Event | Pacific Time | IST |
|---|---|---|
| Submissions close | Thu 12 Nov, 12:00 PT | Fri 13 Nov, 01:30 |
| Judging Period | Tue 1 Dec 14:00 PT to Tue 15 Dec 08:00 PT | |
| Winners announced | on or around Mon 21 Dec, 14:00 PT | |

**Keep it running through about 28 Dec**, so the announcement and any winner verification hit a working site.

To make that happen:
- **Cloud Run and SQL:** keep Cloud Run always-on and Cloud SQL up, and set a GCP budget alert.
- **Keys and credentials:** keep the Vertex AI quota, the Channel3 key and the PayPal sandbox app and buyer credentials valid.
- **Render mirror:** if the mirror stays linked, upgrade the free Postgres before about 8 Dec, or remove the link.
- **Code:** don't push behaviour changes to `main` after submission, so the site keeps matching the video.
