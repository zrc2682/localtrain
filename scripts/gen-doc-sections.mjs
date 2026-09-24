// 生成 ctf-web-challenges.md 第 52-61 批章节 + 校验登记表状态
import fs from 'fs';

function section(b) {
  const d = JSON.parse(fs.readFileSync(`docs/ctf-web-registry-batch${b}.json`, 'utf8'));
  const dep = d.challenges.filter((c) => c.status === 'deployed');
  const date = '2026-09-23';
  let s = `\n## 第${b}批(${date} 部署,${dep.length} 道已部署)\n\n来源:${d.contest}(${dep.length})\n\n| 题目 | 比赛 | 难度 | 端口 | 状态 |\n|------|------|------|------|------|\n`;
  for (const c of d.challenges) {
    if (c.status === 'deployed') {
      s += `| ${c.title} | ${c.contest} | ${c.difficulty} | ${c.port} | 已部署 |\n`;
    }
  }
  // 构建备注
  const notes = {
    52: '来源:team-su/SUCTF-2026 官方归档。SU_wms 因 mysql 双容器排除;SU_sqli 原 flag 为占位符已自拟。所有题均为构建期静态 flag。',
    53: '来源:XDSEC/miniLCTF_2026 与 ProbiusOfficial/LitCTF2026 官方归档。miniL 系列原为运行时 FLAG env,统一改为 entrypoint 硬编码;LitCTF 系列统一在 Dockerfile 追加 ENV GZCTF_FLAG 构建期烧入;Ezdomain 与 prob01 无 Dockerfile 未收录。',
    54: '来源:team-su/SUCTF-2025、mix-archive(DubheCTF 2024)与 Nu1LCTF/n1ctf-2025。SU_photogallery 原 ENV FLAG 为空占位已补真实值;Tagebuch 去除 cloudflared 隧道容器并将 node:slim 固定为 node:22-slim + pnpm@9;VulnTagger 需下载 AI 模型(构建约 40 分钟)并将 RUN --mount 改为普通 RUN;eezzjs/n1cat 的 start.sh 改为硬编码写 /flag。',
    55: '来源:Nu1LCTF(n1ctf 2022/2023)、LFYSec/aliyunctf-ezbean、skymansoul/NepCTF-2026、Tremse/HGAME-2025-Web-AyaNews、PKU-GeekGame/geekgame-5th。SU_wms、antweb(源码不全)、ytiruces(缺 bot)未收录;ezbean 原基础镜像 ctfhub/base_web_tomcat_8u121 两镜像源均无,改为 eclipse-temurin:8-jdk 并将 apk 改 apt;AyaNews 去除 entrypoint 的 unset FLAG 并以 ENV FLAG 注入;grafana 题 flag1/flag2 由构建期 COPY。',
    56: '来源:PKU-GeekGame/geekgame-4th、5th 与 X1cT34m/0xGame2023 重挖。web-copy 缺 2024.pub、graphauth 缺 logger.py(作者未提交)未收录;ez_sqli 原为 web+db 双容器,合并为单容器(容器内 mariadb 导入 db.sql,连接 host 改 localhost);web_snapshot 在 batch34 已有 skipped 登记故跳过;TestConnection/YourBatis 基础镜像 openjdk:8 两源均无改为 eclipse-temurin:8-jdk。',
    57: '来源:XDSEC/MoeCTF_2025 修仙系列、ProbiusOfficial/LitCTF 2023、saltedfisholdxu/XYCTF2025、team-s2/ACTF-2026 重挖。第一章占位 flag 替换为静态值(与已部署的 _revenge 版为不同题);ezpuzzle 原仓缺 files/flag.sh 已补标准脚本;RealDLsite 构建期 git clone 与 go-drive 下载均需外网,改为宿主机预下载进 context。',
    58: '来源:X1cT34m/0xGame2022 与 0xGame2024 重挖。ssrf-me 原 ctfhub/base_web_nginx_mysql_php_56 两源均无改为 php:5.6-apache;think-about-php 原 linode/lamp 改为 php:7.4-apache 并开 AllowOverride;cargo_shop/paste_bin 基础镜像 rust:1.79 因依赖要求 edition2024 升级为 rust:latest;paste_bin 原仓缺 db/ 目录改为 mkdir;profile/next-db/cargo-shop/paste-bin 原无 EXPOSE 已补。',
    59: '来源:XDSEC/miniLCTF_2024、William957-web/My-CTF-Challenges、susers/susctf-2024 重挖。SmartPark-Revenge 在 batch40 有 skipped 旧登记已清理;flag 文件由 GET IT FROM ENV 占位符写入真实值;sandbox 的 COPY --chmod 改为 COPY+RUN chmod(legacy builder 不支持 --mount/--chmod)。',
    60: '来源:hkcert-ctf/CTF-Challenges 2022-2024 年度重挖(与 2022/2023/2024 批次零重复)。全部为运行时 FLAG env,统一 ENV FLAG 构建期烧入。注意 rogue-secret-assistant 等多题为 socat 1337 端口 TCP 服务,平台探活走 TCP 回退。',
    61: '来源:hkcert-ctf/CTF-Challenges 2024 重挖 + PKU-GeekGame/geekgame-3rd。Emoji Wordle 为 sbt/scala 构建(源码内置三 flag,平台取 flag1);realdlsite 的 heredoc Dockerfile 需 BuildKit,以 DOCKER_BUILDKIT=1 单独构建,go-drive tar 预下载进 context。',
  };
  if (notes[b]) s += `\n构建备注:${notes[b]}\n`;
  return s;
}

let out = '';
for (let b = 52; b <= 60; b++) out += section(b);
fs.appendFileSync('docs/ctf-web-challenges.md', out);
console.log('appended sections 52-61');
