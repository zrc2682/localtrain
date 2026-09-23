#!/usr/bin/env node
// 备份平台活数据（dev.db + uploads）到 backups/<时间戳>/，默认保留最近 10 份。
// dev.db 优先用 SQLite VACUUM INTO 生成一致性快照（后端运行中也可安全备份），
// 失败时回退为直接文件复制（后端未运行时同样安全）。
// 用法：node scripts/backup-live-data.mjs [--keep N]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT, 'packages/server/prisma/dev.db');
const UPLOADS_DIR = path.join(ROOT, 'packages/server/uploads');
const BACKUP_ROOT = path.join(ROOT, 'backups');
const DEFAULT_KEEP = 10;

const keepIdx = process.argv.indexOf('--keep');
const KEEP = keepIdx > -1 ? Math.max(1, Number(process.argv[keepIdx + 1]) || DEFAULT_KEEP) : DEFAULT_KEEP;

function fmtSize(bytes) {
  if (bytes == null) return '?';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function dirSize(dir) {
  let total = 0;
  if (!fs.existsSync(dir)) return 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    total += entry.isDirectory() ? dirSize(p) : fs.statSync(p).size;
  }
  return total;
}

function localStamp(d = new Date()) {
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

if (!fs.existsSync(DB_PATH)) {
  console.error(`[备份失败] 未找到数据库文件: ${DB_PATH}`);
  process.exit(1);
}

const target = path.join(BACKUP_ROOT, localStamp());
fs.mkdirSync(target, { recursive: true });

// 1) dev.db：VACUUM INTO 快照优先，回退直接复制
let dbMethod = 'vacuum-into';
try {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const dest = path.join(target, 'dev.db').replace(/\\/g, '/');
  await prisma.$executeRawUnsafe(`VACUUM INTO '${dest}'`);
  await prisma.$disconnect();
} catch (e) {
  dbMethod = 'file-copy';
  fs.copyFileSync(DB_PATH, path.join(target, 'dev.db'));
  for (const suffix of ['-wal', '-shm']) {
    if (fs.existsSync(DB_PATH + suffix)) fs.copyFileSync(DB_PATH + suffix, path.join(target, `dev.db${suffix}`));
  }
}

// 2) uploads 附件目录
fs.cpSync(UPLOADS_DIR, path.join(target, 'uploads'), { recursive: true });

// 3) 按时间戳清理旧备份，保留最近 KEEP 份
const backups = fs
  .readdirSync(BACKUP_ROOT, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();
let pruned = 0;
while (backups.length > KEEP) {
  const oldest = backups.shift();
  fs.rmSync(path.join(BACKUP_ROOT, oldest), { recursive: true, force: true });
  pruned++;
}

console.log(`[备份完成] ${path.relative(ROOT, target)}`);
console.log(`  dev.db   : ${fmtSize(fs.statSync(path.join(target, 'dev.db')).size)} (${dbMethod})`);
console.log(`  uploads/ : ${fmtSize(dirSize(path.join(target, 'uploads')))} (${fs.readdirSync(path.join(target, 'uploads')).length} 个文件)`);
if (pruned > 0) console.log(`  已清理 ${pruned} 个旧备份（保留最近 ${KEEP} 份）`);
