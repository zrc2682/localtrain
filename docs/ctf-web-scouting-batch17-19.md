# CTF Web 题目侦察报告 —— Batch 17/18/19

> 报告日期：2026-07-25  
> 目标：从本地 `.tmp/` 与 `CTF-Archives/*` GitHub 仓库中，为 batch 17/18/19 各挑选 10 个尚未部署的 Web 挑战（easy/medium 为主，少量 hard），最终只输出侦察结论，不写 registry 文件、不构建镜像。  
> 已部署基准：读取 `docs/ctf-web-registry*.json` 共 **178 个 id**（见 `.tmp/deployed-ids.txt`）。

---

## 1. 方法与关键结论

- 扫描 `.tmp` 中所有带 `Dockerfile` 的目录，逐条核对 `deployed-ids.txt`。
- 对候选题目做源码级抽查：Dockerfile、入口脚本、主程序、端口、flag 机制、依赖。
- 通过 GitHub release 页面确认若干未下载附件的真实文件名与大小。
- **核心结论**：本地已验证且未部署的 Web 容器化候选仅约 **14 个**，远不足 30 个；另有 3-5 个在 release 页面存在但尚未下载或无法解压。需继续补充来源或接受批次缺口。

---

## 2. 已验证未部署候选（按源码/容器完整度分组）

### 2.1 源码 + Dockerfile 完整，可较快构建

| id | title | 比赛 | 难度 | 端口 | 来源路径 | 技术栈 | flag 机制 | 备注 |
|---|---|---|---|---|---|---|---|---|
| `qwbs7-2023-happygame` | HappyGame | 2023 强网杯 | medium | 80 | `.tmp/qwbs7-2023-happygame-src.zip` | Java jar（gRPC 监听 80） | `Dockerfile` 构建时 `ARG FLAG` 写入 `/flag`，`happygame.jar` 读取 | 与 `docs/ctf-web-challenges.md` 中“已部署”记录冲突，但 registry 中均未发现；建议二次确认后再部署 |
| `hgame-2023-gopher-shop` | Gopher Shop | HGAME 2023 | medium | 8080 | `.tmp/batch2/x-ek1ng/My-CTF-Challenges-main/HGAME2023-Gopher Shop/challenge/` | Go/Gin + MySQL 5.7 | `config.toml` 中 flag 字段 | 含 Dockerfile + docker-compose.yml，需多容器或合并为单容器 |
| `hgame-2023-v2board` | v2board | HGAME 2023 | medium/hard | 80 | `.tmp/batch2/x-ek1ng/My-CTF-Challenges-main/HGAME2023-v2board/challenge/` | PHP Laravel + MySQL 5.7 + Redis | `entrypoint.sh` 运行安装，flag 预期为反序列化/逻辑漏洞后读取 `/flag` | 含 Dockerfile + docker-compose.yml，需单容器化 |
| `qwb8-2024-semis-proxy1` | proxy1 | 2024 强网杯半决赛 | medium | 8000 | `.tmp/qwb8/proxy1/` | Go + nginx | `entrypoint.sh` 将 `ICQ_FLAG` 写入 `/flag`，`/v1/api/flag` 调用 SUID `/readflag` 读取 | 与已部署 `qwbs8-2024-proxy` 同源不同版本，源码 + Dockerfile 完整 |
| `qwb8-2024-semis-proxy2` | proxy2 | 2024 强网杯半决赛 | medium/hard | 8000 | `.tmp/qwb8/proxy2/` | Go + nginx | 同 proxy1 | proxy1 的复仇/升级版 |
| `qwb8-2024-semis-ezcalc` | ezcalc | 2024 强网杯半决赛 | medium/hard | 9000 | `.tmp/qwb8/ezcalc/` | Go + SQLite + Puppeteer bot（Node） | flag 由 `/readflag` 机制读取 | 含 app/ 与 bot/ 双 Dockerfile + docker-compose.yml，需合并为单容器 |

### 2.2 源码完整但需补 Dockerfile / 数据库

| id | title | 比赛 | 难度 | 端口 | 来源路径 | 技术栈 | flag 机制 | 备注 |
|---|---|---|---|---|---|---|---|---|
| `fjsdxssjan-2023-no-rce-zentao` | no_rce_zentao | 2023 福建省大学生网络安全竞赛 | medium/hard | 80 | `.tmp/batch14/repos/2023-fjsdxssjan/Web-no_rce_zentao/.inspect/` | 完整禅道 PHP 应用 + MySQL | 需自制 Dockerfile，flag 写入 `/flag` 后由 ZenTao 逻辑漏洞读取 | 无 Dockerfile，需参考真实 ZenTao 部署 |
| `2025-jksn-final-web5` | web5 | 2025 尖峰山杯决赛 | medium/hard | 80 | `.tmp/ctf-archives/2025-jksn-final/final_attachment/web5/` | PHP + MySQL | SQL 注入后反序列化触发 eval；flag 需写入 `/flag` 后读取 | 缺少 `conn.php`、Dockerfile；需补全 MySQL 初始化 |
| `ccsssc-2026-semis-nodejs` | nodejs | 2026 全国大学生网络安全与对抗赛半决赛 | medium | 3000 | `.tmp/batch16-downloads/nodejs.zip` | Node.js + Express + vm2 + 原型链污染 | 原型链污染提权，vm2 逃逸读 `/flag` | 无 Dockerfile，无 `public/index.html`；vm2 3.10.0 已知可逃逸 |
| `jksn-2025-quals-download-php` | download | 2025 尖峰山杯初赛 | easy/medium | 80 | `.tmp/ctf-archives/2025-jksn-quals/attachments726/download.php` | 单文件 PHP（MIME 校验 + 文件上传） | 文件上传后读取 `/flag`；需补 Dockerfile 将 flag 写入 `/flag` | 单文件附件，依赖 `include.php`（同目录下存在） |
| `jksn-2025-quals-login-php` | login | 2025 尖峰山杯初赛 | easy/medium | 80 | `.tmp/ctf-archives/2025-jksn-quals/attachments727/login.php` | 单文件 PHP（PDO + MySQL） | SQL 注入或 md5 盐逻辑绕过登录；flag 写入数据库或 `/flag` | 单文件，包含 `include_once("conn.php")`；缺少数据库初始化 |

### 2.3 源码不完整或需要额外下载

| id | title | 比赛 | 难度 | 端口 | 来源路径 | 技术栈 | flag 机制 | 备注 |
|---|---|---|---|---|---|---|---|---|
| `hgame-2023-git-leakage` | Git Leakage | HGAME 2023 | easy | 80 | `.tmp/batch2/x-ek1ng/My-CTF-Challenges-main/HGAME2023-Git Leakage/` | Node `http-server` 静态服务 | `.git` 泄漏后读取 flag 文件 | 本地 `src/` 目录为空，需从上游重新拉取 |
| `ciscn-2025-finals-what-is-model` | what-is-model | 2025 CISCN 总决赛 | hard | 5000 | `.tmp/2025-ciscn-finals/asset-what-is-model.zip` | Flask + PyTorch ResNet18 | 提交篡改模型通过校验后返回 `flag{win}` | 缺少 `model.pth`、`test_subset.pt`、`index.html`、`Dockerfile` |
| `xhlj-2024-ezerp` | ezerp | 2024 西湖论剑 | medium/hard | 待定 | `.tmp/scout/xhlj-ezerp.zip` / `.tmp/scout/ezerp.jar` | Java Spring Boot（单 jar 41MB） | 运行 jar 后通过 Spring Boot 漏洞读取 `/flag` | 仅一个 jar，无 Dockerfile，需自行确定端口 |

### 2.4 Release 页面确认但尚未下载/无法解压

| id | title | 比赛 | 难度 | 端口 | 来源路径 | 技术栈 | 状态 |
|---|---|---|---|---|---|---|---|
| `2023-qwbs7-thinkshop` | thinkshop | 2023 强网杯 | medium/hard | 待定 | GitHub Release `Web-thinkshop.zip`（314 MB） | 未知 | 本地未完整下载 |
| `2023-qwbs7-thinkshopping` | thinkshopping | 2023 强网杯 | medium/hard | 待定 | GitHub Release `Web-thinkshopping.zip`（316 MB） | 未知 | 本地未完整下载 |
| `2025-ciscn-finals-k1cache` | k1cache | 2025 CISCN 总决赛 | medium/hard | 待定 | GitHub Release `ctf-k1cache_7c036bcc5daba0728da87d0cf3560ba9.zip`（15.4 MB） | 未知 | 未下载 |
| `2025-ciscn-finals-MiracleStruct` | MiracleStruct | 2025 CISCN 总决赛 | medium/hard | 待定 | GitHub Release `ctf-MiracleStruct_dc026419ebd806faeba49523354b6bb6.zip` | 未知 | 未下载 |
| `2025-ciscn-finals-awdp-web-rbac` | awdp-web-rbac | 2025 CISCN 总决赛 | hard | 待定 | GitHub Release `awdp-web-rbac.tar.7z`（183 MB） | 未知 | 已下载但环境无 7z 无法解压 |

---

## 3. Batch 17/18/19 分配建议

### 方案 A：按容器完整度分配（推荐）

- **Batch 17（10 题，源码+Dockerfile 完整）**
  1. `qwbs7-2023-happygame`
  2. `hgame-2023-gopher-shop`
  3. `hgame-2023-v2board`
  4. `qwb8-2024-semis-proxy1`
  5. `qwb8-2024-semis-proxy2`
  6. `qwb8-2024-semis-ezcalc`
  7. `fjsdxssjan-2023-no-rce-zentao`
  8. `2025-jksn-final-web5`
  9. `ccsssc-2026-semis-nodejs`
  10. `jksn-2025-quals-download-php`

- **Batch 18（4 题已验证 + 6 题占位）**
  1. `jksn-2025-quals-login-php`
  2. `ciscn-2025-finals-what-is-model`
  3. `xhlj-2024-ezerp`
  4. `hgame-2023-git-leakage`
  5. `2025-ciscn-finals-k1cache`
  6. `2025-ciscn-finals-MiracleStruct`
  7. `2025-ciscn-finals-awdp-web-rbac`
  8. `2023-qwbs7-thinkshop`
  9. `2023-qwbs7-thinkshopping`
  10. 待补充

- **Batch 19（10 题全部待定）**
  - 当前无足够已验证候选。建议继续扫描 `CTF-Archives` 2024-2025 未处理仓库 release。

### 方案 B：按难度配比分配

- 已验证候选中 easy 约 3 个，medium 约 7 个，hard 约 4 个。
- 推荐 **Batch 17 = 4 easy + 6 medium**，**Batch 18 = 3 medium + 7 hard**，**Batch 19 = 待补充**。

---

## 4. 排除项说明

### 4.1 已部署（与候选同名或同源）

| 候选 | 已部署 id | 说明 |
|---|---|---|
| `wdb-zhuque-2024-web1` | `wdb-2024-ezblog` | 与 batch4 已部署题源码一致 |
| `NCO-2026-final-what-can-i-say` | `mamba` | batch14 已部署 |
| `2025-ccb-final-ezwebsite` | `ccb-2025-ezwebsite` | batch5 已部署 |
| `longjian-2025-ezzupload` | `longjian-2025-ezzupload` | batch7 已部署 |
| `longjian-2025-webshell` | `longjian-2025-webshell` | batch9 已部署 |
| `happygame`（docs 记录） | 未见 registry | 仅 docs 标注已部署，registry 无记录，需二次确认 |

### 4.2 非 Web / 非容器 / 占位符

- `2025-ccb-ciscn-semis UpNodeTrap`：pwn 二进制。
- `openharmony-ezapp`：`.hap` 移动应用，非 Web 容器。
- `2025-WQB-Quals easy_readfile / ez_python / ssti`：release 附件仅为占位 README。
- `2024-dfjk EncirclingGame / easy_java / bio_share`：release 中仅找到占位符或已部署。

### 4.3 已部署同赛事其他题

- 2025 尖峰山杯初赛/决赛：大部分已部署。
- 2026 NCO Quals/Final：web 题基本已部署。
- 2025 qwbs9 全系列已部署。
- 2024/2025 CCB-CISCN 初赛/决赛：大部分已部署。

---

## 5. 关键源码/配置摘录

### 5.1 `qwb8-2024-semis-proxy1` entrypoint 与 flag

```bash
if [ ${ICQ_FLAG} ];then
    echo -n ${ICQ_FLAG} > /flag
    chown root:root /flag
    chmod 400 /flag
    echo [+] ICQ_FLAG OK
    unset ICQ_FLAG
else
    echo [!] no ICQ_FLAG
fi
nginx -g "daemon on;"
su app -c '(cd /app && ./proxy&)'
tail -f /dev/null
```

### 5.2 `ccsssc-2026-semis-nodejs` 核心逻辑

- `app.js` 监听 3000。
- 改密码时 `merge` 函数过滤 `__proto__` 但不过滤 `constructor.prototype`，可污染 `isAdmin`。
- `/admin` 进入后 `/sandbox` 使用 `vm2@3.10.0` 执行代码，可逃逸读 `/flag`。

### 5.3 `hgame-2023-gopher-shop` 配置

```toml
[mysql]
host = "127.0.0.1"
port = 3306
username = "root"
password = "root"
database = "gopher_shop"

[secret]
session_secret = "hgame{GopherShop_M@gic_1nt_0verflow}"
flag = "hgame{GopherShop_M@gic_1nt_0verflow}"
```

### 5.4 `ciscn-2025-finals-what-is-model` 缺陷

zip 内仅有 `app.py` 与 `ResNet18_Weights-IMAGENET1K_V1.pth`，缺少 `model.pth`、`test_subset.pt`、`index.html`、`Dockerfile`。

---

## 6. 缺口与后续建议

1. **数量缺口**：本地已验证且可直接容器化的 Web 候选约 6-7 个；加上需补 Dockerfile/DB 的约 4-5 个；合计约 11-12 个。加上 release 确认但未下载的 5 个，也仅约 16-17 个，仍不足 30。
2. **建议优先补齐**：
   - 重新下载 `2023-qwbs7-thinkshop/thinkshopping`（314 MB × 2）。
   - 下载并解压 `2025-ciscn-finals` 的 `k1cache`、`MiracleStruct`、`awdp-web-rbac`。
   - 从 HGAME 2023 上游仓库重新拉取 `Git Leakage` 的完整 `src/.git`。
3. **不建议凑数**：单文件 `Web2.php`、`web3.php`、`Web-api.php` 等缺少题目来源与 flag 机制，不建议直接作为 batch 题目。
4. **happygame ambiguity**：建议用 `docker images` / `docker ps` 确认是否已构建镜像，避免与 docs 记录冲突。

---

> 维护者：LocalTrain 项目
> 最后更新：2026-07-25
