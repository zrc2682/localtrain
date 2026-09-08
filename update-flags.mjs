import fs from 'fs';
import path from 'path';
import http from 'http';

const BASE = 'http://localhost:3000/api';
const WRITEUP_DIR = 'F:/Myprojects/CTF-Writeups/网络空间安全设计与实践/writeup';
const LOGIN = { username: 'admin', password: 'admin' };

// 手写补充：题解里未显式给出最终 flag，但可推导或已知
const MANUAL_FLAGS = {
  传统派: ['flag{alohaoecaesarsssss}'],
};

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

function findWriteup(title) {
  const cats = ['Crypto', 'Misc', 'Pwn', 'Reverse', 'Web'];
  for (const cat of cats) {
    const dir = path.join(WRITEUP_DIR, cat);
    if (!fs.existsSync(dir)) continue;
    for (const e of fs.readdirSync(dir)) {
      if (path.extname(e).toLowerCase() !== '.md') continue;
      if (path.basename(e, '.md') === title) return path.join(dir, e);
    }
  }
  return null;
}

function extractFlags(content) {
  const rawMatches = content.match(/flag\{[^\n}]+\}/g) || [];
  return [
    ...new Set(
      rawMatches.filter((f) => {
        if (f.length > 100) return false;
        const inner = f.slice(5, -1);
        if (inner.includes('{') || inner.includes('}') || inner.includes('\n')) return false;
        return true;
      })
    ),
  ];
}

function isBadFlag(value) {
  return (
    value.includes('待补充') ||
    value.includes('\n') ||
    value.length > 100 ||
    /flag\{[^}]*\{/.test(value)
  );
}

async function main() {
  const token = await login();
  const res = await request('GET', '/challenges', null, {
    Authorization: `Bearer ${token}`,
  });
  if (res.status !== 200) throw new Error('获取题目失败');
  const challenges = res.data.filter((c) => c.title !== '示例题目');

  let updated = 0;
  let skipped = 0;
  let unchanged = 0;

  for (const c of challenges) {
    const currentFlags = c.flags.map((f) => f.value);
    const hasBad = currentFlags.some(isBadFlag);

    const writeupPath = findWriteup(c.title);
    let newFlags = [];
    if (writeupPath) {
      const content = fs.readFileSync(writeupPath, 'utf-8');
      newFlags = extractFlags(content);
    }
    if (newFlags.length === 0 && MANUAL_FLAGS[c.title]) {
      newFlags = MANUAL_FLAGS[c.title];
    }

    if (!hasBad && newFlags.length === 0) {
      unchanged++;
      continue;
    }

    if (newFlags.length === 0) {
      console.log(`[保持占位] ${c.title}`);
      skipped++;
      continue;
    }

    // 如果当前没有坏 flag 且新 flag 与旧 flag 相同，跳过
    if (!hasBad && JSON.stringify(currentFlags) === JSON.stringify(newFlags)) {
      unchanged++;
      continue;
    }

    const updateRes = await request(
      'PUT',
      `/challenges/${c.id}`,
      JSON.stringify({ flags: newFlags }),
      {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    );
    if (updateRes.status === 200) {
      console.log(`[已更新] ${c.title}: ${JSON.stringify(currentFlags)} -> ${JSON.stringify(newFlags)}`);
      updated++;
    } else {
      console.error(`[更新失败] ${c.title}:`, updateRes.data);
      skipped++;
    }
  }

  console.log(`\n更新完成: 更新 ${updated} 题, 跳过/保持 ${skipped} 题, 无变化 ${unchanged} 题`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
