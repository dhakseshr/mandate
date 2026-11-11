#!/usr/bin/env bash
# Mix voiceover takes from the booth onto the film, each at the film time in its file name.
#   ./mix.sh ~/Downloads/writ-vo-*.webm
# A take named writ-vo-line07_at37200ms.webm starts at 37.200 s. Later takes of the same line replace earlier ones;
# line takes override the same span of a full take. Output: out/writ-final.mp4
set -euo pipefail
cd "$(dirname "$0")"
FILM="${FILM:-out/writ-v3.mp4}"
[ $# -gt 0 ] || { echo "usage: ./mix.sh takes..."; exit 1; }

# Keep only the newest take per line (by modification time); a full take is used underneath everything.
declare -A latest
for f in "$@"; do
  key=$(basename "$f" | sed -E 's/_at[0-9]+ms\.webm$//')
  if [ -z "${latest[$key]:-}" ] || [ "$f" -nt "${latest[$key]}" ]; then latest[$key]="$f"; fi
done

inputs=(-i "$FILM"); filters=""; labels=""; n=1
for key in "${!latest[@]}"; do
  f="${latest[$key]}"
  ms=$(basename "$f" | sed -E 's/.*_at([0-9]+)ms\.webm$/\1/')
  inputs+=(-i "$f")
  # Clean up: high-pass rumble, gentle compression, then place at its film time.
  filters+="[$n:a]highpass=f=80,acompressor=threshold=-20dB:ratio=3:attack=5:release=120,adelay=${ms}|${ms}[a$n];"
  labels+="[a$n]"; n=$((n + 1))
done
count=$((n - 1))
filters+="${labels}amix=inputs=${count}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[vo]"

ffmpeg -y "${inputs[@]}" -filter_complex "$filters" -map 0:v -map "[vo]" -c:v copy -c:a aac -b:a 192k -shortest out/writ-final.mp4
echo "→ out/writ-final.mp4"
