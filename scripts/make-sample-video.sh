#!/usr/bin/env bash
# Generates the labelled SAMPLE VIDEO used for demo playback (no third-party footage).
# Outputs into public/media/sample: WebM (VP9/Opus), HLS (H.264/AAC in MPEG-TS) and WebVTT subtitles.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=public/media/sample
mkdir -p "$OUT/hls"
DUR=${DUR:-96}
FONT=/usr/share/fonts/opentype/inter/Inter-Bold.otf
FONT_R=/usr/share/fonts/opentype/inter/Inter-Regular.otf
[ -f "$FONT" ] || FONT=$(fc-match -f '%{file}' 'sans:bold')
[ -f "$FONT_R" ] || FONT_R=$(fc-match -f '%{file}' 'sans')

VF="[0:v]format=yuv420p,
drawbox=x=0:y=ih*0.82:w=iw:h=ih*0.18:color=black@0.35:t=fill,
drawtext=fontfile=$FONT:text='SAMPLE VIDEO':fontsize=h/9:fontcolor=white:x=(w-text_w)/2:y=h*0.34,
drawtext=fontfile=$FONT_R:text='Demo playback - not the selected programme':fontsize=h/26:fontcolor=white@0.8:x=(w-text_w)/2:y=h*0.5,
drawtext=fontfile=$FONT_R:text='%{pts\:hms}':fontsize=h/22:fontcolor=white@0.9:x=w*0.06:y=h*0.88,
drawtext=fontfile=$FONT_R:text='Generated test signal':fontsize=h/30:fontcolor=white@0.6:x=w*0.94-text_w:y=h*0.885"

SRC="gradients=s=1280x720:c0=0x0b1a3a:c1=0x3a1d5c:c2=0x0e3b4a:c3=0x1a0f2e:nb_colors=4:speed=0.012:duration=$DUR:rate=25"

ffmpeg -y -hide_banner -loglevel error -f lavfi -i "$SRC" -f lavfi -i "sine=frequency=220:duration=$DUR:sample_rate=48000" \
  -filter_complex "$VF[v];[1:a]volume=0.04,tremolo=f=0.5:d=0.4[a]" -map "[v]" -map "[a]" \
  -c:v libvpx-vp9 -b:v 300k -deadline good -cpu-used 4 -row-mt 1 -g 50 -c:a libopus -b:a 64k "$OUT/sample.webm"

ffmpeg -y -hide_banner -loglevel error -f lavfi -i "$SRC" -f lavfi -i "sine=frequency=220:duration=$DUR:sample_rate=48000" \
  -filter_complex "$VF[v];[1:a]volume=0.04,tremolo=f=0.5:d=0.4[a]" -map "[v]" -map "[a]" \
  -c:v libx264 -profile:v main -preset veryfast -b:v 350k -g 50 -keyint_min 50 -sc_threshold 0 -c:a aac -b:a 64k \
  -movflags +faststart "$OUT/sample.mp4"

ffmpeg -y -hide_banner -loglevel error -i "$OUT/sample.mp4" -c copy -f hls -hls_time 4 -hls_playlist_type vod \
  -hls_segment_filename "$OUT/hls/segment_%03d.ts" "$OUT/hls/index.m3u8"
# The MP4 is only an intermediate for the HLS packager.
rm -f "$OUT/sample.mp4"

# Sample subtitles (English + French) — clearly marked as demo captions.
node -e '
const fs=require("fs");const dur=+process.argv[1];
const fmt=s=>{const h=String(Math.floor(s/3600)).padStart(2,"0"),m=String(Math.floor(s%3600/60)).padStart(2,"0"),x=String(Math.floor(s%60)).padStart(2,"0");return `${h}:${m}:${x}.000`;};
const lines={en:["[Sample subtitles] This is a generated demo video.","Playback, seeking and subtitles work as they would for a real stream.","Use left and right to seek, OK to pause.","Progress is saved so you can resume later.","[Sample subtitles] Thanks for watching."],
fr:["[Sous-titres de démonstration] Ceci est une vidéo de test.","La lecture, la recherche et les sous-titres fonctionnent normalement.","Gauche et droite pour avancer ou reculer, OK pour mettre en pause.","La progression est enregistrée pour reprendre plus tard.","[Sous-titres de démonstration] Merci."]};
for(const [lang,arr] of Object.entries(lines)){let out="WEBVTT\n\n";let i=0;for(let t=2;t<dur-2;t+=8){out+=`${fmt(t)} --> ${fmt(t+5)}\n${arr[i++%arr.length]}\n\n`;}fs.writeFileSync(`public/media/sample/sample.${lang}.vtt`,out);}
' "$DUR"
ls -la "$OUT" "$OUT/hls" | head -40
