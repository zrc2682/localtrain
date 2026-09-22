import fs from 'fs';
import path from 'path';
import http from 'http';
import net from 'net';
import { spawnSync } from 'child_process';

// 批次冒烟验证工具（Runbook 第 4 步构建冒烟 + 第 6 步平台验证二合一，每批通用，无需再仿写副本）
// 用法: node scripts/verify-batch.mjs <登记表路径> [--preimport] [--keep]
//   默认(平台验证，需后端已启动，API_BASE 默认 http://localhost:3008):
//     以 user 身份逐题 启动环境 → HTTP 探活(自动重试，适配慢启动应用) → 提交 flag → 重置本人进度 → 停环境。
//     默认验证后调用重置接口清掉 user 的解题记录，避免验证污染账号/榜单；--keep 可保留。
//   --preimport: 构建-导入前的纯 Docker 冒烟，不碰平台: docker run -P 随机端口 → HTTP 探活 → 停止删除。
//   退出码: 有失败项则 1。

const API_BASE = process.env.API_BASE || 'http://localhost:3008';
const REGISTRY_PATH = path.resolve(process.argv[2] || '');
const PREIMPORT = process.argv.includes('--preimport');
const KEEP = process.argv.includes('--keep');
const PROBE_TRIES = 15; // 端口就绪后 HTTP 探活重试次数
const PROBE_INTERVAL_MS = 2000;

if (!REGISTRY_PATH || !fs.existsSync(REGISTRY_PATH)) {
  console.error('用法: node scripts/verify-batch.mjs <登记表路径> [--preimport] [--keep]');
  process.exit(1);
}
const REGISTRY = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));

function request(method, path_, body, headers = {}, timeout = 300000) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${API_BASE}${path_}`, { method, headers, timeout }, (res) => {
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
    req.on('timeout', () => { req.destroy(new Error('请求超时')); });
    if (body) req.write(body);
    req.end();
  });
}

// HTTP 探活：收到任意状态码都算服务存活（连接层失败才重试），返回最终状态码或 null
async function httpProbe(url) {
  for (let i = 0; i < PROBE_TRIES; i++) {
    if (i > 0) await sleep(PROBE_INTERVAL_MS);
    try {
      const status = await new Promise((resolve, reject) => {
        http.get(url, { timeout: 10000 }, (res) => {
          res.resume();
          resolve(res.statusCode);
        }).on('error', reject);
      });
      return status;
    } catch {
      // 连接未就绪，重试
    }
  }
  // HTTP 探测全失败,降级 TCP 端口探测(nc 类题目):TCP 可连即视为服务存活
  const m2 = url.match(/:(\d+)/);
  if (m2 && (await new Promise((res) => {
    const s = net.connect({ host: '127.0.0.1', port: Number(m2[1]), timeout: 4000 }, () => { s.destroy(); res(true); });
    s.on('error', () => res(false));
    s.on('timeout', () => { s.destroy(); res(false); });
  }))) return 'TCP';
  return null;
}

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function login(role) {
  const creds = role === 'admin' ? { username: 'admin', password: 'admin' } : { username: 'user', password: 'user' };
  const res = await request('POST', '/api/auth/login', JSON.stringify(creds), { 'Content-Type': 'application/json' });
  if (res.status !== 200) throw new Error(`登录 ${role} 失败: ${JSON.stringify(res.data)}`);
  return res.data.token;
}

// --preimport: 纯 Docker 冒烟，返回 {ok, reason}
async function preimportCheck(entry) {
  const image = entry.image;
  if (spawnSync('docker', ['image', 'inspect', image], { stdio: 'ignore' }).status !== 0) {
    return { ok: false, reason: '本地镜像不存在' };
  }
  const run = spawnSync('docker', ['run', '-d', '--rm', '-P', image], { encoding: 'utf8' });
  if (run.status !== 0) {
    return { ok: false, reason: `docker run 失败: ${(run.stderr || '').trim().split('\n')[0]}` };
  }
  const cid = run.stdout.trim();
  try {
    const portOut = spawnSync('docker', ['port', cid, `${entry.port}/tcp`], { encoding: 'utf8' });
    if (portOut.status !== 0) return { ok: false, reason: `容器未暴露端口 ${entry.port}` };
    const m = portOut.stdout.match(/:(\d+)\s*$/m);
    if (!m) return { ok: false, reason: `无法解析宿主机端口: ${portOut.stdout.trim()}` };
    const hostPort = m[1];
    const status = await httpProbe(`http://127.0.0.1:${hostPort}/`);
    return status === null ? { ok: false, reason: 'HTTP 探活失败(服务未响应)' } : { ok: true, reason: `HTTP ${status}` };
  } finally {
    spawnSync('docker', ['stop', cid], { stdio: 'ignore' }); // --rm 自动删除
  }
}

async function main() {
  const entries = (REGISTRY.challenges || []).filter((e) => e.status !== 'skipped' && e.status !== 'failed');
  console.log(`登记表 ${process.argv[2]}：待验证 ${entries.length} 道（模式: ${PREIMPORT ? 'preimport Docker 冒烟' : '平台验证'}${KEEP ? '，验证后保留进度' : '，验证后重置进度'}）`);

  const results = [];

  if (PREIMPORT) {
    for (const entry of entries) {
      console.log(`\n[${entry.title}] docker 冒烟...`);
      const r = await preimportCheck(entry);
      console.log(`  ${r.ok ? '通过' : '失败'}${r.reason ? `: ${r.reason}` : ''}`);
      results.push({ title: entry.title, ok: r.ok, reason: r.reason });
    }
  } else {
    const adminToken = await login('admin');
    const listRes = await request('GET', '/api/challenges', null, { Authorization: `Bearer ${adminToken}` });
    if (listRes.status !== 200) throw new Error('获取题目列表失败');
    const byTitle = new Map(listRes.data.map((c) => [c.title + "|" + (c.contest || ""), c]));

    const userToken = await login('user');
    for (const entry of entries) {
      console.log(`\n[${entry.title}] 启动环境...`);
      const c = byTitle.get(entry.title + "|" + (entry.contest || "")) || byTitle.get(entry.title);
      if (!c) {
        console.log('  平台未找到该题（未导入或标题不一致）');
        results.push({ title: entry.title, ok: false, reason: '平台未找到' });
        continue;
      }
      try {
        const startRes = await request('POST', `/api/challenges/${c.id}/start`, '', { Authorization: `Bearer ${userToken}` });
        if (startRes.status !== 200) {
          console.log(`  启动失败: ${JSON.stringify(startRes.data)}`);
          results.push({ title: c.title, ok: false, reason: '启动失败' });
          continue;
        }
        let hostPort = startRes.data.hostPort;
        for (let i = 0; i < 30 && !hostPort; i++) {
          await sleep(1000);
          const s = await request('GET', `/api/challenges/${c.id}`, null, { Authorization: `Bearer ${userToken}` });
          hostPort = (s.data.status || {}).hostPort;
        }
        if (!hostPort) {
          console.log('  未获取到宿主机端口');
          results.push({ title: c.title, ok: false, reason: '未获取端口' });
          continue;
        }
        console.log(`  端口: ${hostPort}`);

        const status = await httpProbe(`http://127.0.0.1:${hostPort}/`);
        if (status === null) {
          console.log('  HTTP 探活失败(重试后仍无响应)');
          results.push({ title: c.title, ok: false, reason: 'HTTP 探活失败' });
        } else {
          console.log(`  HTTP 正常: ${status}`);
          const submitRes = await request('POST', `/api/challenges/${c.id}/submit`, JSON.stringify({ index: 0, flag: entry.flag }), {
            Authorization: `Bearer ${userToken}`,
            'Content-Type': 'application/json',
          });
          if (submitRes.data.correct) {
            console.log('  flag 正确 ✓');
            results.push({ title: c.title, ok: true });
          } else {
            console.log(`  flag 提交失败: ${JSON.stringify(submitRes.data)}`);
            results.push({ title: c.title, ok: false, reason: 'flag 错误' });
          }
        }

        // 重置本人进度（清掉验证产生的解题记录并停容器）；reset 自带停容器，这里再兜底 stop 一次
        if (!KEEP) {
          const resetRes = await request('POST', `/api/challenges/${c.id}/reset`, '', { Authorization: `Bearer ${userToken}` });
          if (resetRes.status !== 200) console.log(`  [警告] 重置进度失败: ${JSON.stringify(resetRes.data)}`);
        }
        await request('POST', `/api/challenges/${c.id}/stop`, '', { Authorization: `Bearer ${userToken}` });
      } catch (e) {
        console.log(`  异常: ${e.message}`);
        results.push({ title: c.title, ok: false, reason: e.message });
      }
    }
  }

  console.log('\n========== 冒烟验证结果 ==========');
  for (const r of results) {
    console.log(`[${r.ok ? 'OK' : 'FAIL'}] ${r.title}${r.reason ? ' - ' + r.reason : ''}`);
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n共 ${results.length} 道，通过 ${results.length - failed}，失败 ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
