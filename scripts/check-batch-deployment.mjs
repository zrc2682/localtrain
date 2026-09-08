import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const docsDir = path.join(rootDir, 'docs');
const tmpDir = path.join(rootDir, '.tmp');

const files = fs.readdirSync(docsDir).filter(
  f => f.startsWith('ctf-web-registry') && f.endsWith('.json')
);

const stats = [];
for (const f of files.sort()) {
  const data = JSON.parse(fs.readFileSync(path.join(docsDir, f), 'utf8'));
  const challenges = data.challenges || [];
  const total = challenges.length;
  const deployed = challenges.filter(c => c.status === 'deployed').length;
  const skipped = challenges.filter(c => c.status === 'skipped' || c.status === 'pending').length;
  stats.push({ file: f, total, deployed, skipped, fullyDeployed: total > 0 && deployed === total && skipped === 0 });
}

console.log('Batch deployment status:');
for (const s of stats) {
  const marker = s.fullyDeployed ? ' [ALL DEPLOYED]' : '';
  console.log(`  ${s.file}: total=${s.total}, deployed=${s.deployed}, pending/skipped=${s.skipped}${marker}`);
}

// Also check tmp entries matching batch numbers
const entries = fs.readdirSync(tmpDir).filter(e => e !== '.' && e !== '..' && e !== 'TMP-CLEANUP-REPORT.md');
const batchMap = new Map();
for (const s of stats) {
  const m = s.file.match(/batch(\d+|\w+)/);
  if (!m) continue;
  const batchKey = m[1];
  batchMap.set(batchKey, s);
}

console.log('\n.tmp entries matching batch numbers:');
for (const entry of entries.sort()) {
  const m = entry.match(/batch(\d+|\w+)/i) || entry.match(/\bb(\d+\b)/i);
  if (!m) continue;
  const batchKey = m[1];
  const stat = batchMap.get(batchKey);
  if (stat) {
    const marker = stat.fullyDeployed ? ' [CAN DELETE]' : '';
    console.log(`  ${entry} -> batch${batchKey}: deployed=${stat.deployed}/${stat.total}${marker}`);
  } else {
    console.log(`  ${entry} -> batch${batchKey}: (no registry found)`);
  }
}
