import fs from 'fs';
import path from 'path';
import http from 'http';
import { randomUUID } from 'crypto';
import { execSync } from 'child_process';

const BASE = `${process.env.API_BASE || 'http://localhost:3008'}/api`;
const LOGIN = { username: 'admin', password: 'admin' };
const REGISTRY_FILE = path.resolve(process.argv[2] || path.join(process.cwd(), 'docs', 'ctf-web-registry.json'));
const TMP_DIR = path.join(process.cwd(), '.tmp');
// 平台按「标题归一化」判重：归一化标题相同的题目默认会被覆盖更新而非新建。
// 判重规则：
//   - 同比赛同名（比赛名同样归一化比较）：视为同一题，默认跳过不导入；确认有意更新旧题时加 --allow-update 覆盖。
//   - 不同比赛同名：允许导入，作为新题创建。
const ALLOW_UPDATE = process.argv.includes('--allow-update');

function request(method, path_, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${BASE}${path_}`, { method, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function login() {
  const res = await request('POST', '/auth/login', JSON.stringify(LOGIN), {
    'Content-Type': 'application/json',
  });
  if (res.status !== 200) throw new Error('登录失败: ' + JSON.stringify(res.data));
  return res.data.token;
}

function normalizeTitle(t) {
  return t.toLowerCase().replace(/[-_\s]/g, '');
}

function buildMultipart(fields, files) {
  const boundary = `----FormBoundary${randomUUID().replace(/-/g, '')}`;
  const chunks = [];
  for (const [key, value] of Object.entries(fields)) {
    const values = Array.isArray(value) ? value : [value];
    for (const v of values) {
      chunks.push(Buffer.from(`--${boundary}\r\n`));
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${key}"\r\n\r\n`));
      chunks.push(Buffer.from(String(v)));
      chunks.push(Buffer.from('\r\n'));
    }
  }
  for (const [key, filePath] of files) {
    const filename = path.basename(filePath);
    const data = fs.readFileSync(filePath);
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    chunks.push(Buffer.from(`Content-Disposition: form-data; name="${key}"; filename="${filename}"\r\n`));
    chunks.push(Buffer.from(`Content-Type: application/octet-stream\r\n\r\n`));
    chunks.push(data);
    chunks.push(Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

// 收集题目附件:优先目录内现成 zip;其次 attachments/ 散文件打 zip;
// 都没有则把题目源码整体打 zip(排除题解/利用脚本等会让选手直接看到答案的文件)
const ZIP_EXCLUDE = new Set(['.git', 'node_modules', '__pycache__', 'readme.md', 'wp.md', 'writeup', 'exp.py', 'exploit.py', 'exploit']);

function makeZip(zipPath, srcPaths) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  const psSrc = srcPaths.map((p) => `'${p.replace(/'/g, "''")}'`).join(',');
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path ${psSrc} -DestinationPath '${zipPath.replace(/'/g, "''")}'"`,
    { stdio: 'pipe' }
  );
  return fs.existsSync(zipPath) ? zipPath : null;
}

function makeSourceZip(zipPath, srcPaths, cwd) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  try {
    // 优先使用 zip 命令，可递归排除 node_modules 等目录
    const args = ['-r', '-q', zipPath, ...srcPaths.map((p) => path.basename(p)), '-x', '*/node_modules/*', '-x', '*/__pycache__/*', '-x', '*/.git/*'];
    execSync(`zip ${args.map((a) => `"${a}"`).join(' ')}`, { cwd, stdio: 'pipe' });
    return fs.existsSync(zipPath) ? zipPath : null;
  } catch {
    //  fallback 到 PowerShell，不做递归排除
    return makeZip(zipPath, srcPaths.map((p) => path.relative(process.cwd(), p)));
  }
}

function collectAttachments(entry) {
  const dir = path.join(process.cwd(), entry.dir);
  if (!fs.existsSync(dir)) return [];
  const zips = [];
  const walk = (d, depth) => {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      const st = fs.statSync(p);
      if (st.isDirectory() && depth < 2) walk(p, depth + 1);
      else if (st.isFile() && f.toLowerCase().endsWith('.zip')) zips.push(p);
    }
  };
  walk(dir, 0);
  if (zips.length > 0) return zips.slice(0, 3);

  const attDir = path.join(dir, 'attachments');
  if (fs.existsSync(attDir) && fs.statSync(attDir).isDirectory()) {
    const loose = fs.readdirSync(attDir).filter((f) => fs.statSync(path.join(attDir, f)).isFile());
    if (loose.length > 0) {
      const zip = makeZip(path.join(TMP_DIR, `${entry.id}-attachment.zip`), loose.map((f) => path.join(attDir, f)));
      if (zip) return [zip];
    }
  }

  // 兜底:题目源码整体打包,排除题解/利用脚本/版本管理目录
  const srcEntries = fs.readdirSync(dir)
    .filter((f) => !ZIP_EXCLUDE.has(f.toLowerCase()))
    .map((f) => path.join(dir, f));
  if (srcEntries.length > 0) {
    const zip = makeSourceZip(path.join(TMP_DIR, `${entry.id}-src.zip`), srcEntries, dir);
    if (zip) return [zip];
  }
  return [];
}

function buildDescription(entry) {
  if (entry.description && String(entry.description).trim()) {
    return String(entry.description).trim();
  }
  const lines = [`【${entry.contest}】比赛题`];
  if (entry.source?.url) lines.push(`题目来源:${entry.source.url}`);
  if (entry.writeup) lines.push(`Writeup:${entry.writeup}`);
  return lines.join('\n');
}

async function main() {
  const registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'));
  console.log('登录 admin...');
  const token = await login();

  const listRes = await request('GET', '/challenges', null, { Authorization: `Bearer ${token}` });
  if (listRes.status !== 200) throw new Error('获取题目列表失败');
  const existingByNorm = new Map(listRes.data.map((c) => [normalizeTitle(c.title), c]));

  for (const entry of registry.challenges) {
    if (entry.status === 'skipped' || entry.status === 'failed') continue;

    const tarName = `localtrain_ctf-${entry.id}_latest.tar`;
    const tarPath = path.join(process.cwd(), 'docker-images', tarName);
    if (!fs.existsSync(tarPath)) {
      console.warn(`[警告] 镜像归档不存在: docker-images/${tarName}(仍继续导入,启动时会尝试自动加载)`);
    }

    const fields = {
      title: entry.title,
      description: buildDescription(entry),
      category: entry.category || 'web',
      difficulty: entry.difficulty,
      contest: entry.contest,
      image: entry.image,
      port: entry.port,
      visible: 'true',
      flags: entry.flag,
    };

    const norm = normalizeTitle(entry.title);
    const existing = existingByNorm.get(norm);
    // 同名但不同比赛（比赛名同样归一化比较）：作为新题导入，不进入覆盖分支
    const sameContest = existing && normalizeTitle(existing.contest || '') === normalizeTitle(entry.contest || '');

    if (existing && sameContest) {
      if (!ALLOW_UPDATE) {
        // 不改写 status，仅记录原因：保持 pending 以便确认后加 --allow-update 重新导入
        console.log(`[跳过-同比赛同名] ${entry.title}：平台已存在同比赛同名题目 "${existing.title}"(${existing.id})，默认不覆盖；如确为有意更新旧题，请加 --allow-update`);
        entry.reason = `同比赛同名冲突：平台已有 "${existing.title}"；未导入。确认有意更新请加 --allow-update`;
        continue;
      }
      console.log(`[更新] ${entry.title} -> 覆盖平台已有题目 ${existing.id}（--allow-update）`);
      const res = await request('PUT', `/challenges/${existing.id}`, JSON.stringify({
        title: entry.title,
        description: fields.description,
        category: fields.category,
        difficulty: entry.difficulty,
        contest: entry.contest,
        image: entry.image,
        port: entry.port,
        visible: true,
        flags: [entry.flag],
      }), { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });
      entry.status = res.status === 200 ? 'deployed' : 'failed';
      if (res.status !== 200) entry.reason = JSON.stringify(res.data);
      else delete entry.reason;
      continue;
    }

    const attachments = collectAttachments(entry);
    if (existing && !sameContest) {
      console.log(`[新建-同名不同比赛] ${entry.title}：平台已有 "${existing.title}"(${existing.contest})，本题为 "${entry.contest}"，作为新题导入`);
    }
    console.log(`[新建] ${entry.title}(附件 ${attachments.length} 个)`);
    const { body, contentType } = buildMultipart(fields, attachments.map((p) => ['attachments', p]));
    const res = await request('POST', '/challenges', body, {
      Authorization: `Bearer ${token}`,
      'Content-Type': contentType,
      'Content-Length': body.length,
    });
    entry.status = res.status === 200 ? 'deployed' : 'failed';
    if (res.status !== 200) entry.reason = JSON.stringify(res.data);
    else delete entry.reason;
  }

  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2));
  console.log('\n========== 导入结果 ==========');
  for (const c of registry.challenges) {
    console.log(`[${c.status}] ${c.contest} / ${c.title}${c.reason ? ' - ' + c.reason : ''}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
