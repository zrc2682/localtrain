import fs from 'fs';

const mk = (id, title, contest, difficulty, port, flag, source, writeup, dir, mech) => ({
  id, title, contest, category: 'web', difficulty, port,
  image: `localtrain/ctf-${id}:latest`, flag,
  source, writeup: writeup || null,
  dir: `docker/ctf-contests/${dir}`,
  status: 'pending',
  flagMechanism: mech,
});
const gh = (repo, path) => ({ repo, ...(path ? { path } : {}) });

const batches = [];

// ---------- batch62: 重挖补漏批 ----------
batches.push({
  batch: 62, contest: '重挖补漏混合批(0xGame/miniL/NCKUCTF/NHNC/HITCON展/ISCTF)',
  source: '多仓库重挖; 部分为历史构建失败/镜像损坏重试题',
  challenges: [
    mk('0xg2023-spring', 'spring', '0xGame 2023', 'medium', 8081, 'flag{0xg2023_spr1ng_rce_l0c4l}',
      gh('X1cT34m/0xGame2023', 'Web/Week 4/spring'), 'https://github.com/X1cT34m/0xGame2023',
      'batch62-mix/0xg2023-spring', '源码内置(部署时确认); 基础镜像 openjdk:8 需换 eclipse-temurin:8-jdk; spring.jar 单容器'),
    mk('0xg2023-web-snapshot', 'web_snapshot', '0xGame 2023', 'medium', 80, '0xGame{aef421d4-0f35-4b82-b7ee-0dbea46b6333}',
      gh('X1cT34m/0xGame2023', 'Web/Week 3/web_snapshot'), 'https://github.com/X1cT34m/0xGame2023',
      'batch62-mix/0xg2023-web-snapshot', '源码内置真实 flag(php:7.2-apache 截图服务); batch34 陈旧 skipped 条目已清理'),
    mk('minil2023-pycalculator', 'pycalculator', 'Mini L-CTF 2023', 'medium', 9999, 'miniL{pyc4lcul4t0r_l0c4l}',
      gh('XDSEC/miniLCTF_2023', 'Challenges/pycalculator'), 'https://github.com/XDSEC/miniLCTF_2023',
      'batch62-mix/minil2023-pycalculator', '自拟; xinetd TCP 9999 python jail, ENV FLAG→start.sh 写 /home/ctf/flag; 探活走 TCP; batch39 陈旧 skipped 已清理'),
    mk('minil2024-smartpark-revenge', 'SmartPark-Revenge', 'Mini L-CTF 2024', 'hard', 8080, 'miniL{smartpark_r3v3ng3_2024}',
      gh('XDSEC/miniLCTF_2024', 'Challenges/SmartPark-Revenge'), 'https://github.com/XDSEC/miniLCTF_2024',
      'batch62-mix/minil2024-smartpark-revenge', '重试题(上轮镜像层损坏容器停在 Created 已 rmi); flag 文件原为 GET IT FROM ENV 占位需写真实值'),
    mk('minil2024-injections', 'InjectionS', 'Mini L-CTF 2024', 'hard', 8080, 'miniL{1nj3ct10n5_sh1r0_rc3}',
      gh('XDSEC/miniLCTF_2024', 'Challenges/InjectionS'), 'https://github.com/XDSEC/miniLCTF_2024',
      'batch62-mix/minil2024-injections', '自拟; 原 web(spring+shiro)+mysql 双容器 compose 需合并单容器(参考 ez_sql 先例)'),
    mk('minil2024-jvavguy', 'JvavGuy', 'Mini L-CTF 2024', 'hard', 8080, 'miniL{jv4vguy_ru0y1_rc3}',
      gh('XDSEC/miniLCTF_2024', 'Challenges/JvavGuy'), 'https://github.com/XDSEC/miniLCTF_2024',
      'batch62-mix/minil2024-jvavguy', '自拟; ruoyi(CMS)+mysql 双容器需合并; 构建工作量偏大'),
    mk('nckuctf2024-double-exploit', 'DOUBLE EXPLOIT', 'NCKUCTF 2024', 'medium', 80, 'NCKUCTF{my_first_pwn+web}',
      gh('William957-web/My-CTF-Challenges', 'NCKUCTF/2024/NCKU-DOUBLE-EXPLOIT-main'), 'https://github.com/William957-web/My-CTF-Challenges',
      'batch62-mix/nckuctf2024-double-exploit', 'secret.php 内置真实 flag(php mysqli); 重试题(上轮镜像层损坏已 rmi)'),
    mk('hitconex2025-cardmachine', 'Daemon Slayer Card Machine', 'HITCON Exhibition 2025', 'medium', 1202, 'hitcon{i_really_enjoy_the_day_when_will_us_meet_next_time_..._bypass_hitcon_d2}',
      gh('William957-web/My-CTF-Challenges', 'hitcon_exhibition/2025'), 'https://github.com/William957-web/My-CTF-Challenges',
      'batch62-mix/hitconex2025-cardmachine', 'flag.txt 内置真实 flag; flask 单容器 :1202; HITCON 摊位展题'),
    mk('isctf2025-baby-notice-board', 'baby_notice_board', 'ISCTF 2025', 'medium', 80, 'flag{3a4cc347-8475-46cd-9f3e-64b393749fd2}',
      gh('LamentXU123/myCTFchallenges', 'ISCTF 2025/baby_notice_board'), 'https://github.com/LamentXU123/myCTFchallenges',
      'batch62-mix/isctf2025-baby-notice-board', '源码内置真实 flag; php7.3-fpm+nginx+mysql 单容器(自带); 重试题(历史 mysql 初始化失败); batch46 陈旧 skipped 已清理'),
  ],
});

// ---------- batch63: GeekGame 自建批 ----------
batches.push({
  batch: 63, contest: 'GeekGame 2nd/3rd Web 自建批',
  source: 'PKU-GeekGame/geekgame-2nd + geekgame-3rd; 另有企鹅文档(txdocs)/给钱不要(omnibox)两题无源码环境, 仅官方 wp, 未收录待自建',
  challenges: [
    mk('geekgame2-mediawiki', '私有笔记', 'GeekGame 2nd', 'hard', 80, 'flag{insecure_01d_mediavviki}',
      gh('PKU-GeekGame/geekgame-2nd', 'official_writeup/mediawiki'), 'https://github.com/PKU-GeekGame/geekgame-2nd/tree/main/official_writeup/mediawiki',
      'geekgame2nd/geekgame2-mediawiki', '官方 writeup 提取真实 flag; MediaWiki 私有笔记, 需自建容器(mediawiki 镜像+数据)'),
    mk('geekgame3-homepage', '第三新XSS', 'GeekGame 3rd', 'medium', 5000, 'flag{gg3_h0mep4g3_5w_x55_l0c4l}',
      gh('PKU-GeekGame/geekgame-3rd', 'official_writeup/prob01-homepage'), 'https://github.com/PKU-GeekGame/geekgame-3rd/tree/main/official_writeup/prob01-homepage',
      'geekgame3rd/geekgame3-homepage', '自拟; server(flask)+xssbot 双容器需合并(supervisord); Service Worker XSS 向'),
    mk('geekgame3-emoji-wordle', 'Emoji Wordle', 'GeekGame 3rd', 'medium', 9000, 'flag{s1Mp1e_brut3f0rc3}',
      gh('PKU-GeekGame/geekgame-3rd', 'official_writeup/prob14-emoji'), 'https://github.com/PKU-GeekGame/geekgame-3rd/tree/main/official_writeup/prob14-emoji',
      'geekgame3rd/geekgame3-emoji-wordle', '源码内置三 flag 取 flag1(scala sbt); 风险: sbtscala/scala-sbt 基础镜像两镜像源均无, 需直连拉取或换基础镜像自装 sbt'),
  ],
});

// ---------- batch64-67: HKCERT 2020/2021 ----------
const hk20 = [
  ['hkcert20-rickroll', 'Rickroll', 'easy', 80, 'flag{hkcert20_r1ckr0ll_l0c4l}'],
  ['hkcert20-sanity-check-2', 'Sanity Check II', 'easy', 80, 'flag{hkcert20_s4n1ty_l0c4l}'],
  ['hkcert20-c99mask', 'C99Mask', 'medium', 80, 'flag{hkcert20_c99m4sk_l0c4l}'],
  ['hkcert20-conversion-center', 'Conversion Center', 'medium', 3000, 'flag{hkcert20_c0nv3rs10n_l0c4l}'],
  ['hkcert20-lockpickduck-v3', 'LockPickDuck v3', 'medium', 80, 'flag{hkcert20_l0ckp1ckduck_l0c4l}'],
];
batches.push({
  batch: 64, contest: 'HKCERT CTF 2020 Web 扩展收录',
  source: 'hkcert-ctf/CTF-Challenges CTF-2020',
  note: '2022 年前比赛, 属平台既有 HKCERT 2022-2025 系列的向早期扩展, 部署前请确认是否接受',
  challenges: hk20.map(([id, title, diff, port, flag]) =>
    mk(id, title, 'HKCERT CTF 2020', diff, port, flag,
      gh('hkcert-ctf/CTF-Challenges', `CTF-2020/3. Web Exploitation/${title}`),
      `https://github.com/hkcert-ctf/CTF-Challenges/tree/main/CTF-2020/3.%20Web%20Exploitation/${encodeURIComponent(title)}`,
      `hkcert2020/${id}`, '自拟(部署时可用官方 wp 校验); 原题运行时 FLAG env 注入, 部署时改 ENV FLAG 烧入')),
});
const hk21a = [
  ['hkcert21-infantxss', 'Infant XSS', 'easy', 80, 'flag{hkcert21_1nf4ntx55_l0c4l}'],
  ['hkcert21-babyxss', 'babyXSS', 'easy', 80, 'flag{hkcert21_b4byx55_l0c4l}'],
  ['hkcert21-babyurii', 'babyURIi', 'easy', 80, 'flag{hkcert21_b4byur11_l0c4l}'],
  ['hkcert21-jqplayground', 'jqplayground', 'medium', 80, 'flag{hkcert21_jqpl4ygr0und_l0c4l}'],
];
batches.push({
  batch: 65, contest: 'HKCERT CTF 2021 Web 扩展收录(入门组)',
  source: 'hkcert-ctf/CTF-Challenges CTF-2021',
  note: '2022 年前比赛扩展收录; babyxss/babyurii 依赖公共 xss-bot 基础设施, 单容器部署时需内置 bot 或调整解题路径(参考已部署 Infant XSS again 先例)',
  challenges: hk21a.map(([id, title, diff, port, flag]) =>
    mk(id, title, 'HKCERT CTF 2021', diff, port, flag,
      gh('hkcert-ctf/CTF-Challenges'), 'https://github.com/hkcert-ctf/CTF-Challenges/tree/main/CTF-2021',
      `hkcert2021a/${id}`, '自拟; XSS 类需评估 bot 依赖, jqplayground 为 jq 注入')),
});
const hk21b = [
  ['hkcert21-positron', 'positron', 'medium', 80, 'flag{hkcert21_p051tr0n_l0c4l}'],
  ['hkcert21-because-i-said-it', 'because i said it', 'medium', 80, 'flag{hkcert21_b3c4us3_l0c4l}'],
  ['hkcert21-squirrelcommunity', 'squirrelcommunity', 'medium', 80, 'flag{hkcert21_sq31rr3l_l0c4l}'],
  ['hkcert21-infantbrowser', 'infantbrowser', 'easy', 80, 'flag{hkcert21_1nf4ntbr0wser_l0c4l}'],
];
batches.push({
  batch: 66, contest: 'HKCERT CTF 2021 Web 扩展收录(进阶组 I)',
  source: 'hkcert-ctf/CTF-Challenges CTF-2021',
  note: '2022 年前比赛扩展收录',
  challenges: hk21b.map(([id, title, diff, port, flag]) =>
    mk(id, title, 'HKCERT CTF 2021', diff, port, flag,
      gh('hkcert-ctf/CTF-Challenges'), 'https://github.com/hkcert-ctf/CTF-Challenges/tree/main/CTF-2021',
      `hkcert2021b/${id}`, '自拟; positron=Electron 向, because-i-said-it=HTTP 语义, squirrelcommunity=Squirrel 语言站')),
});
const hk21c = [
  ['hkcert21-sea-of-thorns', 'sea of thorns', 'hard', 80, 'flag{hkcert21_s3a_0f_th0rn5_l0c4l}'],
  ['hkcert21-retk', 'Return of the Tuning Keyboard', 'hard', 80, 'flag{hkcert21_r0tk_l0c4l}'],
  ['hkcert21-ctf-tuning-master', 'CTF Tuning Master', 'hard', 80, 'flag{hkcert21_tun1ng_m4st3r_l0c4l}'],
];
batches.push({
  batch: 67, contest: 'HKCERT CTF 2021 Web 扩展收录(进阶组 II)',
  source: 'hkcert-ctf/CTF-Challenges CTF-2021',
  note: '2022 年前比赛扩展收录; retk/tuning-master 原依赖公共 xss-bot, 需内置 bot',
  challenges: hk21c.map(([id, title, diff, port, flag]) =>
    mk(id, title, 'HKCERT CTF 2021', diff, port, flag,
      gh('hkcert-ctf/CTF-Challenges'), 'https://github.com/hkcert-ctf/CTF-Challenges/tree/main/CTF-2021',
      `hkcert2021c/${id}`, '自拟; sea-of-thorns=PHP 白名单逃逸, tuning 系=xssbot 交互')),
});

for (const b of batches) {
  const f = `docs/ctf-web-registry-batch${b.batch}.json`;
  fs.writeFileSync(f, JSON.stringify(b, null, 2) + '\n');
  console.log(f, b.challenges.length, '题');
}
