# 题目部署需求文档

> 本文件汇总 LocalTrain 项目中 **CVE 题目**与 **CTF 比赛 Web 题目**的部署需求、环境要求、流程规范和当前状态。供本地维护、新增题目和迁移时参考。
>
> 项目本身仅供本地学习使用，所有部署操作均假设在本地 Docker 环境执行。请勿将本项目直接暴露到公网。

## 目录

- [1. 文档目标与适用范围](#1-文档目标与适用范围)
- [2. 部署环境需求](#2-部署环境需求)
- [3. 目录与文件约定](#3-目录与文件约定)
- [4. CVE 题目部署](#4-cve-题目部署)
- [5. CTF 比赛 Web 题目部署](#5-ctf-比赛-web-题目部署)
- [6. 通用部署流程](#6-通用部署流程)
- [7. 安全与注意事项](#7-安全与注意事项)
- [8. 当前状态总览](#8-当前状态总览)
- [9. 历史变更记录](#9-历史变更记录)

---

## 1. 文档目标与适用范围

本文档描述如何为 LocalTrain 本地靶场准备、构建并导入两类题目：

1. **CVE 复现题目**：基于公开 CVE 漏洞构建的独立 Docker 镜像。
2. **CTF 比赛 Web 题目**：来自国内 CTF 比赛官方仓库的 Web 挑战，改造为单容器运行后导入平台。

本文档适用于项目维护者、新增题目的 AI 助手或后续迁移人员。

---

## 2. 部署环境需求

| 组件 | 最低/推荐要求 | 说明 |
|------|---------------|------|
| Node.js | >= 18 | 后端运行与构建所需 |
| npm | 随 Node.js 安装 | 使用 npm workspaces |
| Docker | 任意现代版本 | 需可被本地 Node.js 进程访问 |
| Docker 数据位置 | 已迁移至 `F:/Docker` | 释放 C 盘空间，在 Docker Desktop 中手动设置 |
| 网络代理 | 推荐配置 Clash 等代理 | 访问 GitHub 下载源码，本地代理地址 `http://127.0.0.1:7890` |
| 磁盘空间 | 建议剩余 >= 50 GB | 镜像 tar 归档、Docker 镜像层、源码附件均占用空间 |

> **Docker 镜像源**：当前环境下 Docker Hub 直连不可用，基础镜像通过 `docker.m.daocloud.io`、`docker.1ms.run`、`hub.rat.dev` 等镜像源拉取后再 `docker tag` 回原名；`ghcr.io` 可直连。

---

## 3. 目录与文件约定

```
localtrain/
├── docker/
│   ├── cve-challenges/          # CVE 题目 Dockerfile 与 exploit 脚本
│   ├── ctf-contests/            # 比赛题目源码，按 <比赛slug>/<题目slug> 存放
│   │   └── build.sh             # 批量构建并导出镜像的脚本
│   ├── example-web/             # 最简 nginx 示例题目
│   └── show-me-your-pass/       # 示例 Web 题目
├── docker-images/               # 本地导出的 Docker 镜像 tar 归档
├── docs/
│   ├── cve-deploy-report.md     # CVE 部署详细记录
│   ├── cve-registry.json        # CVE 50 道题目登记表
│   ├── ctf-web-challenges.md    # 比赛 Web 题目部署记录（含每批明细）
│   ├── ctf-web-registry.json    # 比赛 Web 题目主登记表（第 1 批 + 跳过记录）
│   └── ctf-web-registry-batch*.json  # 第 2 批起的比赛 Web 题目登记表（如 batch2 ~ batch23）
├── .deployed-challenges/        # 已部署 CTF 比赛题目空文件夹索引（按 比赛名/题目名 组织，快速查重）
├── cve-writeup/                 # CVE 题目 writeup
│   └── README.md                # 已验证可拿 flag 的 CVE 索引
├── ctf-writeup/                 # 比赛题目 writeup，按比赛分目录
├── .tmp/                        # 临时下载源码、测试输出（已加入 .gitignore）
├── import-ctf-contests.mjs      # 按登记表批量导入 CTF 题目到平台
├── deploy-images.mjs            # 部署镜像到 Docker 并加载
├── update-flags.mjs             # 批量更新题目 flag
└── CHALLENGE-DEPLOYMENT.md      # 本文件
```

### 关键文件职责

| 文件 | 职责 |
|------|------|
| `docs/cve-registry.json` | 记录 50 道 CVE 题目的 id、CVE、端口、镜像、flag、状态 |
| `docs/ctf-web-registry.json` | 记录第 1 批比赛 Web 题目与跳过项，以及部分跨批次复用/更新条目 |
| `docs/ctf-web-registry-batch*.json` | 第 2 批起的比赛 Web 题目登记表（如 batch2 ~ batch23） |
| `.deployed-challenges/<比赛名>/<题目名>/` | 已部署比赛题目空文件夹索引，用于快速 `ls` 查重 |
| `docker/ctf-contests/build.sh` | 按 slug 批量构建镜像并导出 tar 到 `docker-images/` |
| `import-ctf-contests.mjs` | 读取登记表，自动创建 Challenge、上传附件 zip、写入 `contest` 标签 |
| `scripts/import-cve-challenges.mjs` | 将 CVE 登记表中 `deployed` 状态题目导入数据库 |
| `scripts/deploy-skipped-cve.mjs` | 重试 `skipped` 状态的 CVE 题目 |

---

## 4. CVE 题目部署

### 4.1 选题与登记表

- 全部 50 道 CVE 题目登记在 `docs/cve-registry.json`。
- 每道题包含：id、标题、CVE 编号、难度、端口、镜像名、flag、状态、来源镜像、flag 机制说明。

### 4.2 当前状态

| 状态 | 数量 | 说明 |
|------|------|------|
| 已部署 | 45 | 已完成镜像构建并导入数据库 |
| 跳过 | 5 | 缺少可用镜像或需自定义环境，暂时不部署 |

### 4.3 已验证可拿 flag 的题目

20 道已验证 CVE 题目已整理 writeup，索引见 `cve-writeup/README.md`，包括：

- Log4Shell / Log4j 绕过（CVE-2021-44228 / CVE-2021-45046）
- Spring Cloud Gateway SpEL（CVE-2022-22947）
- Apache Shiro RememberMe（CVE-2016-4437）
- ThinkPHP 5 RCE（CVE-2018-20062）
- PHPUnit eval-stdin（CVE-2017-9841）
- Apache HTTPd 路径穿越 / mod_rewrite 等
- Redis 未授权、Elasticsearch Groovy、Solr + Log4j、pyLoad、Node.js vm2 等

完整列表与利用步骤参考 `cve-writeup/README.md`。

### 4.4 仍待补充的 CVE 题目（5 道 skipped）

| 题目 | 端口 | 未部署原因 |
|------|------|------------|
| WordPress Bricks Builder RCE | 80 | 需要较新的 WordPress + Bricks Builder 插件；当前 vulhub 镜像版本过旧且不含插件 |
| WordPress WP Automatic SQLi→RCE | 80 | 需要较新的 WordPress + WP Automatic 插件；当前 vulhub 镜像版本过旧且不含插件 |
| Ruby on Rails Action View 文件读取 / RCE | 3000 | 需自定义 Rails 环境，已标记跳过 |
| Git 符号链接 RCE | 80 | 需自定义 git 客户端/服务端环境，已标记跳过 |
| Zabbix SAML 认证绕过 | 80 | 缺少 5.0.17 版本镜像，当前可用 3.0.3 与 CVE 不匹配 |

后续若找到可用镜像或自定义环境，可通过 `scripts/deploy-skipped-cve.mjs` 继续尝试。

### 4.5 CVE 部署流程

1. 确认 `docs/cve-registry.json` 中题目状态与镜像候选。
2. 运行 `node scripts/deploy-skipped-cve.mjs [id]` 尝试构建并导出镜像。
3. 运行 `node scripts/import-cve-challenges.mjs` 将 `deployed` 题目导入数据库。
4. 在前台启动容器，按 `cve-writeup/` 中的步骤验证 flag 可达性。
5. 记录 writeup 与测试结果，更新 `cve-writeup/README.md` 与 `docs/cve-deploy-report.md`。

---

## 5. CTF 比赛 Web 题目部署

### 5.1 选题标准

- 仅 Web 题目，来自国内 CTF 比赛（2022 年以后）官方仓库。
- 每题必须有：完整题目源码/附件 + 可单容器部署（优先自带 Dockerfile）+ 公开 writeup。
- 难度配比：**中等和简单为主，困难少量**。
- 排除：虚拟机渗透题（boot2root）、需多容器编排、依赖外部服务、非 Web 服务。

> 2026-07-19 起，由于已可直接走 GitHub 下载源码，旧「单附件 15MB 上限」已移除。附件大小不再作为选题排除条件，仅保留多容器编排、依赖外部服务、无源码/无 Dockerfile 等排除项。

### 5.2 选题流程（脚本门禁版）

每批次固定目标 10 道 Web 题。**先跑脚本、再看输出，不要手工翻历史登记表逐题查重。** 全流程按以下顺序执行：

**0. 刷新查重索引（每次选题前必做）**

```bash
node scripts/update-deployed-index.mjs
```

从所有 `docs/ctf-web-registry*.json` 重新生成 `.tmp/deployed-contests.txt`（已部署比赛）、`.tmp/deployed-challenge-keys.txt`（已部署 `比赛/题目`）、`.tmp/deployed-title-norms.txt`（已部署标题归一化形式），并补齐 `.deployed-challenges/` 空文件夹索引。之后所有查重只读这三个文件。

**1. 筛选比赛并下载源码**

- 选题标准见 5.1。用 `deployed-contests.txt` 和 `ls .deployed-challenges/<比赛名>/` 确认比赛未充分使用。
- 比赛确定后，**先把源码/附件下载到 `.tmp/batchN/`（N=当前批次号）再分析**；不要仅凭网页目录树或 release 说明判定题目可用。下载失败或仓库为空的直接跳过。

**2. 扫描候选目录，一轮拿到分类+查重结论**

```bash
node scripts/scan-web-candidates.mjs .tmp/batchN
```

- 只看 `kind=web 且 dup=-` 的行进入下一步评估；`dup=YES`/`MAYBE(...)` 的排除或人工确认后排除；`pwn`/`misc`/`static` 直接跳过（`static` 纯前端题仅在没有其他候选时考虑）。
- 扫描器按附件名归一化比对已部署标题，附件名带比赛/阶段前缀时也会按后缀匹配（如 `zjsdxs-finals-web2.php` → 命中已部署 `web2`）。

**3. 评估难度并写登记表**

- 读候选本地 README/writeup 评估难度；本地无资料再联网搜索，仍无可靠资料则跳过。
- 确定的题目写入 `docs/ctf-web-registry-batchN.json`，`status: pending`。字段规范：
  - `id`：`<比赛slug>-<题目slug>`，全小写，仅 `[a-z0-9_-]`；`image` 固定为 `localtrain/ctf-<id>:latest`。
  - `title`：判重规则为「归一化标题 + 归一化比赛名」——同比赛同名视为同一题（默认跳过，`--allow-update` 覆盖）；**不同比赛同名允许导入，会创建为新题**。为便于选手区分，同名不同比赛时仍建议给标题加比赛前缀（如 `HKCERT ezjs`）。
  - `dir`：`docker/ctf-contests/<比赛slug>/<题目slug>/`。

**4. 预检（硬性门禁，有 ERROR 不许构建/导入）**

```bash
node scripts/validate-batch-registry.mjs docs/ctf-web-registry-batchN.json
```

检查必填字段、id/镜像/flag 命名规范、批内与跨批次 id 及归一化标题冲突、源码目录与 Dockerfile 是否存在。后端在线时可加 `--api` 额外比对平台现有题目。

**5. 构建、导入、验证、收尾**：按 5.4 执行。

> 常见否决项（第 32 批教训）：自定义非 HTTP 协议服务（如 sockserver）、需 SSH/交互式进容器才能解题（如 OnlyLocalSql 需容器内起恶意 MySQL）、只有附件没有可运行源码、标题归一化与旧题冲突且未加前缀。

> 选题过程中同时维护 `docs/ctf-web-challenges.md` 的批次章节（构建备注、附件补齐、writeup 来源）；`.deployed-challenges/` 索引由 `update-deployed-index.mjs` 维护，不要手工增删。

### 5.3 当前状态（32 批）

| 批次 | 日期 | 数量 | 部署 | 跳过 | 失败 | 备注 |
|------|------|------|------|------|------|------|
| 第 1 批 | 2026-07-18 | 12 | 12 | 3 | 0 | 主登记表含 3 道跳过记录 |
| 第 2 批 | 2026-07-18 | 20 | 15 | 5 | 0 | 含 7 道旧规则下因附件大小被跳过、后重新部署的题目 |
| 第 3 批 | 2026-07-18 | 10 | 10 | 0 | 0 | 以补足 LitCTF / HGAME 为主 |
| 第 4 批 | 2026-07-19 | 10 | 10 | 0 | 0 | 附件大小限制已移除，2 道旧因大小跳过题目后续在第 2 批补充 |
| 第 5 批 | 2026-07-20 | 10 | 10 | 0 | 0 | 含 `internal_api` 单容器化改造 |
| 第 6 批 | 2026-07-20 | 10 | 10 | 0 | 0 | 多道 Java 题强制监听 8080 |
| 第 7 批 | 2026-07-21 | 11 | 10 | 0 | 1 | `web-01` 因 Rust 版本不兼容构建失败；补充 `ezzupload` 补齐 10 道 |
| 第 8 批 | 2026-07-21 | 10 | 10 | 0 | 0 | 含 `note taking 1` flag 更新；`ezDjango` 为避免标题冲突加后缀独立导入 |
| 第 9 批 | 2026-07-21 | 15 | 10 | 0 | 5 | 5 道 qwbs9 候选因非 Web 或构建复杂失败 |
| 第 10 批 | 2026-07-21 | 10 | 10 | 0 | 0 | 全部来自 `.tmp/` 本地源码，10 道全部成功 |
| 第 11 批 | 2026-07-21 | 10 | 10 | 0 | 0 | NewStar CTF 2025，官方镜像改静态 flag |
| 第 12 批 | 2026-07-21 | 10 | 10 | 0 | 0 | NewStar CTF 2025；`sqlupload` 使用 flatten 打包 |
| 第 13 批 | 2026-07-22 | 10 | 10 | 0 | 0 | NewStar CTF 2025 剩余 7 题 + energyCTF2025 2 题 + SDNISC 1 题 |
| 第 14 批 | 2026-07-22 | 10 | 10 | 0 | 0 | 2026 NCO、2025 尖峰山杯、2024 蓝桥杯、2023 沈阳车联网、2025 CISCN 总决赛；2 题为更新（标题冲突） |
| 第 15 批 | 2026-07-22 | 10 | 10 | 0 | 0 | 2026 NCO 入围测试、2025 尖峰山杯初赛、2024 三峡杯、2025 能源、2025 CISCN 总决赛、本地未归档源码 |
| 第 16 批 | 2026-07-25 | 10 | 10 | 0 | 0 | 2025 尖峰山杯初赛、2026 CCSSSC 半决赛、2023 强网杯、2024 强网杯半决赛、2023 全国大学生信息安全竞赛、2025 CISCN 总决赛；3 题由官方镜像 tar 重写 flag 后重新保存 |
| 第 17 批 | 2026-07-26 | 10 | 10 | 0 | 0 | HGAME 2023、2025 尖峰山杯决赛、AWDP 训练、Socialgroup CTF 2022、2023 福建省大学生网络安全竞赛；9 道自写 Dockerfile |
| 第 18 批 | 2026-07-27 | 10 | 10 | 0 | 0 | SDNISC 2025 海选、2026 NCO Final、AWDP 训练、NewStar CTF 2024、HGAME 2023、2024 西湖论剑、2024 强网杯半决赛、2025 鹏城杯初赛；不限难度配比，补齐未完整部署比赛 |
| 第 19 批 | 2026-07-28 | 10 | 10 | 0 | 0 | ADCTF 2025(2)、TSCTF-J 2025(6)、2024 CCB-CISCN Quals(2)；10 道全部成功 |
| 第 20 批 | 2026-07-28 | 10 | 10 | 0 | 0 | EOF CTF Qual 2026(1)、No Hack No CTF 2025(3)、AIS3 Pre-Exam 2025(1)、AIS3 Pre-Exam 2026(1)、QnQSec CTF 2025(2)、NEHS ICED 2024(2)；10 道全部成功 |
| 第 21 批 | 2026-07-29 | 10 | 10 | 0 | 0 | XYCTF 2025(5)、Mini L-CTF 2025(2)、0xGame 2025(1)、R3CTF 2025(1)、HITCON CTF 2025(1)；10 道全部成功，基础镜像均从 docker.m.daocloud.io 拉取后本地 tag |
| 第 22 批 | 2026-08-05 | 10 | 10 | 0 | 0 | MoeCTF 2025(7)、CUHK CTF 2025(2)、ACTF 2026(1)；构建与运行时修复若干 flag 注入/端口/CRLF 问题，已在 `docs/ctf-web-challenges.md` 记录 |
| 第 23 批 | 2026-08-06 | 10 | 10 | 0 | 0 | MoeCTF 2025(10)；10 道题全部构建镜像并导入平台，含 Dockerfile 改造与 NO_SAVE 处理 |
| 第 24 批 | 2026-08-07 | 10 | 10 | 0 | 0 | MoeCTF 2025(7)、ACTF 2026(2)、CUHK CTF 2025(1)；10 道全部成功；修复 `prepare-batch.mjs` 对 `--no-save`/`NO_SAVE=1` 的支持 |
| 第 25 批 | 2026-08-08 | 10 | 10 | 0 | 0 | MoeCTF 2025(9)、ACTF 2026(1)；`12307` 经 apt 换源后构建成功并验证 |
| 第 26 批 | 2026-08-09 | 10 | 10 | 0 | 0 | MoeCTF 2024(10)；基础镜像替换为本地已有标签，`NO_SAVE=1` 保留镜像 |
| 第 27 批 | 2026-08-09 | 10 | 10 | 0 | 0 | MoeCTF 2024 垫刀之路(7)、ImageCloud、smbms，2024 巅峰极客 GoldenHornKing；`NO_SAVE=1` 保留镜像 |
| 第 28 批 | 2026-08-09 | 10 | 10 | 0 | 0 | 2022 西湖论剑(3)、2022 美团CTF(1)、NCTF 2023(2)、2026 NCO Quals(2)、HGAME 2023(2)；`NO_SAVE=1` 保留镜像 |
| 第 29 批 | 2026-08-09 | 10 | 10 | 0 | 0 | 2025 强网杯 初赛(4)、HKCTF 2025 Quals(3)、2026 NCO Final(2)、2024 PandaCupCTF Finals(1)；`NO_SAVE=1` 保留镜像 |
| 第 30 批 | 2026-08-16 | 10 | 10 | 0 | 0 | 2024 网鼎杯 朱雀组 Web1，2025 OpenHarmony CTF Layers of Compromise、Filesystem，2024 CISCN 总决赛 AWDP ezjs、ShareCard、Fobee、SolonMaster，2024 三峡杯 babyjava、textme，2024 浙江师范大学选拔赛 QL again，共 10 道全部成功并验证 |
| 第 31 批 | 2026-08-16 | 10 | 10 | 0 | 0 | HKCERT CTF 2025 Quals `HKCERT ezjs`、`HKCERT Labyrinth`、`HKCERT nettool`，2025 尖峰山杯决赛 `jksn final web2`、`jksn web4-lfi`，2025 尖峰山杯初赛 `jksn login-php`，2025 JSWA `jswa web1`，NewStar CTF 2025 `strange login`，TSCTF-J 2025 `TSCTF-J ez_sql`、`TSCTF-J filesystem`；4 道旧题因标题归一化被覆盖，已恢复为原数据；HKCERT 三道加前缀区分 |
| 第 32 批 | 2026-08-16 | 10 | 5 | 0 | 0 | 5 道已成功部署：`ezdja`、`fuond cms`、`CyberSecurity Knowledge`、`teacher panel`、`WAF bypass`；另外 5 道候选因重复或平台不支持未纳入本批次，用户确认不再补充 |
| 第 33 批 | 2026-08-23 | 10 | 10 | 0 | 0 | SVUCTF HELLOWORLD 2024(7)、CISCN 2024 初赛(1)、CUHK CTF 2025(1)、2025 强网杯初赛(1)；`build.sh` 支持从登记表读取 flag 注入；CUHK `jain-streak-dreamers` 因 opam 编译过久使用原题镜像 + 独立 `Dockerfile.flag-inject` 注入 flag |

**合计**：33 个批次，已部署 342 道，待构建 0 道，跳过 8 道，失败 6 道（部分失败题目为候选，未占用最终名额）。

### 5.4 部署流程（每批次通用）

前置：登记表已通过 `validate-batch-registry.mjs` 预检（5.2 第 4 步）。

1. **准备源码与构建镜像**：
   - 手动流程：源码放入 `docker/ctf-contests/<比赛slug>/<题目slug>/`，构建期注入 flag（`ARG FLAG` + `ENV FLAG` + 写入 `/flag` 等固定位置），执行 `NO_SAVE=1 bash docker/ctf-contests/build.sh <题目id>...`。
   - 自动流程：`node scripts/prepare-batch.mjs <登记表> --no-save`（自动 clone、写 flag.txt、替换占位符、调 build.sh），加 `--import` 直接继续导入。
   - `build.sh` 同时兼容两种目录规范：`<比赛slug>/<题目id>`（目录名即 id）与 `<比赛slug>/<题目slug>`（拼接后等于 id）。`NO_SAVE=1` 的缘由见 5.6。
2. **本地冒烟验证**：每题 `docker run -d --rm -p <主机端口>:<题目端口> localtrain/ctf-<id>:latest`，curl 确认 HTTP 可访问、flag 位于约定路径。
3. **导入平台**：后端启动后运行 `node import-ctf-contests.mjs <登记表>`（`--import` 让 prepare-batch 自动调用）。
   - 登记表 `description` 非空则直接作为题目描述，否则自动生成「比赛来源 + 题目链接 + Writeup」。
   - **判重规则为「归一化标题 + 归一化比赛名」**：同比赛同名视为同一题，默认跳过不导入（status 保持不变，`reason` 记录原因），确认有意更新旧题时加 `--allow-update` 覆盖；**不同比赛同名允许导入，作为新题创建**（日志中标注 `[新建-同名不同比赛]`）。
   - 导入结果回写登记表 `status`；新题自动打附件 zip 上传。
4. **收尾（必做）**：
   - 以 user 身份逐题启动容器，确认可访问、flag 可提交。
   - 更新 `docs/ctf-web-challenges.md` 批次章节、`CHALLENGE-DEPLOYMENT.md` 5.3 表格与第 9 章历史记录。
   - `node scripts/update-deployed-index.mjs` 刷新查重索引（会自动补齐 `.deployed-challenges/`）。
   - 清理 `.tmp/batchN/` 已部署内容（`node scripts/clean-tmp-deployed.mjs --dry-run` 预览后执行），再运行 `node scripts/update-tmp-report.mjs`。
   - writeup 能本地化的保存到 `ctf-writeup/<比赛slug>/<题目slug>.md`，PDF/无法抓取的记录链接。

### 5.5 构建与镜像特殊处理记录

部分题目在单容器化过程中需要特殊处理，已在 `docs/ctf-web-challenges.md` 中逐批记录。常见情况包括：

- 多容器原题改造为单容器（如 `internal_api` 内嵌 Chromium bot）。
- 多语言服务共存（如 `JavaSql` 单容器启动 MariaDB + Java jar + Python Flask）。
- 镜像标签含大写非法字符统一改为小写。
- Rust 版本不兼容导致构建失败（如 `web-01`）。
- 基础镜像通过镜像源拉取后重新 tag。

新增批次时，须优先在 `docs/ctf-web-challenges.md` 中记录类似构建备注，便于后续复现。

### 5.6 关于 `NO_SAVE=1` 的使用说明

自第 23 批起，部分批次使用 `NO_SAVE=1 bash docker/ctf-contests/build.sh <slug>` 构建镜像，仅保留本地 Docker 镜像标签，不导出 `docker-images/*.tar` 归档。

**原因**：当前 Docker Desktop 启用 **containerd snapshotter** 后，`docker save` 会导出不完整的 tar 归档（缺少部分 layer blob），平台后续通过 `docker load` 加载该 tar 后无法创建容器。这是 Docker Desktop 的已知问题，不是项目代码缺陷。

**为什么可以这样做**：

- 项目早期导出 tar 主要是为了**磁盘空间不足时删除本地镜像、用 tar 兜底恢复**；
- 当前环境磁盘空间充足，本地镜像无需删除；
- 平台启动环境时优先使用本地镜像，只有本地不存在时才尝试加载 `docker-images/` 中的 tar；
- 因此只要保留本地镜像标签，不导出 tar 并不影响平台正常使用。

**使用建议**：

- 在 containerd snapshotter 关闭前，新批次可继续使用 `NO_SAVE=1`；
- 若关闭 containerd snapshotter 或 Docker Desktop 修复该 bug，应恢复默认导出 tar 的行为；
- 个别题目修复后重新构建时，如未加 `NO_SAVE=1`，会正常导出 tar 作为备份（如第 24 批 `AAA'26`）。

---

## 6. 通用部署流程

### 6.1 新增一道题

1. 在 `docker/ctf-contests/<比赛slug>/<题目slug>/` 放置源码与 Dockerfile（或修改现有 CVE Dockerfile）。
2. 构建镜像：`bash docker/ctf-contests/build.sh <题目slug>`（CVE 题按各自脚本构建）。
3. 导出 tar：`docker save -o docker-images/<image_name>.tar <image_name>:latest`（`build.sh` 已自动完成）。
   - 若 Docker Desktop 启用 containerd snapshotter 后 `docker save` 生成不完整的 OCI tar，导致平台加载后无法创建容器，可临时使用 `NO_SAVE=1 bash docker/ctf-contests/build.sh <slug>` 仅保留本地镜像标签（`build.sh` 已支持该开关）。详见 [5.6 关于 `NO_SAVE=1` 的使用说明](#56-关于-no_save1-的使用说明)。
4. 在对应登记表添加条目，确认 `status` 为 `pending`。
5. 导入平台：`node import-ctf-contests.mjs docs/ctf-web-registry-batchX.json`（或 CVE 对应脚本）。
6. 验证后更新 `docs/ctf-web-challenges.md` 或 `docs/cve-deploy-report.md`。

### 6.2 清理与维护

- `.tmp/` 目录用于临时存放下载的题目源码与构建中间产物。已部署题目的附件可以清理，未部署题目保留。
- 使用 `node scripts/clean-tmp-deployed.mjs --dry-run` 可预览清理结果，去掉 `--dry-run` 后执行删除。该脚本会自动读取 `docs/ctf-web-registry*.json` 中所有 `status: deployed` 的题目，匹配 `.tmp/` 下顶层已部署的源码压缩包或完整 repo 目录，删除已部署的归档；对多 challenge 的 repo 目录，仅当全部 registry 条目都已部署时才删除整个目录。
- 受保护的工作目录（如 `batch*`、`downloads`、`extract`、`inspect`、`scout` 等）以及日志、脚本、文档类扩展名默认不会被删除，避免误清理候选题目。
- **每批次部署完成后，须删除 `.tmp/` 下该批题目产生的临时附件/源码归档**，避免重复占用磁盘。可结合 `clean-tmp-deployed.mjs` 清理已部署条目，再手动检查并删除未命中但已无需保留的压缩包或目录。
- Docker 镜像清理：删除已部署的重复挑战镜像标签以释放空间；保留基础镜像。
- 镜像存储位置：已通过 Docker Desktop 迁移到 `F:/Docker`，避免 C 盘空间不足。

### 6.3 手动在网站上部署单道 Web 题目

下面以在 `docker/ctf-contests/myctf-2025/hello/` 中准备的一道 Web 题为例，说明从源码目录到在网站上成功部署的完整手动流程。静态题（Crypto / Reverse / Misc 等不需要运行服务的题目）只需跳过镜像相关步骤，将「镜像名」留空即可。

#### 1. 准备源码目录

目录结构示例：

```
docker/ctf-contests/
└── myctf-2025/
    └── hello/
        ├── Dockerfile
        ├── src/
        │   └── index.php
        └── ...
```

- `Dockerfile` 必须保证容器启动后服务监听固定端口（如 80）。
- flag 直接写入容器内固定位置，例如 `/flag`。平台不会向容器注入 `FLAG` 环境变量，flag 由用户在网站上提交后由后端校验。
- 示例 `Dockerfile`：

```dockerfile
FROM php:7.4-apache
COPY src/ /var/www/html/
RUN echo 'flag{hello_myctf_2025_abc123}' > /flag
EXPOSE 80
CMD ["apache2-foreground"]
```

#### 2. 本地构建镜像

```bash
cd docker/ctf-contests/myctf-2025/hello
docker build -t localtrain/ctf-hello:latest .
```

镜像命名规范：`localtrain/ctf-<题目id>:latest`。题目 id 只包含小写字母、数字、连字符、下划线，后续将用于归档文件名和数据库中的 `image` 字段。

#### 3. 本地冒烟测试

```bash
docker run -d --rm --name hello-test -p 8080:80 localtrain/ctf-hello:latest
```

访问 `http://localhost:8080` 验证服务可访问，并按题目预期解法确认能读取到 `/flag` 的内容。

测试完成后停止：

```bash
docker stop hello-test
```

#### 4. 导出镜像归档

平台启动环境时，如果本地 Docker 中不存在该镜像，会自动从 `docker-images/` 加载同名 `.tar`。因此推荐导出：

```bash
# 在项目根目录执行
docker save -o docker-images/localtrain_ctf-hello_latest.tar localtrain/ctf-hello:latest
```

归档文件名规范：`localtrain_ctf-<题目id>_latest.tar`。

#### 5. 启动 LocalTrain 平台

```bash
npm run dev
```

- 前端：http://127.0.0.1:8080
- 后端：http://localhost:3008

#### 6. 在管理后台创建题目

1. 打开 http://127.0.0.1:8080，使用默认管理员账号登录：`admin` / `admin`。
2. 点击顶部导航「切换为管理员」进入 `/admin` 管理后台。
3. 点击「新建题目」或使用「出题模板」（Web）快速填充，然后修改以下字段：
   - **标题**：`Hello`
   - **分类**：`web`
   - **难度**：`easy` / `medium` / `hard` / `expert`
   - **比赛来源**：`myctf-2025`（仅作展示标签）
   - **镜像名**：`localtrain/ctf-hello:latest`
   - **端口**：`80`（容器内部监听端口，必须与 `Dockerfile` 中 `EXPOSE` 一致）
   - **可见性**：勾选后普通用户可见
   - **flag**：`flag{hello_myctf_2025_abc123}`（多 flag 题目可填写多个）
   - **描述**：题目说明、来源、writeup 链接等
   - **附件**：上传源码 zip 或选手需要下载的附件
4. 保存题目。

> 提示：如果已存在同标题题目，手动创建会新增一条记录；批量导入时建议使用 `import-ctf-contests.mjs`，它会按标题去重并更新已有题目。

#### 7. 验证网站部署

1. 切换到普通用户角色（点击顶部「切换为用户」，或登录 `user` / `user`）。
2. 在题目列表找到新题目，进入详情页。
3. 点击「启动环境」，等待系统从 `30000–39999` 分配一个宿主机端口。
4. 页面会显示 `http://localhost:<hostPort>`，浏览器访问该地址验证服务。
5. 在 flag 输入框提交 `flag{hello_myctf_2025_abc123}`，确认提示「flag 正确」。

如果启动环境时提示「本地不存在镜像」，请检查：
- 镜像名与 `Dockerfile` 构建的 tag 是否一致；
- `docker-images/localtrain_ctf-hello_latest.tar` 是否存在且命名正确；
- 本地 Docker 中是否已加载该镜像（可执行 `docker images | grep ctf-hello`）。

#### 8. 批量部署的替代方式（可选）

对于同一比赛的多道题目，建议先编写 `docs/ctf-web-registry-batchX.json` 登记表，然后使用：

```bash
node import-ctf-contests.mjs docs/ctf-web-registry-batchX.json
```

该脚本会自动登录 admin、创建/更新题目、打包并上传附件。登记格式和注意事项参考现有 `docs/ctf-web-registry.json` 和 `docs/ctf-web-challenges.md`。

> 登记表示例字段（常用）：
> - `id` / `title` / `contest` / `category` / `difficulty` / `port` / `image` / `flag` / `source` / `writeup` / `dir` / `status`
> - `description`（可选）：非空时直接作为题目描述导入；留空时脚本会自动生成「比赛来源 + 题目来源 + Writeup」的默认描述。

---

## 7. 安全与注意事项

- **本项目仅供本地学习，请勿部署到公网。**
- 本地 Docker 默认账号、JWT 硬编码、无防爆破、无 CSRF 等设计均不适合公网。
- 容器可直接访问本地 Docker socket，任何代码注入都可能影响宿主机。
- 新增题目来源需确认许可证与使用范围，避免版权问题。
- 所有 flag 均为本地静态值，不同用户共用同一 flag，仅为本地练习用途。

---

## 8. 当前状态总览

| 类型 | 已部署 | 待构建 | 跳过 | 失败 | 总计 |
|------|--------|--------|------|------|------|
| CVE 题目 | 45 | 0 | 5 | 0 | 50 |
| CTF 比赛 Web 题目 | 332 | 0 | 8 | 6 | 346（含重复/更新条目） |

> 已部署题目镜像 tar 归档均保存在 `docker-images/` 目录，未部署题目的源码保留在 `.tmp/` 或 `docker/ctf-contests/` 中。

---

## 9. 历史变更记录

- 2026-07-17：CVE 批量部署启动，45 道 deployed，5 道 skipped；Docker 镜像清理释放约 20 GB。
- 2026-07-18：CTF 第 1-3 批部署完成；移除 15MB 单附件上限。
- 2026-07-19：CTF 第 4 批部署完成；附件大小限制正式移除，旧因大小跳过的题目重新评估。
- 2026-07-20：CTF 第 5-6 批部署完成；7 道旧因大小跳过题目重新部署。
- 2026-07-21：CTF 第 7-10 批部署完成；Docker 数据迁移到 `F:/Docker`；创建本文档。
- 2026-07-22：CTF 第 13 批部署完成（NewStar 2025 剩余 7 题 + energyCTF2025 + SDNISC，10 道）。
- 2026-07-22：CTF 第 14 批部署完成（NCO 2026、尖峰山杯、2024 蓝桥杯、2023 沈阳车联网、2025 CISCN 总决赛，10 道；其中 2 道为标题冲突更新）。
- 2026-07-22：CTF 第 15 批部署完成（NCO 2026 入围测试、尖峰山杯初赛、2024 三峡杯、2025 能源、2025 CISCN 总决赛、本地未归档源码，10 道全部成功）。
- 2026-07-25：CTF 第 16 批部署完成（尖峰山杯初赛、2026 CCSSSC 半决赛、2023 强网杯、2024 强网杯半决赛、2023 全国大学生信息安全竞赛、2025 CISCN 总决赛，10 道全部成功）。
- 2026-07-26：使用 `scripts/clean-tmp-deployed.mjs` 清理 `.tmp/` 下已部署题目的源码归档，共删除 66 个顶层文件/目录；更新脚本以覆盖全部批次登记表并移除容易误删的标题子串匹配。
- 2026-07-26：管理后台功能更新：题目表格支持横向滚动、难度排序、1 秒延迟 tooltip；用户列表支持搜索和查看解题记录；容器管理按用户分组；删除题目时级联清理解题记录并停止相关容器。
- 2026-07-26：CTF 第 17 批部署完成（HGAME 2023、2025 尖峰山杯决赛、AWDP 训练、Socialgroup CTF 2022、2023 福建省大学生网络安全竞赛，10 道全部成功；9 道自写 Dockerfile）。
- 2026-07-27：CTF 第 18 批部署完成（SDNISC 2025 海选、2026 NCO Final、AWDP 训练、NewStar CTF 2024、HGAME 2023、2024 西湖论剑、2024 强网杯半决赛、2025 鹏城杯初赛，10 道全部成功；不限难度配比，补齐未完整部署比赛；`office` 大附件上传触发超时后已把后端 server timeout 延长至 10 分钟）。
- 2026-07-26：新增积分机制：Submission 增加 `score` 字段，简单/中等/困难/专家题分别首次完整解出获得 100/200/300/400 分；重置后重复解出不重复计分；个人主页和管理后台用户解题记录均展示总积分。
- 2026-07-29：CTF 第 22 批筛选完成（MoeCTF 2025 7 道、CUHK CTF 2025 2 道、ACTF 2026 1 道），10 道题已登记待构建，尚未进行 Dockerfile 改造与镜像构建。
- 2026-08-05：CTF 第 22 批部署完成（10 道全部成功）。本次修复：MoeCTF 系列 entrypoint 默认值覆盖问题、藏经禁制 Apache 默认首页覆盖、灵蛛探穴 start.sh CRLF、CUHK cookies 监听端口不一致、CUHK classic-sql 入口脚本缺失 secret key 与数据库初始化。Docker Desktop containerd 存储下 `docker save` 导出的 tar 不完整，本次以 `NO_SAVE=1` 保留本地镜像标签方式部署；`docker/ctf-contests/build.sh` 已支持 `NO_SAVE=1` 开关。
- 2026-08-05：更新 CTF 选题流程（5.2 节），明确要求比赛确定后**先下载源码到本地**再分析，禁止仅凭网页搜索或仓库目录树判断题目可用性。
- 2026-08-06：CTF 第 23 批筛选完成（MoeCTF 2025 10 道），登记于 `docs/ctf-web-registry-batch23.json`，10 道题已登记并构建部署；因本地其他仓库缺少完整 Web 源码，本批全部沿用 MoeCTF 2025 剩余章节。
- 2026-08-06：CTF 第 23 批部署完成（10 道全部成功）。统一改造 Dockerfile/entrypoint 为构建期注入 flag；第四章 `app.py` 按平台 flag base64 替换 7 段碎片；第二十章关闭 Flask `debug=True`；第二十章/第二十一章基础镜像因 Docker Hub 不可达改为 `python:3.11-slim`；第四章 `docker save` 导出不完整，使用 `NO_SAVE=1` 保留本地镜像标签。
- 2026-08-06：CTF 第 24 批筛选完成（MoeCTF 2025 7 道、ACTF 2026 2 道、CUHK CTF 2025 1 道），登记于 `docs/ctf-web-registry-batch24.json`，10 道题已登记待构建，尚未导入平台。
- 2026-08-06：管理后台与前端 UI 调整：题目编辑页增加已有附件管理（重命名、删除、控制普通用户可见性），附件可见性开关改为保存题目时批量提交；排行榜时间轴改为从今天起往前推 6 天（共 7 天）并增加刷新按钮；容器管理列表不再显示镜像大小；题目详情环境运行信息不再显示容器 ID。
- 2026-08-06：Attachment 模型增加 `visibleToUser` 字段，控制普通用户是否可在题目详情看到并下载对应附件，管理员始终可见；同步修复排行榜日期在本地时区下因 UTC 转换导致"今天"偏移一天的问题。
- 2026-08-07：CTF 第 24 批部署完成（MoeCTF 2025 7 道、ACTF 2026 2 道、CUHK CTF 2025 1 道，10 道全部成功）。MoeCTF 统一改为 Dockerfile 构建期注入 `ENV FLAG`；ACTF `AAA'26` 移除 `COPY --chmod` 以兼容 legacy builder；ACTF `GoMySQL` 增加 `GOPROXY=https://goproxy.cn,direct` 解决 go mod 下载失败；CUHK Next.js 题目在 Dockerfile 写入 FLAG/USERNAME/PASSWORD 环境变量。本批次使用 `NO_SAVE=1` 仅保留本地镜像标签，同步修复 `scripts/prepare-batch.mjs` 对 `--no-save`/`NO_SAVE=1` 的支持。
- 2026-08-08：CTF 第 25 批部署完成（MoeCTF 2025 9 道、ACTF 2026 1 道，10 道全部成功并验证）。MoeCTF 题目修复基础镜像替换、Dockerfile 构建期注入 flag、entrypoint/start.sh CRLF 换行导致容器启动失败等问题；CUHK `Jain Streak Dreamers` 为 OCaml Dream 应用，`opam install` 需下载并编译 135 个依赖，尝试默认源、Clash 代理、`OPAMFETCH` 自定义下载命令、清华 opam 镜像均失败或超时，已标记为 `failed` 且不占用本批次名额；中间曾误将第 22 批已部署的 CUHK `I want more cookies!` 作为第 10 题重复导入，已删除重复题目并恢复第 22 批原题；ACTF 2026 `12307` 因 Debian apt 源速度过慢（约 20 kB/s）首次构建中止，已将 Dockerfile 内源换为 `mirrors.tuna.tsinghua.edu.cn` 后重新构建成功，并验证环境可启动、flag 可提交。
- 2026-08-09：CTF 第 26 批部署完成（MoeCTF 2024 10 道，10 道全部成功并验证）。统一将 Dockerfile 基础镜像替换为本地已有镜像，运行时 `$FLAG` 改为构建期 `ENV FLAG=...` 或 `RUN echo "$FLAG" > /flag` 写入；`web入门指北` 无原 Dockerfile，额外补充 `php:8.2-apache` 单容器服务；`弗拉格之地的挑战` 最终 flag 保持原题值并同时写入 `/flag`。本批次使用 `NO_SAVE=1` 仅保留本地镜像标签，未导出 tar。
- 2026-08-09：CTF 第 27 批部署完成（MoeCTF 2024 垫刀之路 7 题 + ImageCloud + smbms，2024 巅峰极客 GoldenHornKing，10 道全部成功并验证）。`垫刀之路01-06` 替换为本地 `ctftraining/base_image_nginx_mysql_php_73`；`垫刀之路07` 与 `ImageCloud` 替换为 `python:3.11-slim`；`smbms` 替换为 `ubuntu:20.04`；运行时 `$FLAG` 统一改为构建期注入。`GoldenHornKing` 无原 Dockerfile，补充 FastAPI + uvicorn 镜像。本批次使用 `NO_SAVE=1` 仅保留本地镜像标签。
- 2026-08-09：CTF 第 28 批部署完成（2022 西湖论剑 easy-api、node_magical_login、real_ez_node，2022 美团CTF easypickle，NCTF 2023 waitwhat、webshellgen，2026 NCO Quals 个性签名生成器、超级无敌保险箱，HGAME 2023 guess_who_i_am、shared_diary，共 10 道全部成功并验证）。`easy-api` 因 Jetty 基础镜像非 root 用户无法写入 `/flag`，在 Dockerfile 追加 `USER root` 后重新构建成功；`webshellgen` 因 Debian buster apt 源 404 改为 `archive.debian.org` 并关闭 `Acquire::Check-Valid-Until=false` 后重新构建成功；其余 8 题首次构建均成功。本批次统一将运行时 `$FLAG` 改为构建期 `ENV FLAG=...` / `RUN echo "$FLAG" > /flag` 静态写入，使用 `NO_SAVE=1` 仅保留本地镜像标签。
- 2026-08-09：CTF 第 29 批部署完成（2025 强网杯 初赛 bbjv、SecretVault、CeleRace、go2php，HKCTF 2025 Quals Labyrinth、ezjs、nettool，2026 NCO Final Pino、What CAN I Say，2024 PandaCupCTF Finals gateway，共 10 道全部成功并验证）。`CeleRace` 与 `go2php` 将 Debian 12 apt 源路径改为 `/etc/apt/sources.list.d/debian.sources`，并移除 Dockerfile 中重复创建 `redis` 用户的命令；`gateway` 使用 `#` 分隔符替换 URL 避免与目标 URL 斜杠冲突；`bbjv` 修复 `start.sh` 的 `read` 参数以非交互模式运行。其余 6 题首次构建均成功。本批次使用 `NO_SAVE=1` 仅保留本地镜像标签，未导出 tar。实际难度配比为 2 easy / 8 medium。
- 2026-08-16：CTF 第 30 批部署完成（2024 网鼎杯 朱雀组 Web1，2025 OpenHarmony CTF Layers of Compromise、Filesystem，2024 CISCN 总决赛 AWDP ezjs、ShareCard、Fobee、SolonMaster，2024 三峡杯 babyjava、textme，2024 浙江师范大学选拔赛 QL again，共 10 道全部成功并验证）。本批次统一使用本地已有基础镜像，并将运行时 `$FLAG` 改为构建期静态注入；`Layers of Compromise` 额外复制 `config.php` 与 `secrettttts/token.txt` 到 Web 根目录避免路径引用失败；`Filesystem` 直接运行已编译的 `dist/src/main.js`；`Fobee` 与 `SolonMaster` 使用土耳其 locale 并强制监听 8888；`textme` 通过 entrypoint 写入 flag；`QL again` 强制监听 8089。本批次使用 `NO_SAVE=1` 仅保留本地镜像标签，未导出 tar。实际难度配比为 0 easy / 8 medium / 2 hard。
- 2026-08-16：CTF 第 31 批部署完成。因 GitHub 下载受阻（直连超时、代理 reset、API rate limit 耗尽），本批次从 `docker-images/` 历史归档与本地 Docker 镜像中筛选 10 道未部署 Web 题补入：HKCERT CTF 2025 Quals `HKCERT ezjs`、`HKCERT Labyrinth`、`HKCERT nettool`，2025 尖峰山杯决赛 `jksn final web2`、`jksn web4-lfi`，2025 尖峰山杯初赛 `jksn login-php`，2025 JSWA `jswa web1`，NewStar CTF 2025 `strange login`，TSCTF-J 2025 `TSCTF-J ez_sql`、`TSCTF-J filesystem`。10 道题全部导入并验证 HTTP 可访问。导入过程中曾因标题归一化与已有题目冲突，导致 4 道旧题被覆盖，已恢复为原数据；HKCERT 三道题与已部署的 HKCTF 2025 Quals 同名题为不同镜像构建，标题加 `HKCERT` 前缀区分。
- 2026-08-16：CTF 第 32 批部署完成（5 道已部署：`ezdja`、`fuond cms`、`CyberSecurity Knowledge`、`teacher panel`、`WAF bypass`）。初筛 10 道候选中，另外 5 道因重复或平台不适合未纳入本批次；`week2 web1` 与 `QL again` 曾因标题归一化错误覆盖 batch6/batch30 原题，已恢复为原数据。`docker/ctf-contests/qwbS6qsn-2023` 已重命名为 `qwbs6qsn-2023` 以符合镜像名小写要求；本批次使用 `NO_SAVE=1` 仅保留本地镜像标签。用户确认第 32 批不再补充，按 5 道题定稿。
- 2026-08-16：题目筛选/部署流程工具化整改（针对第 32 批重复部署与覆盖事故）。新增 `scripts/update-deployed-index.mjs`（一键重建查重索引：`.tmp/deployed-*.txt` + `.deployed-challenges/` 同步）、`scripts/validate-batch-registry.mjs`（登记表预检硬性门禁：字段/命名/批内外 id 与归一化标题冲突/源码目录检查，支持 `--api` 平台侧比对）、`scripts/scan-web-candidates.mjs`（候选目录一次扫描输出 web/pwn/misc 分类与 dup 查重结论）；`import-ctf-contests.mjs` 判重改为「归一化标题 + 归一化比赛名」：同比赛同名默认跳过、`--allow-update` 才覆盖；不同比赛同名允许导入并创建新题；`docker/ctf-contests/build.sh` 恢复兼容「目录名即 id」旧规范并保留拼接 slug 新规范。5.2/5.4 已重写为脚本门禁流程。
- 2026-08-23：CTF 第 33 批部署完成（SVUCTF HELLOWORLD 2024 7 道、CISCN 2024 初赛 1 道、CUHK CTF 2025 1 道、2025 强网杯初赛 1 道，10 道全部成功并验证 flag 可提交）。本次统一改为构建期 `ARG FLAG` + `RUN echo "$FLAG" > /flag` 注入；`docker/ctf-contests/build.sh` 增加 `REGISTRY_FILE` 支持，自动从登记表读取 flag 并作为 `--build-arg` 注入。Windows 下 3000/3001 等端口被系统保留，后端临时改用 `127.0.0.1:2800`。CUHK `jain streak dreamers` 为 OCaml Dream 应用，opam 依赖 135 个包编译耗时极长且无可用的国内 opam 镜像，因此保留原题 Dockerfile，额外编写 `Dockerfile.flag-inject` 基于已完整构建的原题镜像仅注入 flag 文件，产物仍标记为 `localtrain/ctf-cuhk-ctf-2025-jain-streak-dreamers:latest`。本批次使用 `NO_SAVE=1` 仅保留本地镜像标签。

---

> 维护者：LocalTrain 项目
> 最后更新：2026-08-23
