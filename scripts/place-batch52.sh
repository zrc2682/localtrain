#!/usr/bin/env bash
# batch52: 放置 SUCTF-2026 七题源码到 docker/ctf-contests/suctf2026/
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/.tmp/b52-mine/team-su_SUCTF-2026/web"
DST="$ROOT/docker/ctf-contests/suctf2026"
rm -rf "$DST"; mkdir -p "$DST"

place_webdeploy() { # $1=题目目录 $2=目标id
  mkdir -p "$DST/$2"
  cp -r "$SRC/$1/env/web_deploy/." "$DST/$2/"
}
place_env() { # SU_Thief: env 整体即 context
  mkdir -p "$DST/$2"
  cp -r "$SRC/$1/env/." "$DST/$2/"
}

# 1. SU-Note (php+apache+bot, port 80)
place_webdeploy SU-Note suctf2026-su-note
# 2. SU-Note-rev (同上变体, port 80)
place_webdeploy SU-Note-rev suctf2026-su-note-rev
# 3. SU_Thief (grafana+caddy, port 80, flag 已在 Dockerfile 构建期写入)
place_env SU_Thief suctf2026-su-thief
# 4. SU_cmsAgain (ubuntu apache php+mysql 同容器; Dockerfile 在 env/, context 为题目根)
mkdir -p "$DST/suctf2026-su-cmsagain"
cp "$SRC/SU_cmsAgain/env/Dockerfile" "$DST/suctf2026-su-cmsagain/"
cp "$SRC/SU_cmsAgain/env/start.sh" "$DST/suctf2026-su-cmsagain/env_start.sh" 2>/dev/null || true
mkdir -p "$DST/suctf2026-su-cmsagain/env/data"
cp -r "$SRC/SU_cmsAgain/env/data/." "$DST/suctf2026-su-cmsagain/env/data/"
mkdir -p "$DST/suctf2026-su-cmsagain/sourcecode"
cp -r "$SRC/SU_cmsAgain/sourcecode/code" "$DST/suctf2026-su-cmsagain/sourcecode/code"
# start.sh 引用路径修正: Dockerfile COPY ./env/start.sh
cp "$SRC/SU_cmsAgain/env/start.sh" "$DST/suctf2026-su-cmsagain/env/start.sh"
# 5. SU_jdbc-master (java8, port 8080, /flag)
place_webdeploy SU_jdbc-master suctf2026-su-jdbc-master
# 6. SU_sqli (go+postgres 同容器, port 8080) + 换 GOPROXY + 注入 flag
place_webdeploy SU_sqli suctf2026-su-sqli
sed -i 's|GOPROXY=https://proxy.golang.org,direct|GOPROXY=https://goproxy.cn,direct|; s|GOSUMDB=sum.golang.org|GOSUMDB=|' "$DST/suctf2026-su-sqli/Dockerfile"
printf 'flag{g0_pg_sqli_1n_suctf2026}\n' > "$DST/suctf2026-su-sqli/bin/flag"
# 7. SU_uri (go 多阶段→alpine, port 8080, readflag)
place_webdeploy SU_uri suctf2026-su-uri

# CRLF 清理 + 可执行位
find "$DST" -type f \( -name "*.sh" -o -name "entrypoint*" -o -name "pushflag*" \) -exec sed -i 's/\r$//' {} +
find "$DST" -type f -name "*.py" -exec sed -i 's/\r$//' {} + 2>/dev/null || true
echo "== 放置完成 =="
for d in "$DST"/*/; do echo "$d: $(ls "$d" | head -5 | tr '\n' ' ')"; done
