#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const tmpDir = path.join(rootDir, '.tmp');
const docsDir = path.join(rootDir, 'docs');

// Load all challenge registry files (CTF Web + CVE). CVE sources are rarely in .tmp,
// but including the registry keeps the cleanup consistent.
const registryFiles = fs.readdirSync(docsDir).filter(
  f => f.startsWith('ctf-web-registry') && f.endsWith('.json')
);
if (fs.existsSync(path.join(docsDir, 'cve-registry.json'))) {
  registryFiles.push('cve-registry.json');
}
const registries = registryFiles.map(f => path.join('docs', f));

// Protected working / candidate directories that should never be removed wholesale,
// even if their name accidentally resembles a deployed challenge or repo.
const protectedEntries = new Set([
  'archive_cn',
  'archive_cn.zip',
  'batch2',
  'batch6-downloads',
  'batch7-inspect',
  'deprecated_compare',
  'inspection',
  'qwb',
  'qwb2',
  'qwb8',
  'qwbs7-inspect',
  'qwbs8',
  'batch14',
  'batch15',
  'batch15-include-bak',
  'batch15-inspect',
  'batch16',
  'batch16-candidates',
  'batch16-dl',
  'batch16-downloads',
  'batch16-inspect',
  'batch17-downloads',
  'batch17-downloads2',
  'batch17-extract',
  'batch18-downloads',
  'batch18-inspect',
  'ctf-archives',
  'flatten',
  'longjian-extract',
  'newstar-ctf-2025-main',
  'ns24_all_category_extract',
  'ns24_page_extract',
  'qwbs8-extract',
  'scout',
]);

// Protected file extensions (logs, scripts, docs, registry snapshots, etc.).
const protectedExtensions = new Set([
  '.json', '.md', '.mjs', '.js', '.pdf', '.txt', '.log', '.html', '.atom', '.sh',
]);

// Stop words for token matching; pure years are handled separately.
const stopTokens = new Set([
  'challenges', 'web', 'release', 'attachments', 'src', 'source', 'master', 'main',
  'latest', 'finals', 'quals', 'qual', 'semis', 'semi', 'repo', 'archive', 'contest',
  'ctf', 'and', 'the', 'for', 'of', 'in', 'as', 'a', 'an', 'game',
  '2022', '2023', '2024', '2025', '2026',
]);

// Collect deployed challenges and repos
const deployedChallenges = new Map(); // id -> challenge
const repoAllChallenges = new Map(); // repo -> Set of challenge ids
const repoToChallenges = new Map(); // repo -> Set of deployed challenge ids

for (const reg of registries) {
  const regPath = path.join(rootDir, reg);
  if (!fs.existsSync(regPath)) {
    console.warn(`Registry not found, skipping: ${reg}`);
    continue;
  }
  const data = JSON.parse(fs.readFileSync(regPath, 'utf8'));
  for (const ch of data.challenges || []) {
    const repo = ch.source?.repo || '';
    if (!repoAllChallenges.has(repo)) repoAllChallenges.set(repo, new Set());
    repoAllChallenges.get(repo).add(ch.id);

    if (ch.status === 'deployed') {
      deployedChallenges.set(ch.id, ch);
      if (!repoToChallenges.has(repo)) repoToChallenges.set(repo, new Set());
      repoToChallenges.get(repo).add(ch.id);
    }
  }
}

function allRegistryChallengesDeployed(repo) {
  const allIds = repoAllChallenges.get(repo);
  if (!allIds || allIds.size === 0) return false;
  for (const id of allIds) {
    if (!deployedChallenges.has(id)) return false;
  }
  return true;
}

function stripExtension(name) {
  return name.replace(/\.(tar\.gz|tar\.bz2|tar\.xz|tar\.zst|src\.zip|source\.zip|zip|tar|tgz|bz2|gz|rar|7z)$/i, '');
}

function stripSuffixes(name) {
  return name.replace(/-(src|source|master|main|latest|download|downloads|expanded|tag|tags|v?\d+(\.\d+)*)$/i, '');
}

function normalize(s) {
  return s.toLowerCase().replace(/[-_\.\s]+/g, '');
}

function idTokens(s) {
  return s.toLowerCase().split(/[-_\.\s]+/).filter(t => t.length >= 2 && !/^\d{4}$/.test(t));
}

function repoTokens(s) {
  return s.toLowerCase().split(/[-_\.\s]+/).filter(t => t.length >= 3 && !stopTokens.has(t));
}

function extractYear(s) {
  const m = s.match(/\b(20\d{2})\b/);
  return m ? m[1] : null;
}

// 1. Full / partial id match: the normalized id appears as a substring of the entry name.
// This catches files like `2023-qwbs7-thinkshopping-src.zip` -> id `2023-qwbs7-thinkshopping`.
function findFullIdMatch(entryBase) {
  const baseNorm = normalize(entryBase);
  let bestId = null;
  let bestLen = 0;
  for (const [id, ch] of deployedChallenges) {
    const idNorm = normalize(id);
    if (idNorm.length < 3) continue;
    if (baseNorm.includes(idNorm)) {
      const significant = idNorm.length >= 6 || idNorm.length >= baseNorm.length * 0.5;
      if (significant && idNorm.length > bestLen) {
        bestLen = idNorm.length;
        bestId = id;
      }
    }
  }
  return bestId;
}

// 2. Challenge id token match: every token of the id must appear as a substring in the entry.
// Slightly looser than full id; useful for abbreviated source archives.
function findChallengeIdTokenMatch(entryBase) {
  const baseNorm = normalize(entryBase);
  let bestId = null;
  let bestScore = 0;

  for (const [id, ch] of deployedChallenges) {
    const tokens = idTokens(id);
    if (tokens.length > 0 && tokens.every(t => baseNorm.includes(t))) {
      const score = tokens.reduce((a, t) => a + t.length, 0);
      if (score > bestScore) {
        bestScore = score;
        bestId = id;
      }
    }
  }
  return bestId;
}

// 3. Source path token match: meaningful path segments from the registry appear in the entry.
function extractPathTokens(sourcePath) {
  const tokens = new Set();
  if (!sourcePath) return tokens;
  const parts = sourcePath.split(/[\\\/]+/);
  for (const part of parts) {
    const clean = part.trim();
    if (!clean) continue;
    const base = clean.replace(/\.(zip|tar\.gz|tar|tgz|rar|7z)$/i, '');
    const norm = normalize(base);
    if (norm.length >= 4 && !stopTokens.has(norm)) tokens.add(norm);
  }
  return tokens;
}

function findPathTokenMatch(entryBase) {
  const baseNorm = normalize(entryBase);
  let bestId = null;
  let bestTokenLen = 0;

  for (const [id, ch] of deployedChallenges) {
    const tokens = extractPathTokens(ch.source?.path || '');
    for (const t of tokens) {
      if (baseNorm.includes(t) || t.includes(baseNorm)) {
        if (t.length > bestTokenLen) {
          bestTokenLen = t.length;
          bestId = id;
        }
      }
    }
  }
  return bestId;
}

// 4. Repo match: full repo archive directories (e.g. `2025-ccb-ciscn-semis`).
function findRepoMatch(entryBase) {
  const baseNorm = normalize(entryBase);
  if (stopTokens.has(baseNorm)) return null;

  const baseTokens = repoTokens(entryBase);
  const baseYear = extractYear(entryBase);

  let best = null;
  for (const [repo, ids] of repoToChallenges) {
    const slug = repo.split('/').pop() || '';
    const slugNorm = normalize(slug);
    const repoTokensList = repoTokens(slug);
    const repoYear = extractYear(slug);

    if (repoYear && baseYear && repoYear !== baseYear) continue;

    let matched = false;
    let lcsLen = 0;

    if (baseNorm === slugNorm) {
      matched = true;
      lcsLen = baseNorm.length;
    } else if (baseNorm.length >= 5 && slugNorm.length >= 5 &&
               (baseNorm.includes(slugNorm) || slugNorm.includes(baseNorm))) {
      matched = true;
      lcsLen = Math.min(baseNorm.length, slugNorm.length);
    } else {
      const shared = baseTokens.filter(t => repoTokensList.includes(t));
      if (shared.length >= 2) {
        matched = true;
        lcsLen = shared.reduce((a, b) => a + b.length, 0);
      }
    }

    if (matched) {
      if (!best || lcsLen > best.lcsLen) {
        best = { repo, count: ids.size, lcsLen };
      }
    }
  }
  return best;
}

const entries = fs.readdirSync(tmpDir);
const toDelete = [];
const toKeep = [];

for (const entry of entries) {
  if (entry === '.' || entry === '..') continue;

  const ext = path.extname(entry).toLowerCase();
  const rawBase = stripExtension(path.basename(entry));
  const baseName = stripSuffixes(rawBase);

  if (protectedEntries.has(entry)) {
    toKeep.push({ entry, reason: 'protected working directory' });
    continue;
  }
  if (protectedExtensions.has(ext)) {
    toKeep.push({ entry, reason: 'protected extension' });
    continue;
  }

  // 1. Full id match.
  const fullIdMatch = findFullIdMatch(baseName);
  if (fullIdMatch) {
    toDelete.push({ entry, reason: `deployed challenge ${fullIdMatch} (full id)` });
    continue;
  }

  // 2. Id token match.
  const idMatch = findChallengeIdTokenMatch(baseName);
  if (idMatch) {
    toDelete.push({ entry, reason: `deployed challenge ${idMatch} (id tokens)` });
    continue;
  }

  // 3. Source path token match (disabled: too generic; e.g. `app.py` matched unrelated files).
  // Use id / repo matching instead, which is sufficient for top-level source archives.

  // 4. Repo match (for whole-repo directories/archives).
  const repoMatch = findRepoMatch(baseName);
  if (repoMatch) {
    if (repoMatch.count === 1 || allRegistryChallengesDeployed(repoMatch.repo)) {
      toDelete.push({ entry, reason: `repo ${repoMatch.repo} (${repoMatch.count} deployed, all registry entries deployed)` });
    } else {
      toKeep.push({ entry, reason: `multi-challenge repo ${repoMatch.repo} (${repoMatch.count} deployed entries)` });
    }
    continue;
  }

  toKeep.push({ entry, reason: 'no match' });
}

console.log('=== Plan: delete these .tmp/ entries ===');
for (const item of toDelete) {
  console.log(`  ${item.entry}  -> ${item.reason}`);
}

console.log(`\n=== Plan: keep these .tmp/ entries (${toKeep.length}) ===`);
for (const item of toKeep) {
  console.log(`  ${item.entry}  -> ${item.reason}`);
}

console.log(`\nTotal: ${toDelete.length} to delete, ${toKeep.length} to keep`);

const dryRun = process.argv.includes('--dry-run');
if (dryRun) {
  console.log('\nDry run: no files were deleted.');
  process.exit(0);
}

console.log('\nDeleting...');
for (const item of toDelete) {
  const fullPath = path.join(tmpDir, item.entry);
  fs.rmSync(fullPath, { recursive: true, force: true });
  console.log(`  deleted ${item.entry}`);
}

console.log('\nDone.');
