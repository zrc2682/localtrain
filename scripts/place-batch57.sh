#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
R="$ROOT/.tmp/re-mine"
DST="$ROOT/docker/ctf-contests/batch57-mix"
rm -rf "$DST"; mkdir -p "$DST"

cp_one() { mkdir -p "$DST/$2"; cp -r "$1/." "$DST/$2/"; }

# MoeCTF 2025 修仙系列
cp_one "$R/XDSEC_MoeCTF_2025/challenges/Web/第一章 神秘的手镯" moectf2025-chapter1
cp_one "$R/XDSEC_MoeCTF_2025/challenges/Web/第三章 问剑石！篡天改命！" moectf2025-chapter3
cp_one "$R/XDSEC_MoeCTF_2025/challenges/Web/第六章 藏经禁制？玄机初探！" moectf2025-chapter6
# LitCTF 2023
cp_one "$R/ProbiusOfficial_LitCTF/2023/Web/Giveflag" litctf2023-giveflag
cp_one "$R/ProbiusOfficial_LitCTF/2023/Web/PHP is the best language in the world" litctf2023-php-best
cp_one "$R/ProbiusOfficial_LitCTF/2023/Web/SQL_Letmein" litctf2023-sql-letmein
# XYCTF 2025
cp_one "$R/saltedfisholdxu_XYCTF2025/Web/crazy_again" xyctf2025-crazy-again
cp_one "$R/saltedfisholdxu_XYCTF2025/Web/ezpuzzle" xyctf2025-ezpuzzle
# ACTF 2026
cp_one "$R/team-s2_ACTF-2026/web/RealDLsite/env" actf2026-realdlsite

# flag 替换：通用占位符
grep -rl "flag{default_flag}" "$DST" 2>/dev/null | xargs -r sed -i 's/flag{default_flag}/flag{m0ectf_xiuxian_s3ries_2025}/g'
grep -rl "flag{default_flag_here}" "$DST" 2>/dev/null | xargs -r sed -i 's/flag{default_flag_here}/flag{m0ectf_xiuxian_s3ries_2025}/g'
# Giveflag / PHP-best / SQL_Letmein
sed -i 's/ENV FLAG=NSSCTF{123456}/ENV FLAG=flag{g1ve_fl4g_pl3ase_2023}/' "$DST/litctf2023-giveflag/Dockerfile"
grep -q "ENV FLAG=" "$DST/litctf2023-php-best/Dockerfile" || printf 'ENV FLAG=flag{php_1s_th3_b3st_2023}\n' >> "$DST/litctf2023-php-best/Dockerfile"
grep -rl "flag{test_flag}" "$DST/litctf2023-sql-letmein" 2>/dev/null | xargs -r sed -i 's/flag{test_flag}/flag{sql_letmein_2023}/g'
# 第六章 flag.sh 需要 FLAG env
grep -q "ENV FLAG=" "$DST/moectf2025-chapter6/Dockerfile" || printf 'ENV FLAG=flag{m0ectf_xiuxian_s3ries_2025}\n' >> "$DST/moectf2025-chapter6/Dockerfile"

find "$DST" -type f \( -name "*.sh" -o -name "Dockerfile" -o -name "dockerfile" -o -name "*.py" \) -exec sed -i 's/\r$//' {} +
echo "== batch57 放置完成 =="
grep -rhoE "flag\{[^}]+\}|ACTF\{[^}]+\}" "$DST" 2>/dev/null | sort -u | head -12
