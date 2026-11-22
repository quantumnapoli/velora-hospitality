#!/usr/bin/env bash
# Converte le clip della storia (stampa 3D → logo → suite) in fotogrammi WebP per la hero guidata dallo scroll.
# Uso: scripts/build-sequence.sh clip1.mp4 clip2.mp4 clip3.mp4
# Output: public/sequence/NNNN.webp e src/sequence.json
set -euo pipefail
FPS=${FPS:-10}          # fotogrammi per secondo di video (≈ quante immagini per tratto di scroll)
WIDTH=${WIDTH:-1600}    # larghezza dei fotogrammi
QUALITY=${QUALITY:-72}
OUT=public/sequence
[ "$#" -ge 1 ] || { echo "uso: $0 clip1.mp4 [clip2.mp4 ...]"; exit 1; }
rm -rf "$OUT" && mkdir -p "$OUT"
inputs=(); filters=""
for i in $(seq 0 $(($# - 1))); do inputs+=(-i "${@:$((i + 1)):1}"); filters+="[$i:v:0]fps=30,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1[v$i];"; done
for i in $(seq 0 $(($# - 1))); do filters+="[v$i]"; done
filters+="concat=n=$#:v=1:a=0,fps=$FPS,scale=$WIDTH:-2:flags=lanczos[out]"
ffmpeg -hide_banner -loglevel error -y "${inputs[@]}" -filter_complex "$filters" -map "[out]" \
  -c:v libwebp -quality "$QUALITY" -compression_level 6 -preset photo "$OUT/%04d.webp"
COUNT=$(ls "$OUT" | wc -l)
SIZE=$(identify -format '%w %h' "$OUT/0001.webp" 2>/dev/null || python3 -c "from PIL import Image;print(*Image.open('$OUT/0001.webp').size)")
printf '{ "path": "/sequence", "count": %d, "width": %d, "height": %d }\n' "$COUNT" ${SIZE} > src/sequence.json
echo "$COUNT fotogrammi, $(du -sh "$OUT" | cut -f1)"
