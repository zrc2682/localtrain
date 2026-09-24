#!/usr/bin/env bash
# batch55: n1ctf2023-ezmaria, n1ctf2022-do-not-touch, aliyunctf2023-ezbean,
#          nepctf2026-挂钩, hgame2025-ayanews, vnctf2024-onlylocalsql
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
M="$ROOT/.tmp/b52-mine"
DST="$ROOT/docker/ctf-contests"
rm -rf "$DST/batch55-mix"; mkdir -p "$DST/batch55-mix"

# 1. ezmaria (httpd+maria+php 单容器, port 80)
mkdir -p "$DST/batch55-mix/n1ctf2023-ezmaria"
cp -r "$M/Nu1LCTF_n1ctf-2023/web/ezmaria/environment/app/." "$DST/batch55-mix/n1ctf2023-ezmaria/"
sed -i 's|echo \$FLAG > /flag|echo n1ctf{e5mar1a_sqli_ch4ll3nge} > /flag|' "$DST/batch55-mix/n1ctf2023-ezmaria/files/start.sh"
sed -i 's/FLAG{ISHERE}/n1ctf{e5mar1a_sqli_ch4ll3nge}/g' "$DST/batch55-mix/n1ctf2023-ezmaria/files/init.sql" 2>/dev/null || true

# 2. do-not-touch-my-localhost (go+archlinux+caddy, port 8888)
mkdir -p "$DST/batch55-mix/n1ctf2022-do-not-touch-my-localhost"
cp -r "$M/Nu1LCTF_n1ctf-2022/Web/do-not-touch-my-localhost/source/." "$DST/batch55-mix/n1ctf2022-do-not-touch-my-localhost/"
sed -i 's|echo \$flag > /flag|echo n1ctf{d0_n0t_t0uch_my_l0calh0st} > /flag|' "$DST/batch55-mix/n1ctf2022-do-not-touch-my-localhost/start.sh"

# 3. ezbean (tomcat, port 8080, flag 静态)
mkdir -p "$DST/batch55-mix/aliyunctf2023-ezbean"
cp -r "$M/LFYSec_aliyunctf-ezbean/files/." "$DST/batch55-mix/aliyunctf2023-ezbean/"

# 4. 挂钩都在干什么呢 (vite node, port 5173)
mkdir -p "$DST/batch55-mix/nepctf2026-goupan"
cp -r "$M/skymansoul_NepCTF-2026/web/挂钩都在干什么呢/ni_zhen_de_xu_yao_zhe_ge_ma_/." "$DST/batch55-mix/nepctf2026-goupan/"
sed -i 's|echo \$FLAG > /flag|echo nepctf{nep_h00k_all_the_things} > /flag|' "$DST/batch55-mix/nepctf2026-goupan/docker-entrypoint.sh"

# 5. AyaNews (rust+node+bot supervisord, port 5173)
mkdir -p "$DST/batch55-mix/hgame2025-ayanews"
for f in backend bot config frontend docker-entrypoint.sh README.md; do cp -r "$M/HGAME-2025-Web-AyaNews/$f" "$DST/batch55-mix/hgame2025-ayanews/" 2>/dev/null || true; done
cp "$M/HGAME-2025-Web-AyaNews/dockerfile" "$DST/batch55-mix/hgame2025-ayanews/Dockerfile"
printf '\nENV FLAG=hgame{ay4_news_xss_b0t_2025}\nEXPOSE 5173\n' >> "$DST/batch55-mix/hgame2025-ayanews/Dockerfile"
sed -i '/unset FLAG/d' "$DST/batch55-mix/hgame2025-ayanews/docker-entrypoint.sh"

# 6. VNCTF OnlyLocalSql (nginx+php+mysql, DASFLAG env)
mkdir -p "$DST/batch55-mix/vnctf2024-onlylocalsql"
cp -r "$M/CTF-Archives_2024-VNCTF-OnlyLocalSql/." "$DST/batch55-mix/vnctf2024-onlylocalsql/"
rm -rf "$DST/batch55-mix/vnctf2024-onlylocalsql/.git"
printf '\nENV DASFLAG=flag{0nly_l0cal_sql_1s_n0t_s4fe}\n' >> "$DST/batch55-mix/vnctf2024-onlylocalsql/Dockerfile"

# CRLF 清理
find "$DST/batch55-mix" -type f \( -name "*.sh" -o -name "Dockerfile" -o -name "*.py" \) -exec sed -i 's/\r$//' {} +
echo "== batch55 放置完成 =="
grep -h "n1ctf\|nepctf\|hgame{" "$DST/batch55-mix/"*/start.sh "$DST/batch55-mix/"*/docker-entrypoint.sh 2>/dev/null | head -5
grep -E "EXPOSE" "$DST/batch55-mix/vnctf2024-onlylocalsql/Dockerfile" | head -2
