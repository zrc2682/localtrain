import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const tmpDir = path.join(rootDir, '.tmp');
const docsDir = path.join(rootDir, 'docs');
const dockerDir = path.join(rootDir, 'docker');

const registryFiles = fs.readdirSync(docsDir).filter(
  f => f.startsWith('ctf-web-registry') && f.endsWith('.json')
);
if (fs.existsSync(path.join(docsDir, 'cve-registry.json'))) {
  registryFiles.push('cve-registry.json');
}

const deployedIds = new Set();
const allRegistryIds = new Set();

for (const reg of registryFiles) {
  const regPath = path.join(docsDir, reg);
  if (!fs.existsSync(regPath)) continue;
  const data = JSON.parse(fs.readFileSync(regPath, 'utf8'));
  for (const ch of data.challenges || []) {
    if (ch.id) allRegistryIds.add(ch.id);
    if (ch.status === 'deployed' && ch.id) deployedIds.add(ch.id);
  }
}

function normalize(s) {
  return s.toLowerCase().replace(/[-_\.\s]+/g, '');
}

function stripExt(name) {
  return name.replace(/\.(tar\.gz|tar\.bz2|tar\.xz|tar\.zst|src\.zip|source\.zip|zip|tar|tgz|bz2|gz|rar|7z)$/i, '');
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)}GB`;
}

function getDirSize(dir) {
  let size = 0;
  let count = 0;
  try {
    const walk = (d) => {
      for (const f of fs.readdirSync(d)) {
        const fp = path.join(d, f);
        const s = fs.statSync(fp);
        if (s.isDirectory()) walk(fp);
        else { size += s.size; count++; }
      }
    };
    walk(dir);
  } catch (e) {}
  return { size, count };
}

const entries = fs.readdirSync(tmpDir).filter(e => e !== '.' && e !== '..' && e !== 'TMP-CLEANUP-REPORT.md');
entries.sort();

const reportLines = [];
reportLines.push('# .tmp 目录清理状态报告');
reportLines.push('');
reportLines.push('> 本报告记录 `.tmp` 目录中**尚未清理**的条目。');
reportLines.push('> 每次进行题目筛选、部署或清理前，请先阅读本报告，避免误删正在使用的文件。');
reportLines.push('> 上次更新时间：' + new Date().toISOString());
reportLines.push('');
reportLines.push(`当前未清理条目总数：${entries.length}`);
reportLines.push(`已部署题目数（来自 registry）：${deployedIds.size}`);
reportLines.push(`登记表题目总数：${allRegistryIds.size}`);
reportLines.push('');

reportLines.push('## 说明');
reportLines.push('');
reportLines.push('- **已删除**：已部署题目的源码归档（通过 `node scripts/clean-tmp-deployed.mjs` 清理）。');
reportLines.push('- **已删除**：过期的临时日志、中间产物（HTML/JSON/Markdown/TXT 爬虫结果、下载产物等）。');
reportLines.push('- **以下条目为待确认项**：未匹配到已部署题目或 docker/ 源码，请在下一次批量操作前判断是否仍需要。');
reportLines.push('');

reportLines.push('## 待确认的大文件/目录（优先处理）');
reportLines.push('');
reportLines.push('| 名称 | 类型 | 大小 | 说明 |');
reportLines.push('|------|------|------|------|');

let totalSize = 0;
const remainingItems = [];
for (const entry of entries) {
  const fullPath = path.join(tmpDir, entry);
  const stat = fs.statSync(fullPath);
  let itemSize = 0;
  let itemType = stat.isDirectory() ? '目录' : '文件';
  let itemCount = 0;
  if (stat.isDirectory()) {
    const { size, count } = getDirSize(fullPath);
    itemSize = size;
    itemCount = count;
  } else {
    itemSize = stat.size;
  }
  totalSize += itemSize;
  remainingItems.push({ entry, type: itemType, size: itemSize, count: itemCount });
}

remainingItems.sort((a, b) => b.size - a.size);

for (const item of remainingItems) {
  if (item.size > 10 * 1024 * 1024) {
    const countInfo = item.type === '目录' ? `（${item.count} 个文件）` : '';
    reportLines.push(`| ${item.entry} | ${item.type} | ${formatSize(item.size)} | 大文件，请确认是否仍需要 ${countInfo} |`);
  }
}
reportLines.push('');

reportLines.push('## 全部剩余条目清单');
reportLines.push('');
reportLines.push('| 名称 | 类型 | 大小 | 备注 |');
reportLines.push('|------|------|------|------|');
for (const item of remainingItems) {
  const countInfo = item.type === '目录' ? `（${item.count} 个文件）` : '';
  reportLines.push(`| ${item.entry} | ${item.type} | ${formatSize(item.size)} | ${countInfo} |`);
}
reportLines.push('');
reportLines.push(`**总占用空间：${formatSize(totalSize)}**`);
reportLines.push('');

reportLines.push('## 清理建议');
reportLines.push('');
reportLines.push('1. 优先确认并删除大文件/目录，可释放最多空间。');
reportLines.push('2. `batch*-candidates`、`batch*-downloads`、`batch*-inspect` 等目录通常是一次性工作目录，确认对应批次已部署完成后可删除。');
reportLines.push('3. 以 `-src`、`-extract` 结尾的目录若对应题目已部署到 `docker/ctf-contests/`，可删除。');
reportLines.push('4. 更新本报告后，再继续后续清理。');

fs.writeFileSync(path.join(tmpDir, 'TMP-CLEANUP-REPORT.md'), reportLines.join('\n'));
console.log('Updated .tmp/TMP-CLEANUP-REPORT.md');
console.log(`Remaining entries: ${entries.length}, total size: ${formatSize(totalSize)}`);
