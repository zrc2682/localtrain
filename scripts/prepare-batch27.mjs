import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const MOECTF_SRC = path.join(ROOT, '.tmp/MoeCTF_2024_extract/MoeCTF_2024-main/Challenges/Web');
const DIANDAO_SRC = path.join(MOECTF_SRC, '垫刀之路');
const DFJK_SRC = path.join(ROOT, '.tmp/2024-dfjk-main/Web/GoldenHornKing');
const REGISTRY_FILE = path.join(ROOT, 'docs/ctf-web-registry-batch27.json');

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
  if (/ENV\s+FLAG=/i.test(content)) {
    content = content.replace(/ENV\s+FLAG=.*?\n/i, `ENV FLAG=${flag}\n`);
  } else {
    const lines = content.split('\n');
    let inserted = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toUpperCase().startsWith('FROM')) {
        lines.splice(i + 1, 0, `ENV FLAG=${flag}`);
        inserted = true;
        break;
      }
    }
    if (!inserted) lines.unshift(`ENV FLAG=${flag}`);
    content = lines.join('\n');
  }
  fs.writeFileSync(dockerfilePath, content, 'utf8');
}

function appendFlagWrite(dockerfilePath, flag, targetFiles = ['/flag', '/tmp/flag']) {
  const cmds = targetFiles.map((p) => `echo '${flag}' > ${p}`).join(' && ');
  fs.appendFileSync(dockerfilePath, `\n# 静态 flag 写入,供平台验证及选手读取\nRUN ${cmds}\n`, 'utf8');
}

const entries = [
  { stage: '1_startup', title: '垫刀之路01: MoeCTF？启动！', difficulty: 'easy', notes: 'ctftraining base; 简单 RCE 命令执行读取 $FLAG', port: 80 },
  { stage: '2_upload', title: '垫刀之路02: 文件上传', difficulty: 'easy', notes: 'ctftraining base; 前端/后端文件上传绕过读取 $FLAG', port: 80 },
  { stage: '3_imageupload', title: '垫刀之路03: 图片上传', difficulty: 'easy', notes: 'ctftraining base; 图片上传二次渲染/包含读取 $FLAG', port: 80 },
  { stage: '4_browser', title: '垫刀之路04: 任意文件读取', difficulty: 'easy', notes: 'ctftraining base; path 参数目录穿越读取 /flag', port: 80 },
  { stage: '5_ezlogin', title: '垫刀之路05: SQL 注入登录', difficulty: 'easy', notes: 'ctftraining nginx+mysql+php; 登录框 SQL 注入获取 flag', port: 80 },
  { stage: '6_minimoepop', title: '垫刀之路06: PHP 反序列化', difficulty: 'easy', notes: 'ctftraining base; 构造 POP 链读取 /flag', port: 80 },
  { stage: '7_pinhack', title: '垫刀之路07: PIN 码爆破', difficulty: 'medium', notes: 'Flask debug PIN, Werkzeug 控制台读取 /app/flag; 基础镜像替换为 python:3.11-slim', port: 80 },
];

const registry = {
  version: '1.0',
  note: '第二十七批比赛 Web 题目登记表。来源：MoeCTF 2024（垫刀之路 7 题 + ImageCloud + smbms） + 2024 巅峰极客（GoldenHornKing）。',
  challenges: [],
};

for (const e of entries) {
  const num = e.stage.split('_')[0];
  const id = `moectf-2024-dian-dao-${num.padStart(2, '0')}`;
  const flag = `flag{moectf-2024-dian-dao-${num.padStart(2, '0')}_${randHex()}}`;
  const src = path.join(DIANDAO_SRC, e.stage);
  const target = path.join(ROOT, 'docker/ctf-contests/moectf-2024', id);
  console.log(`[复制] ${e.title} -> ${target}`);
  copyRecursive(src, target);

  const dockerfilePath = path.join(target, 'Dockerfile');
  if (e.stage === '7_pinhack') {
    const dockerfile = `FROM python:3.11-slim
WORKDIR /app
RUN pip install flask -i https://pypi.tuna.tsinghua.edu.cn/simple
COPY webapp/ /app/
ENV FLAG=${flag}
RUN echo '${flag}' > /app/flag
EXPOSE 80
CMD ["python3", "/app/app.py"]
`;
    fs.writeFileSync(dockerfilePath, dockerfile, 'utf8');
    const getPinPath = path.join(target, 'webapp', 'getPIN.py');
    if (fs.existsSync(getPinPath)) {
      let gp = fs.readFileSync(getPinPath, 'utf8');
      gp = gp.replace('/usr/local/lib/python3.10/site-packages/flask/app.py', '/usr/local/lib/python3.11/site-packages/flask/app.py');
      fs.writeFileSync(getPinPath, gp, 'utf8');
    }
  } else {
    let content = fs.readFileSync(dockerfilePath, 'utf8');
    // Docker Hub 不可用,使用本地已有的 ctftraining/base_image_nginx_mysql_php_73
    content = content.replace(/ctftraining\/base_image_nginx_php_73/g, 'ctftraining/base_image_nginx_mysql_php_73');
    fs.writeFileSync(dockerfilePath, content, 'utf8');
    addEnvFlag(dockerfilePath, flag);
    appendFlagWrite(dockerfilePath, flag, ['/flag', '/tmp/flag']);
  }

  registry.challenges.push({
    id,
    title: e.title,
    contest: 'MoeCTF 2024',
    category: 'web',
    difficulty: e.difficulty,
    port: e.port,
    image: `localtrain/ctf-${id}:latest`,
    flag,
    source: {
      repo: 'XDSEC/MoeCTF_2024',
      path: `Challenges/Web/垫刀之路/${e.stage}`,
      url: `https://github.com/XDSEC/MoeCTF_2024/tree/main/Challenges/Web/${encodeURIComponent('垫刀之路')}/${e.stage}`,
    },
    writeup: 'https://github.com/XDSEC/MoeCTF_2024/blob/main/Official_Writeup/Web/Web.md',
    writeupLocal: null,
    dir: `docker/ctf-contests/moectf-2024/${id}`,
    hasDockerfile: true,
    flagMechanism: e.stage === '7_pinhack' ? 'flag 写入 /app/flag' : 'ENV FLAG 注入并写入 /flag、/tmp/flag',
    notes: e.notes,
    status: 'pending',
    built: false,
  });
}

// ImageCloud
{
  const id = 'moectf-2024-imagecloud';
  const title = 'ImageCloud';
  const flag = `flag{moectf-2024-imagecloud_${randHex()}}`;
  const src = path.join(MOECTF_SRC, 'ImageCloud');
  const target = path.join(ROOT, 'docker/ctf-contests/moectf-2024', id);
  console.log(`[复制] ${title} -> ${target}`);
  copyRecursive(src, target);

  const initPath = path.join(target, 'init.py');
  let init = fs.readFileSync(initPath, 'utf8');
  init = init.replace(
    'text = "moectf{CeleBr4Te_You_AtT4ck-to_My-1LliI_CLO0uD1c1e}"',
    "text = getenv('FLAG', 'flag{placeholder}')"
  );
  fs.writeFileSync(initPath, init, 'utf8');

  const dockerfile = `FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libfreetype6 libjpeg62-turbo libpng16-16 zlib1g && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir flask requests Pillow -i https://pypi.tuna.tsinghua.edu.cn/simple
COPY . .
ENV FLAG=${flag}
RUN echo '${flag}' > /flag
EXPOSE 5000
CMD ["sh", "-c", "python init.py && python app.py"]
`;
  fs.writeFileSync(path.join(target, 'Dockerfile'), dockerfile, 'utf8');

  registry.challenges.push({
    id,
    title,
    contest: 'MoeCTF 2024',
    category: 'web',
    difficulty: 'medium',
    port: 5000,
    image: `localtrain/ctf-${id}:latest`,
    flag,
    source: {
      repo: 'XDSEC/MoeCTF_2024',
      path: 'Challenges/Web/ImageCloud',
      url: 'https://github.com/XDSEC/MoeCTF_2024/tree/main/Challenges/Web/ImageCloud',
    },
    writeup: 'https://github.com/XDSEC/MoeCTF_2024/blob/main/Official_Writeup/Web/Web.md',
    writeupLocal: null,
    dir: `docker/ctf-contests/moectf-2024/${id}`,
    hasDockerfile: true,
    flagMechanism: 'init.py 读取 ENV FLAG 写入 flag.jpg',
    notes: 'Flask 图片云，flag 渲染在图片中；基础镜像替换为 python:3.11-slim',
    status: 'pending',
    built: false,
  });
}

// smbms
{
  const id = 'moectf-2024-smbms';
  const title = 'smbms';
  const flag = `flag{moectf-2024-smbms_${randHex()}}`;
  const src = path.join(MOECTF_SRC, 'smbms');
  const target = path.join(ROOT, 'docker/ctf-contests/moectf-2024', id);
  console.log(`[复制] ${title} -> ${target}`);
  copyRecursive(src, target);

  const dockerfilePath = path.join(target, 'Dockerfile');
  let content = fs.readFileSync(dockerfilePath, 'utf8');
  content = content.replace('FROM ubuntu:latest', 'FROM ubuntu:20.04');
  content = content.replace(
    'RUN apt-get update -y && apt-get install openjdk-8-jdk mariadb-client mariadb-server -y',
    'RUN apt-get update -y && DEBIAN_FRONTEND=noninteractive apt-get install -y openjdk-8-jdk mariadb-client mariadb-server && rm -rf /var/lib/apt/lists/*'
  );
  fs.writeFileSync(dockerfilePath, content, 'utf8');
  addEnvFlag(dockerfilePath, flag);
  appendFlagWrite(dockerfilePath, flag, ['/flag']);

  registry.challenges.push({
    id,
    title,
    contest: 'MoeCTF 2024',
    category: 'web',
    difficulty: 'medium',
    port: 8080,
    image: `localtrain/ctf-${id}:latest`,
    flag,
    source: {
      repo: 'XDSEC/MoeCTF_2024',
      path: 'Challenges/Web/smbms',
      url: 'https://github.com/XDSEC/MoeCTF_2024/tree/main/Challenges/Web/smbms',
    },
    writeup: 'https://github.com/XDSEC/MoeCTF_2024/blob/main/Official_Writeup/Web/Web.md',
    writeupLocal: null,
    dir: `docker/ctf-contests/moectf-2024/${id}`,
    hasDockerfile: true,
    flagMechanism: 'docker-entrypoint.sh 用 ENV FLAG 替换 MariaDB 中 flag',
    notes: 'Java Tomcat + MariaDB 单容器; 通过 SMBMS 注入读取 flag; ubuntu:latest 替换为 ubuntu:20.04',
    status: 'pending',
    built: false,
  });
}

// dfjk 2024 GoldenHornKing
{
  const id = 'dfjk-2024-golden-horn-king';
  const title = 'GoldenHornKing';
  const flag = `flag{dfjk-2024-golden-horn-king_${randHex()}}`;
  const target = path.join(ROOT, 'docker/ctf-contests/dfjk-2024', id);
  console.log(`[复制] ${title} -> ${target}`);
  copyRecursive(DFJK_SRC, target);

  const appPath = path.join(target, 'app.py');
  let appCode = fs.readFileSync(appPath, 'utf8');
  appCode = appCode.replace(
    "app = FastAPI()",
    "app = FastAPI()\nimport os\napp.flag = os.getenv('FLAG', 'flag{placeholder}')"
  );
  fs.writeFileSync(appPath, appCode, 'utf8');

  const dockerfile = `FROM python:3.11-slim
WORKDIR /app
RUN pip install --no-cache-dir fastapi uvicorn jinja2 anyio -i https://pypi.tuna.tsinghua.edu.cn/simple
COPY . .
ENV FLAG=${flag}
RUN echo '${flag}' > /flag
EXPOSE 8000
CMD ["python3", "-u", "app.py"]
`;
  fs.writeFileSync(path.join(target, 'Dockerfile'), dockerfile, 'utf8');

  registry.challenges.push({
    id,
    title,
    contest: '2024 巅峰极客',
    category: 'web',
    difficulty: 'medium',
    port: 8000,
    image: `localtrain/ctf-${id}:latest`,
    flag,
    source: {
      repo: 'CTF-Archives/2024-dfjk',
      path: 'Web/GoldenHornKing',
      url: 'https://github.com/CTF-Archives/2024-dfjk',
    },
    writeup: 'https://exp10it.io/posts/dfjk-2024-preliminary-web-writeup/',
    writeupLocal: null,
    dir: `docker/ctf-contests/dfjk-2024/${id}`,
    hasDockerfile: true,
    flagMechanism: 'flag 写入 /flag，且 app.flag 暴露给 SSTI',
    notes: 'FastAPI + Jinja2 SSTI；无原 Dockerfile，补充 python:3.11-slim',
    status: 'pending',
    built: false,
  });
}

fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2), 'utf8');
console.log(`[登记] 已写入 ${REGISTRY_FILE}`);
