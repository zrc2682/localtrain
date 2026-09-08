import fs from 'fs';
import path from 'path';
import http from 'http';
import { randomUUID } from 'crypto';

const BASE = 'http://localhost:3000/api';
const WRITEUP_DIR = 'F:/Myprojects/CTF-Writeups/网络空间安全设计与实践/writeup';
const LOGIN = { username: 'admin', password: 'admin' };

function request(method, path_, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      `${BASE}${path_}`,
      { method, headers },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, data });
          }
        });
      }
    );
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

async function getExistingChallenges(token) {
  const res = await request('GET', '/challenges', null, {
    Authorization: `Bearer ${token}`,
  });
  if (res.status !== 200) throw new Error('获取题目列表失败');
  return new Set(res.data.map((c) => c.title));
}

function parseWriteup(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    console.error(`[读取失败] ${filePath}: ${e.message}`);
    return null;
  }

  // 1. 优先从 "题目标题：`xxx`" 提取
  const titleMatch = content.match(/题目标题[：:]\s*[`'"]?([^`'"\n]+)[`'"]?/);
  let title = titleMatch ? titleMatch[1].trim() : '';

  // 2. 取文件前 10 行中第一个看起来像标题的 # 行（跳过代码块内）
  if (!title) {
    const headLines = content.split(/\r?\n/).slice(0, 10);
    let inCodeBlock = false;
    for (const line of headLines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      if (inCodeBlock) continue;
      const m = line.match(/^#\s+(.+)$/);
      if (!m) continue;
      const candidate = m[1].trim();
      // 排除步骤/章节标题
      if (/^\d+\./.test(candidate)) continue;
      if (/^Step\s+\d+/i.test(candidate)) continue;
      if (candidate.length > 60) continue;
      title = candidate;
      break;
    }
  }

  // 3. 回退到文件名
  if (!title) {
    title = path.basename(filePath, path.extname(filePath));
  }

  // 提取 flag：不跨行、不含嵌套 `{`、长度合理
  const rawMatches = content.match(/flag\{[^\n}]+\}/g) || [];
  const flags = [
    ...new Set(
      rawMatches.filter((f) => {
        if (f.length > 100) return false;
        const inner = f.slice(5, -1);
        if (inner.includes('{') || inner.includes('}') || inner.includes('\n')) return false;
        return true;
      })
    ),
  ];

  return { title, flags };
}

function findAttachment(writeupPath, title) {
  const dir = path.dirname(writeupPath);
  const attachDir = path.join(dir, '题目附件');
  if (!fs.existsSync(attachDir)) return null;

  const files = fs.readdirSync(attachDir);
  const titleBase = title.replace(/[\/\\:*?"<>|]/g, '_');

  // exact match ignoring extension
  for (const f of files) {
    const name = path.parse(f).name.trim();
    if (name === titleBase) return path.join(attachDir, f);
  }

  // file name contains title or title contains file name
  for (const f of files) {
    const name = path.parse(f).name.trim();
    if (name.includes(titleBase) || titleBase.includes(name)) return path.join(attachDir, f);
  }

  // fuzzy: normalized
  for (const f of files) {
    const name = path.parse(f).name.trim();
    const n1 = name.replace(/\s+/g, '').toLowerCase();
    const n2 = titleBase.replace(/\s+/g, '').toLowerCase();
    if (n1 === n2 || n1.includes(n2) || n2.includes(n1)) return path.join(attachDir, f);
  }

  return null;
}

function buildMultipart(fields, files) {
  const boundary = `----FormBoundary${randomUUID().replace(/-/g, '')}`;
  const chunks = [];

  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      for (const v of value) {
        chunks.push(Buffer.from(`--${boundary}\r\n`));
        chunks.push(Buffer.from(`Content-Disposition: form-data; name="${key}"\r\n\r\n`));
        chunks.push(Buffer.from(String(v)));
        chunks.push(Buffer.from('\r\n'));
      }
    } else {
      chunks.push(Buffer.from(`--${boundary}\r\n`));
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${key}"\r\n\r\n`));
      chunks.push(Buffer.from(String(value)));
      chunks.push(Buffer.from('\r\n'));
    }
  }

  for (const [key, filePath] of Object.entries(files)) {
    const filename = path.basename(filePath);
    const data = fs.readFileSync(filePath);
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    chunks.push(Buffer.from(`Content-Disposition: form-data; name="${key}"; filename="${filename}"\r\n`));
    chunks.push(Buffer.from(`Content-Type: application/octet-stream\r\n\r\n`));
    chunks.push(data);
    chunks.push(Buffer.from('\r\n'));
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    body: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

async function createChallenge(token, challenge, attachmentPath) {
  const fields = {
    title: challenge.title,
    description: '',
    category: challenge.category,
    difficulty: 'medium',
    flags: challenge.flags.length > 0 ? challenge.flags : ['flag{待补充}'],
    image: '',
    port: 80,
  };
  const files = attachmentPath ? { attachments: attachmentPath } : {};
  const { body, contentType } = buildMultipart(fields, files);

  const res = await request('POST', '/challenges', body, {
    Authorization: `Bearer ${token}`,
    'Content-Type': contentType,
    'Content-Length': body.length,
  });
  return res;
}

async function main() {
  console.log('登录 admin...');
  const token = await login();
  console.log('获取已有题目...');
  const existing = await getExistingChallenges(token);

  const deployed = [];
  const unknownFlags = [];
  const skippedNoAttachment = [];
  const errors = [];

  const categories = ['Crypto', 'Misc', 'Pwn', 'Reverse', 'Web'];
  // 记录已覆盖的附件，避免把支撑文件重复部署为独立题目
  const coveredAttachments = new Set();

  for (const category of categories) {
    const dir = path.join(WRITEUP_DIR, category);
    if (!fs.existsSync(dir)) continue;

    const entries = fs.readdirSync(dir);
    // 跳过与 .md 同名的 .txt（避免把反编译日志当作题解）
    const mdBases = new Set(
      entries.filter((e) => path.extname(e).toLowerCase() === '.md').map((e) => path.basename(e, '.md'))
    );
    for (const entry of entries) {
      const ext = path.extname(entry).toLowerCase();
      if (ext !== '.md' && ext !== '.txt') continue;
      const base = path.basename(entry, ext);
      if (ext === '.txt' && mdBases.has(base)) continue;

      const writeupPath = path.join(dir, entry);
      const stat = fs.statSync(writeupPath);
      if (!stat.isFile()) continue;

      const parsed = parseWriteup(writeupPath);
      if (!parsed) {
        errors.push({ title: entry, category, error: '读取文件失败' });
        continue;
      }
      const { title, flags } = parsed;
      if (existing.has(title)) {
        console.log(`[跳过-已存在] ${title}`);
        continue;
      }

      const attachmentPath = findAttachment(writeupPath, title);
      if (!attachmentPath) {
        skippedNoAttachment.push({ title, category });
        console.log(`[跳过-无附件] ${title}`);
        continue;
      }

      const challenge = { title, category: category.toLowerCase(), flags };
      const res = await createChallenge(token, challenge, attachmentPath);
      coveredAttachments.add(attachmentPath);
      if (res.status === 200) {
        const hasUnknown = flags.length === 0;
        deployed.push({
          title,
          category,
          flagCount: hasUnknown ? 1 : flags.length,
          hasUnknown,
          attachment: path.basename(attachmentPath),
        });
        if (hasUnknown) {
          unknownFlags.push({ title, category, attachment: path.basename(attachmentPath) });
        }
        console.log(`[已部署] ${title} (${hasUnknown ? 'flag待补充' : flags.length + '个flag'})`);
      } else {
        errors.push({ title, category, error: res.data });
        console.error(`[失败] ${title}:`, res.data);
      }
    }
  }

  console.log('\n========== 部署完成 ==========');
  console.log(`成功部署: ${deployed.length} 题`);
  for (const c of ['Crypto', 'Misc', 'Pwn', 'Reverse', 'Web']) {
    const count = deployed.filter((d) => d.category === c).length;
    if (count > 0) console.log(`  ${c}: ${count}`);
  }

  if (unknownFlags.length > 0) {
    console.log(`\nflag 待补充 (${unknownFlags.length} 题):`);
    for (const u of unknownFlags) {
      console.log(`  - [${u.category}] ${u.title} (${u.attachment})`);
    }
  }

  if (skippedNoAttachment.length > 0) {
    console.log(`\n因无附件跳过 (${skippedNoAttachment.length} 题):`);
    for (const s of skippedNoAttachment) {
      console.log(`  - [${s.category}] ${s.title}`);
    }
  }

  if (errors.length > 0) {
    console.log(`\n部署失败 (${errors.length} 题):`);
    for (const e of errors) {
      console.log(`  - [${e.category}] ${e.title}: ${JSON.stringify(e.error)}`);
    }
  }

  // 部署有附件但无题解的题目框架
  const deployedOrphans = [];
  for (const category of categories) {
    const attachDir = path.join(WRITEUP_DIR, category, '题目附件');
    if (!fs.existsSync(attachDir)) continue;

    const writeupDir = path.join(WRITEUP_DIR, category);
    const writeupBases = new Set(
      fs
        .readdirSync(writeupDir)
        .filter((e) => ['.md', '.txt'].includes(path.extname(e).toLowerCase()))
        .map((e) => path.basename(e, path.extname(e)).trim())
    );

    for (const entry of fs.readdirSync(attachDir)) {
      const attachmentPath = path.join(attachDir, entry);
      const stat = fs.statSync(attachmentPath);
      if (!stat.isFile()) continue;
      if (coveredAttachments.has(attachmentPath)) continue;

      const base = path.basename(entry, path.extname(entry)).trim();
      if (writeupBases.has(base)) continue;

      if (existing.has(base)) {
        console.log(`[跳过-已存在] ${base}`);
        continue;
      }

      const challenge = {
        title: base,
        category: category.toLowerCase(),
        flags: [],
      };
      const res = await createChallenge(token, challenge, attachmentPath);
      if (res.status === 200) {
        deployed.push({
          title: base,
          category,
          flagCount: 1,
          hasUnknown: true,
          attachment: entry,
          orphan: true,
        });
        unknownFlags.push({ title: base, category, attachment: entry });
        deployedOrphans.push({ title: base, category, attachment: entry });
        console.log(`[已部署-无wp] ${base} (${entry})`);
      } else {
        errors.push({ title: base, category, error: res.data });
        console.error(`[失败-无wp] ${base}:`, res.data);
      }
    }
  }

  if (deployedOrphans.length > 0) {
    console.log(`\n有附件无题解的题目框架 (${deployedOrphans.length} 题):`);
    for (const o of deployedOrphans) {
      console.log(`  - [${o.category}] ${o.title} (${o.attachment})`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
