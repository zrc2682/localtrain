# CTF-Writeups 批量部署报告

> 数据源：`F:\Myprojects\CTF-Writeups\网络空间安全设计与实践\writeup`
> 部署目标：LocalTrain（`http://localhost:3000/api`）
> 统计时间：2026-07-13

## 1. 部署概况

| 项目 | 数量 |
|------|------|
| 已导入题目（不含示例题） | 36 |
| Web | 11 |
| Reverse | 9 |
| Pwn | 5 |
| Misc | 9 |
| Crypto | 2 |
| flag 待补充 | 25 |
| 因无附件跳过 | 6 |
| 有附件无题解框架 | 3 |
| 已修复错误 flag | 3 |

## 2. 本次修复

- 删除重复的 `magic` 题目（保留一份）。
- 修复 `deploy-writeups.mjs`：
  - 标题提取时跳过代码块，避免把 bash 注释 `# 查看日志获取最新 commit hash` 误识别为标题。
  - 不再把与 `.md` 同名的 `.txt` 文件当作题解（避免 `Pwn/magic.txt` 这种反编译日志重复部署）。
  - flag 提取增加过滤：不跨行、不含嵌套 `{`、长度不超过 100。
- 新增 `update-flags.mjs`：对已有题目重新提取 flag，修复了以下 3 题的异常 flag：
  - `real`：`flag{{{binary_str}}` 等错误值 → `flag{01010010011001010110000101101100}`
  - `learn_to_type`：把整段解题脚本误当作 flag → `flag{Once_I_was_seven_years_old}`
  - `传统派`：把 Python 代码片段误当作 flag → `flag{alohaoecaesarsssss}`

## 3. Docker 镜像部署

新增 `deploy-images.mjs`，为 Web / Pwn 类题目自动解压附件、识别技术栈、生成 Dockerfile、构建镜像并写入 Challenge 的 `image` 和 `port` 字段。

| 状态 | 数量 | 说明 |
|------|------|------|
| 已配置镜像 | 14 | Web/Pwn 题目中已有 12 题完成；giftbot 修复 tar 后构建成功 |
| 因无附件跳过 | 1 | Show Me Your Pass（附件文件丢失，仍保留已有的 `localtrain/show-me-your-pass`） |
| 构建失败 | 0 | — |

### 已成功部署的题目

- `深渊笔记` → `localtrain/c-84a3f54f:3000`
- `Code_db` → `localtrain/code-db:80`
- `安全镜像` → `localtrain/c-bf47e4b8:5000`
- `草莓云收件箱` → `localtrain/strawberry-mail:5000`
- `火车票1` → `localtrain/train-ticket-1:80`
- `火车票2` → `localtrain/train-ticket-2:80`
- `唐哭` → `localtrain/c-f337b88b:8080`
- `Recovery Console` → `localtrain/recovery-console:1337`
- `novel-contest` → `localtrain/novel-contest:810`
- `活人感文案检测器` → `localtrain/c-55abce96:5000`
- `magic` → `localtrain/magic:1337`
- `holy_fcgi` → `localtrain/holy-fcgi:8080`
- `Chronobreak` → `localtrain/chronobreak:1337`
- `giftbot` → `localtrain/giftbot:9999`
- `BlueprintDesk` → `localtrain/blueprintdesk:4000`

### BlueprintDesk 修复说明

原镜像构建失败的原因：
1. `hexpm/elixir` 镜像源 403；
2. `mix.exs` 依赖了两个 GitHub 私有/分支仓库（`The-Nautilus-Institute/exqlite`、`vito-lbs/elixir-uuid`），当前环境无法访问 GitHub。

处理方式：
- 改用 `elixir:1.18.4-slim` + `debian:trixie-slim` 构建；
- 将 `exqlite` 替换为 hex 包 `~> 0.27`；
- 移除 `elixir_uuid` 的 GitHub fork，新增本地 `UUID` 模块（`uuid4/0`、`uuid4(:slug)`）以兼容原代码；
- 附件中的 `assets/node_modules` 为空占位，Dockerfile 中补充 `npm install`；
- 端口使用应用默认的 `4000`。

已验证容器可在 `localhost:30002` 正常启动并返回 200。

### 验证结果

- `唐哭` 调用 `POST /api/challenges/:id/start` 成功在 `localhost:30000` 拉起容器并返回访问地址。
- 后端容器管理（`packages/server/src/services/docker.ts`）已支持：镜像本地查找、端口 30000–39999 自动分配、每个用户最多同时 5 个容器、默认 2 小时 TTL、延长/停止/清理。

## 4. flag 待补充题目（25 题）

这些题目的 writeup 中未显式给出 `flag{...}`，需要手动补充：

### Web（10 题）
- 安全镜像
- 草莓云收件箱
- 火车票2
- 火车票1
- 唐哭
- Recovery Console
- novel-contest
- BlueprintDesk
- Code_db
- 深渊笔记

### Reverse（6 题）
- 简单解马
- 找不到密钥是⑨
- IBM-5100 Relay
- FlagChecker
- fake
- dontai

### Pwn（5 题）
- 活人感文案检测器
- magic
- holy_fcgi
- giftbot
- Chronobreak

### Misc（3 题）
- 神秘流量
- 神秘文件
- 神秘图片

### 有附件无题解框架（3 题）
- `Web/BlueprintDesk.zip` → BlueprintDesk
- `Web/Code_db.zip` → Code_db
- `Web/深渊笔记.zip` → 深渊笔记

### Crypto（1 题）
- 维新派

## 5. 因无附件跳过的题目（6 题）

这些 writeup 在 `题目附件/` 目录下没有匹配到对应附件：

- [Crypto] Hill
- [Crypto] 签到
- [Web] 户籍表
- [Web] 文件上传
- [Web] 跑马场
- [Web] 音乐会

如需部署这些题目，请把附件放入对应目录的 `题目附件/` 文件夹，文件名与 writeup 文件名一致即可。

## 6. 已部署的有附件无题解框架

以下文件在 `题目附件/` 中没有同名 writeup，已作为题目框架部署（flag 为 `flag{待补充}`）：

- `Web/BlueprintDesk.zip` → BlueprintDesk
- `Web/Code_db.zip` → Code_db
- `Web/深渊笔记.zip` → 深渊笔记

> `Web/Show Me Your Pass.zip` 对应的题目已存在，未重复部署；`Web/火车票1 .zip` 是 `火车票1` 的附件。

## 6. 2025 冬季培训 Web 题目部署

> 数据源：`F:\Myprojects\CTF-Writeups\2025冬季培训\Web`
> 部署时间：2026-07-14

本次只处理有源码附件的 Web 题目，`OTProxy` 按要求不部署；`SayHello`、`calc`、`pingping`、`有蜘蛛`、`跑马场` 因无源码附件跳过。

### 已部署题目

| 题目 | 镜像 | 端口 | 注入 flag |
|------|------|------|-----------|
| ApacheNight | `localtrain/apachenight` | 80 | `flag{apache_night_d86891d2a781}` |
| Canvas | `localtrain/canvas` | 5000 | `flag{canvas_831488a31c48}` |
| CyberAttack | `localtrain/cyberattack` | 80 | `flag{cyber_attack_bcae8bc10834}` |
| FlaskCook | `localtrain/flaskcook` | 1337 | `flag{flask_cook_abe993963bda}` |
| FriendZone | `localtrain/friendzone` | 80 | `flag{friend_zone_7319c44e496e}` |
| LaTeX | `localtrain/latex` | 5000 | `flag{latex_57ff1b5be27c}` |
| Code_db | `localtrain/code_db` | 3000 | `flag{code_db_db2118829f32}` |

### 关键改造

- 新增 `import-2025winter-web.mjs`：把 7 道题目导入 localtrain DB，自动生成唯一 flag 并写入 `Flag` 表。
- 生成 `web-2025winter-flags.json` 作为 flag 映射，供构建脚本读取。
- 改造 `deploy-images.mjs`：
  - 增加 `DEPLOY_TARGETS` 目标过滤，避免影响其它题目。
  - 构建前自动向源码中注入对应 flag：
    - ApacheNight、Canvas、CyberAttack、LaTeX：替换 `flag.txt`。
    - FlaskCook：通过 Python 容器更新 `cooking.sqlite` 的 `user.password`。
    - Code_db：替换 `src/code_samples/flag.txt`。
  - FriendZone 特殊处理：
    - 原附件分 web（`friendzone/`）和 bot（`bot/`）两个目录；平台每次只启动一个容器，故把 bot 的 cron 逻辑合并进 web 镜像。
    - 把 `cron.sh` 目标改为 `http://localhost/`，并生成 `start.sh` 同时启动 cron 与 Apache。
    - 注入 `FLAG` 环境变量；已验证 `/tmp/sess_*` 中出现含 flag 的 session 文件，玩家仍可按原解法读取。

### 验证结果

- FriendZone 容器启动后 curl 首页返回正常；等待 60 秒后 `/tmp` 出现 `sess_*` 文件，内容包含 `flag{friend_zone_7319c44e496e}`。
- ApacheNight、Code_db 等容器均能正常启动并返回首页。

## 7. 后续建议

1. **补充 flag**：在 LocalTrain 管理后台或数据库中修改上述 22 题的 flag。
2. **补充附件**：为 6 道无附件题目补齐附件后，重新运行 `node deploy-writeups.mjs`。
3. **题目环境**：当前只部署了静态附件，未部署 Docker 镜像/动态环境。需要为需要动态环境的题目单独配置镜像。
