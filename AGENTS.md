# LocalTrain 项目指南（AI 助手版）

> 本文件面向接管本项目的 AI 编码助手（ZCode）。改代码或部署题目前先通读本文。
> 日常遇到的两类任务：**① 平台功能开发/修 bug**（packages/ 下的代码），**② 批量筛选部署 CTF 题目**（脚本门禁流程，见「CTF 批量部署 Runbook」）。
> 更详尽的功能说明、API 列表见 `README.md`；部署需求全貌见 `CHALLENGE-DEPLOYMENT.md`。

## 项目概述

LocalTrain 是一个**仅供本地使用**的 CTF / CVE 复现靶场网站：题目管理、Docker 容器环境启停、flag 提交、提示解锁、积分排行。

- 本项目默认账号、JWT 密钥均为硬编码本地配置，**请勿部署到公网**，安全加固不改变这一前提。
- 平台当前存量：CVE 题 45 道（另有 5 道 skipped），CTF 比赛 Web 题 60 个批次（截至 2026-09-24 第 60 批完成，**下一批次从 batch61 开始**；52-60 批新增 65 道，2022 年后国内主要 CTF 官方公开仓库 Web 题源码已系统性挖尽，后续以已挖掘仓库重挖补漏为主）。精确数字以 `docs/ctf-web-challenges.md` 和登记表统计为准。

## ⚠️ 必读：环境关键事实（踩坑记录）

这些是本机（Windows 11 + Git Bash + Docker Desktop）的实际状况，与部分文档的陈旧描述不一致时，**以本节为准**：

1. **版本控制（2026-09-09 起）**：仓库 `https://github.com/zrc2682/localtrain.git`（私有，main 分支）。**只跟踪靶场本体**（packages/、scripts/、docs/、根目录工具与文档，约 107 个文件）；题目 docker 环境（`docker/`）、writeup、`docker-images/` tar、`dev.db`、`uploads/`、`.tmp` 均被 .gitignore 排除、仅存本机——**换新机器克隆仓库拿不到题目环境**。`.gitattributes` 固定 `* -text` 禁止换行符转换（防题目脚本被转成 CRLF 后容器起不来）。push 走 Clash 代理：`git -c http.proxy=http://127.0.0.1:7890 push`。**`dev.db` 与 `uploads/` 不在 git 内，用 `node scripts/backup-live-data.mjs` 备份到 `backups/`（同样被 gitignore）**，删除/损坏不可恢复，操作前先确认目标、必要时先备份。
2. **端口约定（2026-09-09 已全项目统一为 3008）**：
   - 本机 Windows 会保留 3000/3001 等端口（`netsh interface ipv4 show excludedportrange` 可查），因此 `packages/server/.env` 的 `PORT`、`start.cmd`/`start.sh`、所有导入/验证脚本（`import-ctf-contests.mjs`、`verify-batch*.mjs`、`scripts/*.mjs`）的 `API_BASE` 默认值、`test-api.sh` 均为 **3008**。
   - 前端 Vite 固定 `127.0.0.1:8080`，代理 `/api` → `http://localhost:3008`。
   - 脚本仍支持 `API_BASE=...` 环境变量临时覆盖；历史文档（deploy-report、ctf-web-challenges、CHALLENGE-DEPLOYMENT 第 9 章）里的 3000/2800 是当时实况，无需回改。
3. **GitHub 访问**：直连经常超时，用 Clash 代理 `http://127.0.0.1:7890`（git 全局代理通常已配置；详见用户技能 github-access）。
4. **Docker Hub 直连不可用**：基础镜像从 `docker.m.daocloud.io`、`docker.1ms.run`、`hub.rat.dev` 等镜像源拉取后 `docker tag` 回原名；`ghcr.io` 可直连。Docker 数据目录已迁移到 `F:/Docker`。
5. **Docker Desktop 启用 containerd snapshotter 导致三个怪癖**（详见 CHALLENGE-DEPLOYMENT.md 5.6）：
   - `docker save` 导出的 tar 缺 layer blob，加载后无法建容器 → 构建统一加 `NO_SAVE=1`，只保留本地镜像标签，不导出 tar。
   - buildkit 偶发无法读取本地基础镜像 blob → `build.sh` 内部固定 `DOCKER_BUILDKIT=0` 用 legacy builder，不要改动。
   - 个别镜像因 blob 被回收留下「有记录无数据」的陈旧内容条目：本地容器照常能跑，但 `docker push`/`docker save` 报 content digest not found，且从源码重建无效（相同内容被去重）→ 唯一修法是 `docker export` + `docker import` 扁平化重建（2026-09 batch22/23/25 的 5 个 moectf 题实例）。
6. **构建慢/失败的惯用解法**：Debian apt 换 `mirrors.tuna.tsinghua.edu.cn`；buster 老源 404 换 `archive.debian.org` 并关 `Check-Valid-Until`；Go 加 `GOPROXY=https://goproxy.cn,direct`；容器内 shell 脚本注意 CRLF 换行问题（Windows 下 clone 的仓库常见，需转 LF）。
7. 根目录的 `Web2.php`、`web3.php`、`cookies.txt` 及 `.tmp/` 里的 `*.class` 是解题遗留物，不是项目文件；根目录 `uploads/` 是空的历史残留，真实附件目录在 `packages/server/uploads/`。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3 + Vite 6 + TypeScript 5 + Pinia + Vue Router 4 + Element Plus |
| 后端 | Node.js 18+ + Express 4 + TypeScript 5（dev 用 tsx watch，无需编译） |
| 数据库 | SQLite + Prisma ORM 6 |
| 认证 | JWT（Bearer Token，7 天有效） |
| 容器交互 | dockerode（本地 Docker socket） |
| 包管理 | npm workspaces（`packages/server` + `packages/web`） |

## 项目结构

```
localtrain/
├── package.json              # 根工作区配置
├── start.cmd / start.sh      # 一键启动（设置 PORT=3008）
├── test-api.sh               # curl 端到端 API 测试（硬编码 3008）
├── CHALLENGE-DEPLOYMENT.md   # 题目部署需求文档（CVE + CTF，选题/构建/导入全流程）
├── import-ctf-contests.mjs   # 按登记表批量导入题目到平台（admin API；--retry 重试 failed；自带泄题门禁）
├── deploy-images.mjs         # 从平台附件自动构建并部署镜像（早期流程）
├── update-flags.mjs          # 从 writeup 批量更新题目 flag
├── docker/                   # 题目源码与 Dockerfile（永久存放地）
│   ├── cve-challenges/       # CVE 题目
│   ├── ctf-contests/         # 比赛题目，按 <比赛slug>/<题目slug>/，含 build.sh
│   ├── example-web/          # 示例镜像
│   └── show-me-your-pass/
├── docker-images/            # 镜像 tar 归档（280+ 个；NO_SAVE=1 期间不新增）
├── docs/
│   ├── cve-registry.json     # CVE 50 题登记表
│   ├── ctf-web-registry.json # CTF Web 第 1 批主登记表
│   ├── ctf-web-registry-batch*.json  # 第 2 批起每批一个登记表（当前至 batch33）
│   ├── ctf-web-challenges.md # 比赛题目部署记录（每批明细，必读必更）
│   └── cve-deploy-report.md
├── .deployed-challenges/     # 已部署比赛题目空文件夹索引（脚本维护，勿手改）
├── cve-writeup/  ctf-writeup/  # writeup；ctf-writeup 一赛一文件：<比赛slug>/<比赛slug>.md（README.md 是覆盖索引）
├── scripts/                  # 部署辅助脚本（见 Runbook）
├── .tmp/                     # 临时下载/中间产物（gitignore，见「.tmp 管理」）
└── packages/
    ├── server/               # Express 后端
    │   ├── prisma/           # schema.prisma、seed.ts、dev.db（活数据！）
    │   ├── src/
    │   │   ├── index.ts      # 入口（HOST=127.0.0.1，server.timeout=10min）
    │   │   ├── middleware/auth.ts
    │   │   ├── prisma/client.ts
    │   │   ├── routes/       # auth.ts / challenges.ts / users.ts
    │   │   └── services/docker.ts
    │   ├── uploads/          # 题目附件（活数据！800+ 文件）
    │   └── .env              # DATABASE_URL、JWT_SECRET、PORT=3000（会被启动脚本覆盖）
    └── web/                  # Vue 3 前端（views/ 下 8 个页面）
```

## 常用命令（项目根目录执行）

```bash
npm install                        # 安装工作区依赖
npm run db:push                    # 按 schema.prisma 同步数据库结构
npm run db:seed                    # 写入默认账号（admin/admin、user/user）和示例题

bash start.sh                      # 标准启动：PORT=3008 同时起前后端
PORT=3008 npm run dev              # 等价写法（前端 8080 / 后端 3008）
npm run dev:server / dev:web       # 单独启动

bash test-api.sh                   # 后端启动后跑 curl 端到端回归（登录/建题/提示/启停/提交/重置；退出自动清理测试题）
npm run build                      # 前端构建到 packages/web/dist（含 vue-tsc 类型检查）
npm run build -w packages/server   # 后端 tsc 编译到 dist

node scripts/backup-live-data.mjs  # 备份活数据：dev.db（VACUUM INTO 快照）+ uploads/ → backups/<时间戳>/，默认保留最近 10 份（--keep N 调整）

# 重置数据库（会清空所有题目/做题记录，谨慎）
rm packages/server/prisma/dev.db && npm run db:push && npm run db:seed
```

## 代码组织与开发约定

### 后端（NodeNext ESM）

- `module: "NodeNext"` + `"type": "module"`：**相对导入必须带 `.js` 扩展名**（如 `import './routes/auth.js'`），即使源文件是 `.ts`。
- 路由处理统一 `async/await` + `try/catch` 返回 JSON 错误；入参用 zod 校验。
- 单引号字符串、2 空格缩进、行尾分号；变量 camelCase、类型 PascalCase。无 ESLint/Prettier，保持现有风格。

### 路由要点（`packages/server/src/routes/`）

- `auth.ts`：注册/登录/me/switch-role（本地调试便利，一键 admin↔user）。
- `challenges.ts`：题目 CRUD、提示、附件（上传/重命名/删除/可见性）、容器启停/延长、flag 提交、重置、批量可见/删除。
- `users.ts`：用户列表（admin，含总积分）、个人主页、`GET /users/:id/submissions`（admin 查指定用户解题记录）、leaderboard。
- 完整 API 表见 `README.md`。

### 前端

- `tsconfig` 用 `moduleResolution: "bundler"`，可直接导入 `.ts`/`.vue`；组件用 `<script setup lang="ts">`。
- `api/client.ts`：Axios 封装，自动附加 Bearer Token，401 跳登录。
- 主要页面：UserDashboard（题目列表筛选）、ChallengeDetail（详情/环境/flag）、AdminDashboard（外壳 + `components/admin/` 5 个子组件：UsersTab / ChallengesTab / ContainersTab / ChallengeEditDialog / ChallengeHintsDialog）、LeaderboardView、ProfileView、UserContainers。
- 列表接口 `GET /challenges` 只返回摘要字段与计数（flagCount/hintCount/attachmentCount/solved），hints/flags/attachments 明细走详情接口 `GET /challenges/:id`；编辑弹窗打开时自行拉详情。

### 数据库业务规则（Prisma，`packages/server/prisma/schema.prisma`）

- Challenge 可含多个 Flag（0-based `index`）；`visible` 控制普通用户可见性（admin 不受限）；`contest` 仅展示标签；`note` 为**管理员私有备注**，接口对非 admin 一律不下发（面向用户的运维提示应写进 description）。
- Submission 按 `(userId, challengeId)` 唯一：记录已解出 flag 下标数组、累计 `solveCount`、`solvedAt`、首次完整解出的 `score`。
- **计分**：easy/medium/hard/expert = 100/200/300/400 分，仅首次完整解出记一次（`SCORE_MAP` 在 `challenges.ts` 顶部）；首次解出时按该题已解锁提示的 `scorePenalty` 总和扣减（下限 0）；重置后重新解出 `solveCount +1` 但不再加分。
- 「重置题目」清空当前进度、不清历史。
- 删除 Challenge 级联删除 Submission 并**停止所有运行中的对应容器**（防容器游离）。
- Container 按 `(userId, challengeId)` 唯一；端口 30000–39999 自动分配；TTL 2 小时可延长 1 小时；每用户最多 5 个并发容器。
- Attachment.visibleToUser 控制普通用户可见性，admin 始终可见。
- 改 schema 后记得 `npm run db:push`。

### Docker 服务（`services/docker.ts`）

- 启动环境时本地无镜像 → 自动从 `docker-images/<镜像名替换非法字符为_>.tar` 加载。
- 容器 Labels：`localtrain.project=localtrain`、`localtrain.user=<userId>`、`localtrain.challenge=<challengeId>`（清理游离容器时按此识别）。
- 服务重启会 `restoreTimers()` 重建未过期容器的清理定时器，并**立即清理已过期的残留记录**（防停机期间容器游离）；`startChallenge` 复用旧容器前校验未过期。
- 平台**不会**向容器注入 FLAG 环境变量——flag 必须在构建期写死进镜像（见 Runbook）。

## CTF 批量部署 Runbook（核心运维任务）

目标：每批 10 道国内 CTF（2022 年后）官方仓库的 **Web** 题，单容器可部署，中等/简单为主。排除：boot2root、多容器编排、依赖外部服务、非 HTTP 协议、需 SSH 进容器交互解题、纯附件无源码。

**流程严格按脚本门禁执行，先跑脚本再看输出，禁止手工翻历史登记表查重。**

### 1. 选题（batchN = 下一批次号，从 61 起）

```bash
node scripts/update-deployed-index.mjs        # 0. 每次必做：重建查重索引
mkdir -p .tmp/batchN && cd .tmp/batchN         # 1. 该批次所有产物都放这里
#    （用代理从 GitHub 下载候选比赛源码/附件到本地，下载失败/空仓库直接跳过）
node scripts/scan-web-candidates.mjs .tmp/batchN   # 2. 一轮扫描出 kind + dup 结论
```

- 只考虑 `kind=web 且 dup=-` 的行；`dup=YES/MAYBE` 排除；`pwn/misc/static` 跳过。
- 读本地 README/writeup 评估难度；无可靠资料则跳过该题。
- 确定后写 `docs/ctf-web-registry-batchN.json`（`status: "pending"`），字段规范：
  - `id`：`<比赛slug>-<题目slug>`，全小写 `[a-z0-9_-]`；`image` 固定 `localtrain/ctf-<id>:latest`。
  - `title`：判重 = 「归一化标题 + 归一化比赛名」；不同比赛同名允许导入（建议标题加比赛前缀区分）；同比赛同名默认跳过。
  - `dir`：`docker/ctf-contests/<比赛slug>/<题目slug>/`。

### 2. 预检（硬性门禁）

```bash
node scripts/validate-batch-registry.mjs docs/ctf-web-registry-batchN.json
# 后端在线时加 --api 额外比对平台现有题目
```

- 检查项：必填字段/命名规范/批内批外与平台查重/源码目录与 Dockerfile，外加构建坑静态检查（.sh 含 CRLF 报 ERROR、EXPOSE 与登记表 port 不一致、`ENV FLAG` 或缺 `ARG FLAG` 等不可靠 flag 注入方式）。

**有 ERROR 不许构建/导入。** 历史事故（第 31/32 批）：标题归一化冲突导致旧题被覆盖，只能手工恢复——这个门禁就是为此设计的，不要绕过。

### 3. 构建镜像

源码放入 `docker/ctf-contests/<比赛slug>/<题目slug>/`（永久存放地），改造 Dockerfile：

- **flag 构建期静态注入**：`ARG FLAG` + `RUN echo "$FLAG" > /flag`（或写入应用约定位置）。平台不注入运行时环境变量。
- 服务必须监听固定端口并与登记表 `port` 一致。
- 基础镜像优先用本地已有标签（`docker images` 查），缺的从镜像源拉取后 retag。
- `build.sh` 兼容两种目录规范：`<比赛slug>/<目录名即完整id>` 与 `<比赛slug>/<题目slug> 拼接后等于 id`；自动找题目根目录或两层内的 Dockerfile。

```bash
REGISTRY_FILE=docs/ctf-web-registry-batchN.json NO_SAVE=1 bash docker/ctf-contests/build.sh <id1> <id2> ...
# REGISTRY_FILE 让 build.sh 自动从登记表读 flag 并 --build-arg FLAG 注入
# NO_SAVE=1：不导出 docker-images/*.tar（containerd snapshotter 下 docker save 产物损坏，见环境事实 5）
```

自动流程备选：`node scripts/prepare-batch.mjs <登记表> --no-save`（自动 clone、写 flag、调 build.sh）。

### 4. 冒烟验证（每题必做）

```bash
# 脚本方式（推荐）：docker run -P 随机端口 → HTTP 探活（自动重试）→ 停止删除
node scripts/verify-batch.mjs docs/ctf-web-registry-batchN.json --preimport

# 手工方式（等价）：
docker run -d --rm -p <主机端口>:<题目端口> localtrain/ctf-<id>:latest
curl http://localhost:<主机端口>   # 确认 HTTP 可达、按解法能读到 flag
docker stop <容器>
```

### 5. 导入平台（后端需已启动，注意端口）

```bash
API_BASE=http://localhost:3008 node import-ctf-contests.mjs docs/ctf-web-registry-batchN.json
```

- 自动登录 admin、按登记表建题、打附件 zip 上传（自动排除 writeup/exp/flag.txt 等泄答案文件，且上传前解包扫描附件内容，含 flag 原文即拒绝导入）、写 `contest` 标签，结果回写登记表 `status`。
- 同比赛同名默认跳过；确认要覆盖旧题才加 `--allow-update`。导入失败（含泄题门禁拦截）的条目修复后加 `--retry` 重跑。
- 导入前用 `docker image inspect` 检查本地镜像是否存在（不再看 tar，NO_SAVE 时代平台只依赖本地镜像标签）。
- `description` 非空则直接用作题目描述，否则自动生成默认描述。

### 6. 平台侧验证 + 收尾（必做清单）

- 以 user 身份逐题批量验证（启动环境 → HTTP 可访问 → 提交 flag → 自动重置本人进度防污染账号）：`node scripts/verify-batch.mjs docs/ctf-web-registry-batchN.json`。
- 一次性收尾（刷索引 → .tmp 清理预览 → 更新 tmp 报告 → 生成文档表格草稿 + 手工事项清单）：`node scripts/close-batch.mjs docs/ctf-web-registry-batchN.json`。
- 更新文档：`docs/ctf-web-challenges.md` 加批次章节（构建备注/特殊处理/writeup 来源）、`CHALLENGE-DEPLOYMENT.md` 5.3 批次表 + 第 9 章历史记录。
- 确认 close-batch 的清理预览无误后真实清理：`node scripts/clean-tmp-deployed.mjs`（不带 --dry-run）。
- writeup 写入该比赛的合并文档 `ctf-writeup/<比赛slug>/<比赛slug>.md`（一赛一 wp，含题目索引与来源；同一比赛跨批次重复部署的题共用一节）。找全后跑登记表回写：writeupLocal 指向合并文档。无法抓取的 PDF 记录链接。

### 常见构建坑速查（历史批次实录，详见 ctf-web-challenges.md）

- entrypoint/start.sh **CRLF** → 容器起不来，转 LF。
- entrypoint 默认值覆盖注入的 `ENV FLAG` → 改为构建期 `RUN echo` 写文件。
- Jetty 等非 root 基础镜像写不了 `/flag` → Dockerfile 加 `USER root`。
- apt 源慢/404、go mod 拉不下来 → 换国内源（见环境事实 6）。
- 镜像标签含大写 → 全部小写（目录名同理）。
- OCaml/opam 等编译极重的题 → 可基于已构建好的原题镜像另写 `Dockerfile.flag-inject` 只注入 flag（第 33 批 jain-streak-dreamers 先例）。

## .tmp 管理

- **每次筛选题目先读 `.tmp/TMP-CLEANUP-REPORT.md`**，按批次在 `.tmp/batchN/` 内工作，不与其他批次混杂。
- 当前 `.tmp` 仍有 200 个待确认条目、batch30–32 合计约 8GB（见报告），下次批量操作前评估是否清理。
- 批次完成后删除该批次**已部署成功**的源码/归档，保留未部署/跳过的。
- 工具：`node scripts/update-tmp-report.mjs`（更新报告）、`node scripts/clean-tmp-deployed.mjs --dry-run`（按 deployed 状态清理）、`node scripts/clean-tmp-by-batch.mjs --dry-run`（按完整批次清理）。受保护目录（batch*、downloads、extract 等）和文档/脚本扩展名默认不删。

## CVE 题目部署（次要，存量维护）

- 登记表 `docs/cve-registry.json`（50 题：45 deployed + 5 skipped），writeup 索引 `cve-writeup/README.md`（20 道已验证）。
- 5 道 skipped 需自定义环境，若找到可用镜像：`node scripts/deploy-skipped-cve.mjs [id]` → `node scripts/import-cve-challenges.mjs` → 前台验证 flag。
- CVE 题多基于 vulhub 镜像，流程详见 `CHALLENGE-DEPLOYMENT.md` 第 4 章。

## Docker 日常维护

```bash
docker container prune -f   # 已停止容器
docker image prune -f       # 悬空镜像（<none>:<none>，构建中间层，可安全删）
docker builder prune -f     # build cache
docker volume prune -f      # 未使用卷
```

- NO_SAVE=1 期间新批次无 tar 备份，**不要随手删除已部署题目的本地镜像标签**；早期批次有 `docker-images/*.tar` 可恢复。异地备份用 `node scripts/push-images-to-ghcr.mjs`（把无 tar 的 deployed 镜像推到 ghcr.io 私有仓 `ghcr.io/zrc2682/ctf-<id>:latest`；前置 `docker login ghcr.io`，PAT 需 write:packages；恢复命令见脚本头部注释）。
- 游离的 LocalTrain 容器按 `localtrain.project=localtrain` label 识别。

## 安全注意事项（勿「修复」以下设计，属本地使用前提）

- JWT 密钥硬编码在 `packages/server/.env`（`middleware/auth.ts` 有相同 fallback）。
- 默认账号 `admin/admin`、`user/user` 明文写在 seed。
- `POST /api/auth/switch-role` 一键切换角色、无提交次数限制、无防爆破、无 CSRF。
- 容器直连本地 Docker socket，任何代码注入可影响宿主机。
- 若用户明确要求公网化改造，上述点必须优先处理，且需用户确认接受行为变化。

## 文档维护义务（改完必对照）

| 变更 | 必须同步 |
|------|----------|
| 新批次部署 | `docs/ctf-web-challenges.md`、`CHALLENGE-DEPLOYMENT.md`（5.3 表 + 第 9 章）、登记表 status、本文件概述里的批次号 |
| 平台功能/接口变化 | `README.md`（API 表、功能特性）、本文件对应小节 |
| schema 变更 | `README.md` 的 Prisma 模型段、本文件业务规则段 |
| 新增部署脚本 | `CHALLENGE-DEPLOYMENT.md` 关键文件职责表、本文件 Runbook |

## 测试策略

- 无单测框架。后端改动后跑 `bash test-api.sh`（需后端在 3008 运行）。
- 手动路径：`bash start.sh` → admin 登录建题/传附件 → 切 user 启环境/提交 flag → 重置再解验证 solveCount。
- Docker 相关改动注意验证：启动分配端口、TTL 到期清理、重启后 `restoreTimers`、删题停容器。
