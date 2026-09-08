import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'docs/cve-registry.json');
const CHALLENGE_DIR = path.join(ROOT, 'docker/cve-challenges');
const IMAGE_DIR = path.join(ROOT, 'docker-images');
const BUILD_TIMEOUT_MS = 30 * 60 * 1000; // 30 分钟构建/拉取超时

const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));

// 题目 ID 到候选基础镜像列表的映射
const BASE_IMAGE_CANDIDATES = {
  'spring-cloud-function': ['vulhub/spring-cloud-function:3.2.2'],
  'struts2-s2-045': ['vulhub/struts2:2.3.34-showcase'],
  'struts2-s2-061': ['vulhub/struts2:2.5.25'],
  'struts2-xstream': ['vulhub/struts2:2.5.12-rest-showcase'],
  'dubbo': ['vulhub/dubbo:2.7.3'],
  'h2-jndi': ['vulhub/spring-with-h2database:1.4.200'],
  'wp-bricks': ['vulhub/wordpress:4.6'],
  'wp-automatic': ['vulhub/wordpress:4.6'],
  'mysql-udf': ['vulhub/mysql:5.6.5'],
  'grafana': ['vulhub/grafana:8.2.6'],
  'confluence': ['vulhub/confluence:7.13.6'],
  'ofbiz': ['vulhub/ofbiz:18.12.09'],
  'apisix': ['vulhub/apisix:2.11.0'],
  'kibana': ['vulhub/kibana:6.5.4'],
  'gitlab': ['vulhub/gitlab:13.10.1'],
  'airflow': ['vulhub/airflow:1.10.10'],
  'jenkins': ['vulhub/jenkins:2.441'],
  'metabase': ['vulhub/metabase:0.46.6'],
  'zabbix': ['vulhub/zabbix:5.0.17', 'vulhub/zabbix-server:5.0.17', 'vulhub/zabbix-web:5.0.17', 'vulhub/zabbix:latest'],
};

// 这些题目需要自定义构建或特殊处理，本脚本暂时不处理
const NEED_CUSTOM = new Set(['rails', 'git', 'urllib-crlf', 'wp-bricks', 'wp-automatic']);

function generateFlag(id) {
  const rand = randomBytes(6).toString('hex');
  return `flag{${id.replace(/-/g, '_')}_${rand}}`;
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

async function pullImage(image) {
  await run('docker', ['pull', image]);
}

async function findAvailableBaseImage(id) {
  const candidates = BASE_IMAGE_CANDIDATES[id];
  if (!candidates) return null;
  for (const image of candidates) {
    try {
      if (await dockerImageExists(image)) {
        console.log(`  [基础镜像已本地存在] ${image}`);
        return image;
      }
      console.log(`  [拉取] ${image}`);
      await pullImage(image);
      return image;
    } catch (e) {
      console.log(`  [失败] ${image}: ${e.message.split('\n')[0]}`);
    }
  }
  return null;
}

function createDockerfile(challengeDir, baseImage, flag) {
  const dockerfile = `FROM ${baseImage}\nUSER root\nRUN echo '${flag}' > /flag.txt && chmod 444 /flag.txt\n`;
  fs.writeFileSync(path.join(challengeDir, 'Dockerfile'), dockerfile);
}

async function buildAndSave(challengeDir, imageName, id) {
  await run('docker', ['build', '-t', imageName, challengeDir]);
  const safeName = imageName.replace(/[^a-zA-Z0-9._-]/g, '_') + '.tar';
  const archivePath = path.join(IMAGE_DIR, safeName);
  await run('docker', ['save', '-o', archivePath, imageName]);
  return archivePath;
}

async function deployChallenge(chal) {
  const id = chal.id;
  if (NEED_CUSTOM.has(id)) {
    console.log(`[跳过-需自定义] ${chal.title}`);
    return { status: 'skipped', reason: '需要自定义应用或复杂环境' };
  }

  const baseImage = await findAvailableBaseImage(id);
  if (!baseImage) {
    return { status: 'failed', reason: '无可用基础镜像' };
  }

  const flag = generateFlag(id);
  const imageName = chal.image || `localtrain/cve-${id}:latest`;
  const challengeDir = path.join(CHALLENGE_DIR, id);
  fs.mkdirSync(challengeDir, { recursive: true });
  createDockerfile(challengeDir, baseImage, flag);

  try {
    console.log(`  [构建] ${imageName}`);
    const archivePath = await buildAndSave(challengeDir, imageName, id);
    chal.flag = flag;
    chal.image = imageName;
    chal.status = 'deployed';
    delete chal.skipReason;
    delete chal.error;
    console.log(`  [归档] ${archivePath}`);
    return { status: 'deployed', image: imageName, flag };
  } catch (e) {
    return { status: 'failed', reason: e.message.split('\n')[0] };
  }
}

// 这些题目基础镜像相对较小，优先处理，避免被大镜像（Struts2、Confluence、GitLab 等）阻塞
const SMALL_IMAGE_IDS = new Set([
  'h2-jndi',
  'grafana',
  'metabase',
  'apisix',
  'jenkins',
  'kibana',
  'airflow',
  'zabbix',
  'mysql-udf',
  'ofbiz',
  'wp-bricks',
  'wp-automatic',
]);

const TARGET_IDS = process.argv.slice(2).length > 0 ? new Set(process.argv.slice(2)) : null;

async function main() {
  let skipped = registry.challenges.filter((c) => c.status === 'skipped');
  if (TARGET_IDS) {
    skipped = skipped.filter((c) => TARGET_IDS.has(c.id));
    if (skipped.length === 0) {
      console.log(`没有匹配的 skipped 题目: ${[...TARGET_IDS].join(', ')}`);
      process.exit(0);
    }
  }
  // 小镜像优先
  skipped.sort((a, b) => {
    const aSmall = SMALL_IMAGE_IDS.has(a.id) ? 0 : 1;
    const bSmall = SMALL_IMAGE_IDS.has(b.id) ? 0 : 1;
    return aSmall - bSmall;
  });
  console.log(`准备部署 ${skipped.length} 道跳过题目...`);
  console.log(`处理顺序: ${skipped.map((c) => c.id).join(', ')}\n`);

  const results = { deployed: 0, failed: 0, skipped: 0 };

  for (const chal of skipped) {
    console.log(`--- ${chal.title} ---`);
    let attempts = 0;
    let lastResult = null;

    while (attempts < 2) {
      attempts++;
      lastResult = await deployChallenge(chal);
      if (lastResult.status === 'deployed') break;
      console.log(`  [重试 ${attempts}/2]`);
    }

    if (lastResult.status === 'deployed') {
      results.deployed++;
    } else if (lastResult.status === 'skipped') {
      results.skipped++;
      chal.status = 'skipped';
      chal.skipReason = lastResult.reason;
    } else {
      results.failed++;
      chal.status = 'failed';
      chal.skipReason = lastResult.reason;
      chal.error = lastResult.reason;
    }
    console.log(`[结果] ${chal.title}: ${lastResult.status}${lastResult.reason ? ' - ' + lastResult.reason : ''}\n`);
  }

  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
  console.log(`注册表已更新: ${REGISTRY_PATH}`);
  console.log(`\n部署完成: 成功 ${results.deployed}, 失败 ${results.failed}, 跳过 ${results.skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
