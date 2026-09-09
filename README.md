# LocalTrain CTF 靶场

> 一个**仅供本地使用**的 CTF / CVE 复现靶场网站，用于练习题目、复现漏洞和自由尝试渗透技术。
>
> 安全提醒：本项目仅用于本地学习，请勿部署到公网。默认账号、JWT 密钥均为硬编码的本地配置。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3 + Vite + TypeScript + Pinia + Vue Router + Element Plus |
| 后端 | Node.js + Express + TypeScript |
| 数据库 | SQLite + Prisma ORM |
| 认证 | JWT（Bearer Token） |
| 容器交互 | dockerode |

## 功能特性

### 管理员

- 创建 / 编辑 / 删除题目，支持**题目描述 Markdown 实时预览**
- 创建题目时使用**出题模板**（Web / Pwn / Reverse / Crypto / Misc / CVE 复现），快速填充标题、描述、镜像、端口和示例 flag
- 为题目添加多级提示（可设置级别、名称、内容、扣分）
- 为题目设置多个正确 flag（按顺序对应 flag1、flag2…）
- 上传 / 管理题目附件，支持重命名、删除、控制普通用户可见性
- **批量操作**：批量可见 / 批量隐藏 / 批量删除题目
- 查看用户列表，支持**按总积分排序**、按用户名搜索、仅看有解题记录的用户
- 查看所有运行中的容器，支持**按用户 / 按题目分组**，管理员可一键延长容器 TTL

### 普通用户

- 浏览题目列表（支持分类、难度、已解/未解筛选）
- 查看题目详情并下载附件
- 启动 / 停止 / 延长题目环境
- 逐级解锁提示
- 提交 flag（多 flag 题目需分别提交每个 flag）
- 完整解出题目后可**重置题目**，清空当前进度并重新做题
- 在「我的容器」查看当前运行环境
- 在「个人主页」查看完整解出的题目、累计解出次数与最近解出时间

### 通用

- 一键切换角色（admin ↔ user），方便本地调试

## 目录结构

```
localtrain/
├── package.json              # 根工作区配置，npm workspaces
├── package-lock.json         # 依赖锁定
├── start.cmd / start.sh      # 一键启动脚本
├── test-api.sh               # API 测试脚本（bash）
├── import-ctf-contests.mjs   # 按登记表批量导入 CTF 题目
├── deploy-images.mjs         # 从平台附件自动构建并部署镜像
├── update-flags.mjs          # 从 writeup 批量更新题目 flag
├── scripts/
│   └── prepare-batch.mjs     # 从登记表自动拉取源码、构建镜像、导出 tar
├── CHALLENGE-DEPLOYMENT.md   # 题目部署需求文档（CVE + CTF）
├── .gitignore
├── docker/                   # 题目 Docker 镜像目录
│   ├── example-web/          # 示例 nginx 题目镜像
│   └── show-me-your-pass/    # 示例题目镜像
├── packages/server/uploads/  # 题目附件上传目录（运行时自动生成）
├── packages/
│   ├── server/               # Express 后端
│   │   ├── prisma/
│   │   │   ├── schema.prisma # 数据库模型
│   │   │   ├── seed.ts       # 默认账号和示例题目种子
│   │   │   └── dev.db        # SQLite 数据库文件
│   │   ├── src/
│   │   │   ├── index.ts      # 服务入口
│   │   │   ├── middleware/auth.ts   # JWT 认证/授权
│   │   │   ├── prisma/client.ts     # PrismaClient 单例
│   │   │   ├── routes/              # API 路由
│   │   │   │   ├── auth.ts
│   │   │   │   ├── challenges.ts
│   │   │   │   └── users.ts
│   │   │   └── services/docker.ts   # 容器服务
│   │   ├── .env
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/                  # Vue 3 前端
│       ├── src/
│       │   ├── main.ts
│       │   ├── App.vue
│       │   ├── api/client.ts        # Axios 封装
│       │   ├── router/index.ts      # 路由配置
│       │   ├── stores/auth.ts       # 用户状态
│       │   └── views/               # 页面
│       │       ├── LoginView.vue
│       │       ├── RegisterView.vue
│       │       ├── UserDashboard.vue
│       │       ├── ChallengeDetail.vue
│       │       ├── UserContainers.vue
│       │       ├── ProfileView.vue
│       │       ├── LeaderboardView.vue
│       │       └── AdminDashboard.vue
│       ├── index.html
│       ├── package.json
│       ├── tsconfig.json
│       ├── tsconfig.node.json
│       └── vite.config.ts
```

## 快速开始

### 1. 环境要求

- Node.js >= 18
- npm
- Docker（需要启动真实容器时）

### 2. 安装依赖

```bash
cd localtrain
npm install
```

### 3. 初始化数据库

```bash
npm run db:push
npm run db:seed
```

> 种子数据会创建默认账号：
> - 管理员：`admin` / `admin`
> - 普通用户：`user` / `user`

### 4. 启动开发服务器

```bash
npm run dev
```

- 前端：http://localhost:8080
- 后端：http://localhost:3008

Windows 也可以直接双击 `start.cmd`。

## 使用说明

### 一键切换角色

登录后，顶部导航栏会显示当前身份（管理员 / 普通用户），点击「切换为 XXX」即可一键切换，无需重新登录。该功能仅修改当前登录账号在数据库中的角色。

### 题目环境

题目模型中的 `image` 字段填写**本地已构建的 Docker 镜像名**（如 `example-web:latest`），`port` 字段填写容器内部服务实际监听的端口。用户点击「启动环境」后，系统会自动分配一个本地端口（30000–39999）并创建容器。

出题流程：

1. 在 `docker/` 下新建题目目录并编写 `Dockerfile`。
2. 本地构建镜像：
   ```bash
   cd docker/your-challenge
   docker build -t your-challenge:latest .
   ```
3. 导出镜像到项目根目录的 `docker-images/`（推荐，便于备份和迁移）：
   ```bash
   docker save -o docker-images/your-challenge_latest.tar your-challenge:latest
   ```
4. 在管理后台创建题目，填写镜像名和端口；也可先选择「出题模板」快速填充，再按需修改。
5. 静态题（Crypto / Reverse / Misc 等不需要运行服务的题目）可将「镜像」留空。

批量比赛题部署可使用登记脚本：

```bash
# 仅准备源码并构建镜像
node scripts/prepare-batch.mjs docs/ctf-web-registry-batchX.json

# 构建完成后直接导入平台
node scripts/prepare-batch.mjs docs/ctf-web-registry-batchX.json --import
```

脚本会自动 clone 源码、写入平台 flag、调用 `build.sh` 构建导出，并回写登记表；加 `--import` 则自动调用 `import-ctf-contests.mjs` 导入数据库。

启动环境时，若本地 Docker 中不存在该镜像，系统会自动从 `docker-images/` 加载同名 `.tar` 归档。

已批量部署的 CVE 题目及其 writeup 汇总：见 `docs/cve-deploy-report.md`、`cve-writeup/README.md` 与 `CHALLENGE-DEPLOYMENT.md`。

已批量部署的 CTF 比赛 Web 题目汇总：见 `docs/ctf-web-challenges.md`、`docs/ctf-web-registry.json` 及 `docs/ctf-web-registry-batch*.json`，部署需求与流程总览见 `CHALLENGE-DEPLOYMENT.md`。

示例题目镜像：

- `docker/example-web/`：最简 nginx 示例
- `docker/show-me-your-pass/`：Web 题目示例

## 后端 API 路由

所有受保护接口都需要 `Authorization: Bearer <token>`。

### 认证 `POST /api/auth`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/register` | 注册，默认 role=user |
| POST | `/login` | 登录 |
| GET | `/me` | 获取当前用户 |
| POST | `/switch-role` | 一键切换当前用户角色 |

### 用户 `GET /api/users`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/` | 用户列表（含总积分） | admin |
| GET | `/profile` | 当前用户个人主页数据 | 登录用户 |
| GET | `/:id/submissions` | 查看指定用户的解题记录 | admin |
| GET | `/leaderboard` | 积分排行榜折线图数据 | 登录用户 |

### 题目 `CRUD /api/challenges`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/` | 题目列表（含 solved 状态） | 登录用户 |
| POST | `/` | 创建题目 | admin |
| PUT | `/:id` | 更新题目 | admin |
| DELETE | `/:id` | 删除题目 | admin |
| GET | `/:id` | 题目详情（含 hints 解锁状态、容器状态） | 登录用户 |
| GET | `/:id/hints` | 题目所有提示 | admin |
| POST | `/:id/hints` | 添加提示 | admin |
| PUT | `/:id/hints/:hintId` | 更新提示 | admin |
| DELETE | `/:id/hints/:hintId` | 删除提示 | admin |
| POST | `/:id/hints/:hintId/unlock` | 解锁提示 | 登录用户 |
| POST | `/:id/start` | 启动环境 | 登录用户 |
| POST | `/:id/stop` | 停止环境 | 登录用户 |
| POST | `/:id/extend` | 延长环境 1 小时 | 登录用户 |
| POST | `/:id/submit` | 提交指定下标的 flag | 登录用户 |
| POST | `/:id/reset` | 重置题目进度（不清除累计解出记录） | 登录用户 |
| POST | `/batch-visible` | 批量修改题目可见性 | admin |
| POST | `/batch-delete` | 批量删除题目 | admin |
| GET | `/:id/attachments` | 题目附件列表 | 登录用户 |
| GET | `/:id/attachments/:attachmentId/download` | 下载附件 | 登录用户 |
| PUT | `/:id/attachments/:attachmentId/visible` | 修改附件对普通用户是否可见 | admin |
| DELETE | `/:id/attachments/:attachmentId` | 删除附件 | admin |
| GET | `/containers` | 当前用户容器列表 | 登录用户 |
| GET | `/containers/all` | 所有运行中的容器 | admin |
| POST | `/containers/:containerId/extend` | 管理员延长指定容器 1 小时 | admin |

### 健康检查

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 服务健康状态 |

## 数据库模型（Prisma）

```prisma
model User {
  id           String        @id @default(uuid())
  username     String        @unique
  passwordHash String
  role         String        @default("user") // admin | user
  createdAt    DateTime      @default(now())
  submissions  Submission[]
  usedHints    UsedHint[]
  containers   Container[]
}

model Challenge {
  id          String        @id @default(uuid())
  title       String
  description String        @default("")
  category    String        @default("misc")
  difficulty  String        @default("easy") // easy | medium | hard | expert
  image       String        @default("")      // Docker image name
  port        Int           @default(80)      // exposed port
  createdAt   DateTime      @default(now())
  hints       Hint[]        @relation("ChallengeHints")
  submissions Submission[]
  containers  Container[]
  flags       Flag[]
  attachments Attachment[]
}

model Flag {
  id          String    @id @default(uuid())
  challengeId String
  index       Int       // 0-based position: flag1=0, flag2=1...
  value       String
  challenge   Challenge @relation(fields: [challengeId], references: [id], onDelete: Cascade)

  @@unique([challengeId, index])
}

model Attachment {
  id           String   @id @default(uuid())
  challengeId  String
  filename     String
  originalName String
  path         String
  size         Int
  mimeType     String
  visibleToUser Boolean @default(true) // 普通用户是否可在题目详情看到并下载该附件
  createdAt    DateTime @default(now())
  challenge    Challenge @relation(fields: [challengeId], references: [id], onDelete: Cascade)
}

model Hint {
  id           String     @id @default(uuid())
  challengeId  String
  challenge    Challenge  @relation("ChallengeHints", fields: [challengeId], references: [id], onDelete: Cascade)
  level        Int        @default(1)
  label        String     @default("")
  content      String
  scorePenalty Int        @default(0)
  usedHints    UsedHint[]

  @@unique([challengeId, level])
}

model UsedHint {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  hintId    String
  hint      Hint     @relation(fields: [hintId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([userId, hintId])
}

model Submission {
  id                String    @id @default(uuid())
  userId            String
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  challengeId       String
  challenge         Challenge @relation(fields: [challengeId], references: [id], onDelete: Cascade)
  flag              String    @default("")
  isCorrect         Boolean   @default(false)
  solvedFlagIndices Json      @default("[]") // 已解出的 flag 下标
  solveCount        Int       @default(0)    // 累计完整解出次数
  solvedAt          DateTime?                // 最近完整解出时间
  submittedAt       DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@unique([userId, challengeId])
}

model Container {
  id            String    @id @default(uuid())
  userId        String
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  challengeId   String
  challenge     Challenge @relation(fields: [challengeId], references: [id], onDelete: Cascade)
  containerId   String    // Docker container ID
  image         String    // Docker image name
  hostPort      Int       // auto-allocated host port
  internalPort  Int       // container internal port
  startedAt     DateTime  @default(now())
  expiresAt     DateTime
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([userId])
  @@index([challengeId])
  @@index([expiresAt])
  @@unique([userId, challengeId])
}
```

## 前端页面与路由

| 路由 | 页面 | 说明 | 访问权限 |
|------|------|------|----------|
| `/` | - | 重定向到 `/dashboard` | - |
| `/login` | LoginView | 登录 | 游客 |
| `/register` | RegisterView | 注册 | 游客 |
| `/dashboard` | UserDashboard | 题目列表，支持分类/难度/已解未解筛选 | 登录 |
| `/challenges/:id` | ChallengeDetail | 题目详情、附件下载、环境操作、提示解锁、flag 提交 | 登录 |
| `/containers` | UserContainers | 当前运行中的容器 | 登录 |
| `/profile` | ProfileView | 个人解题记录、累计解出次数与最近解出时间 | 登录 |
| `/leaderboard` | LeaderboardView | 积分排行榜折线图（从今天起往前 7 天，支持手动刷新） | 登录 |
| `/admin` | AdminDashboard | 题目管理（含多 flag、附件上传/重命名/删除/可见性控制）+ 用户列表 + 容器管理 | 登录且 admin |

## 开发工作流

### 启动

```bash
npm run dev              # 同时启动 server + web
npm run dev:server       # 只启动后端
npm run dev:web          # 只启动前端
```

### 数据库

```bash
npm run db:push          # 根据 schema.prisma 更新数据库结构
npm run db:seed          # 执行种子脚本（创建默认账号和示例题目）
```

### 构建

```bash
npm run build            # 构建前端到 packages/web/dist
npm run build -w packages/server  # 构建后端
```

## 测试

`test-api.sh` 是基于 curl 的端到端 API 测试，覆盖登录、创建题目、添加提示、切换角色、获取详情、启动环境、提交 flag、重置题目并验证解出次数累计等流程。

```bash
# 确保后端已启动在 http://localhost:3008
bash test-api.sh
```

## 安全与注意事项

- JWT 密钥写死在 `packages/server/.env` 和 `middleware/auth.ts` 的 fallback 中，仅本地使用。
- 默认账号 `admin/admin`、`user/user` 仅用于本地测试。
- SQLite 数据库文件：`packages/server/prisma/dev.db`。
- `switch-role` 接口是本地调试便利功能，公网部署必须移除或严格限制。

## 已知限制与 TODO

- [x] 计分板与排行榜折线图已添加（`/leaderboard`）。
- [ ] 没有提交次数限制和防爆破机制。
- [ ] 前端没有错误边界和 loading 统一处理。

## 常用命令速查

```bash
# 安装 + 初始化（新环境）
npm install && npm run db:push && npm run db:seed

# 启动开发
npm run dev

# 批量准备并构建比赛题镜像
node scripts/prepare-batch.mjs docs/ctf-web-registry-batchX.json

# 批量构建完成后直接导入平台
node scripts/prepare-batch.mjs docs/ctf-web-registry-batchX.json --import

# 重置数据库（删除 dev.db 后重新 push + seed）
rm packages/server/prisma/dev.db
npm run db:push
npm run db:seed
```
