// Mafia de Cuba — pure game logic. No DOM, no network.
// reduce(state, action) returns a NEW state, or throws GameError when the action is not allowed.

export const TOTAL_DIAMONDS = 15;
export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 12;
export const TOKEN_TYPES = ['henchman', 'fbi', 'cia', 'driver', 'cleaner'];
export const AGENTS = ['fbi', 'cia'];

export class GameError extends Error {}
const fail = (msg) => { throw new GameError(msg); };

// Official distribution, by total player count (Godfather included).
const DISTRIBUTION = {
  5: { henchman: 1, agents: 1, driver: 0 },
  6: { henchman: 1, agents: 1, driver: 1 },
  7: { henchman: 2, agents: 1, driver: 1 },
  8: { henchman: 3, agents: 1, driver: 1 },
  9: { henchman: 4, agents: 1, driver: 1 },
  10: { henchman: 4, agents: 2, driver: 1 },
  11: { henchman: 4, agents: 2, driver: 2 },
  12: { henchman: 5, agents: 2, driver: 2 },
};

export function tokensFor(n, { cleaner = false, rng = Math.random } = {}) {
  const d = DISTRIBUTION[n];
  if (!d) return null;
  const t = { henchman: d.henchman, fbi: 0, cia: 0, driver: d.driver, cleaner: 0 };
  if (d.agents === 2) { t.fbi = 1; t.cia = 1; }
  else if (rng() < 0.5) t.fbi = 1; else t.cia = 1;
  if (cleaner && t.henchman > 0) { t.henchman -= 1; t.cleaner = 1; }
  return t;
}

export function defaultJokers(n) { return n === 5 ? 0 : 2; }

export function newTable(code, hostId, hostName, now = Date.now()) {
  return normalize({
    code, hostId, createdAt: now, phase: 'lobby', round: 0,
    players: { [hostId]: { name: hostName, joinedAt: now } },
    order: [hostId],
    godfatherId: hostId,
    settings: { cleaner: false, jokers: 2 },
  });
}

// Firebase drops empty objects/arrays and nulls; fill every field back in.
export function normalize(s) {
  if (!s) return s;
  const o = { ...s };
  o.players = o.players || {};
  o.order = Array.isArray(o.order) ? o.order.filter(Boolean) : Object.values(o.order || {});
  o.settings = { cleaner: false, jokers: 2, ...(o.settings || {}) };
  o.box = o.box ? { diamonds: o.box.diamonds || 0, tokens: { ...zeroTokens(), ...(o.box.tokens || {}) } } : null;
  o.takes = o.takes || {};
  o.eliminated = o.eliminated || {};
  o.jokersGiven = o.jokersGiven || {};
  o.log = Array.isArray(o.log) ? o.log.filter(Boolean) : Object.values(o.log || {});
  o.bag = o.bag || null;
  o.accusation = o.accusation || null;
  o.reveal = o.reveal || null;
  o.result = o.result ? { ...o.result, winners: o.result.winners || [] } : null;
  o.hidden = o.hidden || 0;
  o.turn = o.turn || 0;
  o.recovered = o.recovered || 0;
  o.stolen = o.stolen || 0;
  o.jokers = o.jokers || 0;
  o.seq = o.seq || 0;
  o.bagDone = !!o.bagDone;
  return o;
}

const zeroTokens = () => ({ henchman: 0, fbi: 0, cia: 0, driver: 0, cleaner: 0 });
const clone = (s) => JSON.parse(JSON.stringify(s));

// ----- derived helpers -----
export function takers(s) {
  const i = s.order.indexOf(s.godfatherId);
  if (i < 0) return [];
  const out = [];
  for (let k = 1; k < s.order.length; k++) out.push(s.order[(i + k) % s.order.length]);
  return out;
}
export function currentTaker(s) { return s.phase === 'theft' ? takers(s)[s.turn] || null : null; }
export function rightNeighbor(s, id) {
  const i = s.order.indexOf(id);
  return s.order[(i - 1 + s.order.length) % s.order.length];
}
export function boxEmpty(box) {
  return box.diamonds === 0 && TOKEN_TYPES.every((t) => !box.tokens[t]);
}
// The role a player ended up with.
export function roleOf(s, id) {
  if (id === s.godfatherId) return 'godfather';
  const t = s.takes[id];
  if (!t) return null;
  if (t.kind === 'diamonds') return 'thief';
  if (t.kind === 'urchin') return 'urchin';
  return t.token;
}
export function isOut(s, id) { return !!s.eliminated[id]; }

// ----- reducer -----
export function reduce(state, action) {
  if (!state) fail('השולחן לא קיים');
  const s = normalize(clone(state));
  const by = action.by;
  const isHost = by === s.hostId;
  const p = action;

  switch (p.type) {
    case 'join': {
      if (s.players[by]) { s.players[by].name = p.name || s.players[by].name; return s; }
      if (s.phase !== 'lobby') fail('המשחק כבר התחיל. חכו לסיבוב הבא.');
      if (s.order.length >= MAX_PLAYERS) fail('השולחן מלא (12 שחקנים)');
      s.players[by] = { name: p.name, joinedAt: p.now || Date.now() };
      s.order.push(by);
      return s;
    }
    case 'rename': {
      if (!s.players[by]) fail('אתה לא בשולחן');
      s.players[by].name = p.name;
      return s;
    }
    case 'kick': {
      if (!isHost) fail('רק המארח יכול להוציא שחקנים');
      if (s.phase !== 'lobby' && s.phase !== 'end') fail('אפשר להוציא שחקנים רק בין סיבובים');
      if (p.target === s.hostId) fail('המארח לא יכול להוציא את עצמו');
      delete s.players[p.target];
      s.order = s.order.filter((x) => x !== p.target);
      if (s.godfatherId === p.target) s.godfatherId = s.hostId;
      return s;
    }
    case 'move': {
      if (!isHost) fail('רק המארח מסדר את המקומות');
      if (s.phase !== 'lobby') fail('אפשר לסדר מקומות רק בלובי');
      const i = s.order.indexOf(p.target);
      const j = i + p.dir;
      if (i < 0 || j < 0 || j >= s.order.length) return s;
      [s.order[i], s.order[j]] = [s.order[j], s.order[i]];
      return s;
    }
    case 'reorder': {
      if (!isHost) fail('רק המארח מסדר את המקומות');
      if (s.phase !== 'lobby') fail('אפשר לסדר מקומות רק בלובי');
      const i = s.order.indexOf(p.target);
      const j = Math.max(0, Math.min(s.order.length - 1, p.to | 0));
      if (i < 0 || i === j) return s;
      s.order.splice(i, 1);
      s.order.splice(j, 0, p.target);
      return s;
    }
    case 'setGodfather': {
      if (!isHost) fail('רק המארח בוחר סנדק');
      if (s.phase !== 'lobby') fail('אפשר לבחור סנדק רק בלובי');
      if (!s.players[p.target]) fail('השחקן לא בשולחן');
      s.godfatherId = p.target;
      return s;
    }
    case 'settings': {
      if (!isHost) fail('רק המארח משנה הגדרות');
      if (s.phase !== 'lobby') fail('אפשר לשנות הגדרות רק בלובי');
      if (typeof p.cleaner === 'boolean') s.settings.cleaner = p.cleaner;
      if (Number.isInteger(p.jokers)) s.settings.jokers = Math.max(0, Math.min(5, p.jokers));
      return s;
    }
    case 'start': {
      if (!isHost) fail('רק המארח מתחיל את המשחק');
      if (s.phase !== 'lobby') fail('המשחק כבר התחיל');
      const n = s.order.length;
      if (n < MIN_PLAYERS) fail(`צריך לפחות ${MIN_PLAYERS} שחקנים`);
      if (n > MAX_PLAYERS) fail(`אפשר עד ${MAX_PLAYERS} שחקנים`);
      if (!s.players[s.godfatherId]) s.godfatherId = s.order[0];
      const tokens = tokensFor(n, { cleaner: s.settings.cleaner && n >= 6, rng: p.rng });
      s.phase = 'setup';
      s.round += 1;
      s.box = { diamonds: TOTAL_DIAMONDS, tokens };
      s.hidden = 0; s.turn = 0; s.bag = null; s.bagDone = false;
      s.takes = {}; s.eliminated = {}; s.jokersGiven = {};
      s.recovered = 0; s.stolen = 0;
      s.jokers = n === 5 ? 0 : s.settings.jokers;
      s.accusation = null; s.reveal = null; s.result = null; s.log = [];
      return s;
    }
    case 'hide': {
      if (s.phase !== 'setup') fail('זה לא שלב ההכנה');
      if (by !== s.godfatherId) fail('רק הסנדק מחביא יהלומים');
      const n = p.n;
      if (!Number.isInteger(n) || n < 0 || n > 5) fail('אפשר להחביא בין 0 ל־5 יהלומים');
      s.hidden = n;
      s.box.diamonds = TOTAL_DIAMONDS - n;
      s.phase = 'theft';
      s.turn = 0;
      return s;
    }
    case 'bag': {
      if (s.phase !== 'theft') fail('הקופסה לא בסיבוב');
      if (currentTaker(s) !== by || s.turn !== 0) fail('רק השחקן הראשון יכול להכניס טוקן לשקית');
      if (s.bagDone) fail('כבר השתמשת בשקית');
      if (p.token) {
        if (!s.box.tokens[p.token]) fail('הטוקן הזה לא בקופסה');
        s.box.tokens[p.token] -= 1;
        s.bag = p.token;
      }
      s.bagDone = true;
      return s;
    }
    case 'take': {
      if (s.phase !== 'theft') fail('הקופסה לא בסיבוב');
      if (currentTaker(s) !== by) fail('הקופסה לא אצלך');
      const list = takers(s);
      const last = s.turn === list.length - 1;
      const empty = boxEmpty(s.box);
      if (p.kind === 'diamonds') {
        if (empty) fail('הקופסה ריקה');
        const n = p.n;
        if (!Number.isInteger(n) || n < 1) fail('צריך לקחת לפחות יהלום אחד');
        if (n > s.box.diamonds) fail('אין כל כך הרבה יהלומים בקופסה');
        s.box.diamonds -= n;
        s.takes[by] = { kind: 'diamonds', n };
      } else if (p.kind === 'token') {
        if (empty) fail('הקופסה ריקה');
        if (!TOKEN_TYPES.includes(p.token) || !s.box.tokens[p.token]) fail('הטוקן הזה לא בקופסה');
        s.box.tokens[p.token] -= 1;
        s.takes[by] = { kind: 'token', token: p.token };
      } else if (p.kind === 'nothing') {
        if (!empty && !last) fail('אסור לא לקחת כלום');
        s.takes[by] = { kind: 'urchin' };
      } else fail('פעולה לא מוכרת');
      s.bagDone = true;
      s.turn += 1;
      if (s.turn >= list.length) startInvestigation(s);
      return s;
    }
    case 'accuse': {
      if (s.phase !== 'investigation') fail('זה לא שלב החקירה');
      if (by !== s.godfatherId) fail('רק הסנדק מאשים');
      if (s.accusation) fail('יש כבר האשמה פתוחה');
      const t = p.target;
      if (!s.players[t] || t === s.godfatherId) fail('אי אפשר להאשים את השחקן הזה');
      if (isOut(s, t)) fail('השחקן הזה כבר הודח');
      if (s.jokersGiven[t]) fail('השחקן הזה כבר הואשם בטעות וקיבל וויסקי');
      s.seq += 1;
      s.accusation = { target: t, seq: s.seq };
      if (!s.settings.cleaner) resolve(s, null);
      return s;
    }
    case 'pow': {
      if (!s.accusation || s.accusation.seq !== p.seq) fail('מאוחר מדי');
      if (roleOf(s, by) !== 'cleaner') fail('רק המנקה יכול לירות');
      if (isOut(s, by)) fail('הודחת');
      if (s.accusation.target === by) fail('אי אפשר לירות בעצמך');
      resolve(s, by);
      return s;
    }
    case 'resolve': {
      if (!s.accusation || s.accusation.seq !== p.seq) return s; // already resolved: no-op
      resolve(s, null);
      return s;
    }
    case 'newRound': {
      if (!isHost) fail('רק המארח מתחיל סיבוב חדש');
      if (s.phase !== 'end') fail('הסיבוב עוד לא נגמר');
      if (p.godfatherId && s.players[p.godfatherId]) s.godfatherId = p.godfatherId;
      s.phase = 'lobby';
      s.box = null; s.takes = {}; s.eliminated = {}; s.jokersGiven = {};
      s.accusation = null; s.reveal = null; s.log = []; s.bag = null; s.bagDone = false;
      return s;
    }
    case 'abort': {
      if (!isHost) fail('רק המארח יכול לבטל סיבוב');
      s.phase = 'lobby';
      s.box = null; s.takes = {}; s.eliminated = {}; s.jokersGiven = {};
      s.accusation = null; s.reveal = null; s.log = []; s.result = null; s.bag = null; s.bagDone = false;
      return s;
    }
    default:
      fail('פעולה לא מוכרת');
  }
}

function startInvestigation(s) {
  s.phase = 'investigation';
  s.stolen = TOTAL_DIAMONDS - s.hidden - s.box.diamonds;
  s.recovered = 0;
  if (s.stolen === 0) end(s, 'godfather');
}

function addLog(s, entry) { s.log.push({ ...entry, seq: s.seq }); }

function resolve(s, cleanerId) {
  const target = s.accusation.target;
  const role = roleOf(s, target);
  const take = s.takes[target];
  s.accusation = null;

  if (cleanerId) {
    if (AGENTS.includes(role)) {
      s.reveal = { seq: s.seq, target, outcome: 'powAgent', role, by: cleanerId };
      addLog(s, s.reveal);
      return end(s, 'cleaner', { cleanerId });
    }
    s.eliminated[cleanerId] = 'pow';
    s.eliminated[target] = 'pow';
    const n = role === 'thief' ? take.n : 0;
    s.recovered += n;
    s.reveal = { seq: s.seq, target, outcome: 'pow', role, n, by: cleanerId };
    addLog(s, s.reveal);
    if (s.recovered >= s.stolen) end(s, 'godfather');
    return;
  }

  if (role === 'thief') {
    s.recovered += take.n;
    s.eliminated[target] = 'thief';
    s.reveal = { seq: s.seq, target, outcome: 'thief', role, n: take.n };
    addLog(s, s.reveal);
    if (s.recovered >= s.stolen) end(s, 'godfather');
    return;
  }
  if (AGENTS.includes(role)) {
    s.reveal = { seq: s.seq, target, outcome: 'agent', role };
    addLog(s, s.reveal);
    return end(s, 'agent', { agentId: target });
  }
  // Innocent (henchman, driver, cleaner, urchin)
  if (s.jokers > 0) {
    s.jokers -= 1;
    s.jokersGiven[target] = (s.jokersGiven[target] || 0) + 1;
    s.reveal = { seq: s.seq, target, outcome: 'innocent', role, jokersLeft: s.jokers };
    addLog(s, s.reveal);
    return;
  }
  s.eliminated[s.godfatherId] = 'noJokers';
  s.reveal = { seq: s.seq, target, outcome: 'godfatherOut', role };
  addLog(s, s.reveal);
  end(s, 'thieves');
}

function end(s, type, extra = {}) {
  s.phase = 'end';
  s.accusation = null;
  const winners = new Set();
  const ids = s.order;
  if (type === 'godfather') {
    winners.add(s.godfatherId);
    ids.forEach((id) => { const r = roleOf(s, id); if (r === 'henchman' || r === 'cleaner') winners.add(id); });
  } else if (type === 'agent') {
    winners.add(extra.agentId);
  } else if (type === 'cleaner') {
    winners.add(extra.cleanerId);
  } else if (type === 'thieves') {
    const thieves = ids.filter((id) => roleOf(s, id) === 'thief' && !isOut(s, id));
    const max = Math.max(0, ...thieves.map((id) => s.takes[id].n));
    thieves.filter((id) => s.takes[id].n === max).forEach((id) => winners.add(id));
    if (winners.size) ids.forEach((id) => { if (roleOf(s, id) === 'urchin') winners.add(id); });
  }
  // Drivers win when the player to their right wins (repeat: a driver can sit right of another driver).
  let changed = true;
  while (changed) {
    changed = false;
    ids.forEach((id) => {
      if (roleOf(s, id) === 'driver' && !winners.has(id) && winners.has(rightNeighbor(s, id))) {
        winners.add(id); changed = true;
      }
    });
  }
  s.result = { type, winners: [...winners], ...extra };
}
