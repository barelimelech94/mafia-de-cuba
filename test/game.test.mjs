import { reduce, newTable, takers, tokensFor, roleOf, normalize } from '../game.js';
import assert from 'node:assert/strict';

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('✓', name); };
const fb = (s) => normalize(JSON.parse(JSON.stringify(s, (k, v) => (v === null ? undefined : v)))); // mimic Firebase dropping nulls

function table(n, opts = {}) {
  let s = newTable('ABCD', 'p0', 'P0');
  for (let i = 1; i < n; i++) s = reduce(s, { type: 'join', by: 'p' + i, name: 'P' + i });
  if (opts.cleaner) s = reduce(s, { type: 'settings', by: 'p0', cleaner: true });
  s = reduce(s, { type: 'start', by: 'p0', rng: () => 0.1 });
  return s;
}
const act = (s, a) => fb(reduce(s, a));

t('distribution matches rulebook for 6-12', () => {
  const exp = { 6: [1, 1, 1], 7: [2, 1, 1], 8: [3, 1, 1], 9: [4, 1, 1], 10: [4, 2, 1], 11: [4, 2, 2], 12: [5, 2, 2] };
  for (const [n, [h, a, d]] of Object.entries(exp)) {
    const k = tokensFor(+n);
    assert.equal(k.henchman, h); assert.equal(k.fbi + k.cia, a); assert.equal(k.driver, d);
  }
  const c = tokensFor(8, { cleaner: true });
  assert.equal(c.henchman, 2); assert.equal(c.cleaner, 1);
});

t('cannot start with 4 players', () => {
  let s = newTable('X', 'a', 'A');
  ['b', 'c', 'd'].forEach((id) => (s = reduce(s, { type: 'join', by: id, name: id })));
  assert.throws(() => reduce(s, { type: 'start', by: 'a' }));
});

t('godfather wins after recovering everything; henchman + driver behind him win', () => {
  let s = table(6); // order p0..p5, godfather p0; takers p1..p5
  s = act(s, { type: 'hide', by: 'p0', n: 2 }); // 13 in box
  assert.equal(s.box.diamonds, 13);
  s = act(s, { type: 'bag', by: 'p1', token: null });
  s = act(s, { type: 'take', by: 'p1', kind: 'token', token: 'driver' }); // right neighbour = p0 godfather
  s = act(s, { type: 'take', by: 'p2', kind: 'diamonds', n: 3 });
  s = act(s, { type: 'take', by: 'p3', kind: 'token', token: 'henchman' });
  s = act(s, { type: 'take', by: 'p4', kind: 'diamonds', n: 4 });
  assert.throws(() => reduce(s, { type: 'take', by: 'p4', kind: 'diamonds', n: 1 }), /לא אצלך/);
  s = act(s, { type: 'take', by: 'p5', kind: 'token', token: 'fbi' });
  assert.equal(s.phase, 'investigation');
  assert.equal(s.stolen, 7);
  s = act(s, { type: 'accuse', by: 'p0', target: 'p3' }); // innocent → joker
  assert.equal(s.jokers, 1); assert.equal(s.jokersGiven.p3, 1); assert.equal(s.reveal.outcome, 'innocent');
  s = act(s, { type: 'accuse', by: 'p0', target: 'p2' });
  assert.equal(s.recovered, 3); assert.equal(s.eliminated.p2, 'thief');
  assert.throws(() => reduce(s, { type: 'accuse', by: 'p0', target: 'p2' }));
  s = act(s, { type: 'accuse', by: 'p0', target: 'p4' });
  assert.equal(s.phase, 'end'); assert.equal(s.result.type, 'godfather');
  assert.deepEqual(new Set(s.result.winners), new Set(['p0', 'p3', 'p1']));
});

t('accusing an agent ends the game', () => {
  let s = table(6);
  s = act(s, { type: 'hide', by: 'p0', n: 0 });
  s = act(s, { type: 'take', by: 'p1', kind: 'token', token: 'fbi' });
  for (const id of ['p2', 'p3', 'p4']) s = act(s, { type: 'take', by: id, kind: 'diamonds', n: 1 });
  s = act(s, { type: 'take', by: 'p5', kind: 'token', token: 'driver' });
  s = act(s, { type: 'accuse', by: 'p0', target: 'p1' });
  assert.equal(s.result.type, 'agent'); assert.deepEqual(s.result.winners, ['p1']);
});

t('no jokers left: godfather out, biggest remaining thief + urchins win; empty box → urchin', () => {
  let s = table(6);
  s = act(s, { type: 'hide', by: 'p0', n: 5 }); // 10 left
  s = act(s, { type: 'bag', by: 'p1', token: 'fbi' });
  assert.equal(s.bag, 'fbi');
  s = act(s, { type: 'take', by: 'p1', kind: 'token', token: 'henchman' });
  s = act(s, { type: 'take', by: 'p2', kind: 'diamonds', n: 6 });
  s = act(s, { type: 'take', by: 'p3', kind: 'diamonds', n: 4 });
  s = act(s, { type: 'take', by: 'p4', kind: 'token', token: 'driver' }); // right neighbour p3 (thief)
  assert.throws(() => reduce(s, { type: 'take', by: 'p5', kind: 'diamonds', n: 1 }), /ריקה/);
  s = act(s, { type: 'take', by: 'p5', kind: 'nothing' });
  assert.equal(roleOf(s, 'p5'), 'urchin');
  s = act(s, { type: 'accuse', by: 'p0', target: 'p2' }); // recovers 6, needs 10
  s = act(s, { type: 'accuse', by: 'p0', target: 'p1' }); // joker 1
  s = act(s, { type: 'accuse', by: 'p0', target: 'p5' }); // joker 2
  s = act(s, { type: 'accuse', by: 'p0', target: 'p4' }); // no jokers → godfather out
  assert.equal(s.result.type, 'thieves');
  assert.deepEqual(new Set(s.result.winners), new Set(['p3', 'p5', 'p4']));
});

t('cannot take nothing unless last or box empty', () => {
  let s = table(6);
  s = act(s, { type: 'hide', by: 'p0', n: 0 });
  assert.throws(() => reduce(s, { type: 'take', by: 'p1', kind: 'nothing' }));
  for (const id of ['p1', 'p2', 'p3', 'p4']) s = act(s, { type: 'take', by: id, kind: 'diamonds', n: 1 });
  s = act(s, { type: 'take', by: 'p5', kind: 'nothing' });
  assert.equal(s.phase, 'investigation'); assert.equal(s.stolen, 4);
});

t('cleaner: window, POW on thief eliminates both and returns diamonds; POW on agent wins alone', () => {
  let s = table(7, { cleaner: true });
  s = act(s, { type: 'hide', by: 'p0', n: 0 });
  s = act(s, { type: 'take', by: 'p1', kind: 'token', token: 'cleaner' });
  s = act(s, { type: 'take', by: 'p2', kind: 'diamonds', n: 2 });
  s = act(s, { type: 'take', by: 'p3', kind: 'token', token: 'fbi' });
  s = act(s, { type: 'take', by: 'p4', kind: 'diamonds', n: 1 });
  s = act(s, { type: 'take', by: 'p5', kind: 'token', token: 'henchman' });
  s = act(s, { type: 'take', by: 'p6', kind: 'token', token: 'driver' });
  s = act(s, { type: 'accuse', by: 'p0', target: 'p2' });
  assert.ok(s.accusation);
  assert.throws(() => reduce(s, { type: 'pow', by: 'p5', seq: s.accusation.seq }));
  const s2 = act(s, { type: 'pow', by: 'p1', seq: s.accusation.seq });
  assert.equal(s2.eliminated.p1, 'pow'); assert.equal(s2.eliminated.p2, 'pow'); assert.equal(s2.recovered, 2);
  const s3 = act(s, { type: 'resolve', by: 'p0', seq: s.accusation.seq });
  assert.equal(s3.eliminated.p2, 'thief'); assert.ok(!s3.eliminated.p1);
  // resolve twice is a no-op
  assert.equal(act(s3, { type: 'resolve', by: 'p4', seq: s.accusation.seq }).seq, s3.seq);
  let s4 = act(s3, { type: 'accuse', by: 'p0', target: 'p3' });
  s4 = act(s4, { type: 'pow', by: 'p1', seq: s4.accusation.seq });
  assert.equal(s4.result.type, 'cleaner'); assert.deepEqual(s4.result.winners, ['p1']);
});

t('new round keeps players and switches godfather; takers rotate from new godfather', () => {
  let s = table(6);
  s = act(s, { type: 'hide', by: 'p0', n: 0 });
  for (const id of ['p1', 'p2', 'p3', 'p4', 'p5']) s = act(s, { type: 'take', by: id, kind: 'diamonds', n: 1 });
  for (const id of ['p1', 'p2', 'p3', 'p4', 'p5']) if (s.phase !== 'end') s = act(s, { type: 'accuse', by: 'p0', target: id });
  assert.equal(s.result.type, 'godfather');
  s = act(s, { type: 'newRound', by: 'p0', godfatherId: 'p3' });
  assert.equal(s.phase, 'lobby');
  s = act(s, { type: 'start', by: 'p0' });
  assert.deepEqual(takers(s), ['p4', 'p5', 'p0', 'p1', 'p2']);
});

console.log(`\n${passed} tests passed`);
