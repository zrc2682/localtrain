#!/usr/bin/env bash
# batch54: SUCTF-2025 (5) + DubheCTF-2024 (2) + n1ctf-2025 (2)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
M="$ROOT/.tmp/b52-mine"
DST="$ROOT/docker/ctf-contests"
rm -rf "$DST/suctf2025" "$DST/dubhectf2024" "$DST/n1ctf2025"

# ---------- SUCTF-2025 (env/ 即 context) ----------
for pair in "sujava:suctf2025-sujava" "SU_blog:suctf2025-su-blog" "SU_DOTNET:suctf2025-su-dotnet" "SU_photogallery:suctf2025-su-photogallery" "SU_POP:suctf2025-su-pop"; do
  src="${pair%%:*}"; id="${pair##*:}"
  mkdir -p "$DST/suctf2025/$id"
  cp -r "$M/team-su_SUCTF-2025/web/$src/env/." "$DST/suctf2025/$id/"
done
# photogallery: ENV FLAG=SUCTF{} → 真实 flag
sed -i 's|ENV FLAG=SUCTF{}|ENV FLAG=SUCTF{sti1l_w0t3r_Run_d@@p!!!}|' "$DST/suctf2025/suctf2025-su-photogallery/Dockerfile"

# ---------- DubheCTF 2024 ----------
mkdir -p "$DST/dubhectf2024/dubhe2024-tagebuch"
for f in Dockerfile package.json pnpm-lock.yaml pnpm-workspace.yaml frontend; do
  cp -r "$M/mix-archive_Tagebuch/$f" "$DST/dubhectf2024/dubhe2024-tagebuch/"
done
# 去掉 cloudflared 隧道容器, 单容器直接暴露 80; 注入 flag
printf '\nENV FLAG=flag{dubhe2024_t4gebuch_n0de_ssr1f}\nEXPOSE 80\n' >> "$DST/dubhectf2024/dubhe2024-tagebuch/Dockerfile"

mkdir -p "$DST/dubhectf2024/dubhe2024-vulntagger"
for f in Dockerfile entrypoint.sh bot.py pyproject.toml pdm.lock readflag.c restart.c checkpoints src; do
  [ -e "$M/mix-archive_VulnTagger/$f" ] && cp -r "$M/mix-archive_VulnTagger/$f" "$DST/dubhectf2024/dubhe2024-vulntagger/"
done
sed -i 's|echo -n \$FLAG > /flag|echo -n flag{dubhe2024_vulntagg3r_gguf_rce} > /flag|' "$DST/dubhectf2024/dubhe2024-vulntagger/entrypoint.sh"

# ---------- n1ctf-2025 ----------
mkdir -p "$DST/n1ctf2025/n1ctf2025-eezzjs" "$DST/n1ctf2025/n1ctf2025-n1cat"
cp -r "$M/Nu1LCTF_n1ctf-2025/web/eezzjs/." "$DST/n1ctf2025/n1ctf2025-eezzjs/"
cp -r "$M/Nu1LCTF_n1ctf-2025/web/n1cat/." "$DST/n1ctf2025/n1ctf2025-n1cat/"
sed -i 's|  echo \$FLAG > /flag|  echo n1ctf{eezz_js_ez_readfile} > /flag|' "$DST/n1ctf2025/n1ctf2025-eezzjs/start.sh"
sed -i 's|  echo \$FLAG > /flag|  echo n1ctf{n1cat_t0mc4t_rewr1te_ssrf} > /flag|' "$DST/n1ctf2025/n1ctf2025-n1cat/start.sh"

# CRLF 清理
find "$DST/suctf2025" "$DST/dubhectf2024" "$DST/n1ctf2025" -type f \( -name "*.sh" -o -name "Dockerfile" -o -name "*.py" -o -name "*.c" \) -exec sed -i 's/\r$//' {} +
echo "== batch54 放置完成 =="
grep -h "FLAG" "$DST/suctf2025/suctf2025-su-photogallery/Dockerfile" | head -1
grep -h "flag" "$DST/dubhectf2024/dubhe2024-vulntagger/entrypoint.sh" | head -2
grep -h "n1ctf" "$DST/n1ctf2025/"*/start.sh
