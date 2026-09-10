import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

// 批次收尾串联工具：把 Runbook 第 6 节里可自动化的步骤一次跑完，最后统一打印剩余手工事项。
// 不删除任何文件（.tmp 清理只做 dry-run 预览，确认后需手工执行真实清理）。
// 用法: node scripts/close-batch.mjs <登记表路径>
//   1) node scripts/update-deployed-index.mjs          刷新查重索引（.tmp 索引文件 + .deployed-challenges/）
//   2) node scripts/clean-tmp-deployed.mjs --dry-run   预览本批可清理的 .tmp 产物
//   3) node scripts/update-tmp-report.mjs              更新 .tmp 清理报告
//   4) 生成批次文档表格草稿（markdown，可直接粘进 docs/ctf-web-challenges.md）

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = path.join(ROOT, 'scripts');

const registryPath = path.resolve(process.argv[2] || '');
if (!registryPath || !fs.existsSync(registryPath)) {
  console.error('用法: node scripts/close-batch.mjs <登记表路径>');
  process.exit(1);
}
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const entries = (registry.challenges || []).filter((e) => e.status === 'deployed');
if (entries.length === 0) {
  console.error('登记表中没有 deployed 状态的题目，无需收尾');
  process.exit(1);
}

function runStep(name, script, args = []) {
  console.log(`\n===== ${name} =====`);
  const r = spawnSync('node', [path.join(SCRIPTS, script), ...args], { cwd: ROOT, stdio: 'inherit' });
  return r.status === 0;
}

const ok1 = runStep('1/4 刷新查重索引', 'update-deployed-index.mjs');
const ok2 = runStep('2/4 预览可清理的 .tmp 产物（dry-run，不删除）', 'clean-tmp-deployed.mjs', ['--dry-run']);
const ok3 = runStep('3/4 更新 .tmp 清理报告', 'update-tmp-report.mjs');

// 4) 生成批次文档表格草稿
const byContest = new Map();
for (const e of entries) byContest.set(e.contest, (byContest.get(e.contest) || 0) + 1);
const byDiff = new Map();
for (const e of entries) byDiff.set(e.difficulty, (byDiff.get(e.difficulty) || 0) + 1);
const diffOrder = ['easy', 'medium', 'hard', 'expert'];
const diffSummary = diffOrder.filter((d) => byDiff.has(d)).map((d) => `${byDiff.get(d)} ${d}`).join(' / ');
const contestSummary = [...byContest.entries()].map(([c, n]) => `${c}(${n})`).join('、');

const lines = [];
lines.push(`## 第 X 批(部署日期,${entries.length} 道已部署)`);
lines.push('');
lines.push(`来源比赛:${contestSummary}。实际配比 ${diffSummary}。${entries.length} 道题已构建镜像、导入平台并验证 flag 可提交。`);
lines.push('');
lines.push('> 构建备注:');
lines.push('> - （补:基础镜像来源、Dockerfile 改造、踩坑与特殊处理）');
lines.push('');
lines.push('| 题目 | 比赛 | 难度 | 端口 | writeup | 状态 |');
lines.push('|------|------|------|------|---------|------|');
for (const e of entries) {
  lines.push(`| ${e.title} | ${e.contest} | ${e.difficulty} | ${e.port} | ${e.writeup || '待补充'} | 已部署 |`);
}

console.log(`\n===== 4/4 批次文档表格草稿（补上批次号、部署日期与构建备注后粘进 docs/ctf-web-challenges.md）=====\n`);
console.log(lines.join('\n'));

console.log(`
===== 剩余手工事项 =====
1. 上面的表格草稿补全后写入 docs/ctf-web-challenges.md（含构建备注）
2. CHALLENGE-DEPLOYMENT.md：5.3 批次表加一行 + 第 9 章历史记录
3. writeup 本地化到 ctf-writeup/<比赛slug>/<题目slug>.md，无法抓取的记录链接
4. 确认第 2 步的清理预览无误后，真实执行: node scripts/clean-tmp-deployed.mjs
5. AGENTS.md 概述里的批次号与「下一批次从 batchN+1 开始」${ok1 && ok2 && ok3 ? '' : '\n[注意] 前面有步骤退出码非 0，请回看上方输出'}
`);
