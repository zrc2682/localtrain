import fs from 'fs';
function mk(batch, contest, source, list) {
  return { batch, contest, source, challenges: list };
}
const H = 'https://github.com/hkcert-ctf/CTF-Challenges/tree/main/CTF-';
function hk(id, title, year, dir, flag, cat, diff, port) {
  return {
    id, title, contest: 'HKCERT CTF ' + year, category: cat, difficulty: diff, port,
    image: 'localtrain/ctf-' + id + ':latest', flag,
    source: { repo: 'hkcert-ctf/CTF-Challenges', path: 'CTF-' + year + '/' + dir },
    writeup: H + year + '/' + dir,
    dir: 'docker/ctf-contests/batch60-mix/' + id, status: 'pending',
    flagMechanism: 'ENV FLAG 烧入(原题为运行时 env 注入)',
  };
}
const c = [
  hk('hkcert22-rogue-secret-assistant', 'Rogue Secret Assistant', 2022, '01-rogue-secret-assistant', 'hkcert22{r0gue_4ss1st4nt_l0c4l}', 'web', 'medium', 1337),
  hk('hkcert22-king-of-rps', 'King of RPS', 2022, '02-king-of-rps', 'hkcert22{k1ng_0f_rps_l0c4l}', 'web', 'easy', 1337),
  hk('hkcert22-wordle', 'Wordle', 2022, '34-wordle', 'hkcert22{w0rd13_3xtra_th1cc}', 'web', 'medium', 1337),
  hk('hkcert23-the-flag-game', 'The Flag Game', 2023, '01-the-flag-game', 'hkcert23{th3_fl4g_g4m3_l0c4l}', 'web', 'medium', 80),
  hk('hkcert23-solitude', 'Solitude', 2023, '03-solitude', 'hkcert23{s0l1tud3_x5s_l0c4l}', 'web', 'hard', 1337),
  hk('hkcert23-json2csv', 'json2csv', 2023, '20-json2csv', 'hkcert23{js0n2csv_p0llut10n}', 'web', 'medium', 8080),
  hk('hkcert23-cipher-bridging', 'Cipher Bridging Service', 2023, '21-cipher-bridging-service', 'hkcert23{c1ph3r_br1dg3_l0c4l}', 'web', 'hard', 1337),
  hk('hkcert24-get-flag-yourself', 'Get Flag Yourself', 2024, '03-get-flag-yourself', 'hkcert24{g3t_fl4g_y0urs3lf_l0c4l}', 'web', 'medium', 3000),
];
fs.writeFileSync('docs/ctf-web-registry-batch60.json', JSON.stringify(mk(60, 'HKCERT CTF 2022-2024 重挖混合批', 'https://github.com/hkcert-ctf/CTF-Challenges', c), null, 2) + '\n');

function hk2(id, title, year, dir, flag, cat, diff, port) {
  const o = hk(id, title, year, dir, flag, cat, diff, port);
  o.dir = 'docker/ctf-contests/batch61-mix/' + id;
  return o;
}
const d = [
  hk2('hkcert24-void', 'Void', 2024, '09-void', 'hkcert24{v01d_pyj41l_l0c4l}', 'misc', 'medium', 1337),
  hk2('hkcert24-b6acp', 'B6ACP', 2024, '10-b6acp', 'hkcert24{b64_c0py_p4st3_l0c4l}', 'web', 'medium', 8000),
  hk2('hkcert24-cypress', 'Cypress', 2024, '12-cypress', 'hkcert24{cypress_1s_n0t_4_pl4nt}', 'web', 'hard', 80),
  hk2('hkcert24-bashed', 'Bashed', 2024, '22-bashed', 'hkcert24{b4sh3d_4g41n_l0c4l}', 'misc', 'easy', 1337),
  { id: 'nctf2024-h2-revenge', title: 'H2Revenge', contest: 'NCTF 2024', category: 'web', difficulty: 'hard', port: 8000, image: 'localtrain/ctf-nctf2024-h2-revenge:latest', flag: 'flag{nctf2024_h2_revenge_l0c4l}', source: { repo: 'X1cT34m/NCTF2024', path: 'Web/H2Revenge' }, writeup: 'https://github.com/X1cT34m/NCTF2024', dir: 'docker/ctf-contests/batch61-mix/nctf2024-h2-revenge', status: 'pending', flagMechanism: 'compose FLAG 已替换静态值' },
  { id: 'xyctf2025-fate', title: 'Fate', contest: 'XYCTF 2025', category: 'web', difficulty: 'hard', port: 8080, image: 'localtrain/ctf-xyctf2025-fate:latest', flag: 'XYCTF{Do4t_bElIevE_in_FatE_Y1s_Y0u_2_a_Js0n_ge1nus!}', source: { repo: 'saltedfisholdxu/XYCTF2025', path: 'Web/Fate' }, writeup: 'https://github.com/saltedfisholdxu/XYCTF2025', dir: 'docker/ctf-contests/batch61-mix/xyctf2025-fate', status: 'pending', flagMechanism: '源码内置静态 flag (js 原型链)' },
  { id: 'minil2023-pycalculator', title: 'pycalculator', contest: 'Mini L-CTF 2023', category: 'misc', difficulty: 'medium', port: 9999, image: 'localtrain/ctf-minil2023-pycalculator:latest', flag: 'miniL{pyc4lcul4t0r_l0c4l}', source: { repo: 'XDSEC/miniLCTF_2023', path: 'Challenges/pycalculator' }, writeup: 'https://github.com/XDSEC/miniLCTF_2023', dir: 'docker/ctf-contests/batch61-mix/minil2023-pycalculator', status: 'pending', flagMechanism: 'ENV FLAG 烧入, start.sh 写 /home/ctf/flag (python jail, TCP 探活)' },
  { id: 'geekgame3-emoji-wordle', title: 'Emoji Wordle', contest: 'GeekGame 3rd', category: 'web', difficulty: 'hard', port: 9000, image: 'localtrain/ctf-geekgame3-emoji-wordle:latest', flag: 'flag{s1Mp1e_brut3f0rc3}', source: { repo: 'PKU-GeekGame/geekgame-3rd', path: 'official_writeup/prob14-emoji' }, writeup: 'https://github.com/PKU-GeekGame/geekgame-3rd/tree/main/official_writeup/prob14-emoji', dir: 'docker/ctf-contests/batch61-mix/geekgame3-emoji-wordle', status: 'pending', flagMechanism: 'scala 源码内置三 flag(取 flag1), sbt 构建' },
];
fs.writeFileSync('docs/ctf-web-registry-batch61.json', JSON.stringify(mk(61, 'hkcert 重挖 + NCTF/XYCTF/miniL/GeekGame 残余混合批', '多仓库', d), null, 2) + '\n');
console.log('b60:', c.length, 'b61:', d.length);
