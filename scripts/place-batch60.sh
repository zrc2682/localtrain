#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
R="$ROOT/.tmp/re-mine"
DST="$ROOT/docker/ctf-contests/batch60-mix"
rm -rf "$DST"; mkdir -p "$DST"
cp_one() { mkdir -p "$DST/$2"; cp -r "$1/." "$DST/$2/"; }

declare -A FLAGS=(
  [susctf2024-noscript]="susctf{n0_scr1p7_4_0Id_5cho0l3rs_l0c4l}"
  [susctf2024-note-taking-1]="susctf{3asy_p3a5y_xs5_l0c4l}"
  [susctf2024-note-taking-2]="susctf{cl3v3r_c4ch3_r3v1sited_l0c4l}"
  [susctf2024-vote-now]="susctf{a_l1ttl3_w45m_l0c4l}"
  [susctf2024-webhook-as-a-service]="susctf{g0_f1nd_7he_1fi_l0c4l}"
)
declare -A DIRS=(
  [susctf2024-noscript]="noscript"
  [susctf2024-note-taking-1]="note_taking_1"
  [susctf2024-note-taking-2]="note_taking_2"
  [susctf2024-vote-now]="vote_now"
  [susctf2024-webhook-as-a-service]="webhook-as-a-service"
)
for id in "${!DIRS[@]}"; do
  cp_one "$R/susers_susctf-2024/challenges/web/${DIRS[$id]}/build" "$id"
  printf 'ENV FLAG=%s\n' "${FLAGS[$id]}" >> "$DST/$id/Dockerfile"
done
# NCTF2024 sqlmap-master (单容器, FLAG env → ENV 烧入)
cp_one "$R/X1cT34m_NCTF2024/Web/sqlmap-master" nctf2024-sqlmap-master
rm -f "$DST/nctf2024-sqlmap-master/sqlmap-master-attachment.zip"
printf 'ENV FLAG=NCTF{5q1m4p_m4st3r_c0d3_2024}\n' >> "$DST/nctf2024-sqlmap-master/Dockerfile"
# ISCTF2025 baby_notice_board（历史构建失败重试）
cp_one "$R/LamentXU123_myCTFchallenges/ISCTF 2025/baby_notice_board" isctf2025-baby-notice-board

find "$DST" -type f \( -name "*.sh" -o -name "Dockerfile" -o -name "dockerfile" -o -name "*.py" -o -name "*.c" -o -name "*.go" \) -exec sed -i 's/\r$//' {} +
echo "== batch60 放置完成 =="
ls "$DST"
