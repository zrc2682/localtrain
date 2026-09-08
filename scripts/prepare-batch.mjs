import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const BUILD_SCRIPT = path.join(ROOT, 'docker', 'ctf-contests', 'build.sh');
const CTF_DIR = path.join(ROOT, 'docker', 'ctf-contests');
const TMP_DIR = path.join(ROOT, '.tmp');
const SRC_TMP = path.join(TMP_DIR, 'batch-src');
const IMAGE_DIR = path.join(ROOT, 'docker-images');

const registryPath = path.resolve(process.argv[2] || path.join(ROOT, 'docs', 'ctf-web-registry.json'));
const DRY_RUN = process.argv.includes('--dry-run');
const DO_IMPORT = process.argv.includes('--import');
const ALL = process.argv.includes('--all'); // 默认只处理 pending/failed，--all 处理全部
const FORCE = process.argv.includes('--force'); // 强制覆盖已有源码目录
const NO_PROXY = process.argv.includes('--no-proxy'); // 不使用代理直接连接 GitHub

// 若用户显式传了 HTTP_PROXY/HTTPS_PROXY 或 --no-proxy 则使用对应配置；否则让 git 走系统默认（不强制 127.0.0.1:7890）
const PROXY_ENV = NO_PROXY
  ? process.env
  : {
      ...process.env,
      ...(process.env.HTTP_PROXY ? { HTTP_PROXY: process.env.HTTP_PROXY } : {}),
      ...(process.env.HTTPS_PROXY ? { HTTPS_PROXY: process.env.HTTPS_PROXY } : {}),
    };

function normalizeRepo(repo) {
  return repo.replace(/[^a-zA-Z0-9._-]/g, '-');
}

function contestSlug(contest) {
  return contest
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...opts.env },
      ...opts,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${cmd} ${args.join(' ')} exited ${code}\n${stderr}\n${stdout}`));
      } else {
        resolve(stdout);
      }
    });
    child.on('error', reject);
  });
}

function log(level, msg) {
  const prefix = `[${level.toUpperCase()}]`;
  if (level === 'error') console.error(prefix, msg);
  else console.log(prefix, msg);
}

async function loadRegistry() {
  const raw = fs.readFileSync(registryPath, 'utf-8');
  return JSON.parse(raw);
}

function saveRegistry(registry) {
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

async function cloneRepo(repo) {
  const repoUrl = repo.includes('://') ? repo : `https://github.com/${repo}.git`;
  const slug = normalizeRepo(repo);
  const dest = path.join(SRC_TMP, slug);
  ensureDir(SRC_TMP);

  // 禁用本地 git 全局代理，避免 127.0.0.1:7890 不可达导致失败
  const gitBase = ['-c', 'http.proxy=', '-c', 'https.proxy='];

  if (fs.existsSync(dest)) {
    log('info', `仓库已存在，尝试更新: ${dest}`);
    try {
      await run('git', [...gitBase, '-C', dest, 'pull'], { env: PROXY_ENV });
      return dest;
    } catch (e) {
      log('warn', `git pull 失败，将重新 clone: ${e.message.split('\n')[0]}`);
      fs.rmSync(dest, { recursive: true, force: true });
    }
  }

  log('info', `Clone ${repoUrl} -> ${dest}`);
  await run('git', [...gitBase, 'clone', '--depth', '1', repoUrl, dest], { env: PROXY_ENV });
  return dest;
}

function copyRecursive(src, dest) {
  ensureDir(path.dirname(dest));
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    ensureDir(dest);
    for (const f of fs.readdirSync(src)) {
      copyRecursive(path.join(src, f), path.join(dest, f));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

async function ensureSourceDir(entry) {
  const cSlug = contestSlug(entry.contest);
  const targetDir = path.join(CTF_DIR, cSlug, entry.id);

  if (fs.existsSync(targetDir)) {
    if (!FORCE) {
      log('skip', `源码目录已存在: ${targetDir}`);
      return targetDir;
    }
    fs.rmSync(targetDir, { recursive: true, force: true });
  }

  // 1. 若 .tmp 下已有同比赛/同 id 或同名仓库，优先复用
  const repo = entry.source?.repo;
  const srcPath = entry.source?.path;
  let sourceDir = null;

  if (repo) {
    const repoSlug = normalizeRepo(repo);
    const repoRoot = path.join(SRC_TMP, repoSlug);
    if (fs.existsSync(repoRoot) && srcPath) {
      const inner = path.join(repoRoot, srcPath);
      if (fs.existsSync(inner)) sourceDir = inner;
    }

    if (!sourceDir) {
      // 在 .tmp 顶层以及 .tmp/batch*-src/ 子目录中模糊查找
      const candidates = [];
      if (fs.existsSync(TMP_DIR)) {
        for (const top of fs.readdirSync(TMP_DIR)) {
          const topPath = path.join(TMP_DIR, top);
          if (!fs.statSync(topPath).isDirectory()) continue;
          candidates.push(topPath);
          // 若顶层是 batch*-src 聚合目录，继续遍历一层子目录
          if (/^batch\d*-src$/i.test(top) || top.toLowerCase().endsWith('-src')) {
            for (const sub of fs.readdirSync(topPath)) {
              const subPath = path.join(topPath, sub);
              if (fs.statSync(subPath).isDirectory()) candidates.push(subPath);
            }
          }
        }
      }
      for (const candidate of candidates) {
        if (path.basename(candidate).toLowerCase().includes(repoSlug.toLowerCase())) {
          const inner = srcPath ? path.join(candidate, srcPath) : candidate;
          if (fs.existsSync(inner)) {
            sourceDir = inner;
            break;
          }
        }
      }
    }

    if (!sourceDir) {
      const cloned = await cloneRepo(repo);
      const inner = srcPath ? path.join(cloned, srcPath) : cloned;
      if (!fs.existsSync(inner)) {
        throw new Error(`仓库 ${repo} 中未找到路径: ${srcPath}`);
      }
      sourceDir = inner;
    }
  } else {
    throw new Error('登记表缺少 source.repo，无法自动下载');
  }

  ensureDir(path.dirname(targetDir));
  copyRecursive(sourceDir, targetDir);
  log('info', `源码已复制: ${sourceDir} -> ${targetDir}`);
  return targetDir;
}

function isTextFile(p) {
  const ext = path.extname(p).toLowerCase();
  const textExts = new Set([
    '.txt', '.md', '.json', '.js', '.ts', '.jsx', '.tsx', '.vue', '.html', '.css', '.scss',
    '.py', '.rb', '.php', '.sh', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
    '.sql', '.dockerfile', '.gitignore', '.env', '.cs', '.java', '.go', '.rs', '.c', '.cpp',
    '.h', '.hpp', '.xml', '.plist',
  ]);
  if (textExts.has(ext)) return true;
  if (path.basename(p).toLowerCase() === 'dockerfile') return true;
  return false;
}

function replaceInText(dir, placeholder, value) {
  let count = 0;
  function walk(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      const st = fs.statSync(p);
      if (st.isDirectory()) {
        if (f === '.git' || f === 'node_modules' || f === '__pycache__') continue;
        walk(p);
      } else if (st.isFile() && isTextFile(p)) {
        try {
          let content = fs.readFileSync(p, 'utf-8');
          if (content.includes(placeholder)) {
            content = content.split(placeholder).join(value);
            fs.writeFileSync(p, content, 'utf-8');
            count++;
          }
        } catch {
          // ignore
        }
      }
    }
  }
  walk(dir);
  return count;
}

async function applyFlag(entry, targetDir) {
  const flag = entry.flag;
  if (!flag) throw new Error('登记表缺少 flag');

  // 写入 flag.txt，很多题目通过 /flag 或 flag.txt 读取
  fs.writeFileSync(path.join(targetDir, 'flag.txt'), flag);
  log('info', `已写入 flag.txt`);

  const mech = (entry.flagMechanism || '').toLowerCase();
  const placeholders = [];
  if (mech.includes('flag_placeholder')) placeholders.push('FLAG_PLACEHOLDER');
  if (mech.includes('{{flag}}')) placeholders.push('{{FLAG}}');
  if (entry.notes?.includes('FLAG_PLACEHOLDER')) placeholders.push('FLAG_PLACEHOLDER');
  if (entry.notes?.includes('{{FLAG}}')) placeholders.push('{{FLAG}}');

  const seen = new Set();
  for (const ph of placeholders) {
    if (seen.has(ph)) continue;
    seen.add(ph);
    const n = replaceInText(targetDir, ph, flag);
    if (n > 0) log('info', `已替换占位符 "${ph}"（${n} 个文件）`);
  }
}

async function buildOne(entry) {
  const tarName = `localtrain_ctf-${entry.id}_latest.tar`;
  const tarPath = path.join(IMAGE_DIR, tarName);
  const NO_SAVE = process.argv.includes('--no-save') || process.env.NO_SAVE === '1';

  if (!FORCE && !NO_SAVE && fs.existsSync(tarPath)) {
    log('skip', `镜像归档已存在: ${tarPath}`);
    return { status: 'built' };
  }

  log('info', `开始构建: ${entry.id}`);
  try {
    // 将 Windows 反斜杠路径转为正斜杠，避免 bash 把反斜杠当转义字符
    const scriptPath = BUILD_SCRIPT.replace(/\\/g, '/');
    const env = NO_SAVE ? { ...process.env, NO_SAVE: '1' } : process.env;
    const output = await run('bash', [scriptPath, entry.id], { cwd: ROOT, env });
    if (process.argv.includes('--verbose')) {
      console.log(output);
    }
    if (!NO_SAVE && !fs.existsSync(tarPath)) {
      throw new Error('构建脚本执行完成但未找到导出的 tar 文件');
    }
    return { status: 'built' };
  } catch (e) {
    log('error', `${entry.id} 构建失败: ${e.message}`);
    return { status: 'failed', reason: e.message.split('\n')[0] };
  }
}

async function importRegistry(registryPath_) {
  log('info', '开始导入平台...');
  try {
    await run('node', [path.join(ROOT, 'import-ctf-contests.mjs'), registryPath_], { cwd: ROOT });
    return true;
  } catch (e) {
    log('error', `导入失败: ${e.message.split('\n')[0]}`);
    return false;
  }
}

async function main() {
  if (!fs.existsSync(registryPath)) {
    console.error('登记表不存在:', registryPath);
    process.exit(1);
  }

  const registry = await loadRegistry();
  const entries = registry.challenges || [];
  const toProcess = ALL ? entries : entries.filter((e) => e.status === 'pending' || e.status === 'failed');

  log('info', `共 ${entries.length} 道题，本次处理 ${toProcess.length} 道`);

  let changed = false;
  for (const entry of toProcess) {
    log('info', `\n========== ${entry.contest} / ${entry.title} (${entry.id}) ==========`);
    if (DRY_RUN) {
      log('dry-run', `将处理: ${entry.id}，当前状态 ${entry.status}`);
      continue;
    }

    try {
      const targetDir = await ensureSourceDir(entry);
      await applyFlag(entry, targetDir);
      const result = await buildOne(entry);
      entry.status = result.status;
      entry.built = result.status === 'built';
      if (result.reason) entry.reason = result.reason;
      else delete entry.reason;
      changed = true;
    } catch (e) {
      log('error', e.message);
      entry.status = 'failed';
      entry.reason = e.message;
      changed = true;
    }
  }

  if (changed && !DRY_RUN) {
    saveRegistry(registry);
    log('info', '登记表已回写');
  }

  if (DO_IMPORT && !DRY_RUN) {
    const ok = await importRegistry(registryPath);
    if (!ok) process.exit(1);
  }

  if (DRY_RUN) {
    log('info', 'dry-run 完成，未做实际修改');
  } else {
    log('info', '处理完成');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
