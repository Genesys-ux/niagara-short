// usage: node render.mjs <outdir> <frames: "a-b" or "1,2,3"> [step] [quality]
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

const [, , outdir = 'stills/a', spec = '0', step = '1', qual = '0.96'] = process.argv;
fs.mkdirSync(outdir, { recursive: true });

let frames = [];
for (const part of spec.split(',')) {
  const trimmed = part.trim();
  if (!trimmed) continue;
  if (trimmed.includes('-')) {
    const [a, b] = trimmed.split('-').map(Number);
    for (let f = a; f <= b; f += +step) frames.push(f);
  } else {
    frames.push(+trimmed);
  }
}

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
};

const root = process.env.WEB || path.resolve('web');
const srv = http.createServer((q, s) => {
  const urlPath = decodeURIComponent(q.url.split('?')[0]);
  if (urlPath === '/favicon.ico') {
    s.writeHead(204);
    return s.end();
  }
  const rel = urlPath.replace(/^\/+/, '') || 'index.html';
  const p = path.join(root, rel);
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    console.log('404:', urlPath);
    s.writeHead(404);
    return s.end();
  }
  const ext = path.extname(p);
  s.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(s);
}).listen(0, '127.0.0.1');

await new Promise((r) => srv.on('listening', r));

function resolveBrowser() {
  const pwExec = chromium.executablePath();
  if (pwExec && fs.existsSync(pwExec)) return undefined; // use Playwright bundled Chromium (e.g. GitHub Actions)
  const winCandidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const c of winCandidates) {
    if (fs.existsSync(c)) return c;
  }
  return undefined;
}

const executablePath = resolveBrowser();
const b = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  headless: true,
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--no-sandbox',
  ],
});

const pg = await b.newPage({ viewport: { width: 1080, height: 1920 } });
let hadError = false;
pg.on('console', (m) => {
  console.log('PAGE', m.type(), m.text());
  if (m.type() === 'error') hadError = true;
});
pg.on('pageerror', (e) => {
  console.log('ERR', e.message);
  hadError = true;
});

await pg.goto(`http://127.0.0.1:${srv.address().port}/index.html${process.env.HASH || ''}`);
await pg.waitForFunction(() => window.ready || window.err, null, { timeout: 180000 });
if (hadError || (await pg.evaluate(() => window.err))) {
  console.log('page error detected');
  await b.close();
  srv.close();
  process.exit(1);
}

const t0 = Date.now();
let rendered = 0;
for (let idx = 0; idx < frames.length; idx++) {
  const f = frames[idx];
  const outPath = path.join(outdir, `f${String(f).padStart(4, '0')}.jpg`);
  if (process.env.RESUME && fs.existsSync(outPath) && fs.statSync(outPath).size > 2000) continue;
  const d = await pg.evaluate(([fr, q]) => {
    if (window.location.hash === '#nd') window.DEBUG_ND = 1;
    if (window.location.hash === '#e') window.DEBUG_E = 1;
    window.renderFrame(fr);
    return document.getElementById('c').toDataURL('image/jpeg', q);
  }, [f, +qual]);
  fs.writeFileSync(outPath, Buffer.from(d.split(',')[1], 'base64'));
  rendered++;
  if (rendered % 50 === 0 || idx === frames.length - 1) {
    const elapsed = (Date.now() - t0) / 1000;
    console.log(`[${idx + 1}/${frames.length}] f${String(f).padStart(4, '0')} (${(rendered / Math.max(elapsed, 0.01)).toFixed(2)} fps)`);
  }
}

console.log(`done ${rendered} frames (${frames.length} requested), ${((Date.now() - t0) / Math.max(rendered, 1) / 1000).toFixed(2)} s/frame`);
await b.close();
srv.close();
if (hadError) process.exit(1);
