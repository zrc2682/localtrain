# 比赛 Web 题目部署记录

> 本文档维护从国内 CTF 比赛官方仓库选题部署到本靶场的全过程记录。
> **新增/下线比赛题目时,须同步更新本文档与 `docs/ctf-web-registry.json`(及后续批次登记表)。**

> **规则更新**：2026-07-19 起，由于已可直接走 GitHub 下载源码，移除旧的「单附件 15MB 上限」。附件大小不再作为选题排除条件，仅保留多容器编排、依赖外部服务、无源码/无 Dockerfile 等排除项。

## 选题标准

- 仅 Web 题,来自国内 CTF 比赛(2022 年以后)官方题目仓库
- 每题必须有:完整题目源码/附件 + 可单容器部署(优先自带 Dockerfile)+ 公开 writeup
- 难度配比:中等和简单为主，困难少量
- 排除:虚拟机渗透题(boot2root)、需多容器编排、依赖外部服务

## 部署流程(每批次通用)

1. **选题登记**:写入批次登记表(`docs/ctf-web-registry*.json`),记录来源仓库、端口、flag 机制、writeup 链接,status 初始为 `pending`。可选 `description` 字段:若填写非空描述,`import-ctf-contests.mjs` 会直接将其作为题目描述导入;留空则自动生成默认描述(比赛来源 + 来源链接 + Writeup 链接)。
2. **下载源码**:经 GitHub(本机 Clash 代理 `http://127.0.0.1:7890`,github.com 直连不可用)下载到 `docker/ctf-contests/<比赛slug>/<题目slug>/`。
3. **flag 改造**:原题多为 GZCTF 风格环境变量注入,统一改为 Dockerfile 内 `ENV` 写入登记表中的平台静态 flag(`flag{<slug>_<12hex>}`)。
4. **构建镜像**:基础镜像经公共加速源拉取(Docker Hub 直连不可用,用 `docker.m.daocloud.io` 拉取后 `docker tag` 回原名;备用 docker.1ms.run / hub.rat.dev;ghcr.io 可直连)。`bash docker/ctf-contests/build.sh [题目slug]` 构建并导出 tar 到 `docker-images/`。
5. **冒烟测试**:起容器验证 HTTP 服务可访问、flag 已落位。
6. **导入平台**:`node import-ctf-contests.mjs [登记表路径]`(需后端已启动),自动创建题目(含 contest 标签、难度、附件 zip),结果回写登记表 status。
7. **writeup 本地化**:抓得到正文的存 `ctf-writeup/<比赛slug>/<题目slug>.md`(头部注明出处);PDF/抓不到的只记链接。

## 第一批(2026-07-18 选题,10 道)

来源比赛:SVUCTF WINTER 2023、SUSCTF 2024、LitCTF 2023。配比 1 easy / 6 medium / 3 hard。

| 题目 | 比赛 | 难度 | 端口 | 考点 | writeup | 状态 |
|------|------|------|------|------|---------|------|
| 上传?上传! | SVUCTF WINTER 2023 | easy | 80 | 文件上传条件竞争 | [本地](../../ctf-writeup/svuctf-winter-2023/ez-upload.md) | 已部署 |
| FlagServer | SVUCTF WINTER 2023 | medium | 5000 | 伪随机数种子预测 | [本地](../../ctf-writeup/svuctf-winter-2023/flagserver.md) | 已部署 |
| 热血沸腾的组合技 | SVUCTF WINTER 2023 | medium | 80 | 任意文件下载 + tonyenc 解密 | [本地](../../ctf-writeup/svuctf-winter-2023/tonyenc.md) | 已部署 |
| 题解分享频道 | SVUCTF WINTER 2023 | medium | 5000 | 存储型 XSS 带 cookie | [本地](../../ctf-writeup/svuctf-winter-2023/writeup-channel.md) | 已部署 |
| http server emulator | SUSCTF 2024 | medium | 8080 | 协议构造(状态码) | [官方 PDF](https://github.com/susers/susctf-2024/blob/master/writeup.pdf) | 已部署 |
| noscript | SUSCTF 2024 | hard | 8080 | 无 script 标签 XSS | [官方 PDF](https://github.com/susers/susctf-2024/blob/master/writeup.pdf) | 已部署 |
| note taking 2 | SUSCTF 2024 | hard | 3000 | web cache deception | [官方 PDF](https://github.com/susers/susctf-2024/blob/master/writeup.pdf) | 已部署 |
| Another Sandbox | SUSCTF 2024 | hard | 8000 | Python 沙箱逃逸 + 提权 | [本地](../../ctf-writeup/susctf-2024/sandbox.md) | 已部署 |
| Flag点击就送! | LitCTF 2023 | medium | 5000 | Flask session 伪造 | [本地](../../ctf-writeup/litctf-2023/giveflag.md) | 已部署 |
| 这是什么?SQL!注一下! | LitCTF 2023 | medium | 80 | 括号闭合 SQL 注入 | [本地](../../ctf-writeup/litctf-2023/sql-letmein.md) | 已部署 |

### 第一批跳过记录

| 候选 | 原因 |
|------|------|
| NCTF 2023 logging / EvilMQ | 已重新部署(见"附件大小限制放宽后重新部署"章节) |
| CTF-Archives/2024-ISCC-Quals | 仓库仅 README,无源码附件 |
| GitSeek2/HappyNewYearCTF-2025 | 仓库为出题模板,web 目录为空 |
| SVUCTF-HELLOWORLD-2024 | 全部 easy 难度,不符配比(可作后续 easy 补充) |

## 第二批(2026-07-18 选题,10 道)

来源比赛:西湖论剑 2022、美团高校赛 2022、HGAME 2023、NCTF 2023、巅峰极客 2024。配比 1 easy / 6 medium / 3 hard。

| 题目 | 比赛 | 难度 | 端口 | 考点 | writeup | 状态 |
|------|------|------|------|------|---------|------|
| Node Magical Login | 西湖论剑 2022 | medium | 80 | Node.js 登录逻辑 + 请求拆分 | [本地](../../ctf-writeup/xhlj-2022/node-magical-login.md) | 已部署 |
| easy_api | 西湖论剑 2022 | medium | 8080 | Java fastjson 反序列化 | [本地](../../ctf-writeup/xhlj-2022/easy-api.md) | 已部署 |
| real_ez_node | 西湖论剑 2022 | medium | 3000 | SSRF + 原型链污染 + EJS RCE | [本地](../../ctf-writeup/xhlj-2022/real-ez-node.md) | 已部署 |
| easypickle | 美团高校赛 2022 | medium | 8888 | Python pickle 反序列化 | [本地](../../ctf-writeup/meituan-2022/easypickle.md) | 已部署 |
| Designer | HGAME 2023 | medium | 9090 | JWT 条件 + XSS bot | [本地](../../ctf-writeup/hgame-2023/designer.md) | 已部署 |
| Guess Who I Am | HGAME 2023 | easy | 8080 | Go 路由逻辑 + 连续答题 | [本地](../../ctf-writeup/hgame-2023/guess-who-i-am.md) | 已部署 |
| Shared Diary | HGAME 2023 | hard | 8888 | 原型链污染 + EJS SSTI | [本地](../../ctf-writeup/hgame-2023/shared-diary.md) | 已部署 |
| Wait What? | NCTF 2023 | hard | 80 | Node 命令注入 + 沙箱逃逸 | [本地](../../ctf-writeup/nctf-2023/wait-what.md) | 已部署 |
| Webshell Generator | NCTF 2023 | hard | 80 | 模板注入 + SUID readflag | [本地](../../ctf-writeup/nctf-2023/webshell-generator.md) | 已部署 |
| GoldenHornKing | 巅峰极客 2024 | medium | 8000 | FastAPI Jinja2 SSTI | [本地](../../ctf-writeup/dfjk-2024/golden-horn-king.md) | 已部署 |

### 第二批跳过记录

| 候选 | 比赛 | 原因 |
|------|------|------|
| OnlyLocalSql | VNCTF 2024 | 需要 SSH 进容器在本地起恶意 MySQL 服务,平台仅映射 Web 端口 |
| EvilMQ | NCTF 2023 | 已重新部署(见"附件大小限制放宽后重新部署"章节) |
| logging | NCTF 2023 | 已重新部署(见"附件大小限制放宽后重新部署"章节) |
| ez_wordpress | NCTF 2023 | 需要 web+db 多容器编排,且 deploy.zip 27MB |
| house of click | NCTF 2023 | 需要 backend+db(ClickHouse)+frontend 多容器编排 |
| easyjava | 美团高校赛 2022 | 已重新部署(见"附件大小限制放宽后重新部署"章节) |
| b4bycoffee | 长城杯高校 2022 | 已重新部署(见"附件大小限制放宽后重新部署"章节) |
| ezWEB | 浙江省大学生网络与信息安全竞赛 2023 | 已重新部署(见"附件大小限制放宽后重新部署"章节) |
| admin_Test | 巅峰极客 2024 | 同赛已选 GoldenHornKing,本题无 Dockerfile |
| Classic Childhood Game | HGAME 2023 | 同赛已选 3 题,且 easy 名额已占用 |

## 第三批(2026-07-18 选题,10 道)

来源比赛:LitCTF 2023(8 道)、HGAME 2023(1 道)、2023 安洵杯(1 道)。
本次以补足已有比赛为主,不限难度;实际配比 3 easy / 6 medium / 1 hard。
注:Classic Childhood Game 在第二批因 easy 名额占用被跳过,本批次补充。

| 题目 | 比赛 | 难度 | 端口 | 考点 | writeup | 状态 |
|------|------|------|------|------|---------|------|
| F12 | LitCTF 2023 | easy | 80 | 查看源码 + 控制台彩蛋 | [本地](../../ctf-writeup/litctf-2023/F12.md) | 已部署 |
| Ping | LitCTF 2023 | easy | 80 | 前端校验绕过/命令注入 | [本地](../../ctf-writeup/litctf-2023/Ping.md) | 已部署 |
| Follow me and hack me | LitCTF 2023 | easy | 80 | 备份文件泄露 + 彩蛋 | [本地](../../ctf-writeup/litctf-2023/Follow-me-and-hack-me.md) | 已部署 |
| Vim yyds | LitCTF 2023 | medium | 80 | .swp 缓存恢复 + 命令执行 | [本地](../../ctf-writeup/litctf-2023/Vim-yyds.md) | 已部署 |
| 1zjs | LitCTF 2023 | medium | 80 | JS 源码对比/JSFuck 分析 | [本地](../../ctf-writeup/litctf-2023/1zjs.md) | 已部署 |
| http pro max plus | LitCTF 2023 | medium | 80 | HTTP 头伪造 | [本地](../../ctf-writeup/litctf-2023/http-pro-max-plus.md) | 已部署 |
| Missile trail | LitCTF 2023 | medium | 80 | 前端游戏逻辑/Hook 变量 | [本地](../../ctf-writeup/litctf-2023/Missile-trail.md) | 已部署 |
| Homework management system | LitCTF 2023 | hard | 80 | 弱口令 + 文件创建/命令执行 | [本地](../../ctf-writeup/litctf-2023/Homework-management-system.md) | 已部署 |
| Classic Childhood Game | HGAME 2023 | easy | 80 | JS 混淆/魔塔事件分析 | [本地](../../ctf-writeup/hgame-2023/classic-childhood-game.md) | 已部署 |
| easy_unserialize | 2023 安洵杯 | medium | 80 | PHP 反序列化 POP 链 | [本地](../../ctf-writeup/isoon-2023/easy-unserialize.md) | 已部署 |

### 第三批跳过记录

| 候选 | 比赛 | 原因 |
|------|------|------|
| 无 | - | 本批次以补足已有比赛为主,10 题均成功部署 |

## 第四批(2026-07-19 选题,10 道)

来源比赛:强网杯 S8 2024(3 道)、网鼎杯 2024 朱雀组(1 道)、NewStar CTF 2024(2 道)、NCTF 2024(1 道)、2023 安洵杯(2 道)、鹏城杯 2025(1 道)。实际配比 1 easy / 7 medium / 2 hard。
注:ezBlog 未找到公开 writeup,writeup 为本地源码审计自写。

| 题目 | 比赛 | 难度 | 端口 | 考点 | writeup | 状态 |
|------|------|------|------|------|---------|------|
| Proxy | 强网杯 S8 2024 | medium | 8000 | nginx + Go 代理 SSRF | [本地](../../ctf-writeup/qwbs8-2024/proxy.md) | 已部署 |
| Proxy_revenge | 强网杯 S8 2024 | hard | 8000 | 请求走私 + XOR 加密绕过 | [本地](../../ctf-writeup/qwbs8-2024/proxy-revenge.md) | 已部署 |
| PyBlockly | 强网杯 S8 2024 | medium | 5000 | pyjail + unidecode 绕过 | [本地](../../ctf-writeup/qwbs8-2024/pyblockly.md) | 已部署 |
| ezBlog | 网鼎杯 2024 | medium | 18888 | Apache 代理 + 请求走私 + 信息泄露 | [本地](../../ctf-writeup/wdb-2024/ezblog.md) | 已部署 |
| ezpollute | NewStar CTF 2024 | medium | 3000 | 原型链污染 + RCE | [本地](../../ctf-writeup/newstar-2024/ezpollute.md) | 已部署 |
| PangBai 过家家(4) | NewStar CTF 2024 | medium | 8000 | Go SSTI + SSRF | [本地](../../ctf-writeup/newstar-2024/pangbai4.md) | 已部署 |
| sqlmap-master | NCTF 2024 | easy | 8000 | sqlmap 参数注入 | [本地](../../ctf-writeup/nctf-2024/sqlmap-master.md) | 已部署 |
| signal | 2023 安洵杯 | medium | 80 | YAML + js-yaml 任意函数 + ejs RCE | [本地](../../ctf-writeup/isoon-2023/signal.md) | 已部署 |
| swagger docs | 2023 安洵杯 | medium | 8000 | 原型链污染 + SSTI | [本地](../../ctf-writeup/isoon-2023/swagger-docs.md) | 已部署 |
| ezDjango | 鹏城杯 2025 | hard | 8000 | Django 文件缓存 pickle 反序列化 | [本地](../../ctf-writeup/pengchengcup-2025/ezdjango.md) | 已部署 |

### 第四批跳过记录

> 注:2026-07-19 起文档已移除 15MB 附件上限。以下记录中仅因大小被跳过的题目(H2Revenge、Playground)后续可重新部署,不受此限制。

| 候选 | 比赛 | 原因 |
|------|------|------|
| H2Revenge | NCTF 2024 | jar 附件 23MB / 附件 zip 21MB(按旧规则超 15MB 上限;现规则下已允许) |
| internal_api | NCTF 2024 | 依赖 selenium/standalone-chrome bot 第二容器 |
| EzCalc | 强网杯 S8 2024 | 含 app + puppeteer bot 多容器,且 bot 硬编码作者域名 |
| Playground | 强网杯 S8 2024 | 附件 70MB(按旧规则超 15MB 上限;现规则下已允许) |
| 2024 鹏城杯 Web 题 | 鹏城杯 2024 | 原仓库仅 README,附件在百度网盘 |
| 羊城杯 2024 Web 题 | 羊城杯 2024 | CTF-Archives 归档仓库只有 README 元数据,无源码/Dockerfile |

## 附件大小限制放宽后重新部署(2026-07-20,7 道)

由于已可直接访问 GitHub 下载源码,旧的 15MB 单附件上限已取消。以下题目均因原规则下附件大小被跳过,现已重新部署。

| 题目 | 比赛 | 难度 | 端口 | 考点 | writeup | 状态 |
|------|------|------|------|------|---------|------|
| logging | NCTF 2023 | medium | 8080 | Spring Boot + Log4j2 RCE | [本地](../../ctf-writeup/nctf-2023/logging.md) | 已部署 |
| EvilMQ | NCTF 2023 | hard | 8000 | Apache InLong TubeMQ RCE + RASP 绕过 | [本地](../../ctf-writeup/nctf-2023/evilmq.md) | 已部署 |
| easyjava | 美团高校赛 2022 | hard | 8090 | SpringBoot + Shiro 反序列化 | [本地](../../ctf-writeup/mtgxs-2022/easyjava.md) | 已部署 |
| b4bycoffee | 长城杯高校 2022 | medium | 8080 | Java 反序列化 | [本地](../../ctf-writeup/ccbgx-2022/b4bycoffee.md) | 已部署 |
| ezWEB | 浙江省大学生网络与信息安全竞赛 2023 | medium | 9124 | 反序列化 + RCE | [本地](../../ctf-writeup/zjsdxs-2023/ezweb.md) | 已部署 |
| H2Revenge | NCTF 2024 | hard | 8000 | H2 JDBC 反序列化 | [本地](../../ctf-writeup/nctf-2024/h2revenge.md) | 已部署 |
| Playground | 强网杯 S8 2024 | hard | 5000 | Flask + Go sandbox 逃逸 | [本地](../../ctf-writeup/qwbs8-2024/playground.md) | 已部署 |

### 第一批跳过记录(已更新)

| 候选 | 原因 |
|------|------|
| CTF-Archives/2024-ISCC-Quals | 仓库仅 README,无源码附件 |
| GitSeek2/HappyNewYearCTF-2025 | 仓库为出题模板,web 目录为空 |
| SVUCTF-HELLOWORLD-2024 | 全部 easy 难度,不符配比(可作后续 easy 补充) |

### 第二批跳过记录(已更新)

| 候选 | 比赛 | 原因 |
|------|------|------|
| OnlyLocalSql | VNCTF 2024 | 需要 SSH 进容器在本地起恶意 MySQL 服务,平台仅映射 Web 端口 |
| ez_wordpress | NCTF 2023 | 需要 web+db 多容器编排,且 deploy.zip 27MB |
| house of click | NCTF 2023 | 需要 backend+db(ClickHouse)+frontend 多容器编排 |
| admin_Test | 巅峰极客 2024 | 同赛已选 GoldenHornKing,本题无 Dockerfile |
| Classic Childhood Game | HGAME 2023 | 同赛已选 3 题,且 easy 名额已占用 |

### 第四批跳过记录(已更新)

| 候选 | 比赛 | 原因 |
|------|------|------|
| internal_api | NCTF 2024 | 依赖 selenium/standalone-chrome bot 第二容器 |
| EzCalc | 强网杯 S8 2024 | 含 app + puppeteer bot 多容器,且 bot 硬编码作者域名 |
| 2024 鹏城杯 Web 题 | 鹏城杯 2024 | 原仓库仅 README,附件在百度网盘 |
| 羊城杯 2024 Web 题 | 羊城杯 2024 | CTF-Archives 归档仓库只有 README 元数据,无源码/Dockerfile |
## 第五批(2026-07-20 选题,10 道)

来源比赛:2025 长城杯决赛(3 道)、2023 蓝帽杯初赛(1 道)、SUSCTF 2024(3 道)、2023 安洵杯(2 道)、NCTF 2024(1 道)。实际配比 2 easy / 6 medium / 2 hard。

> 构建备注:本次构建时 Docker Desktop 无法直连 Docker Hub,通过使用本地已缓存镜像或 docker.m.daocloud.io 等镜像源完成基础镜像拉取。`susctf-2024-webhook-as-a-service` 原 Dockerfile 要求 Go 1.23,额外拉取 `golang:1.23` 并设置 `GOPROXY=https://goproxy.cn,direct` + `GOSUMDB=off` 完成模块下载。`nctf-2024-internal-api` 改造为单容器:bot 连接 `localhost:4444`,`/internal/search` 只允许本机回环访问,并在同一镜像内安装 chromium + chromium-driver。

| 题目 | 比赛 | 难度 | 端口 | 考点 | writeup | 状态 |
|------|------|------|------|------|---------|------|
| Deprecated | 2025 长城杯决赛 | medium | 1337 | JWT algorithm confusion + SQLite 注入/文件读取 | [官方附件](https://github.com/CTF-Archives/2025-ccb-final/releases/tag/attachment) | 已部署 |
| EzWebSite | 2025 长城杯决赛 | medium | 80 | PHP/YouDianCMS 漏洞 getshell 后读取 | [官方附件](https://github.com/CTF-Archives/2025-ccb-final/releases/tag/attachment) | 已部署 |
| SolidRockMonitor | 2025 长城杯决赛 | medium | 8080 | Shiro rememberMe 反序列化 | [官方附件](https://github.com/CTF-Archives/2025-ccb-final/releases/tag/attachment) | 已部署 |
| LovePHP | 2023 蓝帽杯初赛 | easy | 80 | PHP 反序列化 + file() 函数读取 | [官方仓库](https://github.com/2023-Bluehat-Quals) | 已部署 |
| note taking 1 | SUSCTF 2024 | easy | 3000 | web cache deception / 存储型 XSS + bot 访问 | [官方 PDF](https://github.com/susers/susctf-2024/blob/master/writeup.pdf) | 已部署 |
| vote_now | SUSCTF 2024 | easy | 9000 | Flask 投票逻辑 + PoW | [官方 PDF](https://github.com/susers/susctf-2024/blob/master/writeup.pdf) | 已部署 |
| webhook-as-a-service | SUSCTF 2024 | medium | 8080 | Go Iris SSTI/RCE | [官方 PDF](https://github.com/susers/susctf-2024/blob/master/writeup.pdf) | 已部署 |
| What's my name | 2023 安洵杯 | medium | 80 | PHP create_function 匿名函数名利用 | [官方 Writeup](https://github.com/D0g3-Lab/i-SOON_CTF_2023/blob/main/Writeup/Web.md) | 已部署 |
| internal_api | NCTF 2024 | hard | 8000 | Rust + Chromium bot + 内部 API | [官方 Writeup](https://github.com/X1cT34m/NCTF2024/blob/main/Writeup/Web.md) | 已部署 |
| ezjava | 2023 安洵杯 | hard | 80 | Java Spring Boot 反序列化 | [官方 Writeup](https://github.com/D0g3-Lab/i-SOON_CTF_2023/blob/main/Writeup/Web.md) | 已部署 |

### 第五批跳过记录

| 候选 | 比赛 | 原因 |
|------|------|------|
| 无 | - | 本批次 10 题全部成功部署 |

## 第六批(2026-07-20 选题,10 道)

来源比赛:OMCTF 2024(2 道)、CISCN 2024 初赛(2 道)、巅峰极客 2024(1 道)、浙江省大学生网络与信息安全竞赛 2024 决赛(2 道)、强网杯 2025 线上赛(1 道)、ISCC 2024 练武 WEEK2(1 道)、羊城杯 2024 本科组(1 道)。实际配比 2 easy / 5 medium / 3 hard。

> 构建备注:本次构建时 Docker Desktop 无法直连 Docker Hub。`omctf-2024-justxss` 使用清华 TUNA 镜像源安装 Chromium;`omctf-2024-messy-mongo` 基础镜像由 `debian:12-slim` 改为本地已缓存的 `debian:bookworm`,通过同一镜像源安装 MongoDB,Deno 二进制从本地缓存的 `denoland/deno:1.46.3` 复制;`dfjk-2024-php-online` 通过 `sudo` 以 `www-data`/`nobody` 用户运行 PHP 沙箱。`ciscn-2024-ezjava` 和 `ycb-2024-ycbjava` 的 Spring Boot 默认端口非 8080,在 Dockerfile 中通过 `-Dserver.port=8080` 强制监听 8080。

| 题目 | 比赛 | 难度 | 端口 | 考点 | writeup | 状态 |
|------|------|------|------|------|---------|------|
| JustXSS | OMCTF 2024 | medium | 1898 | CSP + 存储型 XSS + Puppeteer bot | [官方 Writeup](https://github.com/CTF-Archives/2024-OMCTF/blob/main/writeup.pdf) | 已部署 |
| Messy Mongo | OMCTF 2024 | medium | 1898 | MongoDB NoSQL 注入 | [官方 Writeup](https://github.com/CTF-Archives/2024-OMCTF/blob/main/writeup.pdf) | 已部署 |
| mossfern | CISCN 2024 初赛 | hard | 5000 | Python 沙箱绕过 | [CSDN](https://blog.csdn.net/uuzeray/article/details/139052904) | 已部署 |
| ezjava | CISCN 2024 初赛 | medium | 8080 | Java 反序列化/RCE | [CSDN](https://blog.csdn.net/uuzeray/article/details/139052904) | 已部署 |
| php_online | 巅峰极客 2024 | medium | 80 | Flask + PHP 沙箱命令执行 | [exp10it](https://exp10it.io/2024/08/%E5%B7%85%E5%B3%B0%E6%9E%81%E5%AE%A2-2024-%E5%88%9D%E8%B5%9B-web-writeup/) | 已部署 |
| Web2 | 浙江省大学生网络与信息安全竞赛 2024 决赛 | easy | 80 | PHP 无参数 RCE | 无 | 已部署 |
| web3 | 浙江省大学生网络与信息安全竞赛 2024 决赛 | hard | 80 | PHP 反序列化 POP 链 | 无 | 已部署 |
| Web-api | 强网杯 2025 线上赛 | easy | 80 | PHP 文件上传/日志写入 RCE | 无 | 已部署 |
| WEEK2-web1 | ISCC 2024 练武 WEEK2 | medium | 5000 | 签名绕过 + 文件读取 | 无 | 已部署 |
| ycbjava | 羊城杯 2024 本科组 | medium | 8080 | Java 反序列化/RCE | 无 | 已部署 |

### 第六批跳过记录

| 候选 | 比赛 | 原因 |
|------|------|------|
| 无 | - | 本批次 10 题全部成功部署 |

## 第七批(2026-07-21 选题,10 道)

来源比赛:强网杯 2025 线上赛(1 道)、2025 长城杯半决赛(3 道)、2025 CCB-CISCN 初赛(2 道)、2024 CCB-CISCN 半决赛(2 道)、2024 网鼎杯白虎组初赛(1 道)、2023 强网杯(1 道)。实际配比 4 easy / 7 medium。

> 构建备注:本次构建时 Docker Desktop 无法直连 Docker Hub,全部 Dockerfile 均改用本地已缓存镜像或镜像源。PHP 挑战统一使用 `php:7.3-apache`;`easy_time` 简化为单 Flask 容器运行 `index.py` 监听 5000;`update_demo` 原始 web_demo/index.php 为空,已用最小上传/解压服务补全;`intrabadge` 端口含大写导致镜像标签不合法,已改为小写 `intrabadge`;`mediadrive` 同理改为小写 `mediadrive`;`ezruby` 在 Debian bookworm 中需额外安装 `ruby-bundler` 才能执行 `bundle install`;`wdb-baihu-2024-web-01` 端口由 8881 改为 8080,并补充 dist 占位文件,但因 rustc 1.85.1 与 actix-web 4.14 要求的 Rust 1.88 不兼容且本地无更新 Rust 镜像而构建失败;`javasql` 单容器启动 MariaDB + Java jar + Python Flask,secretKey 写入静态 flag;`happygame` 为普通 Java jar(gRPC 监听 80)。

| 题目 | 比赛 | 难度 | 端口 | 考点 | writeup | 状态 |
|------|------|------|------|------|---------|------|
| 日志系统-api | 强网杯 2025 线上赛 | easy | 80 | PHP 日志写入/文件上传 RCE | 无 | 已部署 |
| easy_time | 2025 长城杯半决赛 | easy | 5000 | Flask 应用漏洞读取 flag | 无 | 已部署 |
| update_demo | 2025 长城杯半决赛 | easy | 80 | 上传 update.tar.gz 覆盖 index.php RCE | 无 | 已部署 |
| Deprecated | 2025 CCB-CISCN 初赛 | medium | 8080 | Node.js Express + SQLite 注入/文件读取 | 无 | 已部署 |
| IntraBadge | 2025 长城杯半决赛 | medium | 5000 | Flask + Redis + SSTI/SSRF | 无 | 已部署 |
| MediaDrive | 2025 长城杯半决赛 | medium | 80 | PHP 文件上传/预览读取 flag | 无 | 已部署 |
| ezruby | 2024 CCB-CISCN 半决赛 | easy | 4567 | Ruby Sinatra 对象注入/SSRF | 无 | 已部署 |
| bookmanager | 2024 CCB-CISCN 半决赛 | medium | 8080 | Solon Java 应用漏洞读取 flag | 无 | 已部署 |
| web-01 | 2024 网鼎杯白虎组初赛 | medium | 8080 | Rust actix-web 图像上传逻辑漏洞 | 无 | 构建失败 |
| JavaSql | 2025 CCB-CISCN 初赛 | medium | 8080 | Python 代理 + Java Spring Boot + MariaDB SQL 注入 | 无 | 已部署 |
| happygame | 2023 强网杯 | medium | 80 | Java 反序列化 gadget 读取 flag | 无 | 已部署 |

> 注：`web-01` 因 Rust 版本不兼容构建失败后，补充同批次 `2025 龙信杯决赛 ezzupload` 作为第 10 题，实际最终配比 5 easy / 7 medium。

| ezzupload | 2025 龙信杯决赛 | easy | 80 | PHP 上传绕过/隐藏文件竞争读取 flag | 无 | 已部署 |

### 第七批失败记录

| 候选 | 比赛 | 原因 |
|------|------|------|
| web-01 | 2024 网鼎杯白虎组初赛 | 构建失败：rustc 1.85.1 与 actix-web 4.14 要求的 Rust 1.88 不兼容，本地无更新 Rust 镜像 |

## 第八批(2026-07-21 选题,10 道)

来源比赛:巅峰极客 2024(1 道)、2024 强网杯 青少年专项赛(3 道)、SUSCTF 2024(1 道)、2025 鹏城杯初赛(1 道)、巅峰极客 Lab(1 道)、2024 CCB-CISCN 半决赛/赛区赛(1 道)、CISCN 2025 决赛 AWDP(2 道)。实际配比 4 easy / 4 medium / 2 hard。

> 构建备注:本次全部源码来自本地 `.tmp/` 目录。`susctf-2024-note-taking-1` 已在第五批部署，本批仅更新 flag/镜像；`pengcheng-2025-ezdjango` 与 batch4 的 `pcb-2025-ezdjango` 为同源题目，为避免平台标题冲突，本批标题加后缀"（鹏城杯 2025 初赛）"并作为独立题目导入；`dfjk-lab-tpcms` 在单容器内启动 MariaDB + Apache + PHP；`ccbciscn-2024-java-again` 使用 eclipse-temurin:21-jre；`ciscn-finals-2025-awdp-web-ota` 使用 eclipse-temurin:17-jre；`ciscn-finals-2025-awdp-web-rasp` 使用 eclipse-temurin:8-jre 并附加 OpenRASP 1.3.7 agent。`iscc-2025-analysis` 原计划部署，但仓库为静态数据分析面板，没有可攻击的 Web 漏洞点，已替换为同目录下的 `签到漫画` 静态站点。

| 题目 | 比赛 | 难度 | 端口 | 考点 | writeup | 状态 |
|------|------|------|------|------|---------|------|
| admin_Test | 巅峰极客 2024 | easy | 80 | PHP 登录/上传 getshell | 无 | 已部署 |
| mysqlprobe | 2024 强网杯 青少年专项赛 | easy | 80 | PHP 反序列化/命令执行 | 无 | 已部署 |
| note taking 1 | SUSCTF 2024 | easy | 3000 | 存储型 XSS + bot 访问 (flag 已更新) | [官方 PDF](https://github.com/susers/susctf-2024/blob/master/writeup.pdf) | 已更新 |
| ezFindShell | 2024 强网杯 青少年专项赛 | medium | 80 | 在大量 PHP 中定位隐藏 webshell | 无 | 已部署 |
| 签到漫画 | 2024 强网杯 青少年专项赛 | easy | 80 | 静态站点源码审计找 flag | 无 | 已部署 |
| ezDjango（鹏城杯 2025 初赛） | 2025 鹏城杯初赛 | medium | 8000 | Django 缓存 pickle 反序列化 RCE | 无 | 已部署 |
| tpcms | 巅峰极客 Lab | medium | 80 | ThinkPHP 3.2 CMS 漏洞 getshell | 无 | 已部署 |
| java_again | 2024 CCB-CISCN 半决赛/赛区赛 | medium | 8080 | Spring Boot 漏洞 RCE | 无 | 已部署 |
| awdp-web-ota | CISCN 2025 决赛 AWDP | hard | 8080 | Spring Boot 漏洞 RCE | 无 | 已部署 |
| awdp-web-rasp | CISCN 2025 决赛 AWDP | hard | 8080 | OpenRASP 保护下 Spring Boot 漏洞 RCE | 无 | 已部署 |

## 第九批(2026-07-21 选题,10 道)

来源比赛:2025 强网杯线上赛(5 道)、NCTF 2023(1 道)、2024 CISCN 东南赛区(4 道)、2025 龙信杯决赛(1 道)。实际配比 4 easy / 5 medium / 1 hard，另有 5 道 qwbs9 候选因非 Web 或构建困难标记为失败。

> 构建备注:本次在原有 qwbs9 + NCTF 2023 的 5 道基础上，补充部署了 2024 CISCN 东南赛区的 4 道 Web 题（Web-Polluted、Web-submit、Web-粗心的程序员、Web-bigfish）以及 2025 龙信杯决赛的 `ezzupload` 和 `webshell大派送` 中的后者。CISCN 题目均无 Dockerfile，均自写；`Web-bigfish` 为 Node + Puppeteer，需安装 Chromium。`webshell大派送` 为 Python Bottle 单文件，/shell 路由对长度 18 以内的 cmd 执行 exec，通过沙箱逃逸读取 /flag。

| 题目 | 比赛 | 难度 | 端口 | 考点 | writeup | 状态 |
|------|------|------|------|------|---------|------|
| go2php | 2025 强网杯线上赛 | medium | 80 | PHP 扩展 + 文件上传 RCE | 无 | 已部署 |
| bbjv | 2025 强网杯线上赛 | medium | 8080 | Java jar 漏洞 RCE | 无 | 已部署 |
| CeleRace | 2025 强网杯线上赛 | hard | 5000 | Flask + Celery + Redis SSRF/任务队列 | 无 | 已部署 |
| SecretVault | 2025 强网杯线上赛 | medium | 5555 | Go JWT 认证代理 + Flask Vault 逻辑 | 无 | 已部署 |
| ez_wordpress | NCTF 2023 | medium | 80 | WordPress 反序列化 RCE | 无 | 已部署 |
| Web-Polluted | 2024 CISCN 东南赛区 | easy | 80 | Flask 原型链污染 session 伪造 | 无 | 已部署 |
| Web-submit | 2024 CISCN 东南赛区 | easy | 80 | PHP 上传绕过 getshell | 无 | 已部署 |
| Web-粗心的程序员 | 2024 CISCN 东南赛区 | medium | 80 | PHP + MySQL 注入/日志写入 | 无 | 已部署 |
| Web-bigfish | 2024 CISCN 东南赛区 | medium | 80 | Node-serialize 反序列化 + Puppeteer bot | 无 | 已部署 |
| webshell大派送 | 2025 龙信杯决赛 | easy | 5555 | Python Bottle 长度限制 exec 沙箱逃逸 | 无 | 已部署 |

### 第九批失败记录

| 候选 | 比赛 | 原因 |
|------|------|------|
| sockserver | 2025 强网杯线上赛 | 自定义二进制服务端口 1080，不支持标准 SOCKS5 CONNECT，无法通过浏览器/HTTP 访问，非标准 Web 挑战 |
| PTertar | 2025 强网杯线上赛 | 大型 Laravel + OpenResty 多服务应用，无 Dockerfile，单容器化工作量过大且不稳定 |
| yamcs附件 | 2025 强网杯线上赛 | Dockerfile 依赖 git clone GitHub 与 Maven 构建，无网络/GitHub 访问时无法构建 |
| Interrogation_Room | 2025 强网杯线上赛 | TCP socket 交互式逻辑谜题，非 HTTP/Web 服务 |
| babyjs | 2025 强网杯线上赛 | xinetd + quickjs 沙盒逃逸，属于 Pwn 而非 Web |



## 第十批(2026-07-21 选题,10 道)

来源比赛:SDNISC 2025(1 道)、HKCTF 2025 Quals(3 道)、OpenHarmony CTF 2025(2 道)、JSWA 2025(1 道)、Sanxia CTF 2024(1 道)、西湖论剑 2023(1 道)、巅峰极客 2024(1 道)。实际配比 4 easy / 5 medium / 1 hard。

> 构建备注:本次全部源码来自本地 `.tmp/` 目录。`openharmony-2025-layers` 原始 Dockerfile 使用 `docker.1ms.run/library/php:apache`,该镜像无法解析,已改为 `docker.m.daocloud.io/library/php:apache`;所有题目 Dockerfile 中的 `flag{placeholder}` 均已替换为登记表中的静态 flag。所有 10 道镜像均成功构建并导出到 `docker-images/`。

| 题目 | 比赛 | 难度 | 端口 | 考点 | writeup | 状态 |
|------|------|------|------|------|---------|------|
| web | SDNISC 2025 | easy | 5000 | Flask JWT 算法混淆/权限提升 | 无 | 已部署 |
| ezjs | HKCTF 2025 Quals | easy | 80 | JSON5 解析 + Pug 模板渲染 | 无 | 已部署 |
| nettool | HKCTF 2025 Quals | medium | 80 | FastAPI 管理后台 HTTP 工具 SSRF | 无 | 已部署 |
| labyrinth | HKCTF 2025 Quals | hard | 8080 | Spring Boot 复杂逻辑/迷宫 | 无 | 已部署 |
| layers | OpenHarmony CTF 2025 | easy | 80 | PHP 多层权限绕过/模板注入 | 无 | 已部署 |
| filesystem | OpenHarmony CTF 2025 | medium | 3000 | NestJS 文件上传/解压/路径穿越 | 无 | 已部署 |
| web1 | JSWA 2025 | easy | 80 | Node 登录校验/Cookie 伪造 | 无 | 已部署 |
| textme | Sanxia CTF 2024 | medium | 80 | Rust 预编译服务漏洞 | 无 | 已部署 |
| ezupload | 西湖论剑 2023 | medium | 8080 | Spring Boot 文件上传漏洞 | 无 | 已部署 |
| oldapi | 巅峰极客 2024 | medium | 80 | Spring Boot 旧 API + nginx 反代 | 无 | 已部署 |

### 第十批跳过记录

| 候选 | 比赛 | 原因 |
|------|------|------|
| 无 | - | 本批次 10 题全部成功部署 |


## 第十一批(2026-07-21 选题,10 道)

来源比赛:NewStar CTF 2025。实际配比 6 easy / 3 medium / 1 hard。

> 构建备注:NewStar CTF 2025 在 Docker Hub 发布官方环境镜像 `openctf/newstar-2025:<tag>`。由于本地 Docker 无法直连 Docker Hub,基础镜像通过镜像源 `docker.1ms.run` 和 `hub.rat.dev` 拉取后再 `docker tag` 回原名。原题使用动态 flag 环境变量 `ICQ_FLAG`,统一改造为 Dockerfile 内 `ENV` 写入平台静态 flag。`strange_login` 和 `whitek2` 在常规 `docker buildx` 构建时因层 blob 解析回源 Docker Hub 失败,已改用 `docker export`  flatten 为单一层镜像后重新打包。`废弃的网站` 额外从 GitHub Release 下载了附件 `app.py`。

| 题目 | 比赛 | 难度 | 端口 | 考点 | writeup | 状态 |
|------|------|------|------|------|---------|------|
| 别笑，你也过不了第二关 | NewStar CTF 2025 | easy | 80 | 前端小游戏/源码审计 | [博客园](https://www.cnblogs.com/sbhglqy/p/19677307) | 已部署 |
| 宇宙的中心是 PHP | NewStar CTF 2025 | easy | 11451 | PHP 基础 | [博客园](https://www.cnblogs.com/sbhglqy/p/19677307) | 已部署 |
| multi-headach3 | NewStar CTF 2025 | easy | 80 | HTTP 头相关 | [博客园](https://www.cnblogs.com/sbhglqy/p/19677307) | 已部署 |
| strange_login | NewStar CTF 2025 | easy | 80 | SQLi 登录 | [博客园](https://www.cnblogs.com/sbhglqy/p/19677307) | 已部署 |
| 真的是签到诶 | NewStar CTF 2025 | easy | 80 | 编码绕过/签到 | [博客园](https://www.cnblogs.com/sbhglqy/p/19677307) | 已部署 |
| 小 E 的秘密计划 | NewStar CTF 2025 | easy | 80 | 数据泄露 | [博客园](https://www.cnblogs.com/sbhglqy/p/19677307) | 已部署 |
| 黑客小 W 的故事（1） | NewStar CTF 2025 | medium | 8000 | HTTP 协议 | [博客园](https://www.cnblogs.com/sbhglqy/p/19677307) | 已部署 |
| 白帽小 K 的故事（2） | NewStar CTF 2025 | medium | 80 | SQLi | [博客园](https://www.cnblogs.com/sbhglqy/p/19677307) | 已部署 |
| 武功秘籍 | NewStar CTF 2025 | medium | 80 | CVE 相关 | [博客园](https://www.cnblogs.com/sbhglqy/p/19677307) | 已部署 |
| 废弃的网站 | NewStar CTF 2025 | hard | 5000 | 条件竞争/RCE | [博客园](https://www.cnblogs.com/sbhglqy/p/19677307) | 已部署 |

### 第十一批跳过记录

| 候选 | 比赛 | 原因 |
|------|------|------|
| 无 | - | 本批次 10 题全部成功部署 |


## 第十二批(2026-07-21 选题,10 道)

来源比赛:NewStar CTF 2025。实际配比 5 easy / 3 medium / 2 hard。

> 构建备注:沿用第 11 批 NewStar 2025 官方环境镜像。`week3_mirror-gate` 因 docker.1ms.run 与 hub.rat.dev 均无法完整拉取层 blob,已替换为同比赛 `week4_e-board`（小 E 的留言板）。`week4_sqlupload` 在 buildx 导出阶段因层 blob 回源 Docker Hub 失败,改用 `docker export` + `FROM scratch` 重新 flatten 打包。

| 题目 | 比赛 | 难度 | 端口 | 考点 | writeup | 状态 |
|------|------|------|------|------|---------|------|
| 我真得控制你了 | NewStar CTF 2025 | medium | 80 | 弱口令/登录 | [博客园](https://www.cnblogs.com/sbhglqy/p/19677307) | 已部署 |
| 搞点哦润吉吃吃🍊 | NewStar CTF 2025 | easy | 5000 | 脚本编写/自动化 | [博客园](https://www.cnblogs.com/sbhglqy/p/19677307) | 已部署 |
| DD 加速器 | NewStar CTF 2025 | easy | 80 | RCE | [博客园](https://www.cnblogs.com/sbhglqy/p/19677307) | 已部署 |
| ez-chain | NewStar CTF 2025 | easy | 80 | PHP POP 链 | [博客园](https://www.cnblogs.com/sbhglqy/p/19677307) | 已部署 |
| MyGO!!! | NewStar CTF 2025 | easy | 80 | SSRF | [博客园](https://www.cnblogs.com/sbhglqy/p/19677307) | 已部署 |
| 小 E 的留言板 | NewStar CTF 2025 | medium | 5000 | XSS | [博客园](https://www.cnblogs.com/sbhglqy/p/19677307) | 已部署 |
| who'ssti | NewStar CTF 2025 | medium | 5000 | SSTI | [博客园](https://www.cnblogs.com/sbhglqy/p/19677307) | 已部署 |
| SSTI 在哪里？ | NewStar CTF 2025 | easy | 80 | SSRF/SSTI | [博客园](https://www.cnblogs.com/sbhglqy/p/19677307) | 已部署 |
| sqlupload | NewStar CTF 2025 | hard | 80 | SQLi + 文件上传 | [博客园](https://www.cnblogs.com/sbhglqy/p/19677307) | 已部署 |
| 小 W 和小 K 的故事（最终章） | NewStar CTF 2025 | hard | 3000 | Node.js | [博客园](https://www.cnblogs.com/sbhglqy/p/19677307) | 已部署 |

### 第十二批跳过记录

| 候选 | 比赛 | 原因 |
|------|------|------|
| mirror_gate | NewStar CTF 2025 | docker.1ms.run 与 hub.rat.dev 均无法完整拉取层 blob,替换为 e-board |


## 第十三批(2026-07-22 选题,10 道)

来源比赛:NewStar CTF 2025(7 道)、2025 能源网络安全大赛(2 道)、2025 鹏云杯山东省大学生网络安全技能大赛(1 道)。实际配比 1 easy / 4 medium / 5 hard。

> 构建备注:NewStar 2025 沿用镜像源 `docker.1ms.run` 拉取后 `docker tag` 回原名。`energyCTF2025` 的 2 道 Web 题和 `SDNISC` 的 `web1_fix` 均从 GitHub README / Release 获取源码,自写 Dockerfile;构建前需先从镜像源拉取 `php:7.4-apache`、`node:18`、`python:3.11-slim` 等基础镜像并重新 tag,否则 Docker Desktop buildx 回源 Docker Hub 会失败。

| 题目 | 比赛 | 难度 | 端口 | 考点 | writeup | 状态 |
|------|------|------|------|------|---------|------|
| 白帽小 K 的故事（1） | NewStar CTF 2025 | hard | 80 | HTTP 协议/渗透 | [博客园](https://www.cnblogs.com/sbhglqy/p/19677307) | 已部署 |
| 小 E 的管理系统 | NewStar CTF 2025 | hard | 80 | SQL 拼接绕过防火墙 | [博客园](https://www.cnblogs.com/sbhglqy/p/19677307) | 已部署 |
| 小羊走迷宫 | NewStar CTF 2025 | medium | 11451 | 反序列化/伪协议 | [博客园](https://www.cnblogs.com/sbhglqy/p/19677307) | 已部署 |
| 被玩坏的 AI | NewStar CTF 2025 | medium | 80 | HTTP 响应拆分/CRLF | [博客园](https://www.cnblogs.com/sbhglqy/p/19677307) | 已部署 |
| 眼熟的计算器 | NewStar CTF 2025 | hard | 9999 | 计算器相关 | [博客园](https://www.cnblogs.com/sbhglqy/p/19677307) | 已部署 |
| Binary Blog | NewStar CTF 2025 | hard | 80 | 二进制博客 | [博客园](https://www.cnblogs.com/sbhglqy/p/19677307) | 已部署 |
| who'ssti revenge | NewStar CTF 2025 | hard | 5000 | SSTI | [博客园](https://www.cnblogs.com/sbhglqy/p/19677307) | 已部署 |
| 这网页怪怪的 | 2025 能源网络安全大赛 | easy | 80 | PHP 弱类型 + 文件包含 | [官方 README](https://github.com/CTF-Archives/energyCTF2025/blob/main/README.md) | 已部署 |
| easy_node | 2025 能源网络安全大赛 | medium | 3000 | Node.js 原型链污染 + Handlebars SSTI | [官方 README](https://github.com/CTF-Archives/energyCTF2025/blob/main/README.md) | 已部署 |
| web1_fix | 2025 鹏云杯山东省大学生网络安全技能大赛 | medium | 5000 | JWT 算法混淆 + SSTI | [官方 README](https://github.com/CTF-Archives/2025-SDNISC-haixuan/blob/main/README.md) | 已部署 |

### 第十三批跳过记录

| 候选 | 比赛 | 原因 |
|------|------|------|
| 无 | - | 本批次 10 题全部成功部署 |

## 第十四批(2026-07-22 选题,10 道)

来源比赛:2026 NCO Quals(1 道)、2026 NCO Final(2 道)、2025 尖峰山杯 Quals/Final(4 道)、2024 蓝桥杯总决赛(1 道)、2023 沈阳车联网安全大赛(1 道)、2025 CISCN 总决赛(1 道)。实际配比 2 easy / 5 medium / 3 hard。

> 构建备注:`nco-2026` 的 Flask 应用原仓库缺少依赖声明,在 Dockerfile 中补充 `pip install flask` 并安装 `python-jwt` 等依赖;`pino` 使用阿里云 apt 镜像加速;`lanqiao-2024-java-again`、`shenyang-2023-expr`、`ciscn-2025-awdp-web-ota` 使用 `docker.m.daocloud.io/library/eclipse-temurin:17-jre-alpine` 作为基础镜像;`awdp-web-ota` 原 JWT secret 过短,在 Dockerfile 中设置长度满足 HS256 要求。

| 题目 | 比赛 | 难度 | 端口 | 考点 | writeup | 状态 |
|------|------|------|------|------|---------|------|
| 个性签名生成器 | 2026 NCO Quals | medium | 5004 | Jinja2 SSTI 绕过黑名单 | [官方仓库](https://github.com/CTF-Archives/2026-NCO-Quals) | 已部署 |
| Pino | 2026 NCO Final | medium | 5007 | ping 命令注入绕过黑名单 | [官方仓库](https://github.com/CTF-Archives/2026-NCO-Final) | 已部署 |
| Mamba Out | 2026 NCO Final | hard | 5005 | WriteUp 提交/状态竞争 | [官方仓库](https://github.com/CTF-Archives/2026-NCO-Final) | 已部署 |
| generate_svg | 2025 尖峰山杯 Final | medium | 80 | PHP + XML 外部实体 | [官方仓库](https://github.com/CTF-Archives/2025-jksn-final) | 已部署 |
| web4 | 2025 尖峰山杯 Final | easy | 80 | Session 文件污染 + LFI | [官方仓库](https://github.com/CTF-Archives/2025-jksn-final) | 已部署 |
| 727php | 2025 尖峰山杯 Quals | easy | 80 | MIME 校验绕过 + webshell | [官方仓库](https://github.com/CTF-Archives/2025-jksn-quals) | 已部署 |
| 720unserialize | 2025 尖峰山杯 Quals | medium | 80 | PHP 反序列化链 | [官方仓库](https://github.com/CTF-Archives/2025-jksn-quals) | 已部署 |
| java_again | 2024 蓝桥杯总决赛 | medium | 8888 | Java 自定义反序列化 | [官方仓库](https://github.com/CTF-Archives/2024-LanqiaoCup-Finals) | 已部署 |
| expr | 2023 沈阳车联网安全大赛 | hard | 8080 | Java SecureObjectInputStream 反序列化 | [官方仓库](https://github.com/CTF-Archives/2023-ShenYangCarSecurity-CTF) | 已部署 |
| awdp-web-ota | 2025 CISCN 总决赛 | hard | 8000 | JWT + H2 JDBC 攻击链 | [官方仓库](https://github.com/CTF-Archives/2025-CISCN-Finals) | 已部署 |

### 第十五批(2026-07-22 选题,10 道)

来源比赛:2026 NCO 入围测试(3 道)、2025 尖峰山杯初赛(3 道)、2024 三峡杯网络安全大赛(1 道)、2025 能源网络安全大赛(1 道)、2025 CISCN 总决赛(1 道)、本地未归档源码(1 道)。实际配比 4 easy / 1 medium / 5 hard。

> 构建备注:`sanxia-2024-babyjava` 实际监听 80，`ciscn-2025-finals-security-rasp` 实际监听 8080，登记表已修正。`deprecated-compare` 位于 `docker/ctf-contests/deprecated-compare`（非二级目录），使用 `docker build` + `docker save` 手动构建。`jksn-quals-include` 将原外部 MySQL 改为单容器内置 MariaDB。

| 题目 | 比赛 | 难度 | 端口 | 考点 | writeup | 状态 |
|------|------|------|------|------|---------|------|
| 超级无敌保险箱 | 2026 NCO 入围测试 | easy | 80 | 前端源码/注释分析 | [官方仓库](https://github.com/CTF-Archives/2026-NCO-Quals) | 已部署 |
| 星辰艺术馆 | 2025 尖峰山杯初赛 | easy | 80 | robots.txt / 信息收集 | [官方仓库](https://github.com/CTF-Archives/2025-jksn-quals) | 已部署 |
| 蜀道难 | 2025 尖峰山杯初赛 | easy | 80 | 前端源码/实体编码隐藏 | [官方仓库](https://github.com/CTF-Archives/2025-jksn-quals) | 已部署 |
| 通告下载 | 2025 尖峰山杯初赛 | medium | 80 | PHP 路径穿越读取 /flag | [官方仓库](https://github.com/CTF-Archives/2025-jksn-quals) | 已部署 |
| 电子宠物 | 2025 尖峰山杯初赛 | medium | 3000 | Node.js 原型链污染 | [官方仓库](https://github.com/CTF-Archives/2025-jksn-quals) | 已部署 |
| 学生成绩查询系统 | 2025 尖峰山杯初赛 | hard | 80 | PHP 文件包含 + 上传 + MariaDB 单容器化 | [官方仓库](https://github.com/CTF-Archives/2025-jksn-quals) | 已部署 |
| BabyJava | 2024 三峡杯网络安全大赛 | hard | 80 | Java 自定义反序列化 + Filter | [官方仓库](https://github.com/CTF-Archives/2024-Sanxia-CTF) | 已部署 |
| Internal_JDBC_Hack | 2025 能源网络安全大赛 | hard | 8080 | Spring Boot + H2 JDBC 攻击链 | [官方仓库](https://github.com/CTF-Archives/energyCTF2025) | 已部署 |
| awdp-web-security_rasp | 2025 CISCN 总决赛 | hard | 8080 | Spring WebFlux + RASP 绕过 | [官方仓库](https://github.com/CTF-Archives/2025-CISCN-Finals) | 已部署 |
| Deprecated Compare | 2025 CTF 归档 | hard | 8080 | JWT 算法混淆 + SQLite + 文件读取 | local | 已部署 |

### 第十五批跳过记录

| 候选 | 比赛 | 原因 |
|------|------|------|
| 无 | - | 本批次 10 题全部成功部署 |

## 第十六批(2026-07-25 选题,10 道)

来源比赛:2025 尖峰山杯初赛(2 道)、2026 CCSSSC 半决赛(1 道)、2023 强网杯(3 道)、2024 强网杯半决赛(2 道)、2023 全国大学生信息安全竞赛(1 道)、2025 CISCN 总决赛(1 道)。实际配比 2 easy / 8 medium。

> 构建备注:`login` 使用 `ctftraining/base_image_nginx_mysql_php_73` 单容器化,flag 写入 MySQL 数据库;`thinkshop`/`thinkshopping`/`awdp-web-rbac` 由官方 release 镜像 tar 导入,重写 flag 后重新保存;`DeserBug` 实际监听 8888,登记表已修正;`HappyGame` 为 gRPC 服务,HTTP 根路径不响应,服务本身可正常启动。

| 题目 | 比赛 | 难度 | 端口 | 考点 | writeup | 状态 |
|------|------|------|------|------|---------|------|
| download | 2025 尖峰山杯初赛 | easy | 80 | 文件上传 MIME 校验 + 文件包含 | [官方仓库](https://github.com/CTF-Archives/2025-jksn-quals) | 已部署 |
| login | 2025 尖峰山杯初赛 | easy | 80 | PHP MySQL 登录 / SQL 注入 / md5 盐绕过 | [官方仓库](https://github.com/CTF-Archives/2025-jksn-quals) | 已部署 |
| nodejs | 2026 CCSSSC 半决赛 | medium | 3000 | Node.js vm2 原型链污染逃逸 | [官方仓库](https://github.com/CTF-Archives/2026-CCSSSC-Semis) | 已部署 |
| HappyGame | 2023 强网杯 | medium | 80 | Java gRPC 服务读取 /flag | local | 已部署 |
| proxy1 | 2024 强网杯半决赛 | medium | 8000 | Go 代理 + SUID readflag | local | 已部署 |
| proxy2 | 2024 强网杯半决赛 | medium | 8000 | Go 代理升级 | local | 已部署 |
| DeserBug | 2023 全国大学生信息安全竞赛 | medium | 8888 | Java 反序列化 (CC + Hutool) | [官方仓库](https://github.com/CTF-Archives/CTF-Archive-CN) | 已部署 |
| thinkshop | 2023 强网杯 | medium | 80 | PHP 商店应用 | [官方仓库](https://github.com/CTF-Archives/2023-qwbs7) | 已部署 |
| thinkshopping | 2023 强网杯 | medium | 80 | PHP 商店应用续作 | [官方仓库](https://github.com/CTF-Archives/2023-qwbs7) | 已部署 |
| awdp-web-rbac | 2025 CISCN 总决赛 | medium | 80 | Go Web RBAC | [官方仓库](https://github.com/CTF-Archives/CISCN-2025-Finals-AWDP) | 已部署 |

## 第十七批(2026-07-26 选题,10 道)

来源比赛:HGAME 2023(1 道)、2025 尖峰山杯决赛(3 道)、AWDP 训练(3 道)、Socialgroup CTF 2022(1 道)、2023 某比赛(1 道)、2023 福建省大学生网络安全竞赛(1 道)。实际配比 1 easy / 8 medium / 1 hard。

> 构建备注:本次 10 道题中仅 `hgame-2023-git-leakage` 自带 Dockerfile,其余 9 道均为本地源码/单文件,需自写 Dockerfile。`jksn-2025-final-web5` 为 PHP + MySQL 多组件,已单容器化内置 MariaDB;`awdp-web-fobee` 为 Java Solon + Beetl 应用;`socialgroup-web-easyinstall` 为 ThinkPHP 安装模块逻辑漏洞;`web-go-session` 为 Go 服务内嵌 Flask 5000;`fjsdxssjan-2023-no-rce-zentao` 为完整禅道 PHP 应用,单容器内置 MariaDB。所有镜像均成功构建并导出到 `docker-images/`。

| 题目 | 比赛 | 难度 | 端口 | 考点 | writeup | 状态 |
|------|------|------|------|------|---------|------|
| Git Leakage | HGAME 2023 | easy | 80 | .git 泄漏读取 flag | [官方仓库](https://github.com/ek1ng/My-CTF-Challenges) | 已部署 |
| web2 | 2025 尖峰山杯决赛 | medium | 80 | PHP SVG XXE / 文件读取 | [官方仓库](https://github.com/CTF-Archives/2025-jksn-final) | 已部署 |
| web4 | 2025 尖峰山杯决赛 | medium | 80 | PHP Session 文件污染 + LFI | [官方仓库](https://github.com/CTF-Archives/2025-jksn-final) | 已部署 |
| web5 | 2025 尖峰山杯决赛 | medium | 80 | PHP + MySQL 注入 + 反序列化触发 eval | [官方仓库](https://github.com/CTF-Archives/2025-jksn-final) | 已部署 |
| AWDP-WEB-ezjs | AWDP 训练 | medium | 3000 | Node.js + Express + EJS 模板 | local | 已部署 |
| AWDP-WEB-ShareCard | AWDP 训练 | medium | 8888 | Flask + Jinja2 + JWT | local | 已部署 |
| AWDP-WEB-Fobee | AWDP 训练 | medium | 8080 | Java Solon + Beetl | local | 已部署 |
| Web-EasyInstall | Socialgroup CTF 2022 | medium | 80 | ThinkPHP 安装模块逻辑漏洞 | [官方仓库](https://github.com/CTF-Archives/Socialgroup) | 已部署 |
| Web-go_session | 2023 某比赛 | medium | 80 | Go 服务 + 内嵌 Flask 5000 | local | 已部署 |
| no_rce_zentao | 2023 福建省大学生网络安全竞赛 | hard | 80 | 完整禅道 PHP 应用逻辑漏洞 | [官方仓库](https://github.com/CTF-Archives/2023-fjsdxssjan) | 已部署 |

### 第十七批跳过记录

| 候选 | 比赛 | 原因 |
|------|------|------|
| 无 | - | 本批次 10 题全部成功部署 |


## 第十八批(2026-07-27 选题,10 道)

来源比赛:SDNISC 2025 海选(1 道)、2026 NCO Final(1 道)、AWDP 训练(1 道)、NewStar CTF 2024(1 道)、HGAME 2023(2 道)、2024 西湖论剑(1 道)、2024 强网杯半决赛(1 道)、2025 鹏城杯初赛(2 道)。本次不限难度配比,优先把剩余未完整部署的比赛中容易单容器化的题目补齐。

> 构建备注:`sdnisc-2025-haixuan-web2`、`nco-2026-final-what-can-i-say`、`awdp-web-solonmaster`、`ns24-web-page` 为本地源码/单文件,已补全 Dockerfile;`hgame-2023-gopher-shop`、`hgame-2023-v2board` 由 docker-compose 改造为单容器;`qwb8-2024-semis-ezcalc` 将原 app+bot 双容器合并为单容器,跳过 puppeteer 自带 Chromium 下载,使用 apk chromium;`pengcheng-2025-office`、`pengcheng-2025-oa-system` 为本地发布的源码包,已补全 Dockerfile + MariaDB 初始化。所有 10 道题镜像均已构建导出并导入平台。

| 题目 | 比赛 | 难度 | 端口 | 考点 | writeup | 状态 |
|------|------|------|------|------|---------|------|
| web2 | SDNISC 2025 海选 | medium | 5000 | Flask JWT + python-jwt/jwcrypto | local | 已部署 |
| What CAN I Say | 2026 NCO Final | hard | 5005 | Flask 竞争条件绕过校验 | [官方仓库](https://github.com/CTF-Archives/2026-NCO-Final) | 已部署 |
| AWDP-WEB-SolonMaster | AWDP 训练 | hard | 8080 | Java Solon + Freemarker 反序列化 | local | 已部署 |
| page | NewStar CTF 2024 | medium | 3000 | Koa + Puppeteer XSS bot | [NewStar Wiki](https://newstar.wiki/wp/2024/week4/web/page) | 已部署 |
| Gopher Shop | HGAME 2023 | medium | 8080 | Go/Gin + MySQL | [官方仓库](https://github.com/ek1ng/My-CTF-Challenges) | 已部署 |
| v2board | HGAME 2023 | hard | 80 | PHP Laravel + Redis | [官方仓库](https://github.com/ek1ng/My-CTF-Challenges) | 已部署 |
| ezerp | 2024 西湖论剑 | hard | 8080 | Spring Boot + MariaDB/Redis | local | 已部署 |
| ezcalc | 2024 强网杯半决赛 | hard | 9000 | Go + SQLite + Puppeteer bot | local | 已部署 |
| office | 2025 鹏城杯初赛 | hard | 80 | PHP ThinkPHP OA | local | 已部署 |
| oa_system | 2025 鹏城杯初赛 | hard | 8080 | Java oasys OA | local | 已部署 |

### 第十八批跳过记录

| 候选 | 比赛 | 原因 |
|------|------|------|
| 无 | - | 本批次 10 题全部成功部署 |

## 第十九批(2026-07-28 选题,10 道)

来源比赛:ADCTF 2025(2 道)、TSCTF-J 2025(6 道)、2024 CCB-CISCN Quals(2 道)。实际配比 3 easy / 5 medium / 2 hard,10 道题已全部构建镜像并导入平台。

> 构建备注:`adctf-2025-y2k-bank` 原 Dockerfile 使用 `ghcr.io/astral-sh/uv:debian` 基础镜像,已改为 `python:3.11-slim` 并安装 fastapi/uvicorn/python-jose/pydantic;`ccbciscn-2024-quals-ezruby` 仅有 `main.rb`,已补全 Ruby Dockerfile;`ccbciscn-2024-quals-bookmanager` 仅有 `bookmanager.jar`,已补全 Java JRE Dockerfile;`tsctf-j-2025-filesystem` 和 `tsctf-j-2025-superfilesystem` 原题使用动态 FLAG 环境变量注入随机路径,已改为固定 `/flag`。

| 题目 | 比赛 | 难度 | 端口 | 考点 | writeup | 状态 |
|------|------|------|------|------|---------|------|
| Crossy Road | ADCTF 2025 | easy | 8080 | 前端小游戏/JS 分析 | [官方仓库](https://github.com/GDUTMeow-Challenges/Challenge-Crossy-Road) | deployed |
| Y2K Bank | ADCTF 2025 | medium | 8000 | FastAPI JWT/银行账户逻辑 | [官方仓库](https://github.com/GDUTMeow-Challenges/Challenge-Y2K-Bank) | deployed |
| EZ_Login | TSCTF-J 2025 | easy | 5000 | Flask 验证码+弱密码+XFF+JWT alg=none | [官方仓库](https://github.com/BUPTMerak/TSCTF-J-2025) | deployed |
| EZ_PY | TSCTF-J 2025 | medium | 5000 | Python 原型链污染+SSTI WAF 绕过 | [官方仓库](https://github.com/BUPTMerak/TSCTF-J-2025) | deployed |
| ez_sql | TSCTF-J 2025 | easy | 80 | PHP + MariaDB 字符型 SQL 注入 | [官方仓库](https://github.com/BUPTMerak/TSCTF-J-2025) | deployed |
| 争渡 | TSCTF-J 2025 | medium | 80 | PHP 上传条件竞争+sudo 读 flag | [官方仓库](https://github.com/BUPTMerak/TSCTF-J-2025) | deployed |
| FileSystem | TSCTF-J 2025 | medium | 3000 | Node.js 软链接+session 伪造 | [官方仓库](https://github.com/BUPTMerak/TSCTF-J-2025) | deployed |
| SuperFileSystem | TSCTF-J 2025 | hard | 5000 | Flask 缓存机制 | [官方仓库](https://github.com/BUPTMerak/TSCTF-J-2025) | deployed |
| ezruby | 2024 CCB-CISCN Quals | medium | 8888 | Ruby Sinatra 对象注入+SSRF | [官方仓库](https://github.com/CTF-Archives/2024-CCB-CISCN-Quals) | deployed |
| BookManager | 2024 CCB-CISCN Quals | medium | 8080 | Java Solon + Hessian 反序列化 | [官方仓库](https://github.com/CTF-Archives/2024-CCB-CISCN-Quals) | deployed |

### 第十九批跳过记录

| 候选 | 比赛 | 原因 |
|------|------|------|
| 无 | - | 本批次 10 题均已登记待构建 |

## 第二十批(2026-07-28 选题,10 道)

来源比赛:EOF CTF Qual 2026(1 道)、No Hack No CTF 2025(3 道)、AIS3 Pre-Exam 2025(1 道)、AIS3 Pre-Exam 2026(1 道)、QnQSec CTF 2025(2 道)、NEHS ICED 2024 春季社内赛(2 道)。实际配比 3 easy / 5 medium / 2 hard,10 道题均已导入平台并构建镜像。

> 构建备注:`eof-ctf-qual-2026-linkoreco` 由 nginx+php-fpm docker-compose 改为单容器 php:7.4-apache,flag 写入原路径 `/etc/REDACTED_FILENAME.txt`;`nohacknoctf-2025-when` 保留 nginx+php-fpm 但通过 supervisor 合并为单容器,维持 socket-test 到 127.0.0.1:9000 的 FastCGI 利用链,基础镜像由 php:8.0-fpm 改为 php:8.2-fpm;`nohacknoctf-2025-xxs-xss`、`nohacknoctf-2025-not-xss`、`ais3-pre-exam-2025-lickleak` 使用 python:3.11-slim + chromium,FLAG 改为运行时读取 `/flag`;`ais3-pre-exam-2026-easyweb` 端口改为 5000,基础镜像由 python:3.12-slim 改为 python:3.11-slim;`qnqsec-2025-faas` readflag 改为读取 `/flag`,基础镜像由 php:8.3-apache 改为 php:8.2-apache;`qnqsec-2025-date-logger`、`nehs-iced-2024-click-me`、`nehs-iced-2024-hack-my-x` 端口改为 5000 并替换硬编码 flag 为 `/flag`。

| 题目 | 比赛 | 难度 | 端口 | 考点 | writeup | 状态 |
|------|------|------|------|------|---------|------|
| linkoreco | EOF CTF Qual 2026 | medium | 80 | PHP SSRF + 本地 token 校验 + 文件读取 | [官方仓库](https://github.com/William957-web/My-CTF-Challenges/tree/main/EOF-CTF-Qual/2026/web/linkoreco) | deployed |
| when | No Hack No CTF 2025 | medium | 80 | PHP-FPM FastCGI 任意代码执行 | [官方仓库](https://github.com/William957-web/My-CTF-Challenges/tree/main/NoHackNoCTF/2025/Web/when) | deployed |
| xxs-xss | No Hack No CTF 2025 | easy | 5000 | Flask + Chromium XSS bot + PoW | [官方仓库](https://github.com/William957-web/My-CTF-Challenges/tree/main/NoHackNoCTF/2025/Web/xxs-xss) | deployed |
| not-xss | No Hack No CTF 2025 | hard | 5000 | Flask + CORS + 前缀猜测侧信道 | [官方仓库](https://github.com/William957-web/My-CTF-Challenges/tree/main/NoHackNoCTF/2025/Web/not-xss) | deployed |
| lickleak | AIS3 Pre-Exam 2025 | hard | 5000 | Flask + Chromium bot + 信息泄漏 | [官方仓库](https://github.com/William957-web/My-CTF-Challenges/tree/main/AIS3-Pre-Exam/2025/lickleak) | deployed |
| easyweb | AIS3 Pre-Exam 2026 | easy | 5000 | Flask + AES-ECB cookie / 路径穿越 | [官方仓库](https://github.com/William957-web/My-CTF-Challenges/tree/main/AIS3-Pre-Exam/2026/crypto/easyweb) | deployed |
| faas | QnQSec CTF 2025 | medium | 80 | PHP find 命令过滤绕过 + readflag | [官方仓库](https://github.com/William957-web/My-CTF-Challenges/tree/main/qnqsec/2025/faas) | deployed |
| date_logger | QnQSec CTF 2025 | medium | 5000 | Flask 消息搜索 + 临时文件写入 | [官方仓库](https://github.com/William957-web/My-CTF-Challenges/tree/main/qnqsec/2025/date_logger) | deployed |
| click_me | NEHS ICED 2024 春季社内赛 | easy | 5000 | Flask 表单逻辑绕过 | [官方仓库](https://github.com/William957-web/My-CTF-Challenges-Old/tree/main/2024-springcomp/web/click_me) | deployed |
| hack_my_x | NEHS ICED 2024 春季社内赛 | medium | 5000 | Flask + SQLite 登录/SQL 注入 | [官方仓库](https://github.com/William957-web/My-CTF-Challenges-Old/tree/main/2024-springcomp/web/hack_my_x) | deployed |

### 第二十批跳过记录

| 候选 | 比赛 | 原因 |
|------|------|------|
| 无 | - | 本批次 10 题均已部署 |

## 第二十一批(2026-07-29 选题,10 道)

来源比赛:XYCTF 2025(5 道)、Mini L-CTF 2025(2 道)、0xGame 2025(1 道)、R3CTF 2025(1 道)、HITCON CTF 2025(1 道)。实际配比 4 easy / 5 medium / 1 hard,10 道题均已导入平台并构建镜像。

> 构建备注:`xyctf-2025-signin`、`xyctf-2025-crazy` 为 Bottle 应用,端口 5000,原题静态 flag 文件保留,改为写入 `/flag`;`xyctf-2025-ezsql` 为 PHP 7.3-FPM + nginx + MySQL 单容器,entrypoint 同时启动 mysql、php-fpm、nginx,原题 flag 写入 `/flag.txt`;`xyctf-2025-fate`、`xyctf-2025-now-you-see-me` 为 Flask 应用,端口 8080,flag 分别写入 `/flag_h3r3` 与 `/flag`;`minilctf-2025-guessoneguess` 为 Node.js Socket 应用,端口 3000,原题通过 `$FLAG` 环境变量注入,改为构建期静态 ENV;`minilctf-2025-clickclick` 为 Node.js 应用,端口 8081,通过 start.sh 替换 FLAG 占位符,改为构建期 sed 替换,并清理 Dockerfile 中的代理与 node_modules;`oxgame-2025-ez-bottle` 为 Bottle 应用,端口 9000,原题 Dockerfile 已硬编码 flag 写入 `/flag`;`r3ctf-2025-evalgelist` 为 PHP-FPM + nginx 单容器,端口 80,原题 entrypoint 将 `$FLAG` 写入 `/flag`,改为构建期静态写入;`hitcon-2025-pholyglot` 为 Apache/mod_php,端口 80,flag 写入 `/flag`,需确认 SUID `read_flag` 二进制读取 `/flag` 的兼容性。

| 题目 | 比赛 | 难度 | 端口 | 考点 | writeup | 状态 |
|------|------|------|------|------|---------|------|
| Signin | XYCTF 2025 | easy | 5000 | Bottle + pickle 反序列化 + 路径穿越 | [官方仓库](https://github.com/saltedfisholdxu/XYCTF2025/tree/main/Web/Signin) | deployed |
| ezsql | XYCTF 2025 | easy | 80 | PHP + MySQL 布尔/时间盲注 | [官方仓库](https://github.com/saltedfisholdxu/XYCTF2025/tree/main/Web/ezsql) | deployed |
| crazy | XYCTF 2025 | easy | 5000 | Bottle SSTI 长度 < 25 绕过黑名单 | [官方仓库](https://github.com/saltedfisholdxu/XYCTF2025/tree/main/Web/crazy) | deployed |
| GuessOneGuess | Mini L-CTF 2025 | easy | 3000 | Node.js Socket 浮点溢出/Infinity | [官方仓库](https://github.com/XDSEC/miniLCTF_2025/tree/main/Challenges/Web/GuessOneGuess) | deployed |
| ez_bottle | 0xGame 2025 | easy | 9000 | Bottle 框架漏洞 | [官方仓库](https://github.com/X1cT34m/0xGame2025/tree/main/Web/Week4/ez_bottle) | deployed |
| Fate | XYCTF 2025 | medium | 8080 | Flask SSRF + JSON 反序列化 + f-string + SQLi 组合链 | [官方仓库](https://github.com/saltedfisholdxu/XYCTF2025/tree/main/Web/Fate) | deployed |
| Now you see me | XYCTF 2025 | medium | 8080 | Flask 有回显 SSTI + 混淆 | [官方仓库](https://github.com/saltedfisholdxu/XYCTF2025/tree/main/Web/Now%20you%20see%20me) | deployed |
| clickclick | Mini L-CTF 2025 | medium | 8081 | Node.js 原型链污染 | [官方仓库](https://github.com/XDSEC/miniLCTF_2025/tree/main/Challenges/Web/clickclick) | deployed |
| evalgelist | R3CTF 2025 | medium | 80 | PHP include + PATH 常量 trick 读 flag | [官方仓库](https://github.com/r3kapig/r3ctf-2025/tree/main/Web/evalgelist) | deployed |
| Pholyglot | HITCON CTF 2025 | hard | 80 | PHP polyglot + SUID read_flag | [官方仓库](https://github.com/orangetw/My-CTF-Web-Challenges/tree/master/hitcon-ctf-2025/pholyglot) | deployed |

## 第二十二批(2026-08-05 部署,10 道)

来源比赛:MoeCTF 2025(7 道)、CUHK CTF 2025(2 道)、ACTF 2026(1 道)。实际配比 7 easy / 2 medium / 1 hard,10 道题均已导入平台并验证可启动。

> 构建备注:
> - `moectf-2025-shouzhuo` / `guess-bao` / `wenjian-shi` 原 entrypoint 在未注入 `FLAG` 环境变量时会用默认 flag 覆盖构建期 flag,已改为仅在有显式 `FLAG` 环境变量时才覆盖。
> - `moectf-2025-da-shang-men` 构建期未写入 `/flag`,已补并在 entrypoint 中做条件覆盖。
> - `moectf-2025-cangjing-jinzhi` 重写 Dockerfile 为 `ubuntu:20.04 + apache2 + php7.4 + mariadb-server`,构建期写入 `/flag.txt`,entrypoint 通过 `SetEnv` 传给 PHP;同时移除 Apache 默认 `index.html` 并设置 `DirectoryIndex index.php`。
> - `moectf-2025-lingzhu-shuangsheng` 的 `start.sh` 存在 CRLF,已转 LF;Dockerfile 增加 `ENV FLAG=...` 供 `flag.php` 读取。
> - `cuhk-2025-i-want-more-cookies` 原 app 监听 25032,已改为 5000;最终页面 flag 已替换为平台 flag。
> - `cuhk-2025-classic-sql` 入口脚本缺失 `FLASK_SECRET_KEY`、数据库初始化逻辑错误且存在 CRLF,已修正;flag 分为两部分写入 `secrets` 与 `private_notes`。
> - `actf-2026-tinj` 改用仓库中预构建的 `jphp-ctf-1.0.0-all.jar`,仅编译 SUID `readflag`;构建期 flag 写入 `/flag.txt`,启动脚本复制到 `/flag`。
> - Docker Desktop containerd 存储下 `docker save` 生成的 tar 不完整,本批次以 `NO_SAVE=1` 仅保留本地镜像标签方式部署,`docker/ctf-contests/build.sh` 已支持该开关。由于当前磁盘空间充足,无需为了省空间删除本地镜像,因此保留本地镜像标签即可满足平台启动需求。详见 `CHALLENGE-DEPLOYMENT.md` 5.6 节。

| 题目 | 比赛 | 难度 | 端口 | 考点 | writeup | 状态 |
|------|------|------|------|------|---------|------|
| 神秘的手镯 | MoeCTF 2025 | easy | 80 | nginx 静态站点 / JS 源码/控制台查看 flag | [官方仓库](https://github.com/XDSEC/MoeCTF_2025/tree/main/challenges/Web/%E7%AC%AC%E4%B8%80%E7%AB%A0%20%E7%A5%9E%E7%A7%98%E7%9A%84%E6%89%8B%E9%95%AF) | deployed |
| Moe笑传之猜猜爆 | MoeCTF 2025 | easy | 5000 | Flask 无校验返回 flag | [官方仓库](https://github.com/XDSEC/MoeCTF_2025/tree/main/challenges/Web/Moe%E7%AC%91%E4%BC%A0%E4%B9%8B%E7%8C%9C%E7%8C%9C%E7%88%86) | deployed |
| 初识金曦玄轨 | MoeCTF 2025 | easy | 5000 | Flask 响应头泄漏 flag | [官方仓库](https://github.com/XDSEC/MoeCTF_2025/tree/main/challenges/Web/%E7%AC%AC%E4%BA%8C%E7%AB%A0%20%E5%88%9D%E8%AF%86%E9%87%91%E6%9B%A6%E7%8E%84%E8%BD%A8) | deployed |
| 问剑石！篡天改命！ | MoeCTF 2025 | easy | 5000 | Flask 参数绕过返回 flag | [官方仓库](https://github.com/XDSEC/MoeCTF_2025/tree/main/challenges/Web/%E7%AC%AC%E4%B8%89%E7%AB%A0%20%E9%97%AE%E5%89%91%E7%9F%B3%EF%BC%81%E7%AF%A1%E5%A4%A9%E6%94%B9%E5%91%BD%EF%BC%81) | deployed |
| 打上门来！ | MoeCTF 2025 | easy | 80 | PHP 路径穿越读取 /flag | [官方仓库](https://github.com/XDSEC/MoeCTF_2025/tree/main/challenges/Web/%E7%AC%AC%E4%BA%94%E7%AB%A0%20%E6%89%93%E4%B8%8A%E9%97%A8%E6%9D%A5%EF%BC%81) | deployed |
| 藏经禁制？玄机初探！ | MoeCTF 2025 | easy | 80 | PHP + MySQL 注入 | [官方仓库](https://github.com/XDSEC/MoeCTF_2025/tree/main/challenges/Web/%E7%AC%AC%E5%85%AD%E7%AB%A0%20%E8%97%8F%E7%BB%8F%E7%A6%81%E5%88%B6%EF%BC%9F%E7%8E%84%E6%9C%BA%E5%88%9D%E6%8E%A2%EF%BC%81) | deployed |
| 灵蛛探穴与阴阳双生符 | MoeCTF 2025 | medium | 80 | PHP MD5 弱类型碰撞 | [官方仓库](https://github.com/XDSEC/MoeCTF_2025/tree/main/challenges/Web/%E7%AC%AC%E4%B8%83%E7%AB%A0%20%E7%81%B5%E8%9B%9B%E6%8E%A2%E7%A9%B4%E4%B8%8E%E9%98%B4%E9%98%B3%E5%8F%8C%E7%94%9F%E7%AC%A6) | deployed |
| 32_i-want-more-cookies | CUHK CTF 2025 | easy | 5000 | Flask cookie 多阶段 | [官方仓库](https://github.com/CUHK0x/cuhk-ctf-2025-challenges/tree/main/web/32_i-want-more-cookies) | deployed |
| 65_classic-sql | CUHK CTF 2025 | easy | 8080 | SQL 注入 | [官方仓库](https://github.com/CUHK0x/cuhk-ctf-2025-challenges/tree/main/web/65_classic-sql) | deployed |
| TINJ | ACTF 2026 | hard | 8080 | JPHP 黑盒/反序列化 | [官方仓库](https://github.com/team-s2/ACTF-2026/tree/main/web/TINJ) | deployed |

### 第二十二批跳过记录

| 候选 | 比赛 | 原因 |
|------|------|------|
| 无 | - | 本批次 10 题均已部署 |

## 第二十三批(2026-08-06 部署,10 道)

来源比赛:MoeCTF 2025(10 道)。实际配比 3 easy / 5 medium / 2 hard。10 道题已全部构建镜像并导入平台。

> 筛选说明:本地 `.tmp/` 中其他仓库(2023-StarCTF、2024-PandaCup、2024 网鼎杯半决赛、2025 湾区杯/强网杯 Quals、2026 蓝桥杯 Quals/Finals 等)均无完整 Web 源码或附件,无法凑齐 10 道可单容器部署的 Web 题;因此第 23 批沿用 MoeCTF 2025 剩余章节,补齐未部署的 Web 挑战。

> 构建备注:
> - 本批次 10 题原 Dockerfile/entrypoint 多依赖运行时 `$FLAG` 环境变量注入,平台不注入环境变量,统一改为构建期 `ENV FLAG=...` 或 `RUN echo` 写入 `/flag` 或 `flag.php`。
> - 第四章 `app.py` 将 flag 拆为 7 段 base64 分布在 HTTP 关卡中,已将 `full_flag_b64` 替换为平台 flag 的 base64,并简化 `/final_success` 页面,避免直接泄露答案。
> - 第十一章 `flag.php` 含 `//{{FLAG}}` 占位,通过 Dockerfile `ENV FLAG=...` 在 entrypoint 启动时替换为平台 flag。
> - 第十六章原 `entrypoint.sh` 写入随机文件名 flag,已改为固定 `/flag`。
> - 第二十章 Flask 原开启 `debug=True`,已关闭,避免暴露 Werkzeug 调试控制台。
> - 第二十章/第二十一章原 Dockerfile 使用 `python:3.11-alpine`,因 Docker Hub 网络不可达改为本地可用的 `python:3.11-slim`。
> - 第四章 `docker save` 在 containerd snapshotter 下导出的 tar 不完整,已使用 `NO_SAVE=1` 仅保留本地镜像标签。由于当前磁盘空间充足,无需为了省空间删除本地镜像,因此保留本地镜像标签即可满足平台启动需求。详见 `CHALLENGE-DEPLOYMENT.md` 5.6 节。
> - 所有 batch23 目录下的 `.sh` 脚本已统一转换为 LF 换行,避免 `bad interpreter` 错误。

| 题目 | 比赛 | 难度 | 端口 | 考点 | writeup | 状态 |
|------|------|------|------|------|---------|------|
| 第四章 金曦破禁与七绝傀儡阵 | MoeCTF 2025 | easy | 5000 | HTTP 方法/头综合(GET/POST/PUT/XFF/UA/Cookie/Referer) | [官方仓库](https://github.com/XDSEC/MoeCTF_2025/tree/main/challenges/Web/%E7%AC%AC%E5%9B%9B%E7%AB%A0%20%E9%87%91%E6%9B%A6%E7%A0%B4%E7%A6%81%E4%B8%8E%E4%B8%83%E7%BB%9D%E5%82%80%E5%84%A1%E9%98%B5) | 已部署 |
| 第十一章 千机变·破妄之眼 | MoeCTF 2025 | easy | 80 | 5 字母随机参数名爆破(120 种排列) | [官方仓库](https://github.com/XDSEC/MoeCTF_2025/tree/main/challenges/Web/%E7%AC%AC%E5%8D%81%E4%B8%80%E7%AB%A0%20%E5%8D%83%E6%9C%BA%E5%8F%98%C2%B7%E7%A0%B4%E5%A6%84%E4%B9%8B%E7%9C%BC) | 已部署 |
| 第十六章 昆仑星途 | MoeCTF 2025 | easy | 80 | PHP LFI + data:// 执行(allow_url_include=On) | [官方仓库](https://github.com/XDSEC/MoeCTF_2025/tree/main/challenges/Web/%E7%AC%AC%E5%8D%81%E5%85%AD%E7%AB%A0%20%E6%98%86%E4%BB%91%E6%98%9F%E9%80%94) | 已部署 |
| 第十章 天机符阵 | MoeCTF 2025 | medium | 80 | XXE(LIBXML_NOENT \| LIBXML_DTDLOAD) | [官方仓库](https://github.com/XDSEC/MoeCTF_2025/tree/main/challenges/Web/%E7%AC%AC%E5%8D%81%E7%AB%A0%20%E5%A4%A9%E6%9C%BA%E7%AC%A6%E9%98%B5) | 已部署 |
| 第九章 星墟禁制·天机问路 | MoeCTF 2025 | medium | 80 | nslookup 命令注入 | [官方仓库](https://github.com/XDSEC/MoeCTF_2025/tree/main/challenges/Web/%E7%AC%AC%E4%B9%9D%E7%AB%A0%20%E6%98%9F%E5%A2%9F%E7%A6%81%E5%88%B6%C2%B7%E5%A4%A9%E6%9C%BA%E9%97%AE%E8%B7%AF) | 已部署 |
| 第十七章 星骸迷阵·神念重构 | MoeCTF 2025 | medium | 80 | PHP 单类反序列化 __destruct -> eval | [官方仓库](https://github.com/XDSEC/MoeCTF_2025/tree/main/challenges/Web/%E7%AC%AC%E5%8D%81%E4%B8%83%E7%AB%A0%20%E6%98%9F%E9%AA%A8%E8%BF%B7%E9%98%B5%C2%B7%E7%A5%9E%E5%BF%B5%E9%87%8D%E6%9E%84) | 已部署 |
| 第二十章 幽冥血海·幻语心魔 | MoeCTF 2025 | medium | 80 | Flask SSTI | [官方仓库](https://github.com/XDSEC/MoeCTF_2025/tree/main/challenges/Web/%E7%AC%AC%E4%BA%8C%E5%8D%81%E7%AB%A0%20%E5%B9%BD%E5%86%A5%E8%A1%80%E6%B5%B7%C2%B7%E5%B9%BB%E8%AF%AD%E5%BF%83%E9%AD%94) | 已部署 |
| 第二十一章 往生漩涡·言灵死局 | MoeCTF 2025 | medium | 80 | Flask SSTI 黑名单绕过 | [官方仓库](https://github.com/XDSEC/MoeCTF_2025/tree/main/challenges/Web/%E7%AC%AC%E4%BA%8C%E5%8D%81%E4%B8%80%E7%AB%A0%20%E5%BE%80%E7%94%9F%E6%BC%A9%E6%B6%A1%C2%B7%E8%A8%80%E7%81%B5%E6%AD%BB%E5%B1%80) | 已部署 |
| 第十九章 星穹真相·补天归源 | MoeCTF 2025 | hard | 80 | PHP 反序列化 POP 链(Person 系列) | [官方仓库](https://github.com/XDSEC/MoeCTF_2025/tree/main/challenges/Web/%E7%AC%AC%E5%8D%81%E4%B9%9D%E7%AB%A0%20%E6%98%9F%E7%A9%B9%E7%9C%9F%E7%9B%B8%C2%B7%E8%A1%A5%E5%A4%A9%E5%BD%92%E6%BA%90) | 已部署 |
| 第十八章 万卷诡阁·功法连环 | MoeCTF 2025 | hard | 80 | PHP 反序列化 POP 链(private 属性) | [官方仓库](https://github.com/XDSEC/MoeCTF_2025/tree/main/challenges/Web/%E7%AC%AC%E5%8D%81%E5%85%AB%E7%AB%A0%20%E4%B8%87%E5%8D%B7%E8%AF%A1%E9%98%81%C2%B7%E5%8A%9F%E6%B3%95%E8%BF%9E%E7%8E%AF) | 已部署 |

### 第二十三批跳过/未入选记录

| 候选 | 比赛 | 原因 |
|------|------|------|
| 第十二章 玉魄玄关·破妄 | MoeCTF 2025 | 源码仅为 `eval($_POST['cmd'])`,过于简单,无明显过滤或挑战点,未入选 |
| 第八章/第十三章/第十四章/第十五章/第二十三章/第十章_revenge 等 | MoeCTF 2025 | 依赖 MySQL/Redis 多容器或复杂 Dockerfile,改造工作量大,本批次优先单容器题 |
| 第一章 神秘的手镯_revenge | MoeCTF 2025 | 需连续 500 次正确 POST 才出 flag,交互体验差,未入选 |
| 2023-StarCTF-DeadGame | - | 仅星际争霸 2 地图附件,无 Web 题 |
| 2024-PandaCupCTF | - | 仓库仅有 README,无源码/附件 |
| 2024 网鼎杯半决赛 | - | 本地仅有 API 数据 JSON,无 Web 源码 |
| 2026 蓝桥杯 Quals/Finals | - | 本地仅有 README,无源码 |
| 2025 湾区杯/强网杯 Quals/Finals | - | 附件仅有占位 README 或单个 PHP,缺少完整源码/Dockerfile |

## 第二十四批(2026-08-07 部署,10 道)

来源比赛:MoeCTF 2025(7)、ACTF 2026(2)、CUHK CTF 2025(1)。实际配比 2 easy / 7 medium / 1 hard。10 道题已全部构建镜像并导入平台。

> 构建备注:本批次优先选择单容器、Dockerfile 现成的题目。
> - MoeCTF 剩余章节的 entrypoint/start.sh 原依赖运行时 `$FLAG` 环境变量,平台不注入环境变量,统一在 Dockerfile 构建期注入 `ENV FLAG=...`。
> - ACTF 2026 `AAA'26` Dockerfile 使用 `COPY --chmod` 需要 BuildKit,而 `build.sh` 使用 legacy builder,已改为 `COPY flag.txt /flag` + `RUN chmod/chown`。
> - ACTF 2026 `AAA'26` 在 legacy builder 下用 Dockerfile 内 heredoc 生成的 `/start.sh` 为空,导致容器启动报 `exec format error`;已改为单独维护 `start.sh` 文件并通过 `COPY` 写入镜像,重新构建后验证可正常启动并响应 HTTP。
> - ACTF 2026 `GoMySQL` 构建期 `go mod download` 默认走 `proxy.golang.org` 连接受限,已增加 `ENV GOPROXY=https://goproxy.cn,direct`。
> - CUHK `The Next Stop is Chinese University` 缺少运行时 `.env`,已直接在 Dockerfile 写入 `ENV FLAG=...`、`ENV USERNAME=fake-username`、`ENV PASSWORD=fake-password`。
> - 本批次使用 `NO_SAVE=1` 仅保留本地镜像标签,避免 Docker Desktop containerd snapshotter 下 `docker save` 导出不完整;同时修复 `scripts/prepare-batch.mjs` 对 `--no-save`/`NO_SAVE=1` 的支持。由于当前磁盘空间充足,无需删除本地镜像来省空间,保留本地镜像标签即可满足平台启动需求。AAA'26 修复后重新构建时未使用 `NO_SAVE=1`,因此额外保留了 `docker-images/localtrain_ctf-actf-2026-aaa26_latest.tar` 备份。详见 `CHALLENGE-DEPLOYMENT.md` 5.6 节。

| 题目 | 比赛 | 难度 | 端口 | 考点 | writeup | 状态 |
|------|------|------|------|------|---------|------|
| 第五章 打上门来！ | MoeCTF 2025 | easy | 80 | PHP 路径穿越读取 /flag | [官方仓库](https://github.com/XDSEC/MoeCTF_2025/tree/main/challenges/Web/%E7%AC%AC%E4%BA%94%E7%AB%A0%20%E6%89%93%E4%B8%8A%E9%97%A8%E6%9D%A5%EF%BC%81) | 已部署 |
| 第七章 灵蛛探穴与阴阳双生符 | MoeCTF 2025 | medium | 80 | PHP MD5 弱类型碰撞 | [官方仓库](https://github.com/XDSEC/MoeCTF_2025/tree/main/challenges/Web/%E7%AC%AC%E4%B8%83%E7%AB%A0%20%E7%81%B5%E8%9B%9B%E6%8E%A2%E7%A9%B4%E4%B8%8E%E9%98%B4%E9%98%B3%E5%8F%8C%E7%94%9F%E7%AC%A6) | 已部署 |
| 第八章 天衍真言，星图显圣 | MoeCTF 2025 | medium | 80 | MySQL UNION 注入 | [官方仓库](https://github.com/XDSEC/MoeCTF_2025/tree/main/challenges/Web/%E7%AC%AC%E5%85%AB%E7%AB%A0%20%E5%A4%A9%E8%A1%8D%E7%9C%9F%E8%A8%80%EF%BC%8C%E6%98%9F%E5%9B%BE%E6%98%BE%E5%9C%A3) | 已部署 |
| 第十三章 通幽关·灵纹诡影 | MoeCTF 2025 | medium | 80 | 图片上传文件头绕过 + getshell | [官方仓库](https://github.com/XDSEC/MoeCTF_2025/tree/main/challenges/Web/%E7%AC%AC%E5%8D%81%E4%B8%89%E7%AB%A0%20%E9%80%9A%E5%B9%BD%E5%85%B3%C2%B7%E7%81%B5%E7%BA%B9%E8%AF%A1%E5%BD%B1) | 已部署 |
| 第十四章 御神关·补天玉碑 | MoeCTF 2025 | medium | 80 | .htaccess 上传解析任意后缀 | [官方仓库](https://github.com/XDSEC/MoeCTF_2025/tree/main/challenges/Web/%E7%AC%AC%E5%8D%81%E5%9B%9B%E7%AB%A0%20%E5%BE%A1%E7%A5%9E%E5%85%B3%C2%B7%E8%A1%A5%E5%A4%A9%E7%8E%89%E7%A2%91) | 已部署 |
| 第十五章 归真关·竞时净魔 | MoeCTF 2025 | medium | 80 | 上传 + 访问竞争条件读取 flag | [官方仓库](https://github.com/XDSEC/MoeCTF_2025/tree/main/challenges/Web/%E7%AC%AC%E5%8D%81%E4%BA%94%E7%AB%A0%20%E5%BD%92%E7%9C%9F%E5%85%B3%C2%B7%E7%AB%9E%E6%97%B6%E5%87%80%E9%AD%94) | 已部署 |
| 第二十二章 血海核心·千年手段 | MoeCTF 2025 | hard | 80 | Flask 盲 SSTI + SUID rev 读 /flag | [官方仓库](https://github.com/XDSEC/MoeCTF_2025/tree/main/challenges/Web/%E7%AC%AC%E4%BA%8C%E5%8D%81%E4%BA%8C%E7%AB%A0%20%E8%A1%80%E6%B5%B7%E6%A0%B8%E5%BF%83%C2%B7%E5%8D%83%E5%B9%B4%E6%89%8B%E6%AE%B5) | 已部署 |
| AAA'26 | ACTF 2026 | medium | 3000 | Node.js + MongoDB + ImageMagick/ghostscript 链 | [官方仓库](https://github.com/team-s2/ACTF-2026/tree/main/web/AAA26) | 已部署 |
| GoMySQL | ACTF 2026 | medium | 8080 | Go + MariaDB UDF/模板注入 RCE | [官方仓库](https://github.com/team-s2/ACTF-2026/tree/main/web/GoMySQL) | 已部署 |
| The Next Stop is Chinese University | CUHK CTF 2025 | easy | 3000 | Next.js 应用源码审计/逻辑绕过 | [官方仓库](https://github.com/CUHK0x/cuhk-ctf-2025-challenges/tree/main/web/52_the-next-stop-is-chinese-university) | 已部署 |

## 第二十五批(2026-08-08 部署,10 道已部署)

来源比赛:MoeCTF 2025(9)、ACTF 2026(1)。实际配比 5 easy / 3 medium / 2 hard。10 道题已全部构建镜像并导入平台。

> 构建备注:
> - Docker Hub 直连不可用,`python:3.10.14-alpine`、`php:5.6-apache`、`openjdk:8-jdk-alpine` 等基础镜像无法拉取,统一替换为本地已有镜像:`python:3.11-slim`、`php:7.4-apache`、`openjdk:8`。
> - 所有题目原 Dockerfile/entrypoint/start.sh 多依赖运行时 `$FLAG` 环境变量注入,平台不注入环境变量,统一改为构建期 `ENV FLAG=...` 或 `RUN echo "$FLAG" > /flag` 写入静态 flag。
> - `moectf-2025-webshell`、`moectf-2025-webshell-revenge`、`moectf-2025-ch10-xxe-revenge` 的 `start.sh` 以及 `moectf-2025-ch1-shouzhuo-revenge` 的 `entrypoint.sh` 原含 CRLF 换行,容器启动报 `exec format error` 或 `/bin/bash^M: not found`,已统一转换为 LF 换行。
> - Java 题(`ch23`、`extra-challenge`) 在 Dockerfile 中增加 `ENV FLAG`、`RUN echo "$FLAG" > /flag`、`EXPOSE 8080`,确保 Spring Boot 监听 8080 且 flag 可达。
> - CUHK `Jain Streak Dreamers` 原计划作为第10题,但 OCaml `opam install` 需编译 135 个依赖,30 分钟超时内无法完成;已替换为 ACTF 2026 `12307`。
> - ACTF `12307` 为 nginx + MariaDB + Redis + Python/Node 多服务单容器,supervisor 管理;监听 80;原 Dockerfile 使用 `COPY --chmod` 需要 BuildKit,在 legacy builder 下改为 `COPY flag /flag` + `RUN chmod 600 /flag`;基础镜像 `node:24-bookworm-slim` 从 `docker.m.daocloud.io` 拉取后 tag,`debian:forky-slim` 从 `docker.1ms.run` 拉取后 tag;apt 源因 deb.debian.org 仅约 20 kB/s,已换用 `mirrors.tuna.tsinghua.edu.cn` 镜像源,构建成功。
> - 本批次使用 `NO_SAVE=1` 仅保留本地镜像标签,避免 Docker Desktop containerd snapshotter 下 `docker save` 导出不完整。详见 `CHALLENGE-DEPLOYMENT.md` 5.6 节。

| 题目 | 比赛 | 难度 | 端口 | 考点 | writeup | 状态 |
|------|------|------|------|------|---------|------|
| 第一章 神秘的手镯_revenge | MoeCTF 2025 | easy | 5000 | F12 + 备份文件 + 500 次 POST 爆破 | [官方仓库](https://github.com/XDSEC/MoeCTF_2025/blob/main/official_writeups/Web/Writeup.md) | 已部署 |
| 第十二章 玉魄玄关·破妄 | MoeCTF 2025 | easy | 80 | 一句话木马连接 | [官方仓库](https://github.com/XDSEC/MoeCTF_2025/blob/main/official_writeups/Web/Writeup.md) | 已部署 |
| 第十章 天机符阵_revenge | MoeCTF 2025 | easy | 80 | XXE 读取 /flag.txt | [官方仓库](https://github.com/XDSEC/MoeCTF_2025/blob/main/official_writeups/Web/Writeup.md) | 已部署 |
| 摸金偶遇FLAG，拼尽全力难战胜 | MoeCTF 2025 | easy | 80 | Python 请求/时间逻辑绕过 | [官方仓库](https://github.com/XDSEC/MoeCTF_2025/blob/main/official_writeups/Web/Writeup.md) | 已部署 |
| webshell | MoeCTF 2025 | medium | 80 | 无数字字母 PHP webshell | [官方仓库](https://github.com/XDSEC/MoeCTF_2025/blob/main/official_writeups/Web/Writeup.md) | 已部署 |
| webshell re | MoeCTF 2025 | medium | 80 | 无数字字母/下划线/美元符号 webshell | [官方仓库](https://github.com/XDSEC/MoeCTF_2025/blob/main/official_writeups/Web/Writeup.md) | 已部署 |
| 第十九章 星穹真相·补天归源_revenge | MoeCTF 2025 | hard | 80 | PHP 反序列化 POP 链绕过 system 黑名单 | [官方仓库](https://github.com/XDSEC/MoeCTF_2025/blob/main/official_writeups/Web/Writeup.md) | 已部署 |
| 第二十三章 幻境迷心·皇陨星沉(大结局) | MoeCTF 2025 | hard | 8080 | Java Spring Boot 反序列化反射链 RCE | [官方仓库](https://github.com/XDSEC/MoeCTF_2025/blob/main/official_writeups/Web/Writeup.md) | 已部署 |
| 附加挑战 | MoeCTF 2025 | hard | 8080 | Java TemplatesImpl 动态类加载 / 内存马回显 | [官方仓库](https://github.com/XDSEC/MoeCTF_2025/blob/main/official_writeups/Web/Writeup.md) | 已部署 |
| 12307 | ACTF 2026 | easy | 80 | JSON 重复键解析差 + 业务链拼接打印驱动读 /flag | [官方仓库](https://github.com/team-s2/ACTF-2026/tree/main/web/12307) | 已部署 |

### 第二十五批跳过/未入选记录

| 候选 | 比赛 | 原因 |
|------|------|------|
| signin and fiction | MoeCTF 2025 | 仅为附件/小说 PDF，无 Web 服务容器 |
| 第二十三章 幻境迷心·皇陨星沉(大结局) / rev-shell | MoeCTF 2025 | 原题含 jump-box 子服务，平台内仅用主 dog-app 即可 RCE 读 flag，无需额外 SSH 跳板 |
| Jain Streak Dreamers | CUHK CTF 2025 | OCaml opam 依赖 135 个包编译超时，替换为 ACTF 12307 继续构建 |

## 第二十六批(2026-08-09 部署,10 道已部署)

来源比赛:MoeCTF 2024(10)。实际配比 6 easy / 4 medium。10 道题已全部构建镜像并导入平台。

> 构建备注:
> - Docker Hub 直连不可用,统一将题目原 Dockerfile 中的基础镜像替换为本地已有镜像:`php:8.0-fpm-alpine` 替换 `php:8-fpm-alpine`;`python:3.11-slim` 替换 `python:3.10.14-alpine` / `python:3.11-alpine`;`php:7.3-fpm-alpine` 从 `docker.m.daocloud.io` 拉取后本地 tag 使用;`ctftraining/base_image_nginx_mysql_php_73` 与 `php:8.2-apache` 已本地可用。
> - 所有题目原 Dockerfile/entrypoint/start.sh 多依赖运行时 `$FLAG` 环境变量注入,平台不注入环境变量,统一改为构建期 `ENV FLAG=...` 或 `RUN echo "$FLAG" > /flag` 写入静态 flag。
> - `web入门指北` 无原 Dockerfile,额外补充 `php:8.2-apache` 镜像,直接服务 `www/` 目录,并将 flag 明文写入 `/flag`。
> - `弗拉格之地的挑战` 最终 flag 保持原题 `moectf{AftEr_th1s_tUT0r_I_th1ke_U_kknow_WeB}`,同时额外写入 `/flag` 方便验证。
> - 本批次使用 `NO_SAVE=1` 仅保留本地镜像标签,避免 Docker Desktop containerd snapshotter 下 `docker save` 导出不完整。详见 `CHALLENGE-DEPLOYMENT.md` 5.6 节。

| 题目 | 比赛 | 难度 | 端口 | 考点 | writeup | 状态 |
|------|------|------|------|------|---------|------|
| ez_http | MoeCTF 2024 | easy | 80 | HTTP 头、Referer、Cookie 顺序挑战 | [官方仓库](https://github.com/XDSEC/MoeCTF_2024/tree/main/Challenges/Web/ez_http) | 已部署 |
| 弗拉格之地的入口 | MoeCTF 2024 | easy | 80 | robots.txt 协议,引导访问 /webtutorEntry.php | [官方仓库](https://github.com/XDSEC/MoeCTF_2024/tree/main/Challenges/Web/%E5%BC%97%E6%8B%89%E6%A0%BC%E4%B9%8B%E5%9C%B0%E7%9A%84%E5%85%A5%E5%8F%A3) | 已部署 |
| 弗拉格之地的挑战 | MoeCTF 2024 | easy | 80 | 7 关 web 基础挑战,收集 flag 片段 base64 解码 | [官方仓库](https://github.com/XDSEC/MoeCTF_2024/tree/main/Challenges/Web/%E5%BC%97%E6%8B%89%E6%A0%BC%E4%B9%8B%E5%9C%B0%E7%9A%84%E6%8C%91%E6%88%98) | 已部署 |
| web入门指北 | MoeCTF 2024 | easy | 80 | 前端 AES 解密读取 ciphertext | [官方仓库](https://github.com/XDSEC/MoeCTF_2024/tree/main/Challenges/Web/web%E5%85%A5%E9%97%A8%E6%8C%87%E5%8C%97) | 已部署 |
| ProveYourLove | MoeCTF 2024 | medium | 5000 | 前端提交限制绕过,300 次表白请求 | [官方仓库](https://github.com/XDSEC/MoeCTF_2024/tree/main/Challenges/Web/ProveYourLove) | 已部署 |
| ImageCloud前置 | MoeCTF 2024 | easy | 80 | SSRF 读取 /etc/passwd | [官方仓库](https://github.com/XDSEC/MoeCTF_2024/tree/main/Challenges/Web/ImageCloud%E5%89%8D%E7%BD%AE) | 已部署 |
| who's_blog | MoeCTF 2024 | easy | 80 | Flask Jinja2 SSTI 读取环境变量 | [官方仓库](https://github.com/XDSEC/MoeCTF_2024/tree/main/Challenges/Web/who's_blog) | 已部署 |
| 勇闯铜人阵 | MoeCTF 2024 | medium | 80 | 听声辨位,快速脚本提交 5 轮 | [官方仓库](https://github.com/XDSEC/MoeCTF_2024/tree/main/Challenges/Web/%E5%8B%87%E9%97%AF%E9%93%9C%E4%BA%BA%E9%98%B5) | 已部署 |
| 静态网页 | MoeCTF 2024 | medium | 80 | 静态博客中的 live2d 后端请求 + PHP 弱类型/md5 绕过 | [官方仓库](https://github.com/XDSEC/MoeCTF_2024/tree/main/Challenges/Web/%E9%9D%99%E6%80%81%E7%BD%91%E9%A1%B5) | 已部署 |
| 电院_Backend | MoeCTF 2024 | medium | 80 | robots.txt + 验证码 + SQL 注入 | [官方仓库](https://github.com/XDSEC/MoeCTF_2024/tree/main/Challenges/Web/%E7%94%B5%E9%99%A2_Backend) | 已部署 |

## 第二十七批(2026-08-09 部署,10 道已部署)

来源比赛:MoeCTF 2024(9)、2024 巅峰极客(1)。实际配比 7 easy / 3 medium。10 道题已全部构建镜像并导入平台。

> 构建备注:
> - Docker Hub 直连不可用,`垫刀之路07` 原 `python:3.10.14-alpine` 替换为本地 `python:3.11-slim`;`ImageCloud` 原 `python:3.10-alpine` 替换为 `python:3.11-slim` 并补充 Pillow 依赖系统库;`smbms` 原 `ubuntu:latest` 替换为本地 `ubuntu:20.04`;`垫刀之路01-06` 原 `ctftraining/base_image_nginx_php_73` 替换为本地已有的 `ctftraining/base_image_nginx_mysql_php_73`。
> - 所有题目原 Dockerfile/entrypoint/start.sh 多依赖运行时 `$FLAG` 环境变量注入,平台不注入环境变量,统一改为构建期 `ENV FLAG=...` 或 `RUN echo "$FLAG" > /flag` 写入静态 flag。
> - `垫刀之路` 7 道小题为同一系列,各自拥有独立 Dockerfile 与 flag,按独立题目导入平台。
> - `ImageCloud` 原 `init.py` 硬编码 flag,改为读取 `ENV FLAG` 后写入图片;`GoldenHornKing` 无原 Dockerfile,额外补充 FastAPI + uvicorn 镜像,flag 写入 `/flag` 并在 `app.flag` 暴露。
> - 本批次使用 `NO_SAVE=1` 仅保留本地镜像标签,未导出 tar。

| 题目 | 比赛 | 难度 | 端口 | 考点 | writeup | 状态 |
|------|------|------|------|------|---------|------|
| 垫刀之路01: MoeCTF？启动！ | MoeCTF 2024 | easy | 80 | 简单 RCE 命令执行读取 $FLAG | [官方仓库](https://github.com/XDSEC/MoeCTF_2024/tree/main/Challenges/Web/%E5%9E%AB%E5%88%80%E4%B9%8B%E8%B7%AF/1_startup) | 已部署 |
| 垫刀之路02: 文件上传 | MoeCTF 2024 | easy | 80 | 前端/后端文件上传绕过读取 $FLAG | [官方仓库](https://github.com/XDSEC/MoeCTF_2024/tree/main/Challenges/Web/%E5%9E%AB%E5%88%80%E4%B9%8B%E8%B7%AF/2_upload) | 已部署 |
| 垫刀之路03: 图片上传 | MoeCTF 2024 | easy | 80 | 图片上传二次渲染/包含读取 $FLAG | [官方仓库](https://github.com/XDSEC/MoeCTF_2024/tree/main/Challenges/Web/%E5%9E%AB%E5%88%80%E4%B9%8B%E8%B7%AF/3_imageupload) | 已部署 |
| 垫刀之路04: 任意文件读取 | MoeCTF 2024 | easy | 80 | path 参数目录穿越读取 /flag | [官方仓库](https://github.com/XDSEC/MoeCTF_2024/tree/main/Challenges/Web/%E5%9E%AB%E5%88%80%E4%B9%8B%E8%B7%AF/4_browser) | 已部署 |
| 垫刀之路05: SQL 注入登录 | MoeCTF 2024 | easy | 80 | 登录框 SQL 注入获取 flag | [官方仓库](https://github.com/XDSEC/MoeCTF_2024/tree/main/Challenges/Web/%E5%9E%AB%E5%88%80%E4%B9%8B%E8%B7%AF/5_ezlogin) | 已部署 |
| 垫刀之路06: PHP 反序列化 | MoeCTF 2024 | easy | 80 | 构造 POP 链读取 /flag | [官方仓库](https://github.com/XDSEC/MoeCTF_2024/tree/main/Challenges/Web/%E5%9E%AB%E5%88%80%E4%B9%8B%E8%B7%AF/6_minimoepop) | 已部署 |
| 垫刀之路07: PIN 码爆破 | MoeCTF 2024 | medium | 80 | Flask debug PIN, Werkzeug 控制台读取 /app/flag | [官方仓库](https://github.com/XDSEC/MoeCTF_2024/tree/main/Challenges/Web/%E5%9E%AB%E5%88%80%E4%B9%8B%E8%B7%AF/7_pinhack) | 已部署 |
| ImageCloud | MoeCTF 2024 | medium | 5000 | Flask 图片云,flag 渲染在图片中 | [官方仓库](https://github.com/XDSEC/MoeCTF_2024/tree/main/Challenges/Web/ImageCloud) | 已部署 |
| smbms | MoeCTF 2024 | medium | 8080 | Java Tomcat + MariaDB SMBMS 注入读取 flag | [官方仓库](https://github.com/XDSEC/MoeCTF_2024/tree/main/Challenges/Web/smbms) | 已部署 |
| GoldenHornKing | 2024 巅峰极客 | medium | 8000 | FastAPI + Jinja2 SSTI 读取 flag | [Writeup](https://exp10it.io/posts/dfjk-2024-preliminary-web-writeup/) | 已部署 |

## 第二十八批(2026-08-09 部署,10 道已部署)

来源比赛:2022 西湖论剑(3)、2022 美团CTF(1)、NCTF 2023(2)、2026 NCO Quals(2)、HGAME 2023(2)。实际配比 1 easy / 9 medium。10 道题已全部构建镜像、导入平台并验证 flag 可达。

> 构建备注:
> - 本批次题目全部来自 `.tmp/batch2` / `.tmp/batch14` 等遗留源码,原镜像基础标签在 Docker Hub 不可达环境下无法重新拉取,统一替换为本地已有镜像:`docker.m.daocloud.io/library/jetty:9.4.49-jdk8`、`node:lts-alpine3.15`、`node:8.1.2`、`python:3.11-slim`、`node:20-alpine`、`nginx:alpine`、`golang:1.23-alpine`、`alpine:latest`;NCTF 2023 `webshellgen` 使用 `docker.1ms.run/dasctfbase/web_php73_apache:latest`。
> - 所有题目原 Dockerfile/entrypoint/start.sh 多依赖运行时 `$FLAG` / `$DASFLAG` 环境变量注入,平台不注入环境变量,统一改为构建期 `ENV FLAG=...` / `ENV DASFLAG=...` 或 `RUN echo "$FLAG" > /flag` 写入静态 flag。
> - `2022-xhlj-easy-api` Jetty 镜像默认非 root 用户,在 Dockerfile 中增加 `USER root` 以写入 `/flag`。
> - `nctf-2023-webshellgen` 基础镜像 Debian buster 源已 EOL,在 Dockerfile 中替换为 `archive.debian.org` 并加 `Acquire::Check-Valid-Until=false` 后安装 gcc。
> - `2026-nco-quals-signature-generator` 无原 Dockerfile,补充 `python:3.11-slim` 镜像;源码中 `GZCTF_FLAG` 改为 `FLAG`,端口改为 5000。
> - `2026-nco-quals-super-safe` 无原 Dockerfile,补充 `nginx:alpine` 镜像;entrypoint 用 `sed` 将 HTML 注释中的 `NCO26{xxxxxxxxx}` 替换为平台 flag。
> - `2023-hgame-guess-who-i-am` 将源码中的硬编码 flag/session secret 改为 `os.Getenv("FLAG")`。
> - `2023-hgame-shared-diary` 原题无 flag 返回点,补充 `/flag` 路由,仅管理员角色可读取 `process.env.FLAG`。
> - 本批次使用 `NO_SAVE=1` 仅保留本地镜像标签,未导出 tar。

| 题目 | 比赛 | 难度 | 端口 | 考点 | writeup | 状态 |
|------|------|------|------|------|---------|------|
| easy_api | 2022 西湖论剑 | medium | 8080 | Java Jetty /fastjson 反序列化读取 /tmp/flag | [本地](../../ctf-writeup/xhlj-2022/easy-api.md) | 已部署 |
| node_magical_login | 2022 西湖论剑 | medium | 80 | Node 登录鉴权;flag 拆分两段 | [本地](../../ctf-writeup/xhlj-2022/node-magical-login.md) | 已部署 |
| real_ez_node | 2022 西湖论剑 | medium | 3000 | Node 原型链污染 + EJS RCE | [本地](../../ctf-writeup/xhlj-2022/real-ez-node.md) | 已部署 |
| easypickle | 2022 美团CTF | medium | 8080 | Python pickle 反序列化 RCE | [本地](../../ctf-writeup/meituan-2022/easypickle.md) | 已部署 |
| waitwhat | NCTF 2023 | medium | 80 | Node 正则/auth 绕过;登录后读 flag | [本地](../../ctf-writeup/nctf-2023/wait-what.md) | 已部署 |
| webshellgen | NCTF 2023 | medium | 80 | PHP 模板生成 + SUID readflag | [本地](../../ctf-writeup/nctf-2023/webshell-generator.md) | 已部署 |
| 个性签名生成器 | 2026 NCO Quals | medium | 5000 | Flask Jinja2 SSTI 读取环境变量 | [官方仓库](https://github.com/CTF-Archives/2026-NCO-Quals/tree/main/web/Web-%E4%B8%AD%E7%AD%89%E5%A4%BA%E6%97%97-%E4%B8%AA%E6%80%A7%E7%AD%BE%E5%90%8D%E7%94%9F%E6%88%90%E5%99%A8) | 已部署 |
| 超级无敌保险箱 | 2026 NCO Quals | easy | 80 | 前端禁用调试;flag 在 HTML 注释 | [官方仓库](https://github.com/CTF-Archives/2026-NCO-Quals/tree/main/web/Web-%E5%85%A5%E9%97%A8%E5%A4%BA%E6%97%97-%E8%B6%85%E7%BA%A7%E6%97%A0%E6%95%8C%E4%BF%9D%E9%99%A9%E7%AE%B1) | 已部署 |
| guess_who_i_am | HGAME 2023 | medium | 80 | Go 连续答题,flag 作为 session secret | [本地](../../ctf-writeup/hgame-2023/guess-who-i-am.md) | 已部署 |
| shared_diary | HGAME 2023 | medium | 8888 | 原型链污染获取 admin 后读 /flag | [本地](../../ctf-writeup/hgame-2023/shared-diary.md) | 已部署 |

## 第二十九批(2026-08-09 部署,10 道已部署)

来源比赛:2025 强网杯 初赛(4)、HKCTF 2025 Quals(3)、2026 NCO Final(2)、2024 PandaCupCTF Finals(1)。实际配比 2 easy / 8 medium。10 道题已全部构建镜像、导入平台并验证 flag 可达。

> 构建备注:
> - 所有题目基础镜像均替换为国内可访问标签或本地已有标签;`2025-qwbs9-bbjv` 使用 `eclipse-temurin:21-jdk-jammy`;`2025-qwbs9-secret-vault` 使用 `golang:1.25-alpine` + `python:3.13-alpine`;`2025-qwbs9-cele-race` 使用 `python:3.11-slim` 同容器跑 Redis + Celery + Web;`2025-qwbs9-go2php` 使用 `php:8.2-apache`;HKCTF 2025 三题分别使用 `eclipse-temurin:17-jdk-jammy`、`node:20-alpine`、`python:3.11-slim`;2026 NCO Final 两题使用 `python:3.11-slim`;`2024-pandacup-gateway` 使用 `ubuntu:22.04`。
> - 所有题目统一改为构建期静态 flag:`ENV FLAG=...` / `RUN echo "$FLAG" > /flag` (或对应题目标志文件路径)。
> - `2025-qwbs9-cele-race` 原 Dockerfile 在子目录 `docker/`,复制到根目录并调整 COPY 路径;安装 `redis-server` 与 `supervisor`,同容器启动 Redis、Web、Celery worker。
> - `2025-qwbs9-go2php` 的 `php:8.2-apache` 基于 Debian 12,使用 `/etc/apt/sources.list.d/debian.sources` 换清华源;保留原题 `catflag` SUID 程序读取 `/flag.txt`。
> - `2025-qwbs9-secret-vault` 原 `entrypoint.sh` 读取 `ICQ_FLAG` 环境变量写入 `/flag`,构建期设置 `ENV ICQ_FLAG=...`。
> - `2026-nco-final-pino` / `2026-nco-final-what-can-i-say` 源码中 `GZCTF_FLAG` 改为 `FLAG`,并同时写入 `/flag` 和 `/tmp/flag.txt`。
> - `hkctf-2025-labyrinth` 仅有可执行 jar,手写 Dockerfile 直接 `java -jar` 运行。
> - `hkctf-2025-nettool` 无 requirements.txt,手写 Dockerfile 安装 `fastapi uvicorn jinja2 httpx pydantic pyjwt python-multipart`,监听 8000。
> - `2024-pandacup-gateway` 从 GitHub Release 下载附件,手写 Dockerfile;注意 `sed` 替换源地址时使用 `#` 分隔符避免与 URL 中的 `/` 冲突。
> - 本批次使用 `NO_SAVE=1` 仅保留本地镜像标签,未导出 tar。

| 题目 | 比赛 | 难度 | 端口 | 考点 | writeup | 状态 |
|------|------|------|------|------|---------|------|
| bbjv | 2025 强网杯 初赛 | easy | 8080 | Spring Boot 简单 Java 反序列化 | [官方附件](https://github.com/CTF-Archives/2025-qwbs9-quals) | 已部署 |
| SecretVault | 2025 强网杯 初赛 | medium | 5555 | Go + Python Flask 密码管理器;JWT 与权限绕过 | [官方附件](https://github.com/CTF-Archives/2025-qwbs9-quals) | 已部署 |
| CeleRace | 2025 强网杯 初赛 | medium | 5000 | Python MiniFlask + Celery + Redis;Race Condition | [官方附件](https://github.com/CTF-Archives/2025-qwbs9-quals) | 已部署 |
| go2php | 2025 强网杯 初赛 | medium | 80 | PHP 扩展 + 文件上传;SUID catflag 读 flag | [官方附件](https://github.com/CTF-Archives/2025-qwbs9-quals) | 已部署 |
| Labyrinth | HKCTF 2025 Quals | medium | 8080 | Spring Boot 迷宫/URL 绕过 | [官方附件](https://github.com/CTF-Archives/HKCERTCTF2025Quals) | 已部署 |
| ezjs | HKCTF 2025 Quals | easy | 80 | Node.js JSON5 + pug 模板渲染 SSTI | [官方附件](https://github.com/CTF-Archives/HKCERTCTF2025Quals) | 已部署 |
| nettool | HKCTF 2025 Quals | medium | 8000 | Python FastAPI 管理员 SSRF/命令注入 | [官方附件](https://github.com/CTF-Archives/HKCERTCTF2025Quals) | 已部署 |
| Pino | 2026 NCO Final | medium | 5007 | Flask ping 命令注入 | [官方仓库](https://github.com/CTF-Archives/2026-NCO-Final/tree/main/web/Web-Pino) | 已部署 |
| What CAN I Say | 2026 NCO Final | medium | 5005 | Flask WriteUp 提交倒计时;绕过 AI 检测 | [官方仓库](https://github.com/CTF-Archives/2026-NCO-Final/tree/main/web/Web-What-CAN-I-Say) | 已部署 |
| gateway | 2024 PandaCupCTF Finals | medium | 80 | nginx + spawn-fcgi + C CGI;格式字符串与命令执行 | [博客园 WP](https://www.cnblogs.com/backlion/p/18338661) | 已部署 |

## 第三十批(2026-08-16 部署,10 道已部署)

来源比赛:2024 网鼎杯 朱雀组(1)、2025 OpenHarmony CTF(2)、2024 CISCN 总决赛 AWDP(4)、2024 三峡杯(2)、2024 浙江师范大学选拔赛(1)。实际配比 0 easy / 8 medium / 2 hard。10 道题已全部构建镜像、导入平台并验证 HTTP 可访问。

> 构建备注:
> - 本批次全部使用本地已有基础镜像:`php:8.2-apache`、`node:18-slim`、`python:3.11-slim`、`eclipse-temurin:8-jre-jammy`、`ubuntu:20.04`。
> - 所有题目统一改为构建期静态 flag:`RUN echo "$FLAG" > /flag` 或 `ENV FLAG=...` + entrypoint 写入 flag。
> - `2025-openharmony-layers` 的 `debug.php` 引用 `../config.php`,因此将 `config.php` 同时复制到 `/var/www/config.php`;并将 `secrettttts/token.txt` 复制到 `/var/www/secrets/token.txt`。
> - `2025-openharmony-filesystem` 直接运行已编译的 `dist/src/main.js`,启动前创建 `/opt/filesystem/adminconfig.lock` 和 `/opt/uploads`。
> - `2024-ciscn-awdp-fobee` 依赖土耳其 `toLowerCase()` 行为,Dockerfile 中设置 `LANG=tr_TR.UTF-8` / `LC_ALL=tr_TR.UTF-8` 并生成 locale。
> - `2024-ciscn-awdp-solonmaster` 与 `2024-ciscn-awdp-fobee` 通过 `-Dserver.port=8888` 强制监听 8888。
> - `2024-sanxia-textme` 使用 Rust 二进制,entrypoint 同时将 flag 写入 `/flag` 与 `/app/static/flag.txt`。
> - `2024-zjsdxs-qlagain` 的 jar 默认监听 8080,通过 `-Dserver.port=8089` 强制改为 8089。
> - 本批次使用 `NO_SAVE=1` 仅保留本地镜像标签,未导出 tar。

| 题目 | 比赛 | 难度 | 端口 | 考点 | writeup | 状态 |
|------|------|------|------|------|---------|------|
| Web1 | 2024 网鼎杯 朱雀组 | medium | 80 | Node.js Express + EJS 博客;数组绕过读 admin post | 待补充 | 已部署 |
| Layers of Compromise | 2025 OpenHarmony CTF | medium | 80 | PHP 多层鉴权/文件/XXE 绕过 | 待补充 | 已部署 |
| Filesystem | 2025 OpenHarmony CTF | medium | 3000 | NestJS 文件系统与配置读取 | 待补充 | 已部署 |
| ezjs | 2024 CISCN 总决赛 AWDP | medium | 3000 | Node.js Express 文件上传与 JS 解析 | 待补充 | 已部署 |
| ShareCard | 2024 CISCN 总决赛 AWDP | medium | 8888 | Flask Jinja2 沙箱 + JWT + 二维码分享 | 待补充 | 已部署 |
| Fobee | 2024 CISCN 总决赛 AWDP | hard | 8888 | Solon Java 土耳其 locale 逻辑绕过 | 待补充 | 已部署 |
| SolonMaster | 2024 CISCN 总决赛 AWDP | hard | 8888 | Solon Java 框架鉴权/路由绕过 | 待补充 | 已部署 |
| babyjava | 2024 三峡杯 | medium | 80 | Spring Boot Java 反序列化/逻辑 | 待补充 | 已部署 |
| textme | 2024 三峡杯 | medium | 80 | Rust + Tera 模板注入 | 待补充 | 已部署 |
| QL again | 2024 浙江师范大学选拔赛 | medium | 8089 | Spring Boot SQL/QL 注入 | 待补充 | 已部署 |

## 第三十一批(2026-08-16 部署,10 道已部署)

来源比赛:HKCERT CTF 2025 Quals(3)、2025 尖峰山杯决赛(2)、2025 尖峰山杯初赛(1)、2025 JSWA(1)、NewStar CTF 2025(1)、TSCTF-J 2025(2)。实际配比 2 easy / 7 medium / 1 hard。10 道题全部从本地已构建但未部署的镜像中补入，已导入平台并验证 HTTP 可访问。

> 构建备注:
> - 本批次全部使用本地已有镜像 tar 或已加载的 Docker 镜像，未重新构建。
> - 由于 GitHub 下载受阻（直连超时、代理 reset、API rate limit 耗尽），无法从 CTF-Archives 继续拉取新题，因此从 `docker-images/` 历史归档与本地 Docker 镜像中筛选未部署题目。
> - `HKCERT ezjs` / `HKCERT Labyrinth` / `HKCERT nettool` 与已部署的 `HKCTF 2025 Quals` 三道同名题来源相同但镜像构建不同，标题前加 `HKCERT` 前缀以区分。
> - `jksn login-php`、`TSCTF-J ez_sql`、`strange login` 依赖 MySQL，容器启动脚本会自动初始化数据库。
> - `TSCTF-J filesystem` 监听 3000，其余均为 80。

| 题目 | 比赛 | 难度 | 端口 | 考点 | writeup | 状态 |
|------|------|------|------|------|---------|------|
| HKCERT ezjs | HKCERT CTF 2025 Quals | medium | 80 | Node.js JSON5 + pug 模板渲染 SSTI | 待补充 | 已部署 |
| HKCERT Labyrinth | HKCERT CTF 2025 Quals | hard | 8080 | Spring Boot 迷宫/URL 绕过 | 待补充 | 已部署 |
| HKCERT nettool | HKCERT CTF 2025 Quals | medium | 80 | Python FastAPI 管理员 SSRF/命令注入 | 待补充 | 已部署 |
| jksn final web2 | 2025 尖峰山杯决赛 | medium | 80 | PHP 逻辑/文件操作 | 待补充 | 已部署 |
| jksn login-php | 2025 尖峰山杯初赛 | medium | 80 | PHP + MySQL 登录逻辑/注入 | 待补充 | 已部署 |
| jswa web1 | 2025 JSWA | medium | 80 | Node.js Express 登录/逻辑绕过 | 待补充 | 已部署 |
| strange login | NewStar CTF 2025 | medium | 80 | PHP + MySQL 登录逻辑 | 待补充 | 已部署 |
| TSCTF-J ez_sql | TSCTF-J 2025 | easy | 80 | PHP + MySQL SQL 注入 | 待补充 | 已部署 |
| TSCTF-J filesystem | TSCTF-J 2025 | medium | 3000 | Node.js 文件系统/配置读取 | 待补充 | 已部署 |
| jksn web4-lfi | 2025 尖峰山杯决赛 | medium | 80 | PHP LFI/文件包含 | 待补充 | 已部署 |

## 第三十二批(2026-08-16 部署,5 道已部署)

来源比赛:2023 强网杯 S6 全国赛(2)、2024 浙江省大学生网络安全竞赛预赛(1)、2026 极客少年挑战赛初赛(2)。实际配比 2 easy / 2 medium / 1 hard。5 道题已构建镜像、导入平台并验证 HTTP 可访问;原 5 道候选因与已有记录重复或平台不支持未纳入本批次,不再补充。

> 构建备注:
> - 本批次全部使用本地附件或 GitHub 源码,基础镜像使用 `python:3.11-slim`、`ctftraining/base_image_nginx_mysql_php_73`、`nginx:alpine`、`azul/zulu-openjdk:17`。
> - 所有题目统一改为构建期静态 flag:`ARG FLAG=...` + `ENV FLAG=$FLAG`,并在构建时写入 `/flag`(或题目指定路径)。
> - `qwbs6qsn-2023-ezdja` 为 Django 应用,将数据库改为 SQLite3,`python manage.py migrate --run-syncdb` 初始化表。
> - `qwbs6qsn-2023-fuond-cms` 使用 `ctftraining/base_image_nginx_mysql_php_73` 单容器 LAMP;修改 `base_url` / `DB_PASSWORD` 并生成 `db.sql`。
> - `zjsdxs-2024-qualifier-cybersecurity-knowledge` 为纯前端,使用 nginx 提供静态文件,并通过 `/flag` 路由暴露 flag。
> - `jksn-2026-quals-teacher-panel` 从 `/tmp/flag` 读取 flag;`jksn-2026-quals-waf-bypass` 直接 `java -jar` 运行。
> - 本批次使用 `NO_SAVE=1` 仅保留本地镜像标签,未导出 tar。
> - 目录 `qwbS6qsn-2023` 因 Docker 镜像名不能包含大写字母,已重命名为 `qwbs6qsn-2023`。
> - 已移除的候选:`sockserver`(与 batch9 失败记录同源且非标准 Web 服务)、`OnlyLocalSql`(需 SSH 进容器起恶意 MySQL,平台不支持)、`rizhi api`(与 `qwbs9-2025-web-api` 同源重复);`week2 web1` 与 `QL again` 曾被错误覆盖,已恢复为原数据。

| 题目 | 比赛 | 难度 | 端口 | 考点 | writeup | 状态 |
|------|------|------|------|------|---------|------|
| ezdja | 2023 强网杯 S6 全国赛 | medium | 5000 | Django 应用 + 文件上传反序列化 | 待补充 | 已部署 |
| fuond cms | 2023 强网杯 S6 全国赛 | hard | 80 | PHP CMS + MySQL 注入/文件读取 | 待补充 | 已部署 |
| CyberSecurity Knowledge | 2024 浙江省大学生网络安全竞赛预赛 | easy | 80 | 前端知识竞赛(隐藏 /flag 路由) | 待补充 | 已部署 |
| teacher panel | 2026 极客少年挑战赛初赛 | easy | 8000 | Flask session 角色伪造读 flag | 待补充 | 已部署 |
| WAF bypass | 2026 极客少年挑战赛初赛 | medium | 8080 | Spring Boot fastjson 反序列化 | 待补充 | 已部署 |

## 第三十三批(2026-08-23 部署,10 道已部署)

来源比赛:SVUCTF HELLOWORLD 2024(7)、CISCN 2024 初赛(1)、CUHK CTF 2025(1)、2025 强网杯初赛(1)。实际配比 7 easy / 2 medium / 1 hard。10 道题已构建镜像、导入平台并验证 flag 可提交。

> 构建备注:
> - 本批次全部使用本地附件或 GitHub 源码,基础镜像使用本地已有 `php:8.2-apache`、`python:3.12-alpine`。
> - 所有题目统一改为构建期静态 flag:`ARG FLAG` + `RUN echo "$FLAG" > /flag`(或题目指定路径),并在构建时注入登记表中的平台 flag。
> - `docker/ctf-contests/build.sh` 已增加从登记表读取 `FLAG` 并通过 `--build-arg` 注入的功能,避免 Dockerfile 中硬编码 flag。
> - 后端开发端口因 Windows 保留端口范围(3000–3600 等)无法绑定,本次部署临时使用 `127.0.0.1:2800` 启动后端;导入脚本通过 `API_BASE=http://127.0.0.1:2800` 调用。
> - `cuhk-ctf-2025-jain-streak-dreamers` 依赖 OCaml Dream + opam,135 个包从 opam.ocaml.org 下载/编译耗时极长且清华 opam 镜像不存在。为保留原题 Dockerfile 不变,额外编写 `Dockerfile.flag-inject` 基于已完整构建的原题镜像仅覆盖 flag 文件,产物仍标记为 `localtrain/ctf-cuhk-ctf-2025-jain-streak-dreamers:latest`。
> - 本批次使用 `NO_SAVE=1` 仅保留本地镜像标签,未导出 tar。

| 题目 | 比赛 | 难度 | 端口 | 考点 | writeup | 状态 |
|------|------|------|------|------|---------|------|
| SVUCTF ezHTTP | SVUCTF HELLOWORLD 2024 | easy | 80 | HTTP 头伪造(X-Forwarded-For / Referer / User-Agent) | 待补充 | 已部署 |
| SVUCTF Param | SVUCTF HELLOWORLD 2024 | easy | 80 | GET/POST 参数传递 | 待补充 | 已部署 |
| SVUCTF babyRCE | SVUCTF HELLOWORLD 2024 | easy | 80 | PHP eval 无过滤 RCE | 待补充 | 已部署 |
| SVUCTF Method | SVUCTF HELLOWORLD 2024 | easy | 80 | Flask HTTP 方法探测 | 待补充 | 已部署 |
| SVUCTF PHP Class | SVUCTF HELLOWORLD 2024 | medium | 80 | PHP 类属性与 GET 参数 | 待补充 | 已部署 |
| SVUCTF ezRCE | SVUCTF HELLOWORLD 2024 | medium | 80 | PHP eval 过滤绕过 | 待补充 | 已部署 |
| SVUCTF Unserialize | SVUCTF HELLOWORLD 2024 | medium | 80 | PHP 反序列化 POP 链 | 待补充 | 已部署 |
| pybox | CISCN 2024 初赛 | medium | 5000 | Python 沙箱代码执行绕过 | 待补充 | 已部署 |
| jain streak dreamers | CUHK CTF 2025 | hard | 8080 | OCaml Dream 应用文件包含/路径遍历 | 待补充 | 已部署 |
| web-log-api | 2025 强网杯初赛 | easy | 80 | PHP 日志污染/文件包含 | 待补充 | 已部署 |

## 第34批(2026-09-11 部署,10 道已部署)

2026 湾区杯初赛(4)、0xGame 2023(6)。湾区杯四道为白盒源码题无公开 writeup,由源码自审计确认解法(ShadowArchive=pickle逃逸+深合并污染,DockRelay=SSRF策略绕过+容器内附 flag 服务,nimbus=Go CMS 审计,hanziguard=H2 1.4.200 CREATE ALIAS RCE);0xGame2023 使用官方 X1cT34m 仓库 docker。web_snapshot(双容器 redis slaveOf)与 litemall-plus/SchemaStudio/ThemeForge/jdbc/Robo Admin 均 skipped

| 题目 | 比赛 | 难度 | 端口 | writeup | 状态 |
|------|------|------|------|---------|------|
| ShadowArchive | 2026 湾区杯初赛 | hard | 5000 | 待补充 | 已部署 |
| DockRelay | 2026 湾区杯初赛 | medium | 3000 | 待补充 | 已部署 |
| one-click-to-build | 2026 湾区杯初赛 | medium | 8090 | 待补充 | 已部署 |
| hanziguard | 2026 湾区杯初赛 | medium | 8000 | 待补充 | 已部署 |
| baby_php | 0xGame 2023 | easy | 80 | 0xGame2023 官方 WP(同仓库) | 已部署 |
| ping | 0xGame 2023 | easy | 80 | 0xGame2023 官方 WP(同仓库) | 已部署 |
| ez_upload | 0xGame 2023 | easy | 80 | 0xGame2023 官方 WP(同仓库) | 已部署 |
| ez_unserialize | 0xGame 2023 | easy | 80 | 0xGame2023 官方 WP(同仓库) | 已部署 |
| GoShop | 0xGame 2023 | medium | 8000 | 0xGame2023 官方 WP(同仓库) | 已部署 |
| hello_http | 0xGame 2023 | easy | 80 | 0xGame2023 官方 WP(同仓库) | 已部署 |

## 第35批(2026-09-11 部署,10 道已部署)

0xGame 2022 全批(X1cT34m/0xGame2022 官方仓,官方 WP 为 wp/Week1-4.pdf)。nginx+php-fpm 双容器题合并为 php:7.4-apache 单容器;Ez_sql 合并 mariadb 进单容器并导入官方 sql;i_want_4090ssti/session 为 python:3.7-alpine(1337);dont_pollute_me 为 node(3000)。ssrf_me(ctfhub 老镜像)/think_about_php(linode/lamp)/ez_girlfriend(附件不全) skipped

| 题目 | 比赛 | 难度 | 端口 | writeup | 状态 |
|------|------|------|------|---------|------|
| login | 0xGame 2022 | easy | 80 | 0xGame2022 wp/Week1.pdf | 已部署 |
| where_U_from | 0xGame 2022 | easy | 80 | 0xGame2022 wp/Week1.pdf | 已部署 |
| Myrobots | 0xGame 2022 | easy | 80 | 0xGame2022 wp/Week1.pdf | 已部署 |
| Ez_rce | 0xGame 2022 | easy | 80 | 0xGame2022 wp/Week1.pdf | 已部署 |
| Ez_sql | 0xGame 2022 | easy | 80 | 0xGame2022 wp/Week2.pdf | 已部署 |
| do_u_like_pop | 0xGame 2022 | easy | 80 | 0xGame2022 wp/Week2.pdf | 已部署 |
| upload_whatever | 0xGame 2022 | easy | 80 | 0xGame2022 wp/Week2.pdf | 已部署 |
| i_want_4090ssti | 0xGame 2022 | medium | 1337 | 0xGame2022 wp/Week2.pdf | 已部署 |
| session | 0xGame 2022 | medium | 1337 | 0xGame2022 wp/Week3.pdf | 已部署 |
| dont_pollute_me | 0xGame 2022 | medium | 3000 | 0xGame2022 wp/Week3.pdf | 已部署 |

## 第36批(2026-09-11 部署,10 道已部署)

0xGame 2024 全批(官方仓 23 道 web 全自带 Dockerfile)。hello_http 的 flag 被源码 str_split 切 9 段分发,平台 flag 需 <=45 字符,故该题 flag 短格式。ez_rce/ez_unser/ez_sql 因与 0xGame2022 撞名未收录

| 题目 | 比赛 | 难度 | 端口 | writeup | 状态 |
|------|------|------|------|---------|------|
| hello_web | 0xGame 2024 | easy | 80 | 0xGame2024 Writeup/Week 1 Writeup.pdf | 已部署 |
| hello_http | 0xGame 2024 | easy | 80 | 0xGame2024 Writeup/Week 1 Writeup.pdf | 已部署 |
| picture | 0xGame 2024 | easy | 80 | 0xGame2024 Writeup/Week 1 Writeup.pdf | 已部署 |
| hello_include | 0xGame 2024 | easy | 80 | 0xGame2024 Writeup/Week 2 Writeup.pdf | 已部署 |
| hello_shell | 0xGame 2024 | easy | 80 | 0xGame2024 Writeup/Week 2 Writeup.pdf | 已部署 |
| ez_login | 0xGame 2024 | easy | 8000 | 0xGame2024 Writeup/Week 1 Writeup.pdf | 已部署 |
| ez_ssti | 0xGame 2024 | easy | 8000 | 0xGame2024 Writeup/Week 1 Writeup.pdf | 已部署 |
| baby_pickle | 0xGame 2024 | medium | 8000 | 0xGame2024 Writeup/Week 2 Writeup.pdf | 已部署 |
| baby_xxe | 0xGame 2024 | medium | 8000 | 0xGame2024 Writeup/Week 2 Writeup.pdf | 已部署 |
| hello_jwt | 0xGame 2024 | medium | 3000 | 0xGame2024 Writeup/Week 3 Writeup.pdf | 已部署 |

## 第37批(2026-09-11 部署,10 道已部署)

MoeCTF 2022 七道+MoeCTF 2023 三道入门(XDSEC 官方仓,自带官方 WP)。signin/cookie flask 监听 9999

| 题目 | 比赛 | 难度 | 端口 | writeup | 状态 |
|------|------|------|------|---------|------|
| baby_file | MoeCTF 2022 | easy | 80 | 官方 WP(仓库内) | 已部署 |
| cookiehead | MoeCTF 2022 | easy | 80 | 官方 WP(仓库内) | 已部署 |
| ezhtml | MoeCTF 2022 | easy | 80 | 官方 WP(仓库内) | 已部署 |
| ezphp | MoeCTF 2022 | easy | 80 | 官方 WP(仓库内) | 已部署 |
| sqlmap_boy | MoeCTF 2022 | medium | 80 | 官方 WP(仓库内) | 已部署 |
| what are y0u uploading？ | MoeCTF 2022 | easy | 80 | 官方 WP(仓库内) | 已部署 |
| God_of_Aim | MoeCTF 2022 | medium | 80 | 官方 WP(仓库内) | 已部署 |
| signin | MoeCTF 2023 | easy | 9999 | 官方 WP(仓库内) | 已部署 |
| cookie | MoeCTF 2023 | easy | 9999 | 官方 WP(仓库内) | 已部署 |
| http | MoeCTF 2023 | easy | 80 | 官方 WP(仓库内) | 已部署 |

## 第38批(2026-09-11 部署,10 道已部署)

MoeCTF 2023 其余七道+0xGame 2023 剩余三道(notebook/ez_sandbox/repo_leak)。webimp/php-72-apache 与 vulhub/php-xxe 基础镜像镜像源不可得,统一替换 php:7.4-apache;moeworld(三容器)剔除

| 题目 | 比赛 | 难度 | 端口 | writeup | 状态 |
|------|------|------|------|---------|------|
| gas!gas!gas! | MoeCTF 2023 | medium | 80 | 官方 WP(仓库内) | 已部署 |
| meo图床 | MoeCTF 2023 | medium | 80 | 官方 WP(仓库内) | 已部署 |
| moe图床 | MoeCTF 2023 | medium | 80 | 官方 WP(仓库内) | 已部署 |
| 了解你的座驾 | MoeCTF 2023 | medium | 80 | 官方 WP(仓库内) | 已部署 |
| 彼岸的flag | MoeCTF 2023 | medium | 80 | 官方 WP(仓库内) | 已部署 |
| 大海捞针 | MoeCTF 2023 | medium | 80 | 官方 WP(仓库内) | 已部署 |
| 夺命十三枪 | MoeCTF 2023 | medium | 80 | 官方 WP(仓库内) | 已部署 |
| notebook | 0xGame 2023 | medium | 8000 | 官方 WP(仓库内) | 已部署 |
| ez_sandbox | 0xGame 2023 | medium | 3000 | 官方 WP(仓库内) | 已部署 |
| repo_leak | 0xGame 2023 | easy | 80 | 官方 WP(仓库内) | 已部署 |

## 第39批(2026-09-11 部署,10 道已部署)

NCTF 2022(calc/ez_sql 外为多容器或 deno 依赖被墙,仅收 2 道)+miniL 2022/2023 的 docker 完备 web 题+0xGame 2024 补位(ez-rce-24/basic-flask)。nctf2022-ez-sql 因 deno.land 依赖被墙剔除;pycalculator 实为 socat 沙箱题剔除

| 题目 | 比赛 | 难度 | 端口 | writeup | 状态 |
|------|------|------|------|---------|------|
| calc | NCTF 2022 | easy | 5000 | 官方 WP(仓库内) | 已部署 |
| fake_login | Mini L-CTF 2023 | easy | 8000 | 官方 WP(仓库内) | 已部署 |
| ezsql_minil | Mini L-CTF 2023 | easy | 1433 | 官方 WP(仓库内) | 已部署 |
| giveaway | Mini L-CTF 2023 | medium | 10007 | 官方 WP(仓库内) | 已部署 |
| include | Mini L-CTF 2022 | easy | 80 | 官方 WP(仓库内) | 已部署 |
| easy-httpd | Mini L-CTF 2022 | medium | 2048 | 官方 WP(仓库内) | 已部署 |
| ez_sqli_23 | 0xGame 2023 | medium | 8000 | 0xGame2023 官方 WP(同仓库) | 已部署 |
| signin | 0xGame 2023 | easy | 80 | 0xGame2023 官方 WP(同仓库) | 已部署 |
| basic_flask | 0xGame 2024 | easy | 8000 | 0xGame2024 Writeup/Week 4 | 已部署 |
| ez_rce_24 | 0xGame 2024 | easy | 8000 | 0xGame2024 Writeup/Week 1 | 已部署 |

## 第40批(2026-09-11 部署,10 道已部署)

miniL 2024 docker 完备 web 题+minil2023-guess+0xgame2024-whysoserial(golang:1.22,readflag 题需去掉 BuildKit --chmod 兼容 legacy builder)+0xgame2023-signin(Vue dist 产物 sed 注入)+minil2024-ezjaba(fastjson,flag 在 rm chmod 前写入并 o+r 放行)。JvavGuy/injections/smartpark-revenge(Java+DB 双容器)剔除

| 题目 | 比赛 | 难度 | 端口 | writeup | 状态 |
|------|------|------|------|---------|------|
| PhoneBook | Mini L-CTF 2024 | medium | 9999 | 官方 WP(仓库内) | 已部署 |
| SmartPark | Mini L-CTF 2024 | medium | 8080 | 官方 WP(仓库内) | 已部署 |
| Snooker King | Mini L-CTF 2024 | medium | 80 | 官方 WP(仓库内) | 已部署 |
| game | Mini L-CTF 2024 | medium | 9999 | 官方 WP(仓库内) | 已部署 |
| le-dao-bu-pao | Mini L-CTF 2024 | medium | 8080 | 官方 WP(仓库内) | 已部署 |
| 2bytes | Mini L-CTF 2024 | medium | 9999 | 官方 WP(仓库内) | 已部署 |
| Msgbox | Mini L-CTF 2024 | medium | 5000 | 官方 WP(仓库内) | 已部署 |
| guess | Mini L-CTF 2023 | medium | 10001 | 官方 WP(仓库内) | 已部署 |
| ezjaba | Mini L-CTF 2024 | medium | 8080 | 官方 WP(仓库 OfficialWriteups) | 已部署 |
| WhySoSerial | 0xGame 2024 | medium | 8000 | 0xGame2024 Writeup/Week 3 | 已部署 |

## 第44批(2026-09-11 部署,10 道已部署)

来源:0xGame 2025 官方仓余量(X1cT34m/0xGame2025)。全部 compose 多服务题合并为单容器部署。

| 题目 | 比赛 | 难度 | 端口 | 状态 |
|------|------|------|------|------|
| Ez_HTTP | 0xGame 2025 | easy | 80 | 已部署 |
| ez_xxe | 0xGame 2025 | easy | 8000 | 已部署 |
| Lemon | 0xGame 2025 | easy | 80 | 已部署 |
| Lemon_RevEnge | 0xGame 2025 | easy | 9000 | 已部署 |
| RCE1 | 0xGame 2025 | easy | 80 | 已部署 |
| Rubbish_Flask | 0xGame 2025 | easy | 5000 | 已部署 |
| Rubbish_Unser | 0xGame 2025 | easy | 8000 | 已部署 |
| 404NotFound_rEvenGe | 0xGame 2025 | medium | 5000 | 已部署 |
| ez_pickle | 0xGame 2025 | medium | 9000 | 已部署 |
| ez_signin | 0xGame 2025 | medium | 80 | 已部署 |

## 第45批(2026-09-11 部署,10 道已部署)

来源:0xGame 2025 官方仓余量(X1cT34m/0xGame2025)。全部 compose 多服务题合并为单容器部署。

| 题目 | 比赛 | 难度 | 端口 | 状态 |
|------|------|------|------|------|
| ez_soap | 0xGame 2025 | medium | 80 | 已部署 |
| ez_ssrf | 0xGame 2025 | medium | 8000 | 已部署 |
| ez_upload | 0xGame 2025 | medium | 8000 | 已部署 |
| plus_plus | 0xGame 2025 | medium | 80 | 已部署 |
| Evernight | 0xGame 2025 | hard | 80 | 已部署 |
| ez_phar | 0xGame 2025 | hard | 80 | 已部署 |
| ez_php | 0xGame 2025 | hard | 80 | 已部署 |
| ez_ssti2 | 0xGame 2025 | hard | 80 | 已部署 |
| ez_stack | 0xGame 2025 | hard | 9000 | 已部署 |
| Test_Your_UUID8 | 0xGame 2025 | hard | 9000 | 已部署 |

## 第46批(2026-09-11 部署,10 道已部署)

来源:0xGame 2025 官方仓余量(X1cT34m/0xGame2025)+NCTF 2026+miniL 2023 余量+奶龙杯 2025。全部 compose 多服务题合并为单容器部署。

| 题目 | 比赛 | 难度 | 端口 | 状态 |
|------|------|------|------|------|
| ez_pollute | 0xGame 2025 | hard | 8080 | 已部署 |
| SpringShiro | 0xGame 2025 | hard | 8000 | 已部署 |
| test | 0xGame 2025 | hard | 8080 | 已部署 |
| xss_re | 0xGame 2025 | hard | 3000 | 已部署 |
| N-Horse | NCTF 2026 | medium | 8000 | 已部署 |
| OpenShell | NCTF 2026 | medium | 8000 | 已部署 |
| ezbook | Mini L-CTF 2023 | medium | 8080 | 已部署 |
| mini_java | Mini L-CTF 2023 | medium | 8000 | 已部署 |
| Hello_netdreamCTF_2025 | 奶龙杯 2025 | easy | 80 | 已部署 |
| picklelovedill | 奶龙杯 2025 | medium | 80 | 已部署 |

## 第47批(2026-09-12 部署,10 道已部署)

来源:XYCTF 2025(6)、LILCTF 2025(1)、Mini V&N CTF 2025(1)、V&NCTF 2026(1)、0xGame 2024(1)

| 题目 | 比赛 | 难度 | 端口 | 状态 |
|------|------|------|------|------|
| division | XYCTF 2025 | medium | 13337 | 已部署 |
| greedymen | XYCTF 2025 | medium | 13337 | 已部署 |
| Now you see me 1 | XYCTF 2025 | medium | 8000 | 已部署 |
| Now you see me 2 | XYCTF 2025 | medium | 8000 | 已部署 |
| 出题人又疯 | XYCTF 2025 | medium | 8000 | 已部署 |
| 出题人已疯 | XYCTF 2025 | medium | 8000 | 已部署 |
| ekko_exec | LILCTF 2025 | medium | 5000 | 已部署 |
| check_in | Mini V&N CTF 2025 | medium | 8080 | 已部署 |
| I really really really 系列 | V&NCTF 2026 | medium | 8080 | 已部署 |
| ez_sql_24 | 0xGame 2024 | easy | 8000 | 已部署 |

## 第48批(2026-09-12 部署,9 道已部署)

来源:SUSCTF 2025(6)、HKCERT CTF 2024(3)

| 题目 | 比赛 | 难度 | 端口 | 状态 |
|------|------|------|------|------|
| am-i-admin | SUSCTF 2025 | medium | 8080 | 已部署 |
| am-i-admin-2 | SUSCTF 2025 | hard | 8080 | 已部署 |
| easyoa | SUSCTF 2025 | medium | 80 | 已部署 |
| easyprint | SUSCTF 2025 | medium | 5000 | 已部署 |
| make_php_great_again | SUSCTF 2025 | medium | 80 | 已部署 |
| susmarket | SUSCTF 2025 | hard | 5000 | 已部署 |
| Custom Web Server (1) | HKCERT CTF 2024 | easy | 80 | 已部署 |
| New Free Lunch | HKCERT CTF 2024 | easy | 80 | 已部署 |
| Mystiz's Mini CTF (1) | HKCERT CTF 2024 | easy | 80 | 已部署 |

## 第49批(2026-09-12 部署,9 道已部署)

来源:HKCERT CTF 2024(7)、HKCERT CTF 2023(2)

| 题目 | 比赛 | 难度 | 端口 | 状态 |
|------|------|------|------|------|
| Custom Web Server (2) | HKCERT CTF 2024 | medium | 80 | 已部署 |
| ⚡ | HKCERT CTF 2024 | hard | 80 | 已部署 |
| Chimera | HKCERT CTF 2024 | hard | 80 | 已部署 |
| Webpage to PDF (1) | HKCERT CTF 2024 | easy | 80 | 已部署 |
| Webpage to PDF (2) | HKCERT CTF 2024 | easy | 80 | 已部署 |
| Tuning Keyboard 5.5 | HKCERT CTF 2024 | hard | 80 | 已部署 |
| JSPyaml | HKCERT CTF 2024 | hard | 80 | 已部署 |
| Myblog | HKCERT CTF 2023 | easy | 80 | 已部署 |
| Re:Zero | HKCERT CTF 2023 | easy | 80 | 已部署 |

## 第50批(2026-09-12 部署,9 道已部署)

来源:HKCERT CTF 2023(9)

| 题目 | 比赛 | 难度 | 端口 | 状态 |
|------|------|------|------|------|
| ProbablyUnknown's Markup Language | HKCERT CTF 2023 | medium | 80 | 已部署 |
| Secret Notebook | HKCERT CTF 2023 | medium | 80 | 已部署 |
| ST Code (III) | HKCERT CTF 2023 | medium | 80 | 已部署 |
| Infant XSS again | HKCERT CTF 2023 | easy | 80 | 已部署 |
| Wishlist | HKCERT CTF 2023 | hard | 80 | 已部署 |
| PHP.net Backdoor (I) | HKCERT CTF 2023 | easy | 80 | 已部署 |
| Baby XSS again | HKCERT CTF 2023 | easy | 80 | 已部署 |
| Fetus XSS again | HKCERT CTF 2023 | easy | 80 | 已部署 |
| Fake/Ground Offer | HKCERT CTF 2023 | easy | 80 | 已部署 |

## 第51批(2026-09-12 部署,10 道已部署)

来源:HKCERT CTF 2022(10)

| 题目 | 比赛 | 难度 | 端口 | 状态 |
|------|------|------|------|------|
| MOTP | HKCERT CTF 2022 | easy | 80 | 已部署 |
| Secured Web Service | HKCERT CTF 2022 | easy | 80 | 已部署 |
| The Math24 Game 1 | HKCERT CTF 2022 | easy | 80 | 已部署 |
| Expat Passer Confucian | HKCERT CTF 2022 | hard | 80 | 已部署 |
| Back to the Past | HKCERT CTF 2022 | easy | 80 | 已部署 |
| CVE 1999 | HKCERT CTF 2022 | easy | 80 | 已部署 |
| Spyce | HKCERT CTF 2022 | easy | 80 | 已部署 |
| Spyce2 | HKCERT CTF 2022 | hard | 80 | 已部署 |
| protoTYPE:v2 - sanityXSS | HKCERT CTF 2022 | easy | 80 | 已部署 |
| protoTYPE:v3 - Chaos | HKCERT CTF 2022 | hard | 80 | 已部署 |
