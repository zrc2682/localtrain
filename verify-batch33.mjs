import fs from 'fs';
import http from 'http';

const API_BASE = process.env.API_BASE || 'http://localhost:3008';
const REGISTRY = JSON.parse(fs.readFileSync('docs/ctf-web-registry-batch33.json', 'utf-8'));

function request(method, path_, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${API_BASE}${path_}`, { method, headers, timeout: 300000 }, (res) => {
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

async function login(role) {
  const login = role === 'admin' ? { username: 'admin', password: 'admin' } : { username: 'user', password: 'user' };
  const res = await request('POST', '/api/auth/login', JSON.stringify(login), { 'Content-Type': 'application/json' });
  if (res.status !== 200) throw new Error(`登录 ${role} 失败: ${JSON.stringify(res.data)}`);
  return res.data.token;
}

async function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    http.get(url, { headers, timeout: 30000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const adminToken = await login('admin');
  const listRes = await request('GET', '/api/challenges', null, { Authorization: `Bearer ${adminToken}` });
  if (listRes.status !== 200) throw new Error('获取题目列表失败');

  const titles = new Set(REGISTRY.challenges.map(c => c.title));
  const challenges = listRes.data.filter(c => titles.has(c.title));
  console.log(`匹配到 ${challenges.length} 道题`);

  const userToken = await login('user');
  const results = [];

  for (const c of challenges) {
    console.log(`\n[${c.title}] 启动环境...`);
    try {
      const startRes = await request('POST', `/api/challenges/${c.id}/start`, '', { Authorization: `Bearer ${userToken}` });
      if (startRes.status !== 200) {
        console.log(`  启动失败: ${JSON.stringify(startRes.data)}`);
        results.push({ title: c.title, ok: false, reason: '启动失败' });
        continue;
      }
      let status = startRes.data;
      let hostPort = status.hostPort;
      for (let i = 0; i < 30 && !hostPort; i++) {
        await sleep(1000);
        const s = await request('GET', `/api/challenges/${c.id}`, null, { Authorization: `Bearer ${userToken}` });
        status = s.data.status || {};
        hostPort = status.hostPort;
      }
      if (!hostPort) {
        console.log('  未获取到宿主机端口');
        results.push({ title: c.title, ok: false, reason: '未获取端口' });
        continue;
      }
      console.log(`  端口: ${hostPort}`);

      const url = `http://127.0.0.1:${hostPort}/`;
      const httpRes = await httpGet(url);
      if (httpRes.status !== 200 && httpRes.status !== 302 && httpRes.status !== 404) {
        console.log(`  HTTP 异常: ${httpRes.status}`);
        results.push({ title: c.title, ok: false, reason: `HTTP ${httpRes.status}` });
        await request('POST', `/api/challenges/${c.id}/stop`, '', { Authorization: `Bearer ${userToken}` });
        continue;
      }
      console.log(`  HTTP 正常: ${httpRes.status}`);

      const entry = REGISTRY.challenges.find(x => x.title === c.title);
      const submitRes = await request('POST', `/api/challenges/${c.id}/submit`, JSON.stringify({ index: 0, flag: entry.flag }), {
        Authorization: `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      });
      if (!submitRes.data.correct) {
        console.log(`  flag 提交失败: ${JSON.stringify(submitRes.data)}`);
        results.push({ title: c.title, ok: false, reason: 'flag 错误' });
      } else {
        console.log(`  flag 正确 ✓`);
        results.push({ title: c.title, ok: true });
      }

      await request('POST', `/api/challenges/${c.id}/stop`, '', { Authorization: `Bearer ${userToken}` });
    } catch (e) {
      console.log(`  异常: ${e.message}`);
      results.push({ title: c.title, ok: false, reason: e.message });
    }
  }

  console.log('\n========== 冒烟验证结果 ==========');
  for (const r of results) {
    console.log(`[${r.ok ? 'OK' : 'FAIL'}] ${r.title}${r.reason ? ' - ' + r.reason : ''}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
