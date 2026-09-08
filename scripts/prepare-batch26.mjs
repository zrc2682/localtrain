import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const SRC_BASE = path.join(ROOT, '.tmp/MoeCTF_2024_extract/MoeCTF_2024-main/Challenges/Web');
const TARGET_BASE = path.join(ROOT, 'docker/ctf-contests/moectf-2024');
const REGISTRY_FILE = path.join(ROOT, 'docs/ctf-web-registry-batch26.json');

function findSrcDir(namePart) {
  const dirs = fs.readdirSync(SRC_BASE).filter((n) => fs.statSync(path.join(SRC_BASE, n)).isDirectory());
  const d = dirs.find((n) => n.includes(namePart));
  if (!d) throw new Error(`未找到源目录: ${namePart}`);
  return path.join(SRC_BASE, d);
}

function randHex(len = 12) {
  return randomBytes(len / 2).toString('hex');
}

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const f of fs.readdirSync(src)) {
    const sp = path.join(src, f);
    const dp = path.join(dest, f);
    const st = fs.statSync(sp);
    if (st.isDirectory()) copyRecursive(sp, dp);
    else fs.copyFileSync(sp, dp);
  }
}

function addEnvFlag(dockerfilePath, flag) {
  let content = fs.readFileSync(dockerfilePath, 'utf8');
  // 如果已经存在 ENV FLAG= 行则替换，否则在第一个 FROM 行之后插入
  if (/ENV\s+FLAG=/i.test(content)) {
    content = content.replace(/ENV\s+FLAG=.*?\n/i, `ENV FLAG=${flag}\n`);
  } else {
    const lines = content.split('\n');
    let inserted = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toUpperCase().startsWith('FROM')) {
        lines.splice(i + 1, 0, `ENV FLAG=${flag}`, `RUN echo '${flag}' > /flag`);
        inserted = true;
        break;
      }
    }
    if (!inserted) lines.unshift(`ENV FLAG=${flag}`, `RUN echo '${flag}' > /flag`);
    content = lines.join('\n');
  }
  fs.writeFileSync(dockerfilePath, content, 'utf8');
}

const entries = [
  {
    id: 'moectf-2024-ez-http',
    title: 'ez_http',
    difficulty: 'easy',
    port: 80,
    sourcePath: 'ez_http',
    flagMechanism: 'init.sh 将 ENV FLAG 替换 index.php 中的 moectf{testflag}',
    notes: 'PHP + nginx，按顺序完成 HTTP 头、Referer、Cookie 等挑战；无 EXPOSE，nginx 监听 80',
    needsEnv: true,
  },
  {
    id: 'moectf-2024-webtutor-entry',
    title: '弗拉格之地的入口',
    difficulty: 'easy',
    port: 80,
    sourcePath: '弗拉格之地的入口',
    flagMechanism: 'flag.sh 将 ENV FLAG 写入 webtutorEntry.php 并追加到 /etc/passwd',
    notes: 'ctftraining base 镜像；robots.txt 引导访问 /webtutorEntry.php',
    needsEnv: true,
  },
  {
    id: 'moectf-2024-webtutor-challenge',
    title: '弗拉格之地的挑战',
    difficulty: 'easy',
    port: 80,
    sourcePath: '弗拉格之地的挑战',
    flagMechanism: '静态 7 个 flag 片段，拼合后 base64 解码为最终 flag',
    notes: 'ctftraining base 镜像；7 关 web 基础挑战，最终 flag 保持原题',
    needsEnv: false,
    originalFlag: 'moectf{AftEr_th1s_tUT0r_I_th1ke_U_kknow_WeB}',
  },
  {
    id: 'moectf-2024-web-intro',
    title: 'web入门指北',
    difficulty: 'easy',
    port: 80,
    sourcePath: 'web入门指北',
    flagMechanism: '静态前端 AES 解密，flag 在 ciphertext 中',
    notes: '无原 Dockerfile，额外补充 php:apache 镜像；flag 为 AES 解密后的明文',
    needsEnv: false,
    originalFlag: "moectf{H3r3'5_@_flYinG_kIss_f0r_yoU!}",
    createDockerfile: true,
  },
  {
    id: 'moectf-2024-prove-your-love',
    title: 'ProveYourLove',
    difficulty: 'medium',
    port: 5000,
    sourcePath: 'ProveYourLove',
    flagMechanism: 'entrypoint.sh 将 ENV FLAG 替换 app.py 中的 moectf{testflag}',
    notes: 'Flask + SQLite，前端限制提交次数，需写脚本发送 300 次表白请求',
    needsEnv: true,
  },
  {
    id: 'moectf-2024-imagecloud-pre',
    title: 'ImageCloud前置',
    difficulty: 'easy',
    port: 80,
    sourcePath: 'ImageCloud前置',
    flagMechanism: 'init.sh 将 ENV FLAG 追加到 /etc/passwd，通过 SSRF 读取',
    notes: 'php-fpm + nginx，curl 请求 url 参数，通过 file:///etc/passwd 读 flag',
    needsEnv: true,
  },
  {
    id: 'moectf-2024-whos-blog',
    title: "who's_blog",
    difficulty: 'easy',
    port: 80,
    sourcePath: "who's_blog",
    flagMechanism: 'Flask 从 ENV FLAG 读取，flag 在环境变量中',
    notes: 'Flask SSTI，通过 id 参数注入 Jinja2，读取环境变量 FLAG',
    needsEnv: true,
  },
  {
    id: 'moectf-2024-tongren',
    title: '勇闯铜人阵',
    difficulty: 'medium',
    port: 80,
    sourcePath: '勇闯铜人阵',
    flagMechanism: 'Flask 从 ENV FLAG 读取，flag 在环境变量中',
    notes: 'Flask 听声辨位，根据铜钱数量与方位写脚本快速提交 5 轮',
    needsEnv: true,
  },
  {
    id: 'moectf-2024-static-blog',
    title: '静态网页',
    difficulty: 'medium',
    port: 80,
    sourcePath: '静态网页',
    flagMechanism: 'flag.sh 将 ENV FLAG 写入 flag.php',
    notes: 'ctftraining base 镜像；live2d 小人换衣服触发后端请求，查看网络请求后进入 flag.php 代码审计',
    needsEnv: true,
  },
  {
    id: 'moectf-2024-dianyuan-backend',
    title: '电院_Backend',
    difficulty: 'medium',
    port: 80,
    sourcePath: '电院_Backend',
    flagMechanism: 'docker-entrypoint.sh 将 ENV FLAG 写入 admin/login.php',
    notes: 'php-fpm + nginx + MariaDB，robots.txt 暴露 /admin/，验证码后 email 处 SQL 注入',
    needsEnv: true,
  },
];

const registry = {
  version: '1.0',
  note: '第二十六批比赛 Web 题目登记表。来源：MoeCTF 2024。',
  challenges: [],
};

for (const e of entries) {
  const flag = e.originalFlag || `flag{moectf-2024-${e.id.replace('moectf-2024-', '')}_${randHex()}}`;
  const src = findSrcDir(e.sourcePath);
  const target = path.join(TARGET_BASE, e.id);

  console.log(`[复制] ${e.title} -> ${target}`);
  copyRecursive(src, target);

  const dockerfilePath = path.join(target, 'Dockerfile');
  if (e.needsEnv) {
    if (!fs.existsSync(dockerfilePath)) {
      throw new Error(`${e.id} 需要 ENV FLAG 但缺少 Dockerfile`);
    }
    addEnvFlag(dockerfilePath, flag);
    console.log(`[注入] ENV FLAG -> ${e.id}`);
  } else if (e.createDockerfile) {
    const dockerfile = `FROM php:8.2-apache\nWORKDIR /var/www/html\nCOPY www/ .\nRUN echo '${flag}' > /flag\nEXPOSE 80\nCMD ["apache2-foreground"]\n`;
    fs.writeFileSync(dockerfilePath, dockerfile, 'utf8');
    console.log(`[创建] Dockerfile -> ${e.id}`);
  } else if (e.originalFlag && fs.existsSync(dockerfilePath)) {
    // 为静态 flag 的题目也写入 /flag，方便验证
    let content = fs.readFileSync(dockerfilePath, 'utf8');
    if (!/RUN\s+echo\s+'/.test(content)) {
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toUpperCase().startsWith('FROM')) {
          lines.splice(i + 1, 0, `RUN echo '${flag}' > /flag`);
          break;
        }
      }
      content = lines.join('\n');
      fs.writeFileSync(dockerfilePath, content, 'utf8');
    }
  }

  registry.challenges.push({
    id: e.id,
    title: e.title,
    contest: 'MoeCTF 2024',
    category: 'web',
    difficulty: e.difficulty,
    port: e.port,
    image: `localtrain/ctf-${e.id}:latest`,
    flag,
    source: {
      repo: 'XDSEC/MoeCTF_2024',
      path: `Challenges/Web/${e.sourcePath}`,
      url: `https://github.com/XDSEC/MoeCTF_2024/tree/main/Challenges/Web/${encodeURIComponent(e.sourcePath)}`,
    },
    writeup: 'https://github.com/XDSEC/MoeCTF_2024/blob/main/Official_Writeup/Web/Web.md',
    writeupLocal: null,
    dir: `docker/ctf-contests/moectf-2024/${e.id}`,
    hasDockerfile: true,
    flagMechanism: e.flagMechanism,
    notes: e.notes,
    status: 'pending',
    built: false,
  });
}

fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2), 'utf8');
console.log(`[登记] 已写入 ${REGISTRY_FILE}`);
