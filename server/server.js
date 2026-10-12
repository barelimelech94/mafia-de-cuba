// Local table server for playing without internet.
//   node server/server.js            (once: npm install)
// Serves the site over plain HTTP and keeps every table in memory. Phones on the same Wi-Fi talk to it over a
// WebSocket. The reducer in game.js is the only thing that changes a table, exactly as in the other modes.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { reduce, normalize, GameError } from '../game.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = process.env.MDC_DATA || path.join(ROOT, 'server', 'data');
const SNAPSHOT = path.join(DATA_DIR, 'tables.json');
const PORT = +process.env.PORT || 8080;
const TTL_MS = 12 * 3600 * 1000; // a table nobody touched for this long is dropped
const PING_MS = 3000;

const strip = (o) => JSON.parse(JSON.stringify(o));

// ---------- tables ----------
const tables = new Map(); // code -> { state, touched }
const subs = new Map();   // code -> Set<ws>

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
    const now = Date.now();
    for (const [code, t] of Object.entries(raw)) if (now - t.touched < TTL_MS) tables.set(code, { state: normalize(t.state), touched: t.touched });
  } catch { /* first run, or unreadable: start empty */ }
}
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const out = {};
      for (const [code, t] of tables) out[code] = t;
      fs.writeFileSync(SNAPSHOT + '.tmp', JSON.stringify(out));
      fs.renameSync(SNAPSHOT + '.tmp', SNAPSHOT);
    } catch (e) { console.warn('snapshot failed:', e.message); }
  }, 300);
}
setInterval(() => {
  const now = Date.now();
  for (const [code, t] of tables) if (now - t.touched > TTL_MS) { tables.delete(code); tell(code, { t: 'state', code, s: null, why: 'closed' }); }
  save();
}, 10 * 60 * 1000).unref();

function tell(code, msg) {
  const text = JSON.stringify(msg);
  for (const ws of subs.get(code) || []) if (ws.readyState === 1) ws.send(text);
}

// ---------- WebSocket protocol ----------
// client -> server: exists / create / sub / unsub / act / close   (requests carry an id and get {t:'res', id, ...})
// server -> client: state {code, s, why?}, res, ping
function handle(ws, m) {
  const reply = (extra) => m.id && ws.send(JSON.stringify({ t: 'res', id: m.id, ...extra }));
  const code = String(m.code || '').replace(/\D/g, '').slice(0, 4);
  switch (m.t) {
    case 'exists': return reply({ ok: true, v: tables.has(code) });
    case 'create': {
      if (code.length !== 4 || tables.has(code)) return reply({ ok: true, v: false });
      tables.set(code, { state: normalize(strip(m.state)), touched: Date.now() });
      save();
      return reply({ ok: true, v: true });
    }
    case 'sub': {
      if (code.length !== 4) return;
      if (!subs.has(code)) subs.set(code, new Set());
      subs.get(code).add(ws); ws.codes.add(code);
      const t = tables.get(code);
      return ws.send(JSON.stringify({ t: 'state', code, s: t ? t.state : null }));
    }
    case 'unsub': {
      subs.get(code)?.delete(ws); ws.codes.delete(code);
      return;
    }
    case 'act': {
      const t = tables.get(code);
      if (!t) return reply({ ok: false, err: 'השולחן לא קיים יותר.' });
      try {
        const next = normalize(strip(reduce(t.state, m.a)));
        t.state = next; t.touched = Date.now(); save();
        tell(code, { t: 'state', code, s: next });
        return reply({ ok: true, s: next });
      } catch (e) {
        if (!(e instanceof GameError)) console.warn('reduce failed:', e);
        return reply({ ok: false, err: e instanceof GameError ? e.message : 'שגיאה' });
      }
    }
    case 'close': {
      tables.delete(code); save();
      tell(code, { t: 'state', code, s: null, why: 'closed' });
      return reply({ ok: true });
    }
  }
}

// ---------- static files ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};
// Only the website itself is served: no server code, tests, snapshots, git data or node_modules.
const BLOCKED = /^(server|test|node_modules|\.git)(\/|$)|^\./;

// The same index.html as GitHub Pages, adjusted for this server: the tables live here, and the fonts are local.
function indexHtml() {
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  html = html.replace(/<link[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>\s*/g, '');
  return html.replace('</head>', '<link rel="stylesheet" href="vendor/fonts/fonts.css">\n<script>window.MDC_WS = "/ws";</script>\n</head>');
}

const server = http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, ''); } catch { res.writeHead(400).end(); return; }
  if (rel === '' || rel === 'index.html') {
    res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-store' });
    res.end(indexHtml());
    return;
  }
  const file = path.resolve(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep) || BLOCKED.test(path.relative(ROOT, file).split(path.sep).join('/'))) { res.writeHead(404).end('Not found'); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(buf);
  });
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });
wss.on('connection', (ws) => {
  ws.codes = new Set();
  ws.on('message', (data) => {
    let m;
    try { m = JSON.parse(data.toString()); } catch { return; }
    if (!m || typeof m !== 'object') return;
    try { handle(ws, m); } catch (e) { console.warn('handler failed:', e); }
  });
  const gone = () => { for (const c of ws.codes) subs.get(c)?.delete(ws); };
  ws.on('close', gone);
  ws.on('error', gone);
});
// Heartbeat: lets a phone tell "server is gone" from "server is quiet".
setInterval(() => {
  const text = JSON.stringify({ t: 'ping' });
  for (const ws of wss.clients) if (ws.readyState === 1) ws.send(text);
}, PING_MS).unref();

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) for (const n of list || []) if (n.family === 'IPv4' && !n.internal) out.push(n.address);
  return out;
}

load();
server.listen(PORT, '0.0.0.0', () => {
  console.log('\nהקופסה: שרת מקומי פועל. כל הטלפונים צריכים להיות באותה רשת Wi-Fi.\n');
  const ips = lanAddresses();
  if (!ips.length) console.log('לא נמצאה כתובת רשת. התחברו ל-Wi-Fi או הפעילו נקודה חמה.');
  for (const ip of ips) console.log(`  פתחו בטלפונים:  http://${ip}:${PORT}`);
  console.log(`\n  (אל תפתחו את localhost במחשב המארח: קוד ה-QR יצביע על localhost ולא יעבוד בטלפונים)\n`);
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); const out = {}; for (const [c, t] of tables) out[c] = t; fs.writeFileSync(SNAPSHOT, JSON.stringify(out)); } catch {}
  process.exit(0);
});
