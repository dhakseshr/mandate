#!/usr/bin/env python3
"""Generate the film's voiceover with Google Cloud TTS (Chirp 3 HD) and mix it onto the film.

Each line is synthesized phrase by phrase (split at "‖"), joined with short pauses, fitted inside its
scene (sped up slightly only if it would overrun), placed at the scene start, and mixed onto the film.

  python3 make_vo.py Charon        → ../out/writ-final-Charon.mp4
"""
import base64, json, os, subprocess, sys, urllib.request

VOICE = sys.argv[1] if len(sys.argv) > 1 else "Charon"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "out")
FILM = os.path.join(OUT, "writ-v4.mp4")
WORK = os.path.join(HERE, f"work-{VOICE}")
os.makedirs(WORK, exist_ok=True)
FPS = 30
PROJECT = "writ-hackathon-1110"

# (scene start frame, scene end frame, text). Must match video/src/Film.tsx and VOICEOVER.md.
LINES = [
    (0, 120, "This listing was written to fool an AI."),
    (120, 300, "The AI fell for it. ‖ The money didn't move."),
    (300, 405, "This is Writ."),
    (405, 660, "Agents are learning to buy for us. ‖ Today, that means handing one a card, and hoping. ‖ No finance team signs that."),
    (660, 840, "Writ is the financial permission layer for AI agents, built for procurement teams first."),
    (840, 1140, "AI decides what to buy. ‖ Writ decides whether it may spend: thirteen rules, no model. ‖ PayPal enforces it."),
    (1140, 1317, "A real mission. A hundred dollars, ‖ ask me above fifteen."),
    (1317, 1491, "Gemini on Vertex AI drafts the clauses. ‖ Plain code checks them."),
    (1491, 1701, "I give it to a team of agents, ‖ and sign with my passkey."),
    (1701, 2053, "I approve it in PayPal. ‖ That places an authorization hold, so nothing is charged. ‖ Agents can only capture from it."),
    (2053, 2263, "Each specialist gets a narrower, signed slice. ‖ Every purchase is checked at every level."),
    (2263, 2428, "Mission done. ‖ The unspent eighty-four dollars is voided straight back."),
    (2428, 2680, "Agents pay for data too, per call. ‖ One PayPal capture settles the tab, and Payouts pays the providers."),
    (2680, 2860, "Or bring your own agent, over MCP. ‖ Same rules. Same hold."),
    (2860, 2935, "Now, the real test."),
    (2935, 3175, "A compromised agent gets a real, signed slice of this hold, ‖ and orders to steal."),
    (3175, 3347, "Poisoned listings. ‖ Fake storefronts. ‖ Stolen budgets."),
    (3347, 3625, "Sixteen attacks. ‖ Sixteen blocked. ‖ And PayPal's own API confirms: ‖ zero dollars moved."),
    (3625, 3835, "Even an AI told to break the rules improvises, and gets the same answer."),
    (3835, 4025, "Every clause is crash-tested at its edge, ‖ and Writ signs an assurance certificate."),
    (4025, 4355, "One tap revokes every agent. ‖ Void. ‖ PayPal releases the whole hold."),
    (4355, 4550, "When something goes wrong, Forensics rebuilds the evidence. ‖ The data provider is at fault."),
    (4550, 4790, "I approve the refund. It runs through PayPal's Agent Toolkit."),
    (4790, 4985, "Every cent, every verdict, on the record. ‖ Sandbox money. Real PayPal calls."),
    (4985, 5225, "Writ. ‖ Your AI can shop. ‖ It can't overspend."),
]
LEAD = 0.30  # seconds after the cut before the voice starts
TAIL = 0.35  # keep clear of the next cut
GAP = 0.34  # pause for "‖"


def sh(*a):
    return subprocess.run(a, check=True, capture_output=True, text=True).stdout.strip()


def dur(f):
    return float(sh("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f))


TOKEN = sh("gcloud", "auth", "print-access-token")


def synth(text, path):
    if os.path.exists(path):
        return
    body = json.dumps({
        "input": {"text": text},
        "voice": {"languageCode": "en-US", "name": f"en-US-Chirp3-HD-{VOICE}"},
        "audioConfig": {"audioEncoding": "LINEAR16", "sampleRateHertz": 48000},
    }).encode()
    req = urllib.request.Request("https://texttospeech.googleapis.com/v1/text:synthesize", data=body, headers={
        "Authorization": f"Bearer {TOKEN}", "x-goog-user-project": PROJECT, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        open(path, "wb").write(base64.b64decode(json.load(r)["audioContent"]))


placed = []
silence = os.path.join(WORK, "gap.wav")
sh("ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", f"anullsrc=r=48000:cl=mono", "-t", str(GAP), silence)
for i, (a, b, text) in enumerate(LINES, 1):
    parts = [p.strip() for p in text.split("‖")]
    files = []
    for j, p in enumerate(parts):
        f = os.path.join(WORK, f"l{i:02d}-{j}.wav")
        synth(p, f)
        # trim leading/trailing silence the engine adds, so our pauses are the only pauses
        t = os.path.join(WORK, f"l{i:02d}-{j}-t.wav")
        sh("ffmpeg", "-y", "-loglevel", "error", "-i", f, "-af",
           "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.06,areverse",
           "-ac", "1", "-ar", "48000", t)
        files += ([silence] if j else []) + [t]
    lst = os.path.join(WORK, f"l{i:02d}.txt")
    open(lst, "w").write("".join(f"file '{x}'\n" for x in files))
    line = os.path.join(WORK, f"l{i:02d}.wav")
    sh("ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", line)
    avail = (b - a) / FPS - LEAD - TAIL
    d = dur(line)
    tempo = 1.0
    if d > avail:
        tempo = min(1.06, d / avail)
        fitted = os.path.join(WORK, f"l{i:02d}-fit.wav")
        sh("ffmpeg", "-y", "-loglevel", "error", "-i", line, "-af", f"atempo={tempo:.4f}", fitted)
        line, d = fitted, dur(fitted)
    status = "OVER" if d > avail + 0.05 else "ok"
    print(f"{i:02d} {a / FPS:6.2f}s  {d:5.2f}s / {avail:5.2f}s  tempo {tempo:.2f}  {status}  {text[:50]}")
    placed.append((a / FPS + LEAD, line))

# Mix: each line at its time, a light broadcast chain (warmth, presence, gentle compression), loudness to -16 LUFS.
inputs = ["-i", FILM]
chain = []
for k, (t, f) in enumerate(placed, 1):
    inputs += ["-i", f]
    ms = int(round(t * 1000))
    chain.append(f"[{k}:a]adelay={ms}|{ms}[v{k}]")
labels = "".join(f"[v{k}]" for k in range(1, len(placed) + 1))
chain.append(f"{labels}amix=inputs={len(placed)}:normalize=0,highpass=f=70,equalizer=f=180:t=q:w=1:g=1.5,equalizer=f=3500:t=q:w=1.2:g=2,acompressor=threshold=-18dB:ratio=2.5:attack=8:release=150,loudnorm=I=-16:TP=-1.5:LRA=9[vo]")
final = os.path.join(OUT, f"writ-final-{VOICE}.mp4")
sh("ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", ";".join(chain), "-map", "0:v", "-map", "[vo]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", final)
print("→", final, f"{dur(final):.2f}s")
