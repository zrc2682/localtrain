import fs from 'fs';
import http from 'http';
import { URL } from 'url';

const BASE = `${process.env.API_BASE || 'http://localhost:3008'}/api`;
const LOGIN = { username: 'user', password: 'user' };
const REGISTRY_FILE = 'docs/ctf-web-registry-batch30.json';

function request(method, path_, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE}${path_}`);
    const req = http.request(url, { method, headers }, (res) => {
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
  const res = await request('POST', '/auth/login', JSON.stringify(LOGIN), { 'Content-Type': 'application/json' });
  if (res.status !== 200) throw new Error('登录失败: ' + JSON.stringify(res.data));
  return res.data.token;
}

async function curlHostPort(hostPort, timeoutMs = 15000) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${hostPort}/`, { timeout: timeoutMs }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ ok: true, status: res.statusCode, body: data.slice(0, 200) }));
    });
    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'timeout' });
    });
  });
}

async function main() {
  const registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'));
  const token = await login();
  const listRes = await request('GET', '/challenges', null, { Authorization: `Bearer ${token}` });
  if (listRes.status !== 200) throw new Error('获取题目列表失败');

  const byTitle = new Map(listRes.data.map((c) => [c.title, c]));
  const results = [];

  for (const entry of registry.challenges) {
    if (entry.status === 'skipped' || entry.status === 'failed') continue;
    const challenge = byTitle.get(entry.title);
    if (!challenge) {
      results.push({ id: entry.id, title: entry.title, ok: false, error: '题目未找到' });
      continue;
    }

    const startRes = await request('POST', `/challenges/${challenge.id}/start`, null, { Authorization: `Bearer ${token}` });
    if (startRes.status !== 200) {
      results.push({ id: entry.id, title: entry.title, ok: false, error: '启动失败: ' + JSON.stringify(startRes.data) });
      continue;
    }

    const hostPort = startRes.data.hostPort;
    if (!hostPort) {
      results.push({ id: entry.id, title: entry.title, ok: false, error: '未分配 hostPort' });
      continue;
    }

    // 等待应用启动（Java/Spring 启动较慢）
    await new Promise((r) => setTimeout(r, 10000));
    const curl = await curlHostPort(hostPort);

    await request('POST', `/challenges/${challenge.id}/stop`, null, { Authorization: `Bearer ${token}` });

    results.push({ id: entry.id, title: entry.title, hostPort, ...curl });
  }

  console.log('\n========== 验证结果 ==========');
  for (const r of results) {
    if (r.ok) {
      console.log(`[OK] ${r.title} (port ${r.hostPort}) HTTP ${r.status}`);
    } else {
      console.log(`[FAIL] ${r.title} - ${r.error}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
