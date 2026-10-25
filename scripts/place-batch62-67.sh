#!/usr/bin/env bash
# batch62-67 筛选阶段源码放置(只放源码,不做 flag 改造/构建/导入)
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
R="$ROOT/.tmp/re-mine"
M="$ROOT/.tmp/b52-mine"
DST="$ROOT/docker/ctf-contests"

# ---- batch62: 重挖补漏批 ----
B="$DST/batch62-mix"; mkdir -p "$B"
[ -d "$DST/batch60-mix/0xg2023-spring" ] && mv "$DST/batch60-mix/0xg2023-spring" "$B/0xg2023-spring"
mkdir -p "$B/0xg2023-web-snapshot" && cp -r "$R/X1cT34m_0xGame2023/Web/Week 3/web_snapshot/." "$B/0xg2023-web-snapshot/"
mkdir -p "$B/minil2023-pycalculator" && cp -r "$R/XDSEC_miniLCTF_2023/Challenges/pycalculator/." "$B/minil2023-pycalculator/"
mkdir -p "$B/minil2024-smartpark-revenge" && cp -r "$R/XDSEC_miniLCTF_2024/Challenges/SmartPark-Revenge/." "$B/minil2024-smartpark-revenge/"
mkdir -p "$B/minil2024-injections" && cp -r "$R/XDSEC_miniLCTF_2024/Challenges/InjectionS/." "$B/minil2024-injections/"
mkdir -p "$B/minil2024-jvavguy" && cp -r "$R/XDSEC_miniLCTF_2024/Challenges/JvavGuy/." "$B/minil2024-jvavguy/"
mkdir -p "$B/nckuctf2024-double-exploit" && cp -r "$R/William957-web_My-CTF-Challenges/NCKUCTF/2024/NCKU-DOUBLE-EXPLOIT-main/." "$B/nckuctf2024-double-exploit/"
mkdir -p "$B/nohacknoctf2025-when" && cp -r "$R/William957-web_My-CTF-Challenges/NoHackNoCTF/2025/Web/when/." "$B/nohacknoctf2025-when/"
mkdir -p "$B/hitconex2025-cardmachine" && cp -r "$R/William957-web_My-CTF-Challenges/hitcon_exhibition/2025/." "$B/hitconex2025-cardmachine/"
mkdir -p "$B/isctf2025-baby-notice-board" && cp -r "$R/LamentXU123_myCTFchallenges/ISCTF 2025/baby_notice_board/." "$B/isctf2025-baby-notice-board/"

# ---- batch63: GeekGame 自建批(无现成 Dockerfile 的自写) ----
mkdir -p "$DST/geekgame2nd/geekgame2-txdocs" && cp -r "$M/PKU-GeekGame_geekgame-2nd/official_writeup/txdocs/game/." "$DST/geekgame2nd/geekgame2-txdocs/" 2>/dev/null
mkdir -p "$DST/geekgame2nd/geekgame2-omnibox" && cp -r "$M/PKU-GeekGame_geekgame-2nd/official_writeup/omnibox/game/." "$DST/geekgame2nd/geekgame2-omnibox/" 2>/dev/null
mkdir -p "$DST/geekgame2nd/geekgame2-mediawiki" && cp -r "$M/PKU-GeekGame_geekgame-2nd/official_writeup/mediawiki/." "$DST/geekgame2nd/geekgame2-mediawiki/" 2>/dev/null
mkdir -p "$DST/geekgame3rd/geekgame3-homepage" && cp -r "$M/PKU-GeekGame_geekgame-3rd/official_writeup/prob01-homepage/game/." "$DST/geekgame3rd/geekgame3-homepage/" 2>/dev/null
mkdir -p "$DST/geekgame3rd/geekgame3-emoji-wordle" && cp -r "$M/PKU-GeekGame_geekgame-3rd/official_writeup/prob14-emoji/wordle/." "$DST/geekgame3rd/geekgame3-emoji-wordle/" 2>/dev/null && cp "$M/PKU-GeekGame_geekgame-3rd/official_writeup/prob14-emoji/Dockerfile" "$DST/geekgame3rd/geekgame3-emoji-wordle/Dockerfile" 2>/dev/null

# ---- batch64-67: HKCERT 2020/2021 web(2022 前例外扩展, 待用户确认) ----
H="$R/hkcert-ctf_CTF-Challenges"
place_hk() { # $1=年目录 $2=题目录名 $3=id
  local src="$H/$1/$2" envdir=$(find "$H/$1/$2" -maxdepth 2 -iname dockerfile | head -1)
  envdir=$(dirname "$envdir")
  mkdir -p "$DST/$3" && cp -r "$envdir/." "$DST/$3/"
}
W20="3. Web Exploitation"
place_hk "CTF-2020/$W20" "2. Rickroll"        "hkcert2020/hkcert20-rickroll"
place_hk "CTF-2020/$W20" "3. Sanity Check II" "hkcert2020/hkcert20-sanity-check-2"
place_hk "CTF-2020/$W20" "4. C99Mask"         "hkcert2020/hkcert20-c99mask"
place_hk "CTF-2020/$W20" "5. Conversion Center" "hkcert2020/hkcert20-conversion-center"
place_hk "CTF-2020/$W20" "6. LockPickDuck v3" "hkcert2020/hkcert20-lockpickduck-v3"
place_hk CTF-2021 T1-infantxss               "hkcert2021a/hkcert21-infantxss"
place_hk CTF-2021 40-babyxss                 "hkcert2021a/hkcert21-babyxss"
place_hk CTF-2021 12-babyurii                "hkcert2021a/hkcert21-babyurii"
place_hk CTF-2021 70-jqplayground            "hkcert2021a/hkcert21-jqplayground"
place_hk CTF-2021 55-positron                "hkcert2021b/hkcert21-positron"
place_hk CTF-2021 56-because-i-said-it       "hkcert2021b/hkcert21-because-i-said-it"
place_hk CTF-2021 62-squirrelcommunity       "hkcert2021b/hkcert21-squirrelcommunity"
place_hk CTF-2021 98-infantbrowser           "hkcert2021b/hkcert21-infantbrowser"
place_hk CTF-2021 64-sea-of-thorns           "hkcert2021c/hkcert21-sea-of-thorns"
place_hk CTF-2021 10-return-of-tuning-keyboard "hkcert2021c/hkcert21-retk"
place_hk CTF-2021 37-ctf-tuning-master       "hkcert2021c/hkcert21-ctf-tuning-master"

echo "== 放置完成 =="
ls "$DST/batch62-mix"; echo; ls "$DST/hkcert2020" "$DST/hkcert2021a" "$DST/hkcert2021b" "$DST/hkcert2021c" "$DST/geekgame2nd" "$DST/geekgame3rd"
