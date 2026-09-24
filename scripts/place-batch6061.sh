#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HK="$ROOT/.tmp/re-mine/hkcert-ctf_CTF-Challenges"
D60="$ROOT/docker/ctf-contests/batch60-mix"
D61="$ROOT/docker/ctf-contests/batch61-mix"
rm -rf "$D60" "$D61"; mkdir -p "$D60" "$D61"

place_hk() { # $1=年/题 $2=目标id $3=flag
  local envdir="$HK/CTF-$1/env"
  local ed=$(find "$envdir" -maxdepth 2 -iname "dockerfile" | head -1)
  ed=$(dirname "$ed")
  mkdir -p "$2root"
  mkdir -p "$D60/$2" 2>/dev/null || true
  cp -r "$ed/." "$D60/$2/"
  printf 'ENV FLAG=%s\n' "$3" >> "$D60/$2/Dockerfile"
}

place_hk "2022/01-rogue-secret-assistant" hkcert22-rogue-secret-assistant "hkcert22{r0gue_4ss1st4nt_l0c4l}"
place_hk "2022/02-king-of-rps"            hkcert22-king-of-rps            "hkcert22{k1ng_0f_rps_l0c4l}"
place_hk "2022/34-wordle"                 hkcert22-wordle                 "hkcert22{w0rd13_3xtra_th1cc}"
place_hk "2023/01-the-flag-game"          hkcert23-the-flag-game          "hkcert23{th3_fl4g_g4m3_l0c4l}"
place_hk "2023/03-solitude"               hkcert23-solitude               "hkcert23{s0l1tud3_x5s_l0c4l}"
place_hk "2023/20-json2csv"               hkcert23-json2csv               "hkcert23{js0n2csv_p0llut10n}"
place_hk "2023/21-cipher-bridging-service" hkcert23-cipher-bridging       "hkcert23{c1ph3r_br1dg3_l0c4l}"
place_hk "2024/03-get-flag-yourself"      hkcert24-get-flag-yourself      "hkcert24{g3t_fl4g_y0urs3lf_l0c4l}"

place_hk2() { local ed=$(find "$HK/CTF-$1/env" -maxdepth 2 -iname "dockerfile" | head -1); ed=$(dirname "$ed"); mkdir -p "$D61/$2"; cp -r "$ed/." "$D61/$2/"; printf 'ENV FLAG=%s\n' "$3" >> "$D61/$2/Dockerfile"; }
place_hk2 "2024/09-void"                  hkcert24-void                   "hkcert24{v01d_pyj41l_l0c4l}"
place_hk2 "2024/10-b6acp"                 hkcert24-b6acp                  "hkcert24{b64_c0py_p4st3_l0c4l}"
place_hk2 "2024/12-cypress"               hkcert24-cypress                "hkcert24{cypress_1s_n0t_4_pl4nt}"
place_hk2 "2024/22-bashed"                hkcert24-bashed                 "hkcert24{b4sh3d_4g41n_l0c4l}"

# b61 其余
cp_one() { mkdir -p "$D61/$2"; cp -r "$1/." "$D61/$2/"; }
cp_one "$ROOT/.tmp/re-mine/X1cT34m_NCTF2024/Web/H2Revenge" nctf2024-h2-revenge
sed -i 's/flag{test}/flag{nctf2024_h2_revenge_l0c4l}/' "$D61/nctf2024-h2-revenge/compose.yml"
cp_one "$ROOT/.tmp/re-mine/saltedfisholdxu_XYCTF2025/Web/Fate" xyctf2025-fate
cp_one "$ROOT/.tmp/re-mine/XDSEC_miniLCTF_2023/Challenges/pycalculator" minil2023-pycalculator
sed -i 's|^RUN echo "Blocked|ENV FLAG=miniL{pyc4lcul4t0r_l0c4l}\nRUN echo "Blocked|' "$D61/minil2023-pycalculator/Dockerfile"
cp_one "$ROOT/.tmp/b52-mine/PKU-GeekGame_geekgame-3rd/official_writeup/prob14-emoji" geekgame3-emoji-wordle
sed -i 's|GOPROXY=https://proxy.golang.org,direct|GOPROXY=https://goproxy.cn,direct|' "$D61/geekgame3-emoji-wordle/Dockerfile" 2>/dev/null || true

find "$D60" "$D61" -type f \( -name "*.sh" -o -name "Dockerfile" -o -name "*.py" \) -exec sed -i 's/\r$//' {} +
echo "== b60/b61 放置完成 =="
ls "$D60"; echo ---; ls "$D61"
