import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const TARGET_BASE = path.join(ROOT, 'docker', 'ctf-contests');
const REGISTRY_FILE = path.join(ROOT, 'docs', 'ctf-web-registry-batch29.json');

const BASE = {
  node: 'docker.m.daocloud.io/library/node',
  python: 'docker.m.daocloud.io/library/python',
  golang: 'docker.m.daocloud.io/library/golang',
  alpine: 'docker.m.daocloud.io/library/alpine',
  nginx: 'docker.m.daocloud.io/library/nginx',
  openjdk: 'docker.m.daocloud.io/library/openjdk',
  eclipseTemurin: 'docker.m.daocloud.io/library/eclipse-temurin',
  php: 'docker.m.daocloud.io/library/php',
  ubuntu: 'docker.m.daocloud.io/library/ubuntu',
};

function randHex(len = 12) {
  return randomBytes(len / 2).toString('hex');
}

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
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

function replaceInFile(p, oldStr, newStr) {
  let content = fs.readFileSync(p, 'utf8');
  content = content.split(oldStr).join(newStr);
  fs.writeFileSync(p, content, 'utf8');
}

function writeDockerfile(target, dockerfile) {
  fs.writeFileSync(path.join(target, 'Dockerfile'), dockerfile, 'utf8');
}

function writeFlag(target, flag, extraFiles = []) {
  fs.writeFileSync(path.join(target, 'flag'), flag, 'utf8');
  for (const f of extraFiles) {
    fs.writeFileSync(path.join(target, f), flag, 'utf8');
  }
}

const entries = [
  {
    id: '2025-qwbs9-bbjv',
    title: 'bbjv',
    contest: '2025 强网杯初赛',
    difficulty: 'easy',
    port: 8080,
    sourcePath: '.tmp/batch15-inspect/qwbs9-quals/bbjv_bc4ff9919583580cd2476ebd25b3f409.zip',
    sourceIsZip: true,
    targetDir: '2025-qwbs9/2025-qwbs9-bbjv',
    notes: 'Spring Boot jar；原题读取 /tmp/flag.txt',
    flagMechanism: 'ENV FLAG 注入，同时写入 /flag 和 /tmp/flag.txt',
  },
  {
    id: '2025-qwbs9-secret-vault',
    title: 'SecretVault',
    contest: '2025 强网杯初赛',
    difficulty: 'medium',
    port: 5555,
    sourcePath: '.tmp/batch15-inspect/qwbs9-quals/SecretVaulttar_48aebf7ba1672d666f4c5a9fc3e40ad8.tar.gz',
    sourceIsTarGz: true,
    targetDir: '2025-qwbs9/2025-qwbs9-secret-vault',
    notes: 'Go authorizer + Python Flask vault 同容器；entrypoint 读取 ICQ_FLAG 写入 /flag',
    flagMechanism: 'ENV ICQ_FLAG 注入，entrypoint 写入 /flag',
  },
  {
    id: '2025-qwbs9-cele-race',
    title: 'CeleRace',
    contest: '2025 强网杯初赛',
    difficulty: 'medium',
    port: 5000,
    sourcePath: '.tmp/batch15-inspect/qwbs9-quals/CeleRace_2ecd32259d16b7619d2266334f4bfdf9.zip',
    sourceIsZip: true,
    targetDir: '2025-qwbs9/2025-qwbs9-cele-race',
    notes: 'Python MiniFlask + Redis + Celery 同容器；supervisord 启动',
    flagMechanism: 'ENV FLAG 注入，同时写入 /flag 和 /flag.txt',
  },
  {
    id: '2025-qwbs9-go2php',
    title: 'go2php',
    contest: '2025 强网杯初赛',
    difficulty: 'medium',
    port: 80,
    sourcePath: '.tmp/batch15-inspect/qwbs9-quals/go2php/attachments',
    sourceIsDir: true,
    targetDir: '2025-qwbs9/2025-qwbs9-go2php',
    notes: 'PHP + Apache；catflag SUID 程序读取 /flag.txt',
    flagMechanism: 'ENV FLAG 注入，写入 /flag.txt',
  },
  {
    id: 'hkctf-2025-labyrinth',
    title: 'Labyrinth',
    contest: 'HKCTF 2025 Quals',
    difficulty: 'medium',
    port: 8080,
    sourcePath: '.tmp/hkcert-2025-attachments/Web Exploitation/Labyrinth/attachment.zip',
    sourceIsZip: true,
    targetDir: 'hkctf-2025/hkctf-2025-labyrinth',
    notes: 'Spring Boot 2.7.18 可执行 jar',
    flagMechanism: 'ENV FLAG 注入，写入 /flag',
  },
  {
    id: 'hkctf-2025-ezjs',
    title: 'ezjs',
    contest: 'HKCTF 2025 Quals',
    difficulty: 'easy',
    port: 80,
    sourcePath: '.tmp/hkcert-2025-attachments/Web Exploitation/ezjs/attachment.zip',
    sourceIsZip: true,
    targetDir: 'hkctf-2025/hkctf-2025-ezjs',
    notes: 'Node.js Express + JSON5 + pug 模板渲染',
    flagMechanism: 'ENV FLAG 注入，写入 /flag',
  },
  {
    id: 'hkctf-2025-nettool',
    title: 'nettool',
    contest: 'HKCTF 2025 Quals',
    difficulty: 'medium',
    port: 8000,
    sourcePath: '.tmp/hkcert-2025-attachments/Web Exploitation/nettool/nettool.zip',
    sourceIsZip: true,
    targetDir: 'hkctf-2025/hkctf-2025-nettool',
    notes: 'Python FastAPI；需要管理员登录后访问 nettools',
    flagMechanism: 'ENV FLAG 注入，写入 /flag',
  },
  {
    id: '2026-nco-final-pino',
    title: 'Pino',
    contest: '2026 NCO Final',
    difficulty: 'medium',
    port: 5007,
    sourcePath: '.tmp/batch14/repos/2026-NCO-Final/web/Web-Pino/app.py',
    sourceIsFile: true,
    targetDir: '2026-nco-final/2026-nco-final-pino',
    notes: 'Flask ping 命令注入；原题读取 GZCTF_FLAG 并写入 /tmp/flag.txt',
    flagMechanism: 'ENV FLAG 注入，替换 GZCTF_FLAG，写入 /flag 和 /tmp/flag.txt',
  },
  {
    id: '2026-nco-final-what-can-i-say',
    title: 'What CAN I Say',
    contest: '2026 NCO Final',
    difficulty: 'medium',
    port: 5005,
    sourcePath: '.tmp/batch14/repos/2026-NCO-Final/web/Web-What-CAN-I-Say/app.py',
    sourceIsFile: true,
    targetDir: '2026-nco-final/2026-nco-final-what-can-i-say',
    notes: 'Flask WriteUp 提交倒计时；原题读取 GZCTF_FLAG 并写入 /tmp/flag.txt',
    flagMechanism: 'ENV FLAG 注入，替换 GZCTF_FLAG，写入 /flag 和 /tmp/flag.txt',
  },
  {
    id: '2024-pandacup-gateway',
    title: 'gateway',
    contest: '2024 PandaCupCTF Finals',
    difficulty: 'medium',
    port: 80,
    sourcePath: '.tmp/batch29-dl/pandacup-gateway/attach',
    sourceIsDir: true,
    targetDir: '2024-pandacup/2024-pandacup-gateway',
    notes: 'nginx + spawn-fcgi + C CGI 二进制；需要 32 位库',
    flagMechanism: 'ENV FLAG 注入，写入 /flag',
  },
];

const registry = {
  version: '1.0',
  note: '第二十九批比赛 Web 题目登记表。来源：2025 强网杯初赛、HKCTF 2025 Quals、2026 NCO Final、2024 PandaCupCTF Finals。',
  challenges: [],
};

for (const e of entries) {
  const flag = `flag{batch29-${e.id.replace(/[^a-zA-Z0-9]/g, '-')}_${randHex()}}`;
  const target = path.join(TARGET_BASE, e.targetDir);

  console.log(`[准备] ${e.title} -> ${target}`);
  rmrf(target);
  fs.mkdirSync(target, { recursive: true });

  const srcAbs = path.resolve(ROOT, e.sourcePath);
  const srcRel = path.relative(ROOT, srcAbs).replace(/\\/g, '/');
  const targetRel = path.relative(ROOT, target).replace(/\\/g, '/');
  if (e.sourceIsZip) {
    execSync(`unzip -o -q "${srcRel}" -d "${targetRel}"`, { cwd: ROOT, stdio: 'inherit' });
  } else if (e.sourceIsTarGz) {
    execSync(`tar --force-local -xzf "${srcRel}" -C "${targetRel}"`, { cwd: ROOT, stdio: 'inherit' });
  } else if (e.sourceIsDir) {
    copyRecursive(srcAbs, target);
  } else if (e.sourceIsFile) {
    fs.copyFileSync(srcAbs, path.join(target, path.basename(srcAbs)));
  }

  writeFlag(target, flag);

  if (e.id === '2025-qwbs9-bbjv') {
    const dockerfile = `FROM ${BASE.eclipseTemurin}:21-jdk-jammy
WORKDIR /app
COPY app.jar /app/app.jar
ENV FLAG=${flag}
RUN echo "${flag}" > /flag && echo "${flag}" > /tmp/flag.txt
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
`;
    writeDockerfile(target, dockerfile);
  } else if (e.id === '2025-qwbs9-secret-vault') {
    // 源码解压后通常位于 SecretVault/ 子目录；在子目录中写入 Dockerfile 和 flag
    const sub = path.join(target, 'SecretVault');
    if (fs.existsSync(sub)) {
      fs.writeFileSync(path.join(sub, 'flag'), flag, 'utf8');
      const dockerfile = `FROM ${BASE.golang}:1.25-alpine as builder
WORKDIR /builder
COPY authorizer/go.mod authorizer/go.sum ./
ENV GOPROXY=https://goproxy.cn,direct
RUN go mod download
COPY authorizer/. ./
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o authorizer

FROM ${BASE.python}:3.13-alpine
WORKDIR /app
COPY --from=builder /builder/authorizer ./authorizer/authorizer
COPY ./vault ./vault
RUN pip install --no-cache-dir -r vault/requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
COPY entrypoint.sh /
RUN adduser -S -H authorizer && adduser -S -H vault && \\
    chown -R authorizer:nobody /app/authorizer && \\
    chown -R vault:nobody /app/vault && \\
    chmod -R 700 /app/authorizer && \\
    chmod -R 700 /app/vault && \\
    chmod 700 /entrypoint.sh
ENV ICQ_FLAG=${flag}
RUN echo "${flag}" > /flag && chmod 400 /flag
ENTRYPOINT ["/entrypoint.sh"]
`;
      writeDockerfile(sub, dockerfile);
    }
  } else if (e.id === '2025-qwbs9-cele-race') {
    const dockerfile = `FROM ${BASE.python}:3.11-slim
WORKDIR /app
COPY requirements.txt ./
RUN sed -i 's|deb.debian.org|mirrors.tuna.tsinghua.edu.cn|g' /etc/apt/sources.list.d/debian.sources && sed -i 's|security.debian.org|mirrors.tuna.tsinghua.edu.cn|g' /etc/apt/sources.list.d/debian.sources && apt-get update && apt-get install -y --no-install-recommends gcc libc6-dev redis-server && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
COPY src ./src
COPY framework ./framework
COPY static ./static
COPY docker ./docker
COPY readflag.c ./readflag.c

RUN addgroup --system app && \\
    addgroup --system web && \\
    addgroup --system worker && \\
    useradd --system --home /app --no-create-home --shell /usr/sbin/nologin --gid web --groups app web && \\
    useradd --system --home /app --no-create-home --shell /usr/sbin/nologin --gid worker --groups app worker && \\
    usermod -a -G app redis && \\
    mkdir -p /var/lib/redis /var/run/redis /app/data && \\
    chown -R web:app /app/src /app/framework /app/static && \\
    chmod -R 0750 /app/src && \\
    chmod -R 0550 /app/framework /app/static && \\
    chown web:app /app && chmod 0551 /app && \\
    chown web:app /app/data && chmod 0770 /app/data && \\
    chown -R redis:redis /var/lib/redis /var/run/redis && \\
    chown redis:redis /app/docker/redis.conf /app/docker/redis.acl && chmod 0640 /app/docker/redis.conf /app/docker/redis.acl && chmod +x /app/docker/entrypoint.sh

ENV FLAG=${flag}
RUN echo "${flag}" > /flag && echo "${flag}" > /flag.txt && chmod 0400 /flag

RUN gcc /app/readflag.c -o /readflag && \\
    chown root:worker /readflag && \\
    chmod 4750 /readflag

ENTRYPOINT ["/app/docker/entrypoint.sh"]
`;
    writeDockerfile(target, dockerfile);
  } else if (e.id === '2025-qwbs9-go2php') {
    const dockerfile = `FROM ${BASE.php}:8.2-apache
ARG DEBIAN_FRONTEND=noninteractive
RUN sed -i 's|deb.debian.org|mirrors.tuna.tsinghua.edu.cn|g' /etc/apt/sources.list.d/debian.sources && sed -i 's|security.debian.org|mirrors.tuna.tsinghua.edu.cn|g' /etc/apt/sources.list.d/debian.sources && apt-get update && apt-get upgrade -y && \\
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends gcc
COPY ./go2php.so /usr/local/lib/php/extensions/no-debug-non-zts-20240924/
COPY ./catflag /
COPY ./start.sh /
COPY ./flag.txt /flag.txt
COPY ./index.php /var/www/html/index.php
COPY ./monitor.sh /home/ctf/
COPY ./php.ini /usr/local/etc/php/
RUN useradd -m ctf && \\
    chmod 777 /start.sh && \\
    chmod 400 /flag.txt && \\
    chmod 4755 /catflag && \\
    chmod -R 777 /var/www/html && \\
    chmod 777 /home/ctf/ && \\
    chmod +x /home/ctf/monitor.sh && \\
    chmod +x /start.sh
ENV FLAG=${flag}
RUN echo "${flag}" > /flag.txt && chmod 400 /flag.txt
EXPOSE 80
CMD ["/start.sh"]
`;
    writeDockerfile(target, dockerfile);
  } else if (e.id === 'hkctf-2025-labyrinth') {
    const dockerfile = `FROM ${BASE.eclipseTemurin}:17-jdk-jammy
WORKDIR /app
COPY Labyrinth-0.0.1-SNAPSHOT.jar /app/app.jar
ENV FLAG=${flag}
RUN echo "${flag}" > /flag
EXPOSE 8080
CMD ["java", "-jar", "/app/app.jar"]
`;
    writeDockerfile(target, dockerfile);
  } else if (e.id === 'hkctf-2025-ezjs') {
    const dockerfile = `FROM ${BASE.node}:20-alpine
WORKDIR /app
COPY src/package.json ./
RUN npm install
COPY src/app.js ./
ENV FLAG=${flag}
RUN echo "${flag}" > /flag
EXPOSE 80
CMD ["node", "app.js"]
`;
    writeDockerfile(target, dockerfile);
  } else if (e.id === 'hkctf-2025-nettool') {
    const dockerfile = `FROM ${BASE.python}:3.11-slim
WORKDIR /app
RUN python3 -m pip install --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple fastapi uvicorn jinja2 httpx pydantic pyjwt python-multipart
COPY app ./app
ENV FLAG=${flag}
RUN echo "${flag}" > /flag
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
`;
    writeDockerfile(target, dockerfile);
  } else if (e.id === '2026-nco-final-pino') {
    const appPath = path.join(target, 'app.py');
    replaceInFile(appPath, 'GZCTF_FLAG', 'FLAG');
    const dockerfile = `FROM ${BASE.python}:3.11-slim
WORKDIR /app
RUN python3 -m pip install --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple flask
COPY app.py .
ENV FLAG=${flag}
RUN echo "${flag}" > /flag && echo "${flag}" > /tmp/flag.txt
EXPOSE 5007
CMD ["python3", "-u", "app.py"]
`;
    writeDockerfile(target, dockerfile);
  } else if (e.id === '2026-nco-final-what-can-i-say') {
    const appPath = path.join(target, 'app.py');
    replaceInFile(appPath, 'GZCTF_FLAG', 'FLAG');
    const dockerfile = `FROM ${BASE.python}:3.11-slim
WORKDIR /app
RUN python3 -m pip install --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple flask cryptography
COPY app.py .
ENV FLAG=${flag}
RUN echo "${flag}" > /flag && echo "${flag}" > /tmp/flag.txt
EXPOSE 5005
CMD ["python3", "-u", "app.py"]
`;
    writeDockerfile(target, dockerfile);
  } else if (e.id === '2024-pandacup-gateway') {
    const dockerfile = `FROM ${BASE.ubuntu}:22.04
RUN sed -i "s#http://archive.ubuntu.com#http://mirrors.tuna.tsinghua.edu.cn#g" /etc/apt/sources.list && \\
    apt-get update && apt-get -y dist-upgrade && \\
    apt-get install -y lib32z1 nginx spawn-fcgi fcgiwrap netcat && \\
    rm -rf /var/lib/apt/lists/*
RUN mkdir -p /usr/share/cgi-bin
COPY ./http /usr/share/cgi-bin/
COPY ./default /etc/nginx/sites-available/default
COPY ./start.sh /start.sh
RUN chmod 777 /usr/share/cgi-bin/http && echo "<html>Hello, ctfer!</html>" > /var/www/html/index.html && \\
    chmod +x /start.sh
ENV FLAG=${flag}
RUN echo "${flag}" > /flag && chown www-data:www-data /flag
WORKDIR /
CMD ["/start.sh"]
EXPOSE 80
`;
    writeDockerfile(target, dockerfile);
  }

  registry.challenges.push({
    id: e.id,
    title: e.title,
    contest: e.contest,
    category: 'web',
    difficulty: e.difficulty,
    port: e.port,
    image: `localtrain/ctf-${e.id}:latest`,
    flag,
    source: { repo: e.contest, path: e.sourcePath, url: '' },
    writeup: null,
    writeupLocal: null,
    dir: `docker/ctf-contests/${e.targetDir}`,
    hasDockerfile: true,
    flagMechanism: e.flagMechanism,
    notes: e.notes,
    status: 'pending',
    built: false,
  });
}

fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2), 'utf8');
console.log(`[登记] 已写入 ${REGISTRY_FILE}`);
