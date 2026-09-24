#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
R="$ROOT/.tmp/re-mine"
DST="$ROOT/docker/ctf-contests/batch58-mix"
rm -rf "$DST"; mkdir -p "$DST"
cp_one() { mkdir -p "$DST/$2"; cp -r "$1/." "$DST/$2/"; }

cp_one "$R/X1cT34m_0xGame2022/Web/week3/ssrf_me" 0xg2022-ssrf-me
cp_one "$R/X1cT34m_0xGame2022/Web/week3/think_about_php" 0xg2022-think-about-php
cp_one "$R/X1cT34m_0xGame2022/Web/week4/profile" 0xg2022-profile
cp_one "$R/X1cT34m_0xGame2024/Web/Week 3/cargo_shop" 0xg2024-cargo-shop
cp_one "$R/X1cT34m_0xGame2024/Web/Week 3/next-db" 0xg2024-next-db
cp_one "$R/X1cT34m_0xGame2024/Web/Week 3/paste_bin" 0xg2024-paste-bin

find "$DST" -type f \( -name "*.sh" -o -name "Dockerfile" -o -name "dockerfile" -o -name "*.py" -o -name "*.rs" \) -exec sed -i 's/\r$//' {} +
echo "== batch58 放置完成 =="
grep -rhoE "0xGame\{[^}]+\}" "$DST" | sort -u | head -8
