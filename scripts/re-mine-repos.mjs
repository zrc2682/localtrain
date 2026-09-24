// 重挖已挖掘比赛仓库中未部署的 web 题（带 Dockerfile）
// 用法: node scripts/re-mine-repos.mjs [工作目录，默认 .tmp/re-mine]
// 输出: 候选清单（repo、目录、标题猜测、dup 结论），供人工评估后写批次登记表
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT = process.cwd();
const WORK = path.resolve(process.argv[2] || path.join(ROOT, '.tmp', 're-mine'));
const TMP = path.join(ROOT, '.tmp');

// 与 import-ctf-contests 一致的标题归一化
const norm = (t) => String(t || '').toLowerCase().replace(/[-_\s]/g, '');

// 1. 载入已部署标题归一化集合 + 已部署 contest/title 键
const deployedNorms = new Set(
  fs.readFileSync(path.join(TMP, 'deployed-title-norms.txt'), 'utf8').split(/\r?\n/).filter(Boolean)
);
const deployedKeys = new Set(
  fs.readFileSync(path.join(TMP, 'deployed-challenge-keys.txt'), 'utf8').split(/\r?\n/).filter(Boolean)
);

// 2. 待重挖仓库（登记表中出现过的 source.repo，按引用次数排序取主要仓库）
const REPOS = [
  'XDSEC/MoeCTF_2025', 'XDSEC/MoeCTF_2024', 'XDSEC/MoeCTF_2023',
  'XDSEC/miniLCTF_2024', 'XDSEC/miniLCTF_2023',
  'X1cT34m/0xGame2025', 'X1cT34m/0xGame2024', 'X1cT34m/0xGame2023', 'X1cT34m/0xGame2022',
  'X1cT34m/NCTF2023', 'X1cT34m/NCTF2024',
  'pj-newstar/newstar-ctf-2025',
  'ProbiusOfficial/LitCTF', 'ProbiusOfficial/owasp2025-top10-ctf',
  'LamentXU123/myCTFchallenges',
  'BUPTMerak/TSCTF-J-2025',
  'saltedfisholdxu/XYCTF2025',
  'team-s2/ACTF-2026',
  'William957-web/My-CTF-Challenges',
  'ek1ng/My-CTF-Challenges',
  'susers/susctf-2024', 'susers/susctf-2025',
  'SVUCTF/SVUCTF-HELLOWORLD-2024',
  'hkcert-ctf/CTF-Challenges',
];
const ONLY = process.argv.slice(3); // 可选：只挖指定 repo（支持部分匹配）

fs.mkdirSync(WORK, { recursive: true });

function sh(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], ...opts });
}

function clone(repo) {
  const dest = path.join(WORK, repo.replace('/', '_'));
  if (fs.existsSync(path.join(dest, '.git'))) return dest;
  console.log(`[clone] ${repo}`);
  for (let i = 0; i < 3; i++) {
    try {
      sh(`git clone --depth 1 -q https://github.com/${repo}.git "${dest}"`);
      return dest;
    } catch (e) {
      console.log(`  retry ${i + 1}: ${String(e.message).split('\n')[0]}`);
      fs.rmSync(dest, { recursive: true, force: true });
    }
  }
  console.log(`  [跳过] 克隆失败 ${repo}`);
  return null;
}

// 3. 判断某 Dockerfile 所在目录是否是"web 题"候选
function challengeTitleFor(dockerfilePath, repoRoot) {
  // 只取目录部分，从最深往上找第一个"像题名"的目录（排除辅助目录与分类目录）
  const rel = path.relative(repoRoot, dockerfilePath).replace(/\\/g, '/');
  const parts = rel.split('/').slice(0, -1); // 去掉 Dockerfile 文件名本身
  const AUX = /^(env|deploy|deployment|src|source|sourcecode|docker|dist|build|app|files|attachments?|writeups?|exp|exploit|player|public|bin|scripts?|service|web_deploy|challenges?|game)$/i;
  for (let i = parts.length - 1; i >= 0; i--) {
    if (!AUX.test(parts[i])) return { title: parts[i], rel };
  }
  return { title: parts[parts.length - 1] || 'unknown', rel };
}

function isWebPath(rel) {
  return /(^|\/)web(\/|$)|(^|\/)www(\/|$)|(^|\/)Web(\/|$)/.test(rel);
}

const results = [];
for (const repo of REPOS) {
  if (ONLY.length && !ONLY.some((o) => repo.toLowerCase().includes(o.toLowerCase()))) continue;
  const dest = clone(repo);
  if (!dest) continue;
  // 找全部 Dockerfile
  let dfs = [];
  try {
    dfs = sh(`git -C "${dest}" ls-files -z`, { maxBuffer: 64 * 1024 * 1024 })
      .split('\0').filter((f) => /(^|\/)dockerfile$/i.test(f));
  } catch { continue; }
  for (const df of dfs) {
    const abs = path.join(dest, df);
    const { title, rel } = challengeTitleFor(df, dest);
    const nTitle = norm(title);
    // 排除明显非 web：路径带 pwn/misc/crypto 等一级分类（若能识别）
    const pathBlocked = /(^|\/)(pwn|misc|crypto|rev|reverse|re|forensics|blockchain|iot|ai)(\/|$)/i.test('/' + rel);
    const deployed = deployedNorms.has(nTitle);
    results.push({
      repo, title, rel, isWebPath: isWebPath(rel), pathBlocked, deployed,
      dup: deployed ? 'DEPLOYED' : '-',
    });
  }
}

// 4. 汇总输出：优先显示 web 路径且未部署的
const candidates = results.filter((r) => !r.pathBlocked && r.dup === '-');
const seen = new Set();
const unique = candidates.filter((r) => {
  const k = r.repo + '|' + norm(r.title);
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});
console.log(`\n===== 候选（web 路径优先，未部署，${unique.length} 个）=====`);
const sorted = unique.sort((a, b) => (b.isWebPath - a.isWebPath) || a.repo.localeCompare(b.repo));
for (const r of sorted) {
  console.log(`${r.isWebPath ? 'WEB ' : 'web?'} ${r.repo}  ::  ${r.rel}`);
}
fs.writeFileSync(path.join(WORK, 'candidates.json'), JSON.stringify(sorted, null, 1));
console.log(`\n已写入 ${path.join(WORK, 'candidates.json')}`);
