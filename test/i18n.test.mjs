// Translations: both languages have the same keys and placeholders, every key the code uses exists, and no Hebrew is
// left hard-coded in the UI.   node test/i18n.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { t, tErr, setLang, getLang, ERR_EN, _dicts } from '../i18n.js';
import { reduce, newTable } from '../game.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const HEB = /[֐-׿]/;
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('✓', name); };
const ph = (v) => (typeof v === 'string' ? [...v.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',') : null);
const { he, en } = _dicts;

test('he and en have exactly the same keys', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(he).sort());
});

test('placeholders match between languages', () => {
  for (const k of Object.keys(he)) {
    if (typeof he[k] === 'string' && typeof en[k] === 'string') assert.equal(ph(en[k]), ph(he[k]), `placeholders differ for ${k}`);
    else for (const v of [he[k], en[k]]) for (const n of [1, 2, 5]) assert.ok(typeof v === 'function' ? v({ n }) : v); // plural helpers run
  }
});

test('English values contain no Hebrew; Hebrew values are not empty', () => {
  for (const [k, v] of Object.entries(en)) if (typeof v === 'string') assert.ok(!HEB.test(v) || k === 'lang.other', `Hebrew in en.${k}`);
  for (const [k, v] of Object.entries(he)) if (typeof v === 'string') assert.ok(v.length > 0, `empty he.${k}`);
});

test('every key used in app.js and index.html exists', () => {
  const keys = new Set();
  for (const m of read('app.js').matchAll(/\bt\('([\w.]+)'/g)) if (!m[1].endsWith('.')) keys.add(m[1]); // 'role.' + r is checked below
  for (const m of read('index.html').matchAll(/data-i18n(?:-aria|-ph)?="([\w.]+)"/g)) keys.add(m[1]);
  assert.ok(keys.size > 100);
  for (const k of keys) assert.ok(k in he, `missing key ${k}`);
  for (const r of ['henchman', 'fbi', 'cia', 'driver', 'cleaner', 'godfather', 'thief', 'urchin']) {
    assert.ok(`role.${r}` in he && `roleA.${r}` in he);
  }
});

test('no Hebrew is hard-coded in app.js (except the debug-table names)', () => {
  read('app.js').split('\n').forEach((line, i) => {
    if (HEB.test(line) && !line.includes("'אלי'")) assert.fail(`app.js:${i + 1} has hard-coded Hebrew: ${line.trim().slice(0, 80)}`);
  });
});

test('t() falls back and interpolates', () => {
  setLang('en');
  assert.equal(getLang(), 'en');
  assert.equal(t('lobby.count', { n: 1 }), '1 player at the table');
  assert.equal(t('lobby.count', { n: 3 }), '3 players at the table');
  assert.equal(t('no.such.key'), 'no.such.key');
  assert.equal(t('take.diamonds', { n: 1 }), 'Take 1 diamond and pass');
  setLang('he');
  assert.equal(t('lobby.count', { n: 1 }), '1 שחקן ליד השולחן');
  assert.equal(t('seat.you'), ' (אתה)');
});

test('every Hebrew error message in the code has an English translation', () => {
  const found = new Set();
  const grab = (src, re) => { for (const m of src.matchAll(re)) if (HEB.test(m[2]) && !m[2].includes('${')) found.add(m[2].replace(/\\'/g, "'")); };
  grab(read('game.js'), /fail\(\s*(['`])((?:\\.|(?!\1).)*)\1/g);
  grab(read('sync.js'), /GameError\(\s*(['`])((?:\\.|(?!\1).)*)\1/g);
  grab(read('sync.js'), /\|\|\s*(['`])((?:\\.|(?!\1).)*)\1/g);
  grab(read('sync.js'), /:\s*(['`])((?:\\.|(?!\1).)*)\1\s*\}/g);
  grab(read('server/server.js'), /err:\s*(['`])((?:\\.|(?!\1).)*)\1/g);
  grab(read('server/server.js'), /:\s*(['`])((?:\\.|(?!\1).)*)\1\s*\}\)/g);
  assert.ok(found.size > 40, `only found ${found.size} messages`);
  for (const msg of found) assert.ok(msg in ERR_EN, `no English for: ${msg}`);
  for (const [he_, en_] of Object.entries(ERR_EN)) { assert.ok(HEB.test(he_)); assert.ok(!HEB.test(en_), `Hebrew in translation of ${he_}`); }
});

test('tErr translates real reducer errors and leaves Hebrew alone in Hebrew mode', () => {
  const s = newTable('1234', 'h', 'Host');
  const msg = (fn) => { try { fn(); } catch (e) { return e.message; } return null; };
  const cases = [
    () => reduce(s, { type: 'start', by: 'h' }),                      // needs MIN_PLAYERS (numeric message)
    () => reduce(s, { type: 'kick', by: 'h', target: 'h' }),
    () => reduce(s, { type: 'hide', by: 'h', n: 1 }),
    () => reduce(s, { type: 'chat', by: 'ghost', text: 'x', now: 1 }),
  ];
  for (const c of cases) {
    const m = msg(c);
    assert.ok(m && HEB.test(m), 'expected a Hebrew reducer error');
    setLang('he'); assert.equal(tErr(m), m);
    setLang('en'); const en_ = tErr(m); assert.ok(!HEB.test(en_), `untranslated: ${m} -> ${en_}`);
  }
  assert.equal(tErr('something unknown'), 'something unknown');
  setLang('he');
});

console.log(`\n${passed} passed`);
