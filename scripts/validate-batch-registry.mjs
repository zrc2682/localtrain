import fs from 'fs';
import path from 'path';
import http from 'http';

// 批次登记表预检（硬性门禁）：在写 Dockerfile / 构建 / 导入之前运行，把问题挡在登记表阶段。
// 用法: node scripts/validate-batch-registry.mjs docs/ctf-web-registry-batchN.json [--api] [--allow-update]
//   --api           额外查询运行中的平台（API_BASE，默认 http://localhost:3008），检查与平台现有题目的归一化标题冲突
//   --allow-update  标题冲突降级为警告（仅当确认为有意更新旧题时使用）
// 退出码: 有 ERROR 则 1，否则 0。

const ROOT = process.cwd();
const DOCS = path.join(ROOT, 'docs');
const registryPath = path.resolve(process.argv[2] || '');
const USE_API = process.argv.includes('--api');
const ALLOW_UPDATE = process.argv.includes('--allow-update');
const API_BASE = `${process.env.API_BASE || 'http://localhost:3008'}/api`;

if (!registryPath || !fs.existsSync(registryPath)) {
  console.error('用法: node scripts/validate-batch-registry.mjs <登记表路径> [--api] [--allow-update]');
  process.exit(1);
}

// 与 import-ctf-contests.mjs 保持一致
function normalizeTitle(t) {
  return String(t || '').toLowerCase().replace(/[-_\s]/g, '');
}

const ID_RE = /^[a-z0-9][a-z0-9_-]*$/;
const FLAG_RE = /^flag\{[^}]{4,}\}$/;
const DIFFS = new Set(['easy', 'medium', 'hard', 'expert']);

function request(method, path_, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${API_BASE}${path_}`, { method, headers }, (res) => {
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

// 收集其他登记表中的 id / 归一化标题（含本批之外的 skipped/failed，同源题同样要避雷）
const otherIds = new Map(); // id -> file
const otherNorms = new Map(); // norm -> {title, contest, file, status}
for (const f of fs.readdirSync(DOCS).filter((f) => f.startsWith('ctf-web-registry') && f.endsWith('.json'))) {
  const fp = path.join(DOCS, f);
  if (path.resolve(fp) === registryPath) continue;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch {
    continue;
  }
  for (const c of data.challenges || []) {
    if (c.id && !otherIds.has(c.id)) otherIds.set(c.id, f);
    const norm = normalizeTitle(c.title);
    if (norm && !otherNorms.has(norm)) {
      otherNorms.set(norm, { title: c.title, contest: c.contest, contestNorm: normalizeTitle(c.contest), file: f, status: c.status });
    }
  }
}

function findDockerfile(dir) {
  const p = path.join(dir, 'Dockerfile');
  if (fs.existsSync(p)) return p;
  try {
    for (const sub of fs.readdirSync(dir)) {
      const sp = path.join(dir, sub);
      if (fs.statSync(sp).isDirectory() && fs.existsSync(path.join(sp, 'Dockerfile'))) return path.join(sp, 'Dockerfile');
    }
  } catch {
    // ignore
  }
  return null;
}

// ---- 历史构建坑的静态检查（坑位实录见 docs/ctf-web-challenges.md 各批构建备注）----

const CRLF_TEXT_RE = /\.(sh|py|js|ts|php|html?|css|conf|ini|ya?ml|json)$/i;

function readFileSafe(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

// 遍历目录中的常见文本文件（跳过 .git/node_modules 等，单文件上限 2MB）
function walkTextFiles(dir, fn) {
  const SKIP = new Set(['.git', 'node_modules', '__pycache__']);
  function walk(d, depth) {
    if (depth > 4) return;
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      let st;
      try { st = fs.statSync(p); } catch { continue; }
      if (st.isDirectory()) {
        if (!SKIP.has(f)) walk(p, depth + 1);
      } else if (st.isFile() && st.size < 2 * 1024 * 1024) {
        const base = f.toLowerCase();
        if (base !== 'dockerfile' && !CRLF_TEXT_RE.test(base)) continue;
        const content = readFileSafe(p);
        if (content !== null) fn(p, content);
      }
    }
  }
  walk(dir, 0);
}

function checkBuildPitfalls(e, dir, dockerfilePath) {
  // 1) CRLF：shell 脚本含 CRLF 会让容器 entrypoint 起不来（多批踩坑）
  const crlfFatal = [];
  const crlfWarn = [];
  walkTextFiles(dir, (p, content) => {
    if (!content.includes('\r\n')) return;
    if (/\.sh$/i.test(p)) crlfFatal.push(path.relative(dir, p));
    else if (crlfWarn.length < 5) crlfWarn.push(path.relative(dir, p));
  });
  if (crlfFatal.length > 0) {
    report('ERROR', e, `以下脚本含 CRLF 换行，容器会起不来，需转 LF: ${crlfFatal.slice(0, 5).join(', ')}${crlfFatal.length > 5 ? ` 等 ${crlfFatal.length} 个` : ''}`);
  } else if (crlfWarn.length > 0) {
    report('WARN', e, `以下文本文件含 CRLF 换行（一般不影响运行，可忽略）: ${crlfWarn.join(', ')}`);
  }

  const dockerfile = readFileSafe(dockerfilePath);
  if (!dockerfile) return;

  // 2) EXPOSE 与登记表 port 一致性：平台按登记表 port 做端口映射
  const exposes = new Set();
  for (const m of dockerfile.matchAll(/^\s*EXPOSE\s+(.+)$/gim)) {
    for (const tok of m[1].trim().split(/\s+/)) {
      const port = parseInt(tok, 10);
      if (Number.isInteger(port)) exposes.add(port);
    }
  }
  if (exposes.size > 0 && !exposes.has(e.port)) {
    report('WARN', e, `Dockerfile EXPOSE ${[...exposes].join('/')} 未包含登记表 port ${e.port}，端口映射会指向错误端口`);
  }

  // 3) flag 注入方式：build.sh 用 --build-arg FLAG 注入，需要 ARG FLAG 才生效
  if (e.flag) {
    if (/^\s*ENV\s+FLAG[=\s]/im.test(dockerfile)) {
      report('WARN', e, 'Dockerfile 使用 ENV FLAG：entrypoint 默认值可能覆盖注入值（历史坑），建议改为 ARG FLAG + RUN echo 写文件');
    }
    if (!/^\s*ARG\s+FLAG\b/im.test(dockerfile)) {
      report('WARN', e, 'Dockerfile 无 ARG FLAG，--build-arg 注入不生效；确认 flag 已通过源码内置/占位符替换等方式写入，否则平台 flag 提交会失败');
    }
  }
}

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const entries = registry.challenges || [];
const targetFile = path.basename(registryPath);

const batchIds = new Set();
const batchNorms = new Map(); // norm -> contestNorm
let errCount = 0;
let warnCount = 0;

function report(level, entry, msg) {
  if (level === 'ERROR') errCount++;
  if (level === 'WARN') warnCount++;
  console.log(`[${level}] ${entry?.id || entry?.title || '(unknown)'}: ${msg}`);
}

for (const e of entries) {
  const label = `${e.contest || '?'} / ${e.title || '?'} (${e.id || 'no-id'})`;
  console.log(`\n--- ${label} [${e.status || 'no-status'}]`);
  const skippedEntry = e.status === 'skipped' || e.status === 'failed';

  // 必填字段
  for (const k of ['id', 'title', 'contest', 'category', 'difficulty', 'port', 'image']) {
    if (e[k] === undefined || e[k] === null || e[k] === '') report('ERROR', e, `缺少必填字段 ${k}`);
  }
  if (!e.flag && !skippedEntry) report('ERROR', e, '缺少 flag');

  // 命名规范
  if (e.id && !ID_RE.test(e.id)) report('ERROR', e, `id "${e.id}" 不规范：仅允许小写字母/数字/-/_，且必须小写开头（Docker 镜像名不允许大写）`);
  if (e.category && e.category !== 'web') report('ERROR', e, `category 应为 web，当前为 "${e.category}"`);
  if (e.difficulty && !DIFFS.has(e.difficulty)) report('ERROR', e, `difficulty "${e.difficulty}" 非法`);
  if (e.port !== undefined && (!Number.isInteger(e.port) || e.port < 1 || e.port > 65535)) report('ERROR', e, `port ${e.port} 非法`);
  if (e.flag && !FLAG_RE.test(e.flag)) report('WARN', e, `flag "${e.flag}" 不符合 flag{...} 形式`);
  if (e.image && e.id && e.image !== `localtrain/ctf-${e.id}:latest`) report('WARN', e, `image "${e.image}" 与规范 localtrain/ctf-${e.id}:latest 不一致（历史遗留可忽略，新批次应遵守）`);

  // 批内重复
  if (e.id) {
    if (batchIds.has(e.id)) report('ERROR', e, '批内 id 重复');
    batchIds.add(e.id);
  }
  const norm = normalizeTitle(e.title);
  if (norm) {
    if (batchNorms.has(norm)) {
      const prevContest = batchNorms.get(norm);
      if (prevContest === normalizeTitle(e.contest)) report('ERROR', e, '批内同比赛同名重复');
      else report('WARN', e, '批内存在同名不同比赛的题目，导入时将各自创建新题，请确认标题足以区分');
    }
    batchNorms.set(norm, normalizeTitle(e.contest));
  }

  // 跨批次重复（id 精确 + 标题归一化）
  if (e.id && otherIds.has(e.id)) report('ERROR', e, `id 已在 ${otherIds.get(e.id)} 中存在`);
  if (norm && otherNorms.has(norm)) {
    const o = otherNorms.get(norm);
    const sameContest = o.contestNorm === normalizeTitle(e.contest);
    if (sameContest) {
      const msg = `同比赛同名冲突：${o.file} 已有 "${o.title}"(${o.contest}, ${o.status})；直接导入会被跳过，加 --allow-update 会覆盖对方`;
      if (ALLOW_UPDATE) report('WARN', e, msg);
      else report('ERROR', e, `${msg}；如确为有意更新旧题请加 --allow-update`);
    } else {
      report('WARN', e, `与 ${o.file} 的 "${o.title}"(${o.contest}, ${o.status}) 同名但比赛不同，导入时将作为新题创建；请确认不是同一比赛的不同译名`);
    }
  }

  // 源码目录与 Dockerfile
  if (e.dir) {
    const dir = path.join(ROOT, e.dir);
    if (!fs.existsSync(dir)) {
      report(skippedEntry ? 'WARN' : 'ERROR', e, `源码目录不存在: ${e.dir}`);
    } else {
      const dockerfilePath = findDockerfile(dir);
      if (!dockerfilePath) {
        report(skippedEntry ? 'WARN' : 'ERROR', e, `源码目录缺少 Dockerfile: ${e.dir}`);
      } else if (!skippedEntry) {
        checkBuildPitfalls(e, dir, dockerfilePath);
      }
    }
  } else if (!skippedEntry) {
    report('ERROR', e, '缺少 dir 字段');
  }
}

// 平台侧查重（可选）
if (USE_API) {
  try {
    const login = await request('POST', '/auth/login', JSON.stringify({ username: 'admin', password: 'admin' }), { 'Content-Type': 'application/json' });
    if (login.status !== 200) throw new Error('登录失败');
    const list = await request('GET', '/challenges', null, { Authorization: `Bearer ${login.data.token}` });
    const arr = Array.isArray(list.data) ? list.data : list.data.challenges || list.data.data || [];
    const platformNorms = new Map(arr.map((c) => [normalizeTitle(c.title), { title: c.title, contest: c.contest, contestNorm: normalizeTitle(c.contest) }]));
    console.log(`\n=== 平台侧查重（${arr.length} 道）===`);
    for (const e of entries) {
      const norm = normalizeTitle(e.title);
      if (norm && platformNorms.has(norm)) {
        const p = platformNorms.get(norm);
        const sameContest = p.contestNorm === normalizeTitle(e.contest);
        if (sameContest) {
          const msg = `平台已存在同比赛同名题目 "${p.title}"(${p.contest})，默认跳过、--allow-update 会覆盖该平台记录`;
          if (ALLOW_UPDATE) report('WARN', e, msg);
          else report('ERROR', e, `${msg}；如确为有意更新请加 --allow-update`);
        } else {
          report('WARN', e, `平台已有同名题目 "${p.title}"(${p.contest || '无比赛标签'})，与本题比赛不同，导入时将作为新题创建；请确认不是同一比赛的不同写法`);
        }
      }
    }
  } catch (e) {
    console.log(`\n[WARN] 平台侧查重跳过: ${e.message}`);
  }
}

console.log(`\n========== 预检结果: ${errCount} 个 ERROR, ${warnCount} 个 WARN（共 ${entries.length} 道） ==========`);
process.exit(errCount > 0 ? 1 : 0);
