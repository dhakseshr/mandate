# Writ design: "Intaglio"

> A mandate is a financial instrument, so Writ is printed like one.

Intaglio is the printing process behind banknotes, bond certificates and passports: documents built to be
**hard to forge and easy to check**. Writ makes the same promise about spending authority. The design
language borrows from security printing, set with a modern, strict grid and used only where it means something.
There are no gradients, no glass, no rounded cards and no decorative colour.

## Mood board

These are the references I looked at, each with the specific idea I took from it. The repo commits links only,
with no third-party screenshots. The two archival scans used as assets are listed under *Assets and licences*.

### Security printing (the core of the concept)

| # | Reference | What I took |
|---|---|---|
| 1 | [American Bank Note Co. share certificate, 1863](https://commons.wikimedia.org/wiki/File:Oldest_known_ABNC_stock_1863.jpg) (CC0) | **Punch-cancellation.** Its signatures are cancelled with punched holes, which became the `Punch` component for final acts (DENIED, VOID, REVOKED). Its **black lathe-work border** is the asset used on the certificate, passport and landing instrument |
| 2 | [Eidgenössische Bank share, Zürich 1893](https://commons.wikimedia.org/wiki/File:Eidgen%C3%B6ssische_Bank_1893.jpg) (PD) | The **centred serial plate** ("№ 4428" in a cartouche between two mirrored columns), which became the `№` serial plate in instrument headers. It is also punch-cancelled, so the precedent appears twice |
| 3 | [Guilloché and the rose-engine lathe](https://en.wikipedia.org/wiki/Guilloch%C3%A9) | Rosettes are parametric curves cut on a lathe. This gave `Rosette`: parameters come from the mandate's sha256, and the *engrave* motion grows every line around the circle at once, the way a lathe cuts |
| 4 | [Void pantograph](https://en.wikipedia.org/wiki/Void_pantograph) | A hidden "VOID" that appears when a cheque is copied. An unsigned draft instrument carries a faint VOID pantograph behind its amount until it's signed |
| 5 | [Ormsby, *Bank Note Engraving*, 1852](https://commons.wikimedia.org/wiki/File:Ormsby%27s_Bank_Note_Engraving_(IA_ormsbysbanknotee1852wlor).pdf) (PD) | The argument that intricacy itself is the security. Ornament is used **only** where it encodes identity (hash → rosette), never as decoration |
| 6 | MICR E-13B cheque line | A machine-readable footer on every instrument (`⑆ … ⑈`) |
| 7 | [Swiss 9th banknote series, Manuela Pfrunder](https://landqart.com/en/stories/case-studies/9-serie-chf) | Security printing made contemporary: a strict modern grid and plain type on top of engraved texture. That's the guard against nostalgia kitsch |
| 8 | [Norway banknotes, Snøhetta: "The Beauty of Boundaries"](https://www.designboom.com/design/snohetta-norway-new-banknotes-10-09-2014/) | The *boundary* is the designed subject. The double-hairline **boundary rule** between the agent's side and the money's side, captioned in microprint |
| 9 | [Ootje Oxenaar's Dutch guilders](https://coinweek.com/ootje-oxenaar-the-art-and-application-of-banknote-design/) | Put the technical elements up front instead of hiding them (and OCR-B numerals). This led to the landing **bench**, which shows the real engine instead of describing it, and to mono figures everywhere |
| 10 | Passport data pages (ICAO 9303 MRZ) | The machine-readable zone at the foot of the Agent Passport |

### Editorial and product (rhythm, restraint, honesty)

| # | Reference | What I took |
|---|---|---|
| 11 | [Stripe Press](https://press.stripe.com/) | Book-like restraint: one serif voice, generous measure, praise set as block quotes. Writ sets the human's own words as the pull quote on every instrument |
| 12 | [Linear](https://linear.app/) | Numbered figure captions on product mocks ("Fig 0.1"). Landing sections are captioned *Fig. 1, the bench*, and so on, so the page reads like a specification |
| 13 | [Teenage Engineering OP–1](https://teenage.engineering/products/op-1) | Spec-sheet listing: all-caps rows with units inline, and en-dash product names. Used for the 13 rules and the attack schedule |
| 14 | [Ramp](https://ramp.com/) | **Anti-reference.** Logo wall, "85,000 companies" and "$1M+ saved" stats, email capture in the hero. Writ has no customers to claim, so it shows a working mechanism instead |
| 15 | [Josef Müller-Brockmann, *Grid Systems in Graphic Design*](https://en.wikipedia.org/wiki/Josef_M%C3%BCller-Brockmann) | A 12-column, flush-left asymmetric grid. Section heads take 4 columns and content takes 8. Rules, not boxes, separate content |
| 16 | *Financial Times* broadsheet | The paper colour itself as the brand, tabular figures, and double rules under totals |
| 17 | Giambattista Bodoni, [*Manuale Tipografico* (1818)](https://en.wikipedia.org/wiki/Manuale_Tipografico) | The Didone of certificates and banknotes, which led to Bodoni Moda for display, with its optical-size axis so the hairlines survive on screen |
| 18 | [Rubber stamps and notary seals](https://en.wikipedia.org/wiki/Notary_public#Seal) | Kept from v1. A rotated, inked, slightly distressed stamp means *a human-style decision*. Punched holes mean *a machine made it final* |

What I didn't take: showcase-site trends (bento grids, gradient meshes, glass cards, scroll-jacked 3D). They're
the visual signature of templated AI products, the opposite of what an instrument should feel like.

### Synthesis

Writ's claim is that its authority is **hard to forge, easy to verify, and finite**. Security printing has
answered exactly that problem for 200 years, so its vocabulary (guilloche, serials, microprint, punch-cancellation, counterfoils)
carries the meaning without explanation. Two rules keep it modern and honest. First, ornament appears only where it encodes something
real: a hash, a hold, a verdict. Second, the layout is a strict Swiss grid with plain type, so the texture reads as security,
not as nostalgia.

## Principles

1. **Every signed thing has a face no one else's has.** A mandate's sha256 drives a generative guilloche
   rosette (`components/rosette.tsx`). The same hash always draws the same rosette, and a different hash draws a different one.
   Unsigned documents show an empty, dashed seal ring instead. You can see that something is signed before you read it.
2. **One boundary.** The page is split the way the product is: the agent's side (monospace, the terminal
   well) and the money's side (paper, PayPal blue). The rule between them is drawn as a double hairline
   with microprint: *enforcement boundary · 13 rules · no model*.
3. **Colour is evidence.** Ink is the brand. PayPal blue appears only on PayPal money and PayPal IDs.
   Green, amber and red appear only on verdicts. Nothing else is coloured.
4. **Decisions are stamped; final acts are punched.** Rubber stamps (ALLOWED, ASK HUMAN) are decisions.
   Irreversible acts, such as DENIED, VOID and REVOKED, are *punch-cancelled* the way a bank cancels a cheque: the letters are
   holes (`components/punch.tsx`).
5. **Show the real thing.** The landing page's bench imports `evaluate()` from `lib/policy/engine.ts`, the same
   pure function the server runs before every capture, and runs it in the visitor's browser. Every number
   on the site comes from the README, from the engine, or from the database.

## Type

| Role | Face | Notes |
|---|---|---|
| Display | **Bodoni Moda** (variable, optical size) | Banknote and certificate Didone. Used at 22px and up only, so the hairlines survive |
| Text and labels | **Archivo** (variable, width axis) | Body at normal width. Labels use the condensed width in caps, like the lettering on a note |
| Figures, IDs, hashes | **IBM Plex Mono** | Tabular, never reflowing |

## Colour

| Token | Light | Dark | Meaning |
|---|---|---|---|
| `--bg` / `--surface` | security paper `#eeebe1` / `#f8f6ef` | night press `#0c0c0a` / `#151512` | paper |
| `--ink` | `#121210` | `#ece7da` | the brand, primary actions |
| `--paypal` | `#0059b8` | `#5aa9ff` | PayPal money only |
| `--allow` / `--escalate` / `--deny` | `#1d6a45` / `#94560a` / `#b3261e` | `#5fc28e` / `#e9a23b` / `#ff6f61` | verdicts only |

Light and dark mode follow the OS, and the header toggle can override it (`data-theme`).

## Motion

There are six sanctioned motions. All of them respect `prefers-reduced-motion`, which turns them into instant states.

1. **Ink-in:** log lines and instrument rows appear with a 2px rise.
2. **Stamp:** a verdict stamp lands.
3. **Release:** the held part of the envelope collapses when the hold is voided.
4. **Draw-in:** the instrument's first load.
5. **Engrave:** a rosette is cut on a lathe: every line of the guilloche grows around the circle at once.
6. **Punch:** DENIED, VOID and REVOKED are punched column by column.

## Signature moments

- **Landing hero:** a large engraved rosette behind the headline, plus *the bench*, where the visitor drags a price or throws an
  attack at the real engine and watches 13 checks resolve.
- **Signing:** the instrument with its clauses, the ghost seal, and the PayPal button as the signature.
- **Mission Control:** the envelope is the cheque stub, and verdicts are stamped into the log.
- **Red team:** the DENIED is punched through the panel.
- **Certificate and passport:** the rosette is the face of the document.

## Assets and licences

| Asset | Source | Licence |
|---|---|---|
| Bodoni Moda | Google Fonts, via `next/font/google` (self-hosted at build) | SIL Open Font License 1.1 |
| Archivo | Google Fonts, via `next/font/google` | SIL Open Font License 1.1 |
| IBM Plex Mono | Google Fonts, via `next/font/google` | SIL Open Font License 1.1 |
| Lathe-work border tile (`public/textures/abnc-lathe-1863.png`) | Cropped from [Oldest known ABNC stock 1863.jpg](https://commons.wikimedia.org/wiki/File:Oldest_known_ABNC_stock_1863.jpg), Wikimedia Commons; one 4-motif strip, converted to an alpha mask so it takes the theme's ink colour | CC0 1.0 |
| Paper grain (`public/textures/paper-grain.webp`) | [ambientCG Paper001](https://ambientcg.com/view?id=Paper001), high-pass filtered into a seamless alpha-only grain tile | CC0 1.0 |
| Guilloche rosettes | Generated in code (`components/rosette.tsx`) | MIT (this repo) |
| Punch lettering (5×7 matrix) | Drawn by hand in code (`components/punch.tsx`) | MIT (this repo) |
| Icons | `lucide-react` (already a dependency) | ISC |

Fonts considered and rejected: Fontshare (ITF Free Font License) faces, because that licence restricts redistribution and the repo self-hosts fonts publicly.

The only raster assets are the two textures above, about 85 KB together. Everything else is CSS or generated SVG/canvas.
