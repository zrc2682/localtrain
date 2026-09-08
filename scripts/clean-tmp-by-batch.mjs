import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const docsDir = path.join(rootDir, 'docs');
const tmpDir = path.join(rootDir, '.tmp');

const registryFiles = fs.readdirSync(docsDir).filter(
  f => f.startsWith('ctf-web-registry') && f.endsWith('.json')
);

const fullyDeployedBatches = new Set();
const batchRegistryMap = new Map();

for (const f of registryFiles) {
  const data = JSON.parse(fs.readFileSync(path.join(docsDir, f), 'utf8'));
  const challenges = data.challenges || [];
  const total = challenges.length;
  const deployed = challenges.filter(c => c.status === 'deployed').length;
  const pending = challenges.filter(c => c.status !== 'deployed').length;
  const m = f.match(/batch([\d\w]+)/);
  if (!m) continue;
  const batchKey = m[1];
  batchRegistryMap.set(batchKey, { total, deployed, pending });
  if (total > 0 && pending === 0) {
    fullyDeployedBatches.add(batchKey);
  }
}

const entries = fs.readdirSync(tmpDir).filter(e => e !== '.' && e !== '..' && e !== 'TMP-CLEANUP-REPORT.md');
const toDelete = [];
const toKeep = [];

// Scripts that are generic and should be kept regardless of batch name
const keepScripts = new Set([
  'scan_tmp.mjs',
  'scan_challenges.mjs',
  'find_all_web.mjs',
  'find-web-files.mjs',
  'find-candidates.mjs',
  'fetch-repos.mjs',
  'regenerate-index.mjs',
  'cleanup-duplicate-base-images.mjs',
  'update-redeployed-registries.mjs',
  'compute-flag.mjs',
  'parse-release.mjs',
  'inspect_repos.js',
  '.gen-candidates.js',
  'check-duplicates.mjs',
  'scan-web-candidates.mjs',
  'update-tmp-report.mjs',
  'check-batch-deployment.mjs',
]);

for (const entry of entries) {
  // Check if it's a generic script to keep
  if (keepScripts.has(entry)) {
    toKeep.push({ entry, reason: 'generic tool script' });
    continue;
  }

  // Check for batch number match
  const m = entry.match(/batch([\d\w]+)/i);
  if (!m) {
    toKeep.push({ entry, reason: 'no batch number match' });
    continue;
  }
  const batchKey = m[1];
  const reg = batchRegistryMap.get(batchKey);
  if (!reg) {
    toKeep.push({ entry, reason: `batch${batchKey} not found in registry` });
    continue;
  }
  if (fullyDeployedBatches.has(batchKey)) {
    toDelete.push({ entry, reason: `batch${batchKey} fully deployed (${reg.deployed}/${reg.total})` });
  } else {
    toKeep.push({ entry, reason: `batch${batchKey} not fully deployed (${reg.deployed}/${reg.total})` });
  }
}

console.log('=== Plan: delete these .tmp/ entries (fully deployed batches) ===');
for (const item of toDelete) {
  console.log(`  ${item.entry} -> ${item.reason}`);
}

console.log(`\n=== Plan: keep these .tmp/ entries (${toKeep.length}) ===`);
for (const item of toKeep) {
  console.log(`  ${item.entry} -> ${item.reason}`);
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
