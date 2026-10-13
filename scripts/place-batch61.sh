#!/usr/bin/env bash
# batch61: 2026 湾区杯决赛 AWDP-WEB(3) + SpiritCTF 2026 热身赛(5) + Upload Wall(1)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T="$ROOT/.tmp/b61"
DST="$ROOT/docker/ctf-contests"
rm -rf "$DST/wqb2026finals" "$DST/spiritctf2026" "$DST/uploadwall2026"

# ---------- 1. WQB-Finals sky_uom ----------
D="$DST/wqb2026finals/wqb2026finals-sky-uom"; mkdir -p "$D"
cp "$T/x-sky/server.js" "$D/"
cat > "$D/Dockerfile" << 'EOF'
FROM node:22-alpine
WORKDIR /app
COPY server.js .
RUN echo "flag{wqb26_sky_u0m_v1_s1gn_l34k}" > /flag
EXPOSE 80
CMD ["node", "server.js"]
EOF

# ---------- 2. WQB-Finals lingyun_atlas ----------
D="$DST/wqb2026finals/wqb2026finals-lingyun-atlas"; mkdir -p "$D"
cp "$T/x-atlas/atlas" "$D/"
cat > "$D/Dockerfile" << 'EOF'
FROM debian:bookworm-slim
WORKDIR /app
COPY atlas /app/atlas
RUN chmod +x /app/atlas && echo "flag{wqb26_l1ngyun_4tl4s_tpl_1nj}" > /flag
EXPOSE 80
CMD ["/app/atlas"]
EOF

# ---------- 3. WQB-Finals Flowise ----------
D="$DST/wqb2026finals/wqb2026finals-flowise"
mkdir -p "$D"
cp -r "$T/../b61_flowise/." "$D/" 2>/dev/null || { unzip -o -q "$T/Flowis_36f95877d1230bc059962030e783f449.zip" -d "$D"; mv "$D"/Flowise/* "$D"/Flowise/.[!.]* "$D"/ 2>/dev/null || true; rm -rf "$D"/Flowise; }
# flag: ENV + /flag 双保险(攻击链 RCE 后读文件或 env)
printf 'ENV FLAG=flag{wqb26_fl0w1se_s5t1_rce_1nj}\nRUN echo "flag{wqb26_fl0w1se_s5t1_rce_1nj}" > /flag\n' >> "$D/Dockerfile"

# ---------- 4-8. SpiritCTF 五题 ----------
declare -A FLAGS=(
  [darkroom]='flag{TH3-baCkUP-rev34L5_A-g1F-PHaR_thAT-HIJ@ckS_THe_P@th0}'
  [ez_gambling]='flag{5p1r1t_ez_gambl1ng_int_n3g}'
  [R0b0ts]='flag{5p1r1t_r0b0ts_r0b0ts_txt_ssrf}'
  [spirit-notes]='flag{5p1r1t_n0tes_l0g_bl1nd_1nj}'
  [escape-backrooms]='flag{5p1r1t_3sc4p3_b4ckr00ms_r0ut3}'
)
for name in darkroom ez_gambling R0b0ts spirit-notes escape-backrooms; do
  id="spiritctf2026-$(echo "$name" | tr 'A-Z_-' 'a-z--')"
  D="$DST/spiritctf2026/$id"; mkdir -p "$D"
  cp -r "$T/spiritctf2026/$name/challenge/." "$D/"
  sed -i "s|ENV FLAG=\"flag{fake_for_local_test}\"|ENV FLAG=\"${FLAGS[$name]}\"|" "$D/Dockerfile" || true
  # 有些题 Dockerfile 内还有引用 fake flag 的行
  grep -rl "flag{fake_for_local_test}" "$D" 2>/dev/null | xargs -r sed -i "s|flag{fake_for_local_test}|${FLAGS[$name]}|g" || true
done

# ---------- 9. upload-wall ----------
D="$DST/uploadwall2026/uploadwall2026-upload-wall"; mkdir -p "$D"
cp -r "$T/upload-wall/src" "$D/src"
cp "$T/upload-wall/start.sh" "$D/start.sh"
cp "$T/upload-wall/docker-compose.yml" "$D/" 2>/dev/null || true
cat > "$D/Dockerfile" << 'EOF'
FROM php:8.2-apache

RUN a2enmod rewrite
RUN printf '<Directory /var/www/html>\n    AllowOverride All\n    Options Indexes FollowSymLinks\n</Directory>\n' > /etc/apache2/conf-available/challenge.conf && a2enconf challenge

WORKDIR /var/www/html
COPY src/ /var/www/html/

RUN chown -R www-data:www-data /var/www/html && \
    chmod -R 755 /var/www/html

COPY start.sh /start.sh
RUN chmod +x /start.sh

ENV FLAG=flag{upl04d_w4ll_bl4ckl1st_byp4ss}
EXPOSE 80
CMD ["/start.sh"]
EOF

# CRLF 清理(源码可能来自 Windows 亲缘仓库)
find "$DST/wqb2026finals" "$DST/spiritctf2026" "$DST/uploadwall2026" -type f \( -name "*.sh" -o -name "Dockerfile" -o -name "*.py" -o -name "*.js" -o -name "*.php" \) -exec sed -i 's/\r$//' {} +

echo "== batch61 放置完成 =="
ls "$DST/wqb2026finals" "$DST/spiritctf2026" "$DST/uploadwall2026"
echo "== flag 自检 =="
grep -h "^ENV FLAG" "$DST"/spiritctf2026/*/Dockerfile | head -6
