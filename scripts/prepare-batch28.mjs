import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const TARGET_BASE = path.join(ROOT, 'docker', 'ctf-contests');
const REGISTRY_FILE = path.join(ROOT, 'docs', 'ctf-web-registry-batch28.json');

const BASE = {
  node: 'docker.m.daocloud.io/library/node',
  python: 'docker.m.daocloud.io/library/python',
  golang: 'docker.m.daocloud.io/library/golang',
  alpine: 'docker.m.daocloud.io/library/alpine',
  jetty: 'docker.m.daocloud.io/library/jetty',
  nginx: 'docker.m.daocloud.io/library/nginx',
  dasctfPhp: 'docker.1ms.run/dasctfbase/web_php73_apache',
};

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
    id: '2022-xhlj-easy-api',
    title: 'easy_api',
    contest: '2022 西湖论剑',
    difficulty: 'medium',
    port: 8080,
    sourcePath: 'F:/Myprojects/localtrain/.tmp/batch2/x-2022-xhlj-web-easy_api/2022-xhlj-web-easy_api-master',
    targetDir: '2022-xhlj/2022-xhlj-easy-api',
    notes: 'Jetty 9.4 + ROOT.war；entrypoint 将 FLAG 写入 /tmp/flag',
    flagMechanism: 'ENV FLAG 注入，entrypoint 写入 /tmp/flag，同时写入 /flag',
  },
  {
    id: '2022-xhlj-node-magical-login',
    title: 'node_magical_login',
    contest: '2022 西湖论剑',
    difficulty: 'medium',
    port: 80,
    sourcePath: 'F:/Myprojects/localtrain/.tmp/batch2/x-2022-xhlj-web-node_magical_login/2022-xhlj-web-node_magical_login-master',
    targetDir: '2022-xhlj/2022-xhlj-node-magical-login',
    notes: 'Node + Express 登录鉴权；start.sh 将 FLAG 拆为 /flag1 和 /flag2',
    flagMechanism: 'ENV FLAG 注入，start.sh 拆分写入 /flag1 /flag2，同时写入 /flag',
  },
  {
    id: '2022-xhlj-real-ez-node',
    title: 'real_ez_node',
    contest: '2022 西湖论剑',
    difficulty: 'medium',
    port: 3000,
    sourcePath: 'F:/Myprojects/localtrain/.tmp/batch2/x-rez/2022-xhlj-web-real_ez_node-master',
    targetDir: '2022-xhlj/2022-xhlj-real-ez-node',
    notes: 'Node 8 + Express + lodash 原型链污染；start.sh 将 FLAG 写入 /flag.txt',
    flagMechanism: 'ENV FLAG 注入，start.sh 写入 /flag.txt，同时写入 /flag',
  },
  {
    id: '2022-mtgxs-easypickle',
    title: 'easypickle',
    contest: '2022 美团CTF',
    difficulty: 'medium',
    port: 8080,
    sourcePath: 'F:/Myprojects/localtrain/.tmp/batch2/x-easypickle/2022-mtgxs-web-easypickle-master',
    targetDir: '2022-mtgxs/2022-mtgxs-easypickle',
    notes: 'Flask + pickle 反序列化；entrypoint 将 FLAG 写入 /flag',
    flagMechanism: 'ENV FLAG 注入，entrypoint 写入 /flag',
  },
  {
    id: 'nctf-2023-waitwhat',
    title: 'waitwhat',
    contest: 'NCTF 2023',
    difficulty: 'medium',
    port: 80,
    sourcePath: 'F:/Myprojects/localtrain/.tmp/batch2/nctf-waitwhat-extract/docker-compose/docker',
    targetDir: 'nctf-2023/nctf-2023-waitwhat',
    notes: 'Node + Express 登录/正则封禁；/api/flag 读取当前目录 flag 文件',
    flagMechanism: '构建时写入 /app/flag 与 /flag',
  },
  {
    id: 'nctf-2023-webshellgen',
    title: 'webshellgen',
    contest: 'NCTF 2023',
    difficulty: 'medium',
    port: 80,
    sourcePath: 'F:/Myprojects/localtrain/.tmp/batch2/nctf-webshellgen-extract/webshellgenerator/docker',
    targetDir: 'nctf-2023/nctf-2023-webshellgen',
    notes: 'PHP + DASCTF base；flag.sh 通过 ENV DASFLAG 写入 /flag',
    flagMechanism: 'ENV DASFLAG 注入，base 镜像 entrypoint 写入 /flag',
  },
  {
    id: '2026-nco-quals-signature-generator',
    title: '个性签名生成器',
    contest: '2026 NCO Quals',
    difficulty: 'medium',
    port: 5000,
    sourcePath: 'F:/Myprojects/localtrain/.tmp/batch14/repos/2026-NCO-Quals/web/Web-中等夺旗-个性签名生成器',
    targetDir: '2026-nco-quals/2026-nco-quals-signature-generator',
    notes: 'Flask Jinja2 SSTI；需要把 GZCTF_FLAG 改为 FLAG 并监听 5000',
    flagMechanism: 'ENV FLAG 注入，/flag 校验文件',
  },
  {
    id: '2026-nco-quals-super-safe',
    title: '超级无敌保险箱',
    contest: '2026 NCO Quals',
    difficulty: 'easy',
    sourcePath: 'F:/Myprojects/localtrain/.tmp/batch14/repos/2026-NCO-Quals/web/Web-入门夺旗-超级无敌保险箱',
    targetDir: '2026-nco-quals/2026-nco-quals-super-safe',
    notes: '纯静态前端页面，flag 隐藏在 HTML 注释中；entrypoint 替换 NCO26 占位符',
    flagMechanism: 'ENV FLAG 注入，entrypoint sed 替换 HTML 注释后启动 nginx',
  },
  {
    id: '2023-hgame-guess-who-i-am',
    title: 'guess_who_i_am',
    contest: 'HGAME 2023',
    difficulty: 'medium',
    port: 80,
    sourcePath: 'F:/Myprojects/localtrain/.tmp/batch2/x-2023-hgame-week1-web-guess_who_i_am/2023-hgame-week1-web-guess_who_i_am-master',
    targetDir: '2023-hgame/2023-hgame-guess-who-i-am',
    notes: 'Go + Gin 答题爬虫；secret 同时作为 session 密钥和 flag',
    flagMechanism: 'ENV FLAG 注入，替换源码 secret，同时写入 /flag',
  },
  {
    id: '2023-hgame-shared-diary',
    title: 'shared_diary',
    contest: 'HGAME 2023',
    difficulty: 'medium',
    port: 8888,
    sourcePath: 'F:/Myprojects/localtrain/.tmp/batch2/x-2023-hgame-week4-web-shared_diary/2023-hgame-week4-web-shared_diary-master',
    targetDir: '2023-hgame/2023-hgame-shared-diary',
    notes: 'Node + Express + EJS 原型链污染；补充 /flag 路由供管理员读取',
    flagMechanism: 'ENV FLAG 注入，补充 /flag 路由，同时写入 /flag',
  },
];

const registry = {
  version: '1.0',
  note: '第二十八批比赛 Web 题目登记表。来源：2022 西湖论剑、2022 美团CTF、NCTF 2023、2026 NCO Quals、HGAME 2023。',
  challenges: [],
};

for (const e of entries) {
  const flag = `flag{batch28-${e.id.replace(/[^a-zA-Z0-9]/g, '-')}_${randHex()}}`;
  const target = path.join(TARGET_BASE, e.targetDir);

  console.log(`[复制] ${e.title} -> ${target}`);
  fs.rmSync(target, { recursive: true, force: true });
  copyRecursive(e.sourcePath, target);

  // 通用：写入 flag 文件
  writeFlag(target, flag);

  if (e.id === '2022-xhlj-easy-api') {
    const dockerfile = `FROM ${BASE.jetty}:9.4.49-jdk8\nUSER root\nCOPY ROOT.war /var/lib/jetty/webapps/root.war\nCOPY docker-entrypoint.sh /\nENV FLAG=${flag}\nRUN echo "${flag}" > /flag\nEXPOSE 8080\nENTRYPOINT ["/docker-entrypoint.sh"]\nCMD ["java","-jar","/usr/local/jetty/start.jar"]\n`;
    writeDockerfile(target, dockerfile);
  } else if (e.id === '2022-xhlj-node-magical-login') {
    const dockerfile = `FROM ${BASE.node}:lts-alpine3.15\nWORKDIR /usr/src/app\nCOPY ./app ./\nENV FLAG=${flag}\nRUN echo "${flag}" > /flag\nRUN npm install\nEXPOSE 80\nENTRYPOINT ["/bin/sh","./start.sh"]\n`;
    writeDockerfile(target, dockerfile);
  } else if (e.id === '2022-xhlj-real-ez-node') {
    const dockerfile = `FROM ${BASE.node}:8.1.2\nCOPY files/start.sh /start.sh\nRUN chmod +x /start.sh\nENV FLAG=${flag}\nRUN echo "${flag}" > /flag\nRUN mkdir /app && chown -R root:root /app && chmod -R 755 /app\nCOPY src /app/\nRUN cd /app && chmod +x /app/bin/www\nWORKDIR /app\nCMD /start.sh\n`;
    writeDockerfile(target, dockerfile);
  } else if (e.id === '2022-mtgxs-easypickle') {
    const dockerfile = `FROM ${BASE.python}:3.11-slim\nRUN python3 -m pip install --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple flask\nCOPY ./src/ /app\nCOPY ./service/docker-entrypoint.sh /\nENV FLAG=${flag}\nRUN echo "${flag}" > /flag\nEXPOSE 8080\nENTRYPOINT ["/bin/sh","/docker-entrypoint.sh"]\n`;
    writeDockerfile(target, dockerfile);
  } else if (e.id === 'nctf-2023-waitwhat') {
    const dockerfile = `FROM ${BASE.node}:20-alpine\nCOPY ./app /app\nWORKDIR /app\nENV FLAG=${flag}\nRUN echo "${flag}" > /flag && echo "${flag}" > /app/flag\nRUN npm install && chmod +x /app/run.sh\nENTRYPOINT ["/app/run.sh"]\n`;
    writeDockerfile(target, dockerfile);
  } else if (e.id === 'nctf-2023-webshellgen') {
    const dockerfile = `FROM ${BASE.dasctfPhp}:latest\nUSER root\nRUN sed -i 's|http://deb.debian.org|http://archive.debian.org|g' /etc/apt/sources.list && sed -i 's|http://security.debian.org|http://archive.debian.org|g' /etc/apt/sources.list && sed -i '/stretch-updates/d' /etc/apt/sources.list && sed -i '/buster-updates/d' /etc/apt/sources.list && apt-get update -o Acquire::Check-Valid-Until=false\nCOPY ./files /tmp/files\nRUN rm -rf /var/www/html && cp -r /tmp/files/html /var/www/html && chown -R root:root /var/www/html && chmod -R 755 /var/www/html && apt-get install -y --no-install-recommends gcc && gcc /tmp/files/readflag.c -o /readflag && chmod 4755 /readflag && mv /tmp/files/flag.sh /flag.sh && chmod 444 /flag.sh && rm -rf /tmp/files\nENV DASFLAG=${flag}\nRUN echo "${flag}" > /flag\nEXPOSE 80\n`;
    writeDockerfile(target, dockerfile);
  } else if (e.id === '2026-nco-quals-signature-generator') {
    const src = path.join(target, 'source.py');
    replaceInFile(src, "GZCTF_FLAG", "FLAG");
    replaceInFile(src, "port=5004", "port=5000");
    const dockerfile = `FROM ${BASE.python}:3.11-slim\nWORKDIR /app\nCOPY source.py .\nRUN python3 -m pip install --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple flask\nENV FLAG=${flag}\nRUN echo "${flag}" > /flag\nEXPOSE 5000\nCMD ["python3","-u","source.py"]\n`;
    writeDockerfile(target, dockerfile);
  } else if (e.id === '2026-nco-quals-super-safe') {
    const entrypoint = `#!/bin/sh\nsed -i "s|NCO26{xxxxxxxxx}|${flag}|g" /usr/share/nginx/html/index.html\nnginx -g 'daemon off;'\n`;
    fs.writeFileSync(path.join(target, 'entrypoint.sh'), entrypoint, 'utf8');
    const dockerfile = `FROM ${BASE.nginx}:alpine\nCOPY source.html /usr/share/nginx/html/index.html\nCOPY entrypoint.sh /entrypoint.sh\nENV FLAG=${flag}\nRUN chmod +x /entrypoint.sh\nEXPOSE 80\nENTRYPOINT ["/entrypoint.sh"]\n`;
    writeDockerfile(target, dockerfile);
  } else if (e.id === '2023-hgame-guess-who-i-am') {
    const route = path.join(target, 'internal', 'route', 'route.go');
    replaceInFile(route, 'secret := "hgame{Guess_who_i_am^Happy_Crawler}"', 'secret := os.Getenv("FLAG")');
    const dockerfile = `FROM ${BASE.golang}:1.23-alpine as builder\nWORKDIR /app\nADD . .\nENV GOPROXY=https://goproxy.cn,direct\nRUN go build ./cmd/main.go\nFROM ${BASE.alpine}:latest\nWORKDIR /app\nCOPY --from=builder /app/main /app/\nCOPY --from=builder /app/member.json /app/\nCOPY --from=builder /app/dist /app/dist\nENV FLAG=${flag}\nRUN echo "${flag}" > /flag\nENTRYPOINT ["/app/main"]\n`;
    writeDockerfile(target, dockerfile);
  } else if (e.id === '2023-hgame-shared-diary') {
    const app = path.join(target, 'app', 'app.js');
    let appCode = fs.readFileSync(app, 'utf8');
    const flagRoute = `\napp.get('/flag', (req, res) => {\n    if (req.session.role !== 'admin') {\n        return res.status(403).send('Forbidden');\n    }\n    res.send(process.env.FLAG || 'flag{placeholder}');\n});\n`;
    appCode = appCode.replace(/app\.listen\(8888, '0\.0\.0\.0'\);/, flagRoute + "app.listen(8888, '0.0.0.0');");
    fs.writeFileSync(app, appCode, 'utf8');
    const dockerfile = `FROM ${BASE.node}:20-alpine\nENV PROJECT_ENV production\nENV NODE_ENV production\nCOPY app /app\nWORKDIR /app\nENV FLAG=${flag}\nRUN echo "${flag}" > /flag\nRUN npm install\nEXPOSE 8888\nCMD ["node", "app.js"]\n`;
    writeDockerfile(target, dockerfile);
  }

  registry.challenges.push({
    id: e.id,
    title: e.title,
    contest: e.contest,
    category: 'web',
    difficulty: e.difficulty,
    port: e.port || 80,
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
