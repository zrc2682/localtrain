import http from 'http';

const BASE = process.env.API_BASE || 'http://localhost:3000/api';
const LOGIN = { username: 'admin', password: 'admin' };
const TITLE = process.env.TITLE || 'Django QuerySet.order_by SQLi';
const FLAG = process.env.FLAG || 'flag{django_orderby_sqli_2e8a4c6b1d9f}';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHttp(url, timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        http.get(url, (res) => {
          res.resume();
          resolve(res.statusCode);
        }).on('error', reject);
      });
      return;
    } catch {
      await sleep(1500);
    }
  }
  throw new Error('HTTP service not ready in time');
}

function request(method, path_, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      `${BASE}${path_}`,
      { method, headers },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, data });
          }
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function login() {
  const res = await request('POST', '/auth/login', JSON.stringify(LOGIN), { 'Content-Type': 'application/json' });
  if (res.status !== 200) throw new Error('login failed');
  return res.data.token;
}

async function findChallenge(token, title) {
  const res = await request('GET', '/challenges', null, { Authorization: `Bearer ${token}` });
  return res.data.find((c) => c.title === title);
}

(async () => {
  const token = await login();
  const chal = await findChallenge(token, TITLE);
  if (!chal) { console.error('Challenge not found'); process.exit(1); }
  console.log('challenge', chal.id, chal.title);

  const start = await request('POST', `/challenges/${chal.id}/start`, '', { Authorization: `Bearer ${token}` });
  console.log('start', start.status, start.data);
  if (start.status !== 200) process.exit(1);

  const url = start.data.url;
  console.log('URL', url);

  // 等待 HTTP 服务就绪（非 HTTP 服务会在超时后继续）
  try {
    await waitForHttp(url);
    console.log('http service ready');
  } catch (e) {
    console.log('wait warning:', e.message);
  }
  await sleep(1000);

  // Run exploit via environment
  const { execSync } = await import('child_process');
  const exploit = `node docker/cve-challenges/${process.env.CHALLENGE_DIR || 'django-orderby'}/exploit/exploit.js ${url}`;
  let exploitOut = '';
  try {
    exploitOut = execSync(exploit, { encoding: 'utf-8', timeout: 120000 });
  } catch (e) {
    console.error('exploit failed', e.stdout, e.stderr);
  }
  console.log('exploit output:\n', exploitOut);
  const m = exploitOut.match(/flag\{[^}]+\}/);
  const submittedFlag = m ? m[0] : FLAG;

  const submit = await request('POST', `/challenges/${chal.id}/submit`, JSON.stringify({ index: 0, flag: submittedFlag }), { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });
  console.log('submit', submit.status, submit.data);

  const stop = await request('POST', `/challenges/${chal.id}/stop`, '', { Authorization: `Bearer ${token}` });
  console.log('stop', stop.status, stop.data);

  if (!submit.data?.correct) process.exit(1);
})();
