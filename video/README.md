# The Writ demo film

The submission film is built in code: the footage is recorded from the **live app** by an automated browser, then edited in [Remotion](https://www.remotion.dev/) in Writ's "Intaglio" identity. Nothing in it is mocked. Every screen is the deployed product, running against the PayPal sandbox.

| Part | What it does |
|---|---|
| [`recorder/`](recorder/) | Playwright drives the live site at a true 2560×1440 (viewport 2560 + CSS zoom, so the layout matches 1536px). `stage.mjs` creates mandates and approves their PayPal holds as the sandbox buyer; `rec.mjs` records each take and writes a markers file (timestamps and element boxes) |
| [`src/`](src/) | The film: the edit decision list (`Film.tsx`), scenes, and the design system: paper grain, a hash-derived guilloche rosette, punch-cancellation lettering, a browser frame with an eased camera that frames regions of the 1440p footage |
| [`tts/make_vo.py`](tts/make_vo.py) | Narration with Google Cloud Text-to-Speech (Chirp 3 HD). It synthesizes phrase by phrase, fits each line inside its scene, and mixes the result to −16 LUFS |
| [`teleprompter/`](teleprompter/) | A voiceover booth for recording a human narration: the film plays, the script highlights word by word, and each take is saved with its exact film time. [`mix.sh`](mix.sh) places those takes on the film |
| [`VOICEOVER.md`](VOICEOVER.md) | The narration script, with timecodes |

## Make it

```bash
cd video && npm install
node recorder/stage.mjs attack rt hero   # stage mandates on the live app (needs PAYPAL_SANDBOX_BUYER_PASSWORD in ../.env)
node recorder/rec.mjs attack landing tab ledger forensics redteam live paypal
npx remotion render Writ out/writ.mp4 --codec h264 --crf 16
python3 tts/make_vo.py Charon            # → out/writ-final-Charon.mp4
```

Footage (`public/footage/`) and renders (`out/`) are gitignored. Fonts are Bodoni Moda, Archivo and IBM Plex Mono (SIL OFL). Textures are CC0 (see [`../docs/DESIGN.md`](../docs/DESIGN.md)).
