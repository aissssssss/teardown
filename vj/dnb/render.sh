#!/bin/bash
# Renders the 105 s DnB show segment by segment on the track's clock and joins them with transitions on the phrase
# boundaries (172.2 BPM, 8 bars = 11.15 s). Each segment runs 0.7 s past its cut so the crossfade has frames to blend.
set -e
cd /home/user/teardown
O=/tmp/claude-0/dnbseg; mkdir -p $O
D=1.4
SEGS=(
 "show.html 0 22.5 -"
 "dots2.html 22.5 33.66 dissolve"
 "lib-0.html 33.66 44.8 dissolve"
 "show.html 44.8 55.95 fadewhite"
 "lib-2.html 55.95 67.1 dissolve"
 "lib-3.html 67.1 78.25 dissolve"
 "lib-1.html 78.25 83.8 dissolve"
 "kifs.html 83.8 89.4 dissolve"
 "show.html 89.4 105.2 fadewhite"
)
i=0
for s in "${SEGS[@]}"; do
  set -- $s
  end=$3; [ $i -lt 8 ] && end=$(python3 -c "print($3+$D)")
  [ -f $O/seg$i.mp4 ] || TEARDOWN_OUT=/tmp/claude-0/out node sims/capture.mjs vj/dnb/$1 --size 1080x1920 --dpr 1 --fps 60 --from $2 --to $end --out $O/seg$i.mp4 > $O/seg$i.log 2>&1
  echo "seg$i done"; i=$((i+1))
done
# xfade chain: the transition into segment k starts at its cut time
args=(); filt=""; prev="[0:v]"
for k in $(seq 0 8); do args+=(-i $O/seg$k.mp4); done
k=1
for s in "${SEGS[@]:1}"; do
  set -- $s
  filt+="${prev}[$k:v]xfade=transition=$4:duration=$D:offset=$2[v$k];"; prev="[v$k]"; k=$((k+1))
done
filt+="${prev}fade=t=out:st=103.2:d=2[vout]"
ffmpeg -v error -y "${args[@]}" -i /tmp/claude-0/dnb/track.mp4 -filter_complex "$filt" -map "[vout]" -map 9:a -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a aac -b:a 256k -shortest -movflags +faststart vj/dnb/dnb-show-105s-master.mp4
ffmpeg -v error -y -i vj/dnb/dnb-show-105s-master.mp4 -c:v libx264 -preset slow -b:v 6800k -maxrate 8500k -bufsize 14M -pix_fmt yuv420p -c:a copy -movflags +faststart vj/dnb/dnb-show-105s-hd.mp4
ls -la vj/dnb/*.mp4
