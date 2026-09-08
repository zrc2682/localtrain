import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// 可复用的 Web 题候选扫描器：对给定目录下的 zip / 子目录逐个分类并查重，一次输出全部结论。
// 用法: node scripts/scan-web-candidates.mjs [扫描目录，默认 .tmp] [--out 结果.json]
// 输出列:
//   kind    web / pwn / misc / static / unknown
//   dup     YES=与已部署题目标题归一化相同; MAYBE=标题是某已部署键的子串（需人工确认）; -=新题
//   df      是否含 Dockerfile
// 筛选题目时先运行本脚本，只看 kind=web 且 dup=- 的行，避免逐个翻登记表查重。

const ROOT = process.cwd();
const SCAN_DIR = path.resolve(process.argv[2] || path.join(ROOT, '.tmp'));
const OUT_IDX = process.argv.indexOf('--out');
const OUT_FILE = OUT_IDX > -1 ? process.argv[OUT_IDX + 1] : null;

function normalizeTitle(t) {
  return String(t || '').toLowerCase().replace(/[-_\s]/g, '');
}

const TMP = path.join(ROOT, '.tmp');
let normSet = new Set();
let keyList = [];
try {
  normSet = new Set(fs.readFileSync(path.join(TMP, 'deployed-title-norms.txt'), 'utf8').split(/\r?\n/).filter(Boolean));
  keyList = fs.readFileSync(path.join(TMP, 'deployed-challenge-keys.txt'), 'utf8').split(/\r?\n/).filter(Boolean);
} catch {
  console.error('[WARN] 未找到查重索引，请先运行 node scripts/update-deployed-index.mjs；本次仅分类不查重');
}
const normKeys = keyList.map((k) => normalizeTitle(k));

const WEB_EXT = /\.(php|phtml|html?|js|ts|vue|jsx|tsx|py|rb|go|java|jsp|aspx?|cs)$/i;
const WEB_HINT = /(^|\/)(dockerfile|docker-compose\.ya?ml|nginx\.conf|httpd\.conf|package\.json|composer\.json|requirements\.txt|app\.py|main\.py|manage\.py|wsgi\.py|server\.js|index\.js|pom\.xml|build\.gradle|application\.properties|go\.mod|cargo\.toml|web\.xml|flag\.sh|entrypoint\.sh|start\.sh)$/i;
const BIN_EXT = /\.(exe|elf|bin|so|ko|apk|ipa|dmg|sys|drv|dat|dll)$/i;
const PWN_HINT = /(pwn|reverse|libc-[\d.]+\.so|ld-[\d.]+\.so|babyre|shellcode)/i;
const MISC_EXT = /\.(pcapng?|png|jpe?g|gif|bmp|wav|mp3|mp4|xlsx?|docx?|pptx?|pdf|txt|md|csv|zip|7z|tar|gz)$/i;

function zipFiles(zipPath) {
  try {
    const out = execSync(`unzip -l "${zipPath.replace(/"/g, '\\"')}"`, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    return out.split(/\r?\n/)
      .filter((l) => /^\s*\d+\s+/.test(l))
      .map((l) => l.replace(/^\s*\d+\s+\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}\s+/, '').trim())
      .filter((l) => l && !l.endsWith('/'));
  } catch (e) {
    return null; // 非 zip 或损坏
  }
}

function dirFiles(dir, limit = 400) {
  const files = [];
  const walk = (d) => {
    if (files.length >= limit) return;
    for (const f of fs.readdirSync(d)) {
      if (files.length >= limit) return;
      if (f === '.git' || f === 'node_modules' || f === '__pycache__') continue;
      const p = path.join(d, f);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else files.push(path.relative(dir, p).replace(/\\/g, '/'));
    }
  };
  walk(dir);
  return files;
}

function classify(files) {
  const lower = files.map((f) => f.toLowerCase());
  const hasDockerfile = lower.some((f) => /(^|\/)dockerfile$/.test(f));
  const webScore = files.filter((f) => WEB_EXT.test(f)).length + files.filter((f) => WEB_HINT.test(f)).length * 2;
  const binScore = files.filter((f) => BIN_EXT.test(f)).length + files.filter((f) => PWN_HINT.test(f)).length * 3;
  const miscOnly = files.length > 0 && files.every((f) => MISC_EXT.test(f));
  if (binScore > 0 && webScore === 0) return { kind: 'pwn', hasDockerfile };
  if (webScore === 0 && miscOnly) return { kind: 'misc', hasDockerfile };
  if (webScore === 0) return { kind: 'unknown', hasDockerfile };
  if (webScore > 0 && files.every((f) => /\.(html?|css|js|map|png|jpe?g|svg|woff2?|ico|txt|md)$/i.test(f) || f.includes('assets/'))) {
    return { kind: 'static', hasDockerfile }; // 纯前端静态页
  }
  return { kind: 'web', hasDockerfile };
}

function dupStatus(name) {
  const base = name.replace(/\.(zip|7z|tar|gz|jar|py|php|html?|js)$/i, '');
  const norm = normalizeTitle(base);
  if (!norm) return '-';
  if (normSet.has(norm)) return 'YES';
  // 附件名常带 比赛-阶段-题名 前缀（如 zjsdxs-finals-web2.php），按分隔符逐级取后缀比对已部署标题
  const segs = base.split(/[-_\s]+/).filter(Boolean);
  for (let i = 1; i < segs.length; i++) {
    const suffix = normalizeTitle(segs.slice(i).join(''));
    if (suffix && suffix.length >= 4 && normSet.has(suffix)) return `MAYBE(${suffix})`;
  }
  if (norm.length >= 4 && normKeys.some((k) => k.includes(norm))) return 'MAYBE(key)';
  return '-';
}

const PROTECTED = new Set(['node_modules', '.git', 'logs', 'scripts']);
const results = [];

function scanEntry(p) {
  const name = path.basename(p);
  const st = fs.statSync(p);
  let files = null;
  let type = null;
  if (st.isDirectory()) {
    if (PROTECTED.has(name)) return;
    files = dirFiles(p);
    type = 'dir';
  } else if (/\.(zip|jar)$/i.test(name)) {
    files = zipFiles(p);
    type = 'zip';
  } else if (/\.(py|php|js|html?)$/i.test(name)) {
    files = [name]; // 单文件
    type = 'file';
  } else {
    return;
  }
  if (!files || files.length === 0) {
    results.push({ path: path.relative(ROOT, p), type, kind: 'unknown', df: false, dup: dupStatus(name), files: 0 });
    return;
  }
  const { kind, hasDockerfile } = classify(files);
  results.push({ path: path.relative(ROOT, p), type, kind, df: hasDockerfile, dup: dupStatus(name), files: files.length });
}

// 扫描一层子项；若扫描目录本身是题目包（含 index.php/app.py 等），也作为一个候选
for (const name of fs.readdirSync(SCAN_DIR).sort()) {
  if (name.startsWith('.')) continue;
  scanEntry(path.join(SCAN_DIR, name));
}

const order = { web: 0, static: 1, unknown: 2, misc: 3, pwn: 4 };
results.sort((a, b) => order[a.kind] - order[b.kind] || a.path.localeCompare(b.path));

console.log(`扫描 ${SCAN_DIR}，共 ${results.length} 个候选；kind=web 且 dup=- 的行为可直接进入评估：\n`);
for (const r of results) {
  const mark = r.kind === 'web' && r.dup === '-' ? '  <== 可用' : '';
  console.log(`${r.kind.padEnd(7)} dup=${r.dup.padEnd(16)} df=${r.df ? 'Y' : '-'} files=${String(r.files).padStart(4)}  ${r.path}${mark}`);
}
if (OUT_FILE) {
  fs.writeFileSync(OUT_FILE, JSON.stringify({ scannedAt: new Date().toISOString(), dir: path.relative(ROOT, SCAN_DIR), results }, null, 2));
  console.log(`\n结果已写入 ${OUT_FILE}`);
}
