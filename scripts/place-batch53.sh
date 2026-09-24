#!/usr/bin/env bash
# batch53: miniLCTF2026 (6) + LitCTF2026 (5) 源码放置 + flag 构建期硬编码
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MINIL="$ROOT/.tmp/b52-mine/XDSEC_miniLCTF_2026/Challenges/Web"
LIT="$ROOT/.tmp/b52-mine/ProbiusOfficial_LitCTF2026"
DST="$ROOT/docker/ctf-contests"
rm -rf "$DST/minil2026" "$DST/litctf2026"

# ---------- miniL2026 ----------
mk() { mkdir -p "$DST/minil2026/$1"; cp -r "$MINIL/$2/." "$DST/minil2026/$1/"; }
mk suctf-ezping EzPing
mk suctf-ezomniprobe EzOmniprobe
mk suctf-ezjvav Ezjvav
mk suctf-hdphp Hdphp
mk suctf-ezff ezff
mk suctf-boli-omikuji 博丽神社的御神签

# flag 硬编码（原题为运行时 FLAG env，平台不注入 → 改为写死）
F_EZPING='miniL{p1ng_1s_p0werful_2026}'
F_OMNI='miniL{0mn1_pr0be_3scalat10n}'
F_EZJVAV='miniL{j4va_rust_hybrid_s3cret}'
F_HDPHP='miniL{hd_php_master_2026}'
F_EZFF='miniL{ff_jar_pr0tect_1s_n0t_s4fe}'
F_BOLI='miniL{p0stgre5t_0m1kuji_2026}'

sed -i "s|FLAG=\${FLAG:-\"flag{default_flag_here}\"}|FLAG=\"$F_EZPING\"|" "$DST/minil2026/suctf-ezping/entrypoint.sh"
sed -i "s|FLAG=\${FLAG:-\"flag{default_flag_here}\"}|FLAG=\"$F_OMNI\"|" "$DST/minil2026/suctf-ezomniprobe/entrypoint.sh"
sed -i "s|SECRET_VALUE=\${SECRET:-\${FLAG:-\"ezjvav_dev_placeholder\"}}|SECRET_VALUE=\"$F_EZJVAV\"|" "$DST/minil2026/suctf-ezjvav/entrypoint.sh"
sed -i "s|echo \$FLAG > /flag|echo $F_HDPHP > /flag|" "$DST/minil2026/suctf-hdphp/entrypo1nt.sh"
sed -i "s|FLAG=\${FLAG:-\"flag{default_flag_here}\"}|FLAG=\"$F_EZFF\"|" "$DST/minil2026/suctf-ezff/entrypoint.sh"
# 博丽: echo "$FLAG" > "/tmp/therealflag_$(echo $FLAG | sha3sum ...)" — FLAG 出现两处
sed -i "s|echo \"\$FLAG\" > \"/tmp/therealflag_\$(echo \$FLAG \| sha3sum -a 512 \| head -c 32)\"|echo \"$F_BOLI\" > \"/tmp/therealflag_\$(printf %s \"$F_BOLI\" \| sha3sum -a 512 \| head -c 32)\"|" "$DST/minil2026/suctf-boli-omikuji/build_assets/start.sh"

# ---------- LitCTF2026 (context=docker/) ----------
for c in Web-Northbridge_Document_Hub Web-ezsql Web-ezssti Web-reverseMyWeb Web-华辰企业服务运营平台; do
  case "$c" in
    Web-Northbridge_Document_Hub) id=litctf2026-northbridge; flag='flag{kkfileview_audit_read_history_then_download}' ;;
    Web-ezsql)                    id=litctf2026-ezsql;       flag='flag{ezsql_uni0n_master_2026}' ;;
    Web-ezssti)                   id=litctf2026-ezssti;      flag='flag{ezssti_jinja_gadget_2026}' ;;
    Web-reverseMyWeb)             id=litctf2026-reversemyweb;flag='flag{rev_my_web_pr0tobuf}' ;;
    Web-华辰企业服务运营平台)      id=litctf2026-huachen;     flag='flag{actuator_heapdump_shiro_gcm_vertical_auth}' ;;
  esac
  mkdir -p "$DST/litctf2026/$id"
  cp -r "$LIT/$c/docker/." "$DST/litctf2026/$id/"
  # GZCTF_FLAG 构建期 ENV 注入（batch48 SUSCTF 先例）
  printf '\nENV GZCTF_FLAG=%s\n' "$flag" >> "$DST/litctf2026/$id/Dockerfile"
done

# CRLF 清理（autocrlf=true 全局开启，克隆产物全为 CRLF）
find "$DST/minil2026" "$DST/litctf2026" -type f \( -name "*.sh" -o -name "Dockerfile" -o -name "*.conf" -o -name "*.py" \) -exec sed -i 's/\r$//' {} +
echo "== batch53 放置完成 =="
echo "== flag 替换自检 =="
grep -l "$F_EZPING" "$DST/minil2026/suctf-ezping/entrypoint.sh" && grep -l "$F_EZJVAV" "$DST/minil2026/suctf-ezjvav/entrypoint.sh" && grep -c "$F_BOLI" "$DST/minil2026/suctf-boli-omikuji/build_assets/start.sh" && grep -h "GZCTF_FLAG" "$DST"/litctf2026/*/Dockerfile
