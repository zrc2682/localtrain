import fs from 'fs';
import path from 'path';

// 从所有 docs/ctf-web-registry*.json 重新生成查重索引（单一事实来源）：
//   .tmp/deployed-contests.txt        已部署比赛名（每行一个）
//   .tmp/deployed-challenge-keys.txt  已部署题目键 contest/title（每行一个）
//   .tmp/deployed-title-norms.txt     已部署题目标题的归一化形式（平台判重所用形式）
// 并同步 .deployed-challenges/<比赛名>/<题目名>/ 空文件夹索引。
// 用法: node scripts/update-deployed-index.mjs [--prune]
//   --prune  额外删除 .deployed-challenges 中无对应 deployed 登记表条目的空文件夹

const ROOT = process.cwd();
const DOCS = path.join(ROOT, 'docs');
const TMP = path.join(ROOT, '.tmp');
const INDEX = path.join(ROOT, '.deployed-challenges');
const PRUNE = process.argv.includes('--prune');

// 与 import-ctf-contests.mjs 的 normalizeTitle 保持一致（平台判重形式）
export function normalizeTitle(t) {
  return String(t || '').toLowerCase().replace(/[-_\s]/g, '');
}

// Windows 目录名非法字符替换为 _（与既有索引写法一致，如 "Wait What?" -> "Wait What_"）
function safeDirName(name) {
  return String(name || '').replace(/[<>:"/\\|?*]/g, '_');
}

const registryFiles = fs.readdirSync(DOCS)
  .filter((f) => f.startsWith('ctf-web-registry') && f.endsWith('.json'))
  .sort();

const deployed = [];
const skipped = [];
for (const f of registryFiles) {
  const data = JSON.parse(fs.readFileSync(path.join(DOCS, f), 'utf8'));
  for (const c of data.challenges || []) {
    if (c.status === 'deployed') deployed.push({ ...c, _file: f });
    else if (c.status === 'skipped' || c.status === 'failed') skipped.push({ ...c, _file: f });
  }
}

const contests = [...new Set(deployed.map((c) => c.contest).filter(Boolean))].sort();
const keys = deployed.map((c) => `${c.contest}/${c.title}`).sort();
const norms = [...new Set(deployed.map((c) => normalizeTitle(c.title)))].sort();

fs.mkdirSync(TMP, { recursive: true });
fs.writeFileSync(path.join(TMP, 'deployed-contests.txt'), contests.join('\n') + '\n');
fs.writeFileSync(path.join(TMP, 'deployed-challenge-keys.txt'), keys.join('\n') + '\n');
fs.writeFileSync(path.join(TMP, 'deployed-title-norms.txt'), norms.join('\n') + '\n');

// 同步 .deployed-challenges 空文件夹索引
fs.mkdirSync(INDEX, { recursive: true });
let created = 0;
for (const c of deployed) {
  const dir = path.join(INDEX, safeDirName(c.contest), safeDirName(c.title));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    created++;
  }
}

let pruned = 0;
if (PRUNE) {
  const valid = new Set(deployed.map((c) => `${safeDirName(c.contest)}/${safeDirName(c.title)}`));
  for (const contestDir of fs.readdirSync(INDEX)) {
    const cPath = path.join(INDEX, contestDir);
    if (!fs.statSync(cPath).isDirectory()) continue;
    for (const titleDir of fs.readdirSync(cPath)) {
      const tPath = path.join(cPath, titleDir);
      if (!fs.statSync(tPath).isDirectory()) continue;
      if (valid.has(`${contestDir}/${titleDir}`)) continue;
      // 只删除空目录，避免误删
      if (fs.readdirSync(tPath).length === 0) {
        fs.rmdirSync(tPath);
        pruned++;
      } else {
        console.log(`[保留-非空] ${contestDir}/${titleDir}（登记表无对应 deployed 条目，请人工确认）`);
      }
    }
    if (fs.readdirSync(cPath).length === 0) fs.rmdirSync(cPath);
  }
}

console.log(`登记文件 ${registryFiles.length} 个；deployed ${deployed.length} 道；skipped/failed ${skipped.length} 道`);
console.log(`已写入 .tmp/deployed-contests.txt (${contests.length})、.tmp/deployed-challenge-keys.txt (${keys.length})、.tmp/deployed-title-norms.txt (${norms.length})`);
console.log(`.deployed-challenges 同步：新建 ${created} 个空文件夹${PRUNE ? `，清理 ${pruned} 个失效空文件夹` : '（--prune 可清理失效空文件夹）'}`);
