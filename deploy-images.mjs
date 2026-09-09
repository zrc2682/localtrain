import fs from 'fs';
import path from 'path';
import http from 'http';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE = process.env.API_BASE || 'http://localhost:3008/api';
const LOGIN = { username: 'admin', password: 'admin' };
const IMAGE_ARCHIVE_DIR = path.resolve(__dirname, 'docker-images');
const TEMP_DIR = path.resolve(__dirname, '.deploy-images-tmp');
const BUILD_TIMEOUT_MS = 8 * 60 * 1000;
const CONCURRENCY = 2;

// 2025 冬季培训 Web 题目部署目标（可通过 DEPLOY_TARGETS 环境变量覆盖）
const DEFAULT_TARGETS = [
  'ApacheNight',
  'Canvas',
  'CyberAttack',
  'FlaskCook',
  'FriendZone',
  'LaTeX',
  'Code_db',
];
const TARGET_TITLES = new Set(
  process.env.DEPLOY_TARGETS ? process.env.DEPLOY_TARGETS.split(',').map((s) => s.trim()) : DEFAULT_TARGETS
);

const FLAGS_FILE = path.resolve(__dirname, 'web-2025winter-flags.json');
let CHALLENGE_FLAGS = {};
if (fs.existsSync(FLAGS_FILE)) {
  try {
    CHALLENGE_FLAGS = JSON.parse(fs.readFileSync(FLAGS_FILE, 'utf-8'));
  } catch {
    CHALLENGE_FLAGS = {};
  }
}

if (!fs.existsSync(IMAGE_ARCHIVE_DIR)) {
  fs.mkdirSync(IMAGE_ARCHIVE_DIR, { recursive: true });
}
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

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

async function getChallenges(token) {
  const res = await request('GET', '/challenges', null, {
    Authorization: `Bearer ${token}`,
  });
  if (res.status !== 200) throw new Error('获取题目列表失败');
  return res.data;
}

async function getAttachments(token, challengeId) {
  const res = await request('GET', `/challenges/${challengeId}/attachments`, null, {
    Authorization: `Bearer ${token}`,
  });
  if (res.status !== 200) return [];
  return res.data;
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: BUILD_TIMEOUT_MS,
      ...opts,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('close', (code, signal) => {
      if (code !== 0) {
        const reason = signal ? `killed by ${signal}` : `exited ${code}`;
        reject(new Error(`${cmd} ${args.join(' ')} ${reason}\n${stderr}\n${stdout}`));
      } else {
        resolve(stdout);
      }
    });
    child.on('error', reject);
  });
}

async function dockerImageExists(image) {
  try {
    await run('docker', ['image', 'inspect', image]);
    return true;
  } catch {
    return false;
  }
}

async function pullIfMissing(image) {
  if (await dockerImageExists(image)) {
    console.log(`[缓存] 基础镜像已存在: ${image}`);
    return;
  }
  console.log(`[预热] 拉取基础镜像: ${image}`);
  try {
    await run('docker', ['pull', image]);
  } catch (e) {
    console.warn(`[警告] 拉取 ${image} 失败: ${e.message}`);
  }
}

async function ensurePwnBase() {
  const image = 'localtrain/pwn-base';
  if (await dockerImageExists(image)) return image;

  const baseDir = path.join(TEMP_DIR, 'pwn-base-' + randomUUID());
  fs.mkdirSync(baseDir, { recursive: true });
  fs.writeFileSync(
    path.join(baseDir, 'Dockerfile'),
    `FROM ubuntu:22.04
RUN apt-get update && apt-get install -y socat && rm -rf /var/lib/apt/lists/*
`
  );
  console.log('[预热] 构建 Pwn 基础镜像 localtrain/pwn-base');
  await run('docker', ['build', '-t', image, baseDir], { cwd: baseDir });
  fs.rmSync(baseDir, { recursive: true, force: true });
  return image;
}

function sh(p) {
  // 把 Windows 路径转成 MSYS2 风格，避免 tar 把 F:/... 当成远程主机
  const m = p.match(/^([A-Za-z]):([\\/].*)$/);
  if (m) {
    return '/' + m[1].toLowerCase() + m[2].replace(/\\/g, '/');
  }
  return p.replace(/\\/g, '/');
}

async function extract(archivePath, destDir) {
  const ext = path.extname(archivePath).toLowerCase();
  const beforeCount = fs.existsSync(destDir) ? fs.readdirSync(destDir).length : 0;
  const arc = sh(archivePath);
  const dst = sh(destDir);
  try {
    if (ext === '.zip') {
      await run('unzip', ['-o', '-q', arc, '-d', dst]);
    } else if (ext === '.tar') {
      await run('tar', ['-xf', arc, '-C', dst, '--no-same-owner']);
    } else if (['.gz', '.tgz'].includes(ext)) {
      await run('tar', ['-xzf', arc, '-C', dst, '--no-same-owner']);
    } else if (['.bz2'].includes(ext)) {
      await run('tar', ['-xjf', arc, '-C', dst, '--no-same-owner']);
    } else if (['.xz'].includes(ext)) {
      await run('tar', ['-xJf', arc, '-C', dst, '--no-same-owner']);
    } else {
      fs.copyFileSync(archivePath, path.join(destDir, path.basename(archivePath)));
    }
  } catch (e) {
    // 某些 unzip/tar 因文件名编码警告返回非 0，若文件已解压则忽略
    const afterCount = fs.existsSync(destDir) ? fs.readdirSync(destDir).length : 0;
    if (afterCount <= beforeCount) throw e;
    console.log(`  解压工具返回非 0，但文件已提取，继续`);
  }
}

function isHidden(name) {
  return name.startsWith('.') || name === '__MACOSX' || name.startsWith('._');
}

function isArchive(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ['.zip', '.tar', '.gz', '.tgz', '.bz2', '.xz', '.rar', '.7z'].includes(ext);
}

async function extractRecursive(archivePath, destDir) {
  await extract(archivePath, destDir);

  async function expandArchivesIn(dir) {
    let entries = fs.readdirSync(dir).filter((e) => !isHidden(e));
    // 如果当前目录里全是压缩包，全部解压
    if (entries.length > 0 && entries.every((e) => {
      const p = path.join(dir, e);
      return fs.statSync(p).isFile() && isArchive(p);
    })) {
      for (const e of entries) {
        const p = path.join(dir, e);
        await extractRecursive(p, dir);
        fs.unlinkSync(p);
      }
    }
    // 如果只有一个子目录，进入该子目录继续检查
    entries = fs.readdirSync(dir).filter((e) => !isHidden(e));
    if (entries.length === 1) {
      const sole = path.join(dir, entries[0]);
      if (fs.statSync(sole).isDirectory()) {
        await expandArchivesIn(sole);
      }
    }
  }

  await expandArchivesIn(destDir);
}

function liftSingleDirectory(extractDir, workDir) {
  const entries = fs.readdirSync(extractDir).filter((e) => !isHidden(e));
  if (entries.length === 1) {
    const sole = path.join(extractDir, entries[0]);
    if (fs.statSync(sole).isDirectory()) {
      const newDir = path.join(workDir, 'context');
      fs.mkdirSync(newDir, { recursive: true });
      for (const e of fs.readdirSync(sole)) {
        fs.renameSync(path.join(sole, e), path.join(newDir, e));
      }
      fs.rmSync(extractDir, { recursive: true, force: true });
      fs.renameSync(newDir, extractDir);
    }
  }
}

function findDockerfile(dir) {
  const candidates = ['Dockerfile', 'docker/Dockerfile', 'deploy/Dockerfile', 'src/Dockerfile'];
  for (const c of candidates) {
    const p = path.join(dir, c);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return path.resolve(p);
  }
  for (const e of fs.readdirSync(dir)) {
    const p = path.join(dir, e, 'Dockerfile');
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return path.resolve(p);
  }
  return null;
}

function listFiles(dir, depth = 2) {
  const files = [];
  function walk(d, currentDepth) {
    if (currentDepth > depth) return;
    for (const e of fs.readdirSync(d)) {
      const f = path.join(d, e);
      const s = fs.statSync(f);
      if (s.isDirectory()) walk(f, currentDepth + 1);
      else files.push(f);
    }
  }
  walk(dir, 0);
  return files;
}

function hasExt(dir, ext) {
  return listFiles(dir, 2).some((f) => path.extname(f).toLowerCase() === ext);
}

function findFile(dir, name) {
  for (const f of listFiles(dir, 3)) {
    if (path.basename(f) === name) return f;
  }
  return null;
}

function isElf(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(4);
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    return buf[0] === 0x7f && buf.toString('ascii', 1, 4) === 'ELF';
  } catch {
    return false;
  }
}

function findPwnBinary(dir) {
  const bins = listFiles(dir, 2).filter((f) => {
    const base = path.basename(f);
    if (base.startsWith('ld-linux') || base === 'libc.so.6' || base.endsWith('.so') || base.endsWith('.so.6')) return false;
    const s = fs.statSync(f);
    if (!s.isFile()) return false;
    return isElf(f);
  });
  if (bins.length === 0) return null;
  const rootBins = bins.filter((f) => path.dirname(f) === dir);
  if (rootBins.length > 0) return path.basename(rootBins[0]);
  return path.relative(dir, bins[0]).replace(/\\/g, '/');
}

function detectStack(dir, dockerfilePath) {
  if (dockerfilePath) {
    const content = fs.readFileSync(dockerfilePath, 'utf-8').toLowerCase();
    if (content.includes('php')) return 'php';
    if (content.includes('python')) return 'python';
    if (content.includes('node')) return 'node';
    if (content.includes('flask')) return 'python';
    return 'dockerfile';
  }
  if (hasExt(dir, '.php')) return 'php';
  if (findFile(dir, 'app.py') || findFile(dir, 'requirements.txt')) return 'python';
  if (findFile(dir, 'package.json')) return 'node';
  if (findPwnBinary(dir)) return 'pwn';
  return 'unknown';
}

function detectPort(dir, stack, dockerfilePath) {
  if (dockerfilePath) {
    const content = fs.readFileSync(dockerfilePath, 'utf-8');
    const m = content.match(/EXPOSE\s+(\d+)/i);
    if (m) return parseInt(m[1], 10);
  }
  const defaults = { php: 80, python: 5000, node: 3000, pwn: 9999, dockerfile: 80 };
  return defaults[stack] || 80;
}

function generateDockerfile(dir, stack, pwnBaseImage) {
  if (stack === 'php') {
    const index = findFile(dir, 'index.php');
    let copySource = '.';
    if (index) {
      const rel = path.relative(dir, path.dirname(index)).replace(/\\/g, '/');
      copySource = rel || '.';
    }
    fs.writeFileSync(
      path.join(dir, 'Dockerfile.generated'),
      `FROM php:8.2-apache
WORKDIR /var/www/html
COPY ${copySource} /var/www/html/
RUN chmod -R 755 /var/www/html
EXPOSE 80
`
    );
    return path.join(dir, 'Dockerfile.generated');
  }

  if (stack === 'python') {
    const app = findFile(dir, 'app.py') || findFile(dir, 'main.py');
    const entry = app ? path.relative(dir, app).replace(/\\/g, '/') : 'app.py';
    const req = findFile(dir, 'requirements.txt') ? 'requirements.txt' : '';
    const copySource = fs.existsSync(path.join(dir, 'src')) ? 'src' : '.';
    fs.writeFileSync(
      path.join(dir, 'Dockerfile.generated'),
      `FROM python:3.11-slim
WORKDIR /app
COPY ${copySource} /app/
${req ? 'RUN pip install --no-cache-dir -r ' + req + '\n' : ''}ENV FLASK_APP=${entry}
CMD ["python", "${entry}"]
EXPOSE 5000
`
    );
    return path.join(dir, 'Dockerfile.generated');
  }

  if (stack === 'node') {
    const pkg = findFile(dir, 'package.json');
    const copySource = pkg ? path.relative(dir, path.dirname(pkg)).replace(/\\/g, '/') : '.';
    fs.writeFileSync(
      path.join(dir, 'Dockerfile.generated'),
      `FROM node:18-slim
WORKDIR /app
COPY ${copySource} /app/
RUN npm install
CMD ["npm", "start"]
EXPOSE 3000
`
    );
    return path.join(dir, 'Dockerfile.generated');
  }

  if (stack === 'pwn') {
    const binary = findPwnBinary(dir);
    if (!binary) return null;
    const hasLibc = listFiles(dir, 2).some((f) => path.basename(f) === 'libc.so.6');
    const hasLd = listFiles(dir, 2).some((f) => path.basename(f).startsWith('ld-linux'));
    const runCmd = hasLibc && hasLd
      ? `./ld-linux-x86-64.so.2 --library-path . ./${binary}`
      : `./${binary}`;
    fs.writeFileSync(
      path.join(dir, 'Dockerfile.generated'),
      `FROM ${pwnBaseImage}
WORKDIR /app
COPY . /app/
RUN chmod +x /app/${binary}
RUN printf '#!/bin/sh\\ncd /app\\n${runCmd}\\n' > /app/run.sh && chmod +x /app/run.sh
CMD ["socat", "TCP-LISTEN:9999,reuseaddr,fork", "EXEC:/app/run.sh"]
EXPOSE 9999
`
    );
    return path.join(dir, 'Dockerfile.generated');
  }

  return null;
}

function findFlagFiles(dir) {
  return listFiles(dir, 3).filter((f) => path.basename(f) === 'flag.txt');
}

async function patchSqliteFlag(dbPath, flag) {
  const workDir = path.dirname(dbPath);
  const scriptPath = path.join(workDir, '__update_flag__.py');
  fs.writeFileSync(
    scriptPath,
    `import sqlite3
conn = sqlite3.connect('/data/cooking.sqlite')
c = conn.cursor()
c.execute("UPDATE user SET password = ?", (${JSON.stringify(flag)},))
conn.commit()
conn.close()
`
  );
  const dataVol = sh(workDir);
  await run('docker', [
    'run', '--rm',
    '-v', `${dataVol}:/data`,
    'python:3.11-slim',
    'python', '/data/__update_flag__.py',
  ]);
  fs.unlinkSync(scriptPath);
}

async function patchChallengeFlag(extractDir, title, flag) {
  if (!flag) return;

  if (title === 'FlaskCook') {
    const db = findFile(extractDir, 'cooking.sqlite');
    if (db) {
      console.log(`  更新 FlaskCook SQLite flag: ${db}`);
      await patchSqliteFlag(db, flag);
    }
    return;
  }

  if (title === 'Code_db') {
    const codeSamples = path.join(extractDir, 'src', 'code_samples', 'flag.txt');
    if (fs.existsSync(codeSamples)) {
      console.log(`  更新 Code_db flag: ${codeSamples}`);
      fs.writeFileSync(codeSamples, flag);
    }
    return;
  }

  if (title === 'FriendZone') {
    // FriendZone 原附件里同时有 web 服务（friendzone/）和 bot（bot/），
    // 平台每次只启动一个容器，所以把 bot 的 cron 逻辑合并进 web 镜像。
    const botDir = path.join(extractDir, 'bot');
    const dockerfileDir = path.join(extractDir, 'friendzone');
    const dockerfilePath = path.join(dockerfileDir, 'Dockerfile');
    if (!fs.existsSync(dockerfilePath)) {
      console.warn(`  未找到 friendzone/Dockerfile，跳过 FriendZone 特殊处理`);
      return;
    }

    if (fs.existsSync(botDir)) {
      for (const f of fs.readdirSync(botDir)) {
        if (f.toLowerCase() === 'dockerfile') continue;
        fs.copyFileSync(path.join(botDir, f), path.join(dockerfileDir, f));
      }
    }

    const cronPath = path.join(dockerfileDir, 'cron.sh');
    fs.writeFileSync(
      cronPath,
      `#!/bin/bash\nwhile true; do\n  curl -s -X POST -d "secret=\${FLAG}" http://localhost/\n  sleep 60\ndone\n`
    );

    const startPath = path.join(dockerfileDir, 'start.sh');
    fs.writeFileSync(
      startPath,
      `#!/bin/sh\n/cron.sh &\napache2-foreground\n`
    );

    fs.appendFileSync(
      dockerfilePath,
      `\nCOPY cron.sh /cron.sh\nCOPY start.sh /start.sh\nRUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*\nENV FLAG="${flag}"\nRUN chmod +x /cron.sh /start.sh\nCMD ["/start.sh"]\n`
    );
    console.log(`  更新 FriendZone flag 并注入启动脚本`);
    return dockerfilePath;
  }

  const flagFiles = findFlagFiles(extractDir);
  for (const f of flagFiles) {
    console.log(`  更新 flag: ${f}`);
    fs.writeFileSync(f, flag);
  }
}

function makeImageName(title, id) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length < 3 || !/[a-z]/.test(slug)) {
    return `localtrain/c-${id.slice(0, 8)}`;
  }
  return `localtrain/${slug}`;
}

function writeDockerignore(contextDir) {
  const p = path.join(contextDir, '.dockerignore');
  if (fs.existsSync(p)) return;
  fs.writeFileSync(
    p,
    `node_modules
.git
__pycache__
.DS_Store
*.tar
*.zip
`
  );
}

async function buildImage(imageName, contextDir, dockerfilePath) {
  // 如果 Dockerfile 在子目录，优先以子目录为上下文构建（CTF 附件通常把构建上下文打包在子目录里）
  if (dockerfilePath && path.dirname(dockerfilePath) !== contextDir) {
    const subContext = path.dirname(dockerfilePath);
    writeDockerignore(subContext);
    try {
      console.log(`  以子目录为上下文构建: ${subContext}`);
      await run('docker', ['build', '-t', imageName, subContext], { cwd: subContext });
      return;
    } catch (e) {
      console.log(`  子目录构建失败，回退到根目录上下文`);
    }
  }

  writeDockerignore(contextDir);
  const args = ['build', '-t', imageName];
  if (dockerfilePath && path.dirname(dockerfilePath) !== contextDir) {
    args.push('-f', dockerfilePath);
  } else if (dockerfilePath && path.basename(dockerfilePath) !== 'Dockerfile') {
    args.push('-f', dockerfilePath);
  }
  args.push(contextDir);
  await run('docker', args, { cwd: contextDir });
}

async function saveImage(imageName) {
  const archiveName = imageName.replace(/[^a-zA-Z0-9._-]/g, '_') + '.tar';
  const archivePath = path.join(IMAGE_ARCHIVE_DIR, archiveName);
  await run('docker', ['save', '-o', archivePath, imageName]);
  return archivePath;
}

async function updateChallenge(token, challengeId, image, port) {
  const res = await request(
    'PUT',
    `/challenges/${challengeId}`,
    JSON.stringify({ image, port }),
    {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
  );
  return res;
}

async function withConcurrency(items, fn, limit) {
  const results = [];
  const executing = [];
  for (const [i, item] of items.entries()) {
    const p = Promise.resolve().then(() => fn(item, i));
    results.push(p);
    if (items.length >= limit) {
      const e = p.then(() => {});
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
        executing.splice(executing.findIndex((x) => x === e), 1);
      }
    }
  }
  return Promise.all(results);
}

async function processChallenge(c, token, pwnBaseImage, results) {
  console.log(`\n--- 处理 [${c.category}] ${c.title} ---`);
  if (c.image) {
    const archiveName = c.image.replace(/[^a-zA-Z0-9._-]/g, '_') + '.tar';
    if (fs.existsSync(path.join(IMAGE_ARCHIVE_DIR, archiveName))) {
      console.log(`[跳过-已配置镜像] ${c.title}: ${c.image}`);
      results.skipped.push({ title: c.title, reason: '已配置镜像' });
      return;
    }
  }

  const attachments = await getAttachments(token, c.id);
  if (!attachments || attachments.length === 0) {
    console.log(`[跳过-无附件] ${c.title}`);
    results.skipped.push({ title: c.title, reason: '无附件' });
    return;
  }

  const att = attachments[0];
  if (!fs.existsSync(att.path)) {
    console.log(`[跳过-附件路径不存在] ${c.title}: ${att.path}`);
    results.skipped.push({ title: c.title, reason: '附件路径不存在' });
    return;
  }

  const workDir = path.join(TEMP_DIR, randomUUID());
  fs.mkdirSync(workDir, { recursive: true });
  const extractDir = path.join(workDir, 'extracted');
  fs.mkdirSync(extractDir, { recursive: true });

  try {
    console.log(`解压附件: ${att.originalName}`);
    await extractRecursive(att.path, extractDir);
    liftSingleDirectory(extractDir, workDir);

    let dockerfilePath = findDockerfile(extractDir);
    const stack = detectStack(extractDir, dockerfilePath);
    console.log(`检测到栈: ${stack}${dockerfilePath ? ' (含 Dockerfile)' : ''}`);

    if (stack === 'unknown') {
      console.log(`[跳过-无法识别栈] ${c.title}`);
      results.skipped.push({ title: c.title, reason: '无法识别栈' });
      return;
    }

    if (!dockerfilePath) {
      dockerfilePath = generateDockerfile(extractDir, stack, pwnBaseImage);
      if (!dockerfilePath) {
        console.log(`[跳过-生成 Dockerfile 失败] ${c.title}`);
        results.skipped.push({ title: c.title, reason: '生成 Dockerfile 失败' });
        return;
      }
      console.log(`生成 Dockerfile: ${dockerfilePath}`);
    }

    const port = detectPort(extractDir, stack, dockerfilePath);

    // 注入本次生成的 flag
    const flag = CHALLENGE_FLAGS[c.title];
    let effectiveDockerfile = dockerfilePath;
    if (flag) {
      const patched = await patchChallengeFlag(extractDir, c.title, flag);
      if (patched) effectiveDockerfile = patched;
    }

    const imageName = makeImageName(c.title, c.id);

    console.log(`构建镜像: ${imageName} (port ${port})`);
    await buildImage(imageName, extractDir, effectiveDockerfile);

    // 默认不执行 docker save；本地镜像足够平台运行。如需归档可传入 --save
    let archivePath = null;
    if (process.argv.includes('--save')) {
      console.log(`导出镜像归档...`);
      archivePath = await saveImage(imageName);
    }

    console.log(`更新题目 image/port...`);
    const updateRes = await updateChallenge(token, c.id, imageName, port);
    if (updateRes.status !== 200) {
      throw new Error('更新题目失败: ' + JSON.stringify(updateRes.data));
    }

    results.success.push({ title: c.title, image: imageName, port, archive: archivePath });
    console.log(`[成功] ${c.title} -> ${imageName}:${port}`);
  } catch (e) {
    console.error(`[失败] ${c.title}:`, e.message.split('\n')[0]);
    results.failed.push({ title: c.title, error: e.message });
  } finally {
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

async function main() {
  console.log('登录 admin...');
  const token = await login();
  console.log('获取题目列表...');
  const challenges = await getChallenges(token);

  const targetChallenges = challenges.filter(
    (c) => TARGET_TITLES.size === 0 || TARGET_TITLES.has(c.title)
  );

  console.log(`\n预热基础镜像...`);
  await Promise.all([
    pullIfMissing('python:3.11-slim'),
    pullIfMissing('node:18-slim'),
    pullIfMissing('php:8.2-apache'),
    pullIfMissing('ubuntu:22.04'),
  ]);

  const pwnBaseImage = await ensurePwnBase();

  console.log(`\n开始处理 ${targetChallenges.length} 道 Web/Pwn 题目（并发 ${CONCURRENCY}）...`);
  const results = { success: [], skipped: [], failed: [] };

  await withConcurrency(
    targetChallenges,
    (c) => processChallenge(c, token, pwnBaseImage, results),
    CONCURRENCY
  );

  console.log('\n========== 镜像部署完成 ==========');
  console.log(`成功: ${results.success.length}`);
  for (const s of results.success) {
    console.log(`  [成功] ${s.title}: ${s.image}:${s.port}`);
  }
  console.log(`\n跳过: ${results.skipped.length}`);
  for (const s of results.skipped) {
    console.log(`  [跳过] ${s.title}: ${s.reason}`);
  }
  console.log(`\n失败: ${results.failed.length}`);
  for (const f of results.failed) {
    console.log(`  [失败] ${f.title}: ${f.error.split('\n')[0]}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
