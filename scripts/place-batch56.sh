#!/usr/bin/env bash
# batch56: GeekGame(4th copy/memos, 5th graphauth) + 0xGame2023 六题
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
G4="$ROOT/.tmp/b52-mine/PKU-GeekGame_geekgame-4th/official_writeup"
G5="$ROOT/.tmp/b52-mine/PKU-GeekGame_geekgame-5th/official_writeup"
G3="$ROOT/.tmp/b52-mine/PKU-GeekGame_geekgame-3rd/official_writeup"
ZG="$ROOT/.tmp/re-mine/X1cT34m_0xGame2023/Web"
DST="$ROOT/docker/ctf-contests"
rm -rf "$DST/batch56-mix"; mkdir -p "$DST/batch56-mix"

# 1. GeekGame 4th web-copy (flask 反复制, port 5000, flag 内置 flag.py)
mkdir -p "$DST/batch56-mix/geekgame4-web-copy"
cp -r "$G4/web-copy/game/." "$DST/batch56-mix/geekgame4-web-copy/"

# 2. GeekGame 4th web-memos (memos, port 5230, 需补 /flag)
mkdir -p "$DST/batch56-mix/geekgame4-web-memos"
cp -r "$G4/web-memos/game/." "$DST/batch56-mix/geekgame4-web-memos/"
printf 'geekgame{mem0s_sql1te_x55_dump}\n' > "$DST/batch56-mix/geekgame4-web-memos/flag"
sed -i 's|^COPY memos_prod.db /tmp/memos_prod.db|COPY flag /flag\nCOPY memos_prod.db /tmp/memos_prod.db|' "$DST/batch56-mix/geekgame4-web-memos/Dockerfile"

# 3. GeekGame 5th web-graphauth (python, 读 /flag1)
mkdir -p "$DST/batch56-mix/geekgame5-web-graphauth"
cp -r "$G5/web-graphauth/game/." "$DST/batch56-mix/geekgame5-web-graphauth/"
printf 'geekgame{graphauth_jwt_pl4ygr0und}\n' > "$DST/batch56-mix/geekgame5-web-graphauth/flag1"
printf 'geekgame{graphauth_flag2_hidden}\n' > "$DST/batch56-mix/geekgame5-web-graphauth/flag2"
grep -q "COPY flag1" "$DST/batch56-mix/geekgame5-web-graphauth/Dockerfile" || printf 'COPY flag1 /flag1\nCOPY flag2 /flag2\n' >> "$DST/batch56-mix/geekgame5-web-graphauth/Dockerfile"

# 4-9. 0xGame2023 六题 (zip_file_manager flag 已内置; rss_parser/auth_bypass 双阶段 readflag)
for pair in "Week 2/ez_sqli:0xg2023-ez-sqli" "Week 3/rss_parser:0xg2023-rss-parser" "Week 3/web_snapshot:0xg2023-web-snapshot" "Week 3/zip_file_manager:0xg2023-zip-file-manager" "Week 4/TestConnection:0xg2023-testconnection" "Week 4/YourBatis:0xg2023-yourbatis" "Week 4/auth_bypass:0xg2023-auth-bypass"; do
  src="${pair%%:*}"; id="${pair##*:}"
  mkdir -p "$DST/batch56-mix/$id"
  cp -r "$ZG/$src/." "$DST/batch56-mix/$id/"
done

find "$DST/batch56-mix" -type f \( -name "*.sh" -o -name "Dockerfile" -o -name "dockerfile" -o -name "*.py" \) -exec sed -i 's/\r$//' {} +
echo "== batch56 放置完成 =="
ls "$DST/batch56-mix"
