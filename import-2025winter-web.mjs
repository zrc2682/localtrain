import fs from 'fs';
import path from 'path';
import http from 'http';
import { randomUUID, randomBytes } from 'crypto';

const BASE = process.env.API_BASE || 'http://localhost:3008/api';
const LOGIN = { username: 'admin', password: 'admin' };
const WRITEUP_DIR = 'F:/Myprojects/CTF-Writeups/2025冬季培训/Web';
const ATTACH_DIR = path.join(WRITEUP_DIR, '部分题目附件');
const FLAGS_FILE = path.join(process.cwd(), 'web-2025winter-flags.json');

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
  return res.data;
}

function normalizeTitle(t) {
  return t.toLowerCase().replace(/[-_\s]/g, '');
}

function generateFlag(slug) {
  const rand = randomBytes(6).toString('hex');
  return `flag{${slug}_${rand}}`;
}

function findAttachment(title) {
  if (!fs.existsSync(ATTACH_DIR)) return null;
  const files = fs.readdirSync(ATTACH_DIR);
  const titleBase = title.replace(/[\/\\:*?"<>|]/g, '_');
  const n2 = normalizeTitle(titleBase);

  for (const f of files) {
    const name = path.parse(f).name.trim();
    if (name === titleBase) return path.join(ATTACH_DIR, f);
  }
  for (const f of files) {
    const name = path.parse(f).name.trim();
    if (name.includes(titleBase) || titleBase.includes(name)) return path.join(ATTACH_DIR, f);
  }
  for (const f of files) {
    const name = path.parse(f).name.trim();
    const n1 = normalizeTitle(name);
    if (n1 === n2 || n1.includes(n2) || n2.includes(n1)) return path.join(ATTACH_DIR, f);
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

async function createChallenge(token, title, flag, attachmentPath) {
  const fields = {
    title,
    description: '',
    category: 'web',
    difficulty: 'medium',
    flags: flag,
    image: '',
    port: 80,
  };
  const files = attachmentPath ? { attachments: attachmentPath } : {};
  const { body, contentType } = buildMultipart(fields, files);
  return request('POST', '/challenges', body, {
    Authorization: `Bearer ${token}`,
    'Content-Type': contentType,
    'Content-Length': body.length,
  });
}

async function updateChallengeFlags(token, id, flag) {
  return request(
    'PUT',
    `/challenges/${id}`,
    JSON.stringify({ flags: [flag] }),
    {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
  );
}

async function main() {
  console.log('登录 admin...');
  const token = await login();
  console.log('获取已有题目...');
  const existing = await getExistingChallenges(token);
  const existingByNorm = new Map(existing.map((c) => [normalizeTitle(c.title), c]));

  // 部署目标：7 道新题 + 复用已有 Code_db
  const targets = [
    { title: 'ApacheNight', slug: 'apache_night' },
    { title: 'Canvas', slug: 'canvas' },
    { title: 'CyberAttack', slug: 'cyber_attack' },
    { title: 'FlaskCook', slug: 'flask_cook' },
    { title: 'FriendZone', slug: 'friend_zone' },
    { title: 'LaTeX', slug: 'latex' },
    { title: 'Code_db', slug: 'code_db' },
  ];

  const flagMapping = {};
  const results = [];

  for (const { title, slug } of targets) {
    const flag = generateFlag(slug);
    flagMapping[title] = flag;

    const norm = normalizeTitle(title);
    const existingChallenge = existingByNorm.get(norm);

    if (existingChallenge) {
      console.log(`[已存在] ${existingChallenge.title} -> 更新 flag`);
      const res = await updateChallengeFlags(token, existingChallenge.id, flag);
      if (res.status !== 200) {
        console.error(`[失败] 更新 ${title} flag:`, JSON.stringify(res.data));
        results.push({ title, status: 'update-failed', error: res.data });
      } else {
        results.push({ title, status: 'updated', id: existingChallenge.id, flag });
      }
      continue;
    }

    const attachmentPath = findAttachment(title);
    if (!attachmentPath) {
      console.warn(`[跳过-无附件] ${title}`);
      results.push({ title, status: 'no-attachment' });
      continue;
    }

    console.log(`[新建] ${title}: ${attachmentPath}`);
    const res = await createChallenge(token, title, flag, attachmentPath);
    if (res.status !== 200) {
      console.error(`[失败] 创建 ${title}:`, JSON.stringify(res.data));
      results.push({ title, status: 'create-failed', error: res.data });
    } else {
      results.push({ title, status: 'created', id: res.data.id, flag });
    }
  }

  fs.writeFileSync(FLAGS_FILE, JSON.stringify(flagMapping, null, 2));
  console.log(`\nflag 映射已写入 ${FLAGS_FILE}`);
  console.log(JSON.stringify(flagMapping, null, 2));

  console.log('\n========== 导入结果 ==========');
  for (const r of results) {
    console.log(`[${r.status}] ${r.title}${r.id ? ' id=' + r.id : ''}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
