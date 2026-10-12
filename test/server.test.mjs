// Starts the real local server on a spare port and plays against it with WebSocket clients.
//   node test/server.test.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { newTable } from '../game.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 20000 + Math.floor(Math.random() * 20000);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'mdc-test-'));
let proc = null;
let passed = 0;
const t = async (name, fn) => { await fn(); passed++; console.log('✓', name); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function start() {
  proc = spawn(process.execPath, [path.join(ROOT, 'server', 'server.js')], { env: { ...process.env, PORT: String(PORT), MDC_DATA: DATA }, stdio: ['ignore', 'pipe', 'inherit'] });
  return new Promise((resolve, reject) => {
    proc.stdout.on('data', (d) => { if (String(d).includes(String(PORT))) resolve(); });
    proc.on('exit', (c) => reject(new Error('server exited early: ' + c)));
    setTimeout(() => reject(new Error('server did not start')), 5000);
  });
}
const stop = () => new Promise((resolve) => { proc.removeAllListeners('exit'); proc.once('exit', resolve); proc.kill('SIGTERM'); });

// A tiny client speaking the same protocol as ServerSync in sync.js.
function client() {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  const c = { ws, states: [], pending: new Map(), n: 0 };
  ws.on('message', (d) => {
    const m = JSON.parse(d);
    if (m.t === 'state') c.states.push(m);
    if (m.t === 'res') { const p = c.pending.get(m.id); c.pending.delete(m.id); p(m); }
  });
  c.ready = new Promise((r) => ws.on('open', r));
  c.req = (msg) => new Promise((resolve) => { const id = String(++c.n); c.pending.set(id, resolve); ws.send(JSON.stringify({ ...msg, id })); });
  c.sub = (code) => ws.send(JSON.stringify({ t: 'sub', code }));
  c.last = () => c.states[c.states.length - 1];
  return c;
}
const get = async (p) => { const r = await fetch(`http://127.0.0.1:${PORT}${p}`); return { status: r.status, type: r.headers.get('content-type'), text: await r.text() }; };

await start();
try {
  await t('serves the site with the server hook and local fonts, without Google Fonts', async () => {
    const r = await get('/');
    assert.equal(r.status, 200);
    assert.match(r.text, /window\.MDC_WS = "\/ws"/);
    assert.match(r.text, /vendor\/fonts\/fonts\.css/);
    assert.doesNotMatch(r.text, /googleapis|gstatic/);
    assert.match(r.text, /app\.js/);
  });

  await t('serves assets with the right types', async () => {
    assert.match((await get('/app.js')).type, /javascript/);
    assert.match((await get('/style.css')).type, /css/);
    assert.equal((await get('/vendor/fonts/suez-one-hebrew-400-normal.woff2')).status, 200);
    assert.equal((await get('/roles/thief.webp')).status, 200);
  });

  await t('does not serve server code, tests, git data or anything outside the site', async () => {
    for (const p of ['/server/server.js', '/test/server.test.mjs', '/.git/config', '/node_modules/ws/package.json', '/../etc/passwd', '/%2e%2e/%2e%2e/etc/passwd', '/server/data/tables.json']) {
      assert.equal((await get(p)).status, 404, p);
    }
  });

  const host = client(), other = client();
  await host.ready; await other.ready;

  await t('create, exists, and a taken code', async () => {
    assert.equal((await host.req({ t: 'exists', code: '4821' })).v, false);
    assert.equal((await host.req({ t: 'create', code: '4821', state: newTable('4821', 'p0', 'Host') })).v, true);
    assert.equal((await other.req({ t: 'exists', code: '4821' })).v, true);
    assert.equal((await other.req({ t: 'create', code: '4821', state: newTable('4821', 'x', 'X') })).v, false);
  });

  await t('subscribing to a missing table gets null; to a real one gets its state', async () => {
    other.sub('9999');
    await sleep(100);
    assert.equal(other.last().code, '9999'); assert.equal(other.last().s, null);
    host.sub('4821'); other.sub('4821');
    await sleep(100);
    assert.equal(host.last().s.hostId, 'p0');
    assert.equal(other.last().s.code, '4821');
  });

  const players = [host];
  await t('five players join and every subscriber sees every change', async () => {
    for (let i = 1; i < 5; i++) {
      const c = i === 1 ? other : client();
      await c.ready; c.sub('4821');
      const r = await c.req({ t: 'act', code: '4821', a: { type: 'join', name: 'P' + i, by: 'p' + i, now: Date.now() } });
      assert.equal(r.ok, true);
      players.push(c);
    }
    await sleep(150);
    for (const c of players) assert.equal(Object.keys(c.last().s.players).length, 5);
  });

  await t('a rejected action returns the rule message and changes nothing', async () => {
    const before = players[0].states.length;
    const r = await players[1].req({ t: 'act', code: '4821', a: { type: 'start', by: 'p1' } }); // only the host may start
    assert.equal(r.ok, false); assert.ok(r.err && r.err.length > 0);
    await sleep(100);
    assert.equal(players[0].states.length, before);
  });

  await t('the host starts the round and everyone is in the same phase', async () => {
    const r = await host.req({ t: 'act', code: '4821', a: { type: 'start', by: 'p0' } });
    assert.equal(r.ok, true, r.err);
    await sleep(150);
    for (const c of players) assert.equal(c.last().s.phase, r.s.phase);
    assert.notEqual(r.s.phase, 'lobby');
  });

  await t('the table survives a server restart', async () => {
    await sleep(500); // snapshot is written shortly after a change
    await stop(); await start();
    const c = client(); await c.ready; c.sub('4821'); await sleep(150);
    assert.equal(c.last().s.code, '4821');
    assert.notEqual(c.last().s.phase, 'lobby');
    c.ws.close();
  });

  await t('closing a table tells subscribers it is closed, then it no longer exists', async () => {
    const a = client(), b = client(); await a.ready; await b.ready;
    a.sub('4821'); b.sub('4821'); await sleep(100);
    assert.equal((await a.req({ t: 'close', code: '4821' })).ok, true);
    await sleep(100);
    assert.equal(b.last().s, null); assert.equal(b.last().why, 'closed');
    assert.equal((await b.req({ t: 'exists', code: '4821' })).v, false);
    a.ws.close(); b.ws.close();
  });

  await t('garbage messages do not crash the server', async () => {
    const g = client(); await g.ready;
    g.ws.send('not json'); g.ws.send('null'); g.ws.send(JSON.stringify({ t: 'act', code: '0000', a: {} })); g.ws.send(JSON.stringify({ t: 'create', code: 'abcd', state: {} }));
    await sleep(150);
    assert.equal((await g.req({ t: 'exists', code: '1234' })).ok, true);
    g.ws.close();
  });

  console.log(`\n${passed} tests passed`);
} catch (e) {
  console.error('\n✗ FAILED:', e);
  process.exitCode = 1;
} finally {
  if (proc) { proc.removeAllListeners('exit'); proc.kill('SIGKILL'); }
  fs.rmSync(DATA, { recursive: true, force: true });
  process.exit(process.exitCode || 0);
}
