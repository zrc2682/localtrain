import fs from 'fs';
import path from 'path';
import { execSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

// 把本地无 tar 备份的已部署题目镜像推送到 ghcr.io 私有仓库，作为异地备份。
// 背景: Docker Desktop + containerd snapshotter 下 docker save 导出的 tar 不完整（见 CHALLENGE-DEPLOYMENT.md 5.6），
// 第 23 批起构建统一 NO_SAVE=1，这些镜像仅以本地标签存在；本脚本把它们推到 ghcr.io 防误删/换机丢失。
// 用法: node scripts/push-images-to-ghcr.mjs [--owner <github用户名>] [--all] [--dry-run] [题目id ...]
//   --owner  ghcr 命名空间；默认取 GHCR_OWNER 环境变量，再默认从 git remote origin 解析 GitHub 用户名
//   （不带 id）默认范围: docs/ctf-web-registry*.json 中 status=deployed 且 docker-images/ 无对应 tar 的题目
//   --all    范围改为全部 deployed 题目（含已有 tar 的）
//   --dry-run 只打印将推送的清单，不做任何修改
// 前置: docker login ghcr.io（PAT 需 write:packages 权限）；ghcr 首推自动创建私有包，无需预建仓库
// 恢复: docker pull ghcr.io/<owner>/ctf-<id>:latest
//       docker tag  ghcr.io/<owner>/ctf-<id>:latest localtrain/ctf-<id>:latest

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'docs');
const IMAGE_DIR = path.join(ROOT, 'docker-images');

function resolveOwner() {
  const idx = process.argv.indexOf('--owner');
  if (idx > -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  if (process.env.GHCR_OWNER) return process.env.GHCR_OWNER;
  try {
    const url = execSync('git remote get-url origin', { cwd: ROOT, encoding: 'utf8' }).trim();
    const m = url.match(/github\.com[/:]([^/]+)\//i);
    if (m) return m[1].toLowerCase();
  } catch {
    // ignore
  }
  console.error('无法确定 ghcr 用户名，请用 --owner <github用户名> 或 GHCR_OWNER 环境变量指定');
  process.exit(1);
}

function buildTargetList() {
  const ids = process.argv.slice(2).filter((a) => !a.startsWith('--') && /^[a-z0-9][a-z0-9_-]*$/.test(a));
  const all = process.argv.includes('--all');
  const list = []; // { id, file }
  for (const f of fs.readdirSync(DOCS).filter((f) => f.startsWith('ctf-web-registry') && f.endsWith('.json')).sort()) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(path.join(DOCS, f), 'utf8'));
    } catch {
      continue;
    }
    for (const c of data.challenges || []) {
      if (c.status !== 'deployed' || !c.id) continue;
      const tarPath = path.join(IMAGE_DIR, `localtrain_ctf-${c.id}_latest.tar`);
      if (!all && fs.existsSync(tarPath)) continue; // 已有 tar 备份的不在默认范围
      list.push({ id: c.id, file: f });
    }
  }
  if (ids.length > 0) {
    const wanted = new Set(ids);
    const filtered = list.filter((x) => wanted.has(x.id));
    for (const id of ids) {
      if (!filtered.some((x) => x.id === id)) console.warn(`[警告] id "${id}" 不在默认备份范围内（非 deployed 或已有 tar），跳过`);
    }
    return filtered;
  }
  return list;
}

// 远端已存在则跳过推送（重复执行本脚本时避免整批重推）
function remoteHas(owner, id) {
  const target = `ghcr.io/${owner}/ctf-${id}:latest`;
  const r = spawnSync('docker', ['manifest', 'inspect', target], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return r.status === 0;
}

const owner = resolveOwner();
const dryRun = process.argv.includes('--dry-run');
const list = buildTargetList();
list.sort((a, b) => a.file.localeCompare(b.file) || a.id.localeCompare(b.id));

console.log(`ghcr 命名空间: ${owner}；备份范围内共 ${list.length} 个镜像（ghcr.io/${owner}/ctf-<id>:latest，私有）\n`);
if (dryRun) {
  for (const x of list) console.log(`  [${x.file.replace('ctf-web-registry-', '').replace('.json', '')}] ${x.id}`);
  console.log('\n(dry-run 结束，未推送)');
  process.exit(0);
}

const failed = [];
const missingLocal = [];
let pushed = 0;
let skipped = 0;

for (const { id, file } of list) {
  const local = `localtrain/ctf-${id}:latest`;
  const target = `ghcr.io/${owner}/ctf-${id}:latest`;

  const inspect = spawnSync('docker', ['image', 'inspect', local], { stdio: ['ignore', 'pipe', 'pipe'] });
  if (inspect.status !== 0) {
    console.log(`[缺本地镜像] ${id}（${file}），无法备份，需从 docker/ctf-contests 源码重建`);
    missingLocal.push(id);
    continue;
  }
  if (remoteHas(owner, id)) {
    console.log(`[已存在，跳过] ${target}`);
    skipped++;
    continue;
  }
  const tag = spawnSync('docker', ['tag', local, target], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (tag.status !== 0) {
    console.error(`[tag 失败] ${id}: ${tag.stderr}`);
    failed.push(id);
    continue;
  }
  console.log(`[推送] ${target}`);
  const push = spawnSync('docker', ['push', target], { stdio: 'inherit' });
  if (push.status !== 0) {
    console.error(`[推送失败] ${id}——若报 unauthorized/permission denied 请先 docker login ghcr.io（PAT 需 write:packages）；若报 content digest not found，是 containerd 内容存储存在「有记录无数据」的陈旧 blob，从源码重建无法消除（相同内容会被去重），需 docker export（走快照）+ docker import 扁平化重建该镜像后重跑本脚本（import 时按原镜像 Config 重建 CMD/ENTRYPOINT/EXPOSE/ENV）`);
    failed.push(id);
    continue;
  }
  pushed++;
}

console.log(`\n========== 结果: 推送 ${pushed}，远端已存在跳过 ${skipped}，本地缺镜像 ${missingLocal.length}，失败 ${failed.length} ==========`);
if (missingLocal.length > 0) console.log('本地缺镜像（无 tar 且无本地标签，只能重建）:', missingLocal.join(', '));
if (failed.length > 0) console.log('推送失败（重跑本脚本可续传）:', failed.join(', '));
process.exit(failed.length > 0 ? 1 : 0);
