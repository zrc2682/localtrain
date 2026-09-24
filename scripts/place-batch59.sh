#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
R="$ROOT/.tmp/re-mine"
G4="$ROOT/.tmp/b52-mine/PKU-GeekGame_geekgame-4th/official_writeup"
DST="$ROOT/docker/ctf-contests/batch59-mix"
rm -rf "$DST"; mkdir -p "$DST"
cp_one() { mkdir -p "$DST/$2"; cp -r "$1/." "$DST/$2/"; }

# miniL2024
cp_one "$R/XDSEC_miniLCTF_2024/Challenges/SmartPark-Revenge" minil2024-smartpark-revenge
# NoHackNoCTF 2025
cp_one "$R/William957-web_My-CTF-Challenges/NoHackNoCTF/2025/Web/xxs-xss" nohacknoctf2025-xxs-xss
# NCKUCTF 2024
cp_one "$R/William957-web_My-CTF-Challenges/NCKUCTF/2024/NCKU-DOUBLE-EXPLOIT-main" nckuctf2024-double-exploit
# owasp2025 A01 三难度
for t in easy medium hard; do cp_one "$R/ProbiusOfficial_owasp2025-top10-ctf/A01-BrokenAccessControl/$t" "owasp2025-a01-$t"; done
# susctf2024 sandbox
cp_one "$R/susers_susctf-2024/challenges/web/sandbox/build" susctf2024-sandbox
# GeekGame4 web-crx（源码在 attachment 内）
cp_one "$G4/web-crx/attachment/web-crx-src" geekgame4-web-crx

find "$DST" -type f \( -name "*.sh" -o -name "Dockerfile" -o -name "dockerfile" -o -name "*.py" \) -exec sed -i 's/\r$//' {} +
echo "== batch59 放置完成 =="
echo "== flag 线索 =="
grep -rn "flag{" "$DST/nohacknoctf2025-xxs-xss/app.py" | head -2
cat "$DST/minil2024-smartpark-revenge/flag" 2>/dev/null | head -1
grep -rn "flag" "$DST/geekgame4-web-crx/flag_server.py" 2>/dev/null | head -2
grep -rn "FLAG\|flag" "$DST/susctf2024-sandbox/run.sh" "$DST/susctf2024-sandbox/Dockerfile" -i 2>/dev/null | head -4
grep -rn "EXPOSE\|5000\|3000\|8080" "$DST/nckuctf2024-double-exploit/Dockerfile" "$DST/owasp2025-a01-easy/Dockerfile" 2>/dev/null | head -5
