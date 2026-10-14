import { firebaseConfig } from './config.js';
import { createSync } from './sync.js';
import { t, tErr, getLang, setLang, applyStatic } from './i18n.js';
import {
  newTable, takers, currentTaker, rightNeighbor, boxEmpty, roleOf, isOut, tokensFor,
  TOKEN_TYPES, AGENTS, MIN_PLAYERS, MAX_PLAYERS, GameError,
  DEFAULT_CHAT_TTL, MIN_CHAT_TTL, MAX_CHAT_TTL, DEFAULT_CHAT_COOLDOWN, MIN_CHAT_COOLDOWN, MAX_CHAT_COOLDOWN,
} from './game.js';

// ---------- small utils ----------
const $ = (sel) => document.querySelector(sel);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, area = localStorage) { try { return area.getItem(k); } catch { return null; } },
  set(k, v, area = localStorage) { try { v == null ? area.removeItem(k) : area.setItem(k, v); } catch {} },
};
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.hidden = true), 3200);
}

// ---------- icons ----------
const I = {
  gem: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 12h20L16 28z" fill="#d9ab52"/><path d="M6 12l4-6h12l4 6z" fill="#f0cf86"/><path d="M10 6l2 6 4-6 4 6 2-6M12 12l4 16 4-16" fill="none" stroke="#8a6224" stroke-width="1.2" stroke-linejoin="round"/></svg>',
  hat: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 21c3 2 21 2 24 0-1 3-23 3-24 0z" fill="currentColor"/><path d="M9 20c0-6 1-11 7-11s7 5 7 11c-4 1-10 1-14 0z" fill="currentColor"/><path d="M9 17c4 1 10 1 14 0" stroke="#9e2b21" stroke-width="2.2" fill="none"/></svg>',
  badge: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3l3.6 7.6 8.4 1-6.2 5.8 1.6 8.3L16 21.6l-7.4 4.1 1.6-8.3L4 11.6l8.4-1z" fill="currentColor"/></svg>',
  wheel: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="16" cy="16" r="3" fill="currentColor"/><path d="M16 19v8M13.4 14.5L6 11M18.6 14.5L26 11" stroke="currentColor" stroke-width="3"/></svg>',
  cross: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="9" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M16 3v8M16 21v8M3 16h8M21 16h8" stroke="currentColor" stroke-width="2.6"/></svg>',
  cap: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 19c0-7 5-11 11-11s11 3 11 8c0 2-2 3-4 3z" fill="currentColor"/><path d="M5 19h14c2 0 5 1 8 3H7c-1 0-2-1-2-3z" fill="currentColor" opacity=".7"/><circle cx="15" cy="8" r="2" fill="currentColor"/></svg>',
  crown: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 24l-1-14 7 6 5-9 5 9 7-6-1 14z" fill="#d9ab52"/><path d="M5 26h22" stroke="#d9ab52" stroke-width="2.4"/></svg>',
  bottle: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M13 3h6v6c0 2 4 3 4 8v10c0 1-1 2-2 2H11c-1 0-2-1-2-2V17c0-5 4-6 4-8z" fill="#c4813a"/><rect x="11" y="16" width="10" height="7" rx="1" fill="#f3e7cc"/><rect x="13" y="2" width="6" height="3" fill="#7a4a1f"/></svg>',
  // drag handle: an SVG (not a text glyph), so it can't be selected and always renders the same
  grip: '<svg viewBox="0 0 20 20" aria-hidden="true"><g fill="currentColor"><circle cx="7" cy="4.5" r="1.8"/><circle cx="13" cy="4.5" r="1.8"/><circle cx="7" cy="10" r="1.8"/><circle cx="13" cy="10" r="1.8"/><circle cx="7" cy="15.5" r="1.8"/><circle cx="13" cy="15.5" r="1.8"/></g></svg>',
};
const TOKEN_ICON = { henchman: I.hat, fbi: I.badge, cia: I.badge, driver: I.wheel, cleaner: I.cross };
const ROLE_ICON = { ...TOKEN_ICON, godfather: I.crown, thief: I.gem, urchin: I.cap };
const ROLES = ['henchman', 'fbi', 'cia', 'driver', 'cleaner', 'godfather', 'thief', 'urchin'];
const roleName = (r) => t('role.' + r);  // "Driver" (a label)
const roleA = (r) => t('roleA.' + r);    // "a driver" (inside a sentence)
// one portrait per role (roles/<role>.webp), preloaded so the pocket peek and the reveal never wait on the network
const ROLE_IMG = Object.fromEntries(ROLES.map((r) => [r, `roles/${r}.webp`]));
const roleImg = (r, cls = '') => ROLE_IMG[r] ? `<img class="roleimg ${cls}" src="${ROLE_IMG[r]}" alt="${roleName(r)}" draggable="false" decoding="async">` : '';
Object.values(ROLE_IMG).forEach((src) => { const im = new Image(); im.src = src; });

function roleGoal(s, id) {
  const r = roleOf(s, id);
  switch (r) {
    case 'godfather': return t('goal.godfather');
    case 'thief': return t('goal.thief');
    case 'henchman': return t('goal.henchman');
    case 'fbi': case 'cia': return t('goal.agent');
    case 'driver': return t('goal.driver', { name: esc(nameOf(s, rightNeighbor(s, id))) });
    case 'cleaner': return t('goal.cleaner');
    case 'urchin': return t('goal.urchin');
    default: return '';
  }
}
const nameOf = (s, id) => (s.players[id] && s.players[id].name) || t('player');
const gems = (n, max = 15) => `<div class="gem-row" aria-hidden="true">${I.gem.repeat(Math.min(n, max))}</div>`;
const chip = (tk, count) => `<span class="chip ${tk}">${TOKEN_ICON[tk]}${roleName(tk)}${count > 1 ? ` <span class="x">×${count}</span>` : ''}</span>`;
const tokenChips = (tokens) => {
  const list = TOKEN_TYPES.filter((tk) => tokens[tk] > 0);
  return list.length ? `<div class="chips">${list.map((tk) => chip(tk, tokens[tk])).join('')}</div>` : `<p class="muted">${t('noTokens')}</p>`;
};

// ---------- app state ----------
let sync;
const pidArea = () => (sync && sync.mode === 'local' ? sessionStorage : localStorage);
let pid;
let code = null;
let game = null;
let unsub = null;
let connected = true;
let drag = null; // active lobby drag-to-reorder gesture
const ui = {
  boxOpen: false, boxTurnKey: '', pick: null, pickN: 1, hideN: 0,
  pocket: false, accuseTarget: null, rules: false, menu: false,
  revealSeen: 0, revealAt: 0, accSeq: 0, accAt: 0, resolvedSent: 0,
  newGf: null, joining: false, busy: false, chatOpen: false, chatSeen: 0, chatLockUntil: 0,
};
const ui0 = { ...ui };

function newPid() { return 'p' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }

// ---------- solo debug mode: ?solo=N ----------
// One tab plays a whole table. N players (default 6) are seated up front; a bar at the bottom switches
// which phone you are looking at. State lives in LocalSync, so nothing else about the app changes.
// Keys 1-9 and 0 switch seats. The restart button reloads into a fresh table.
let soloIds = null;
const soloUi = {};
const SOLO_NAMES = getLang() === 'en'
  ? ['Alex', 'Ben', 'Cleo', 'Dana', 'Eli', 'Fay', 'Gus', 'Hana', 'Ivy', 'Jon', 'Kai', 'Lee']
  : ['אלי', 'בני', 'גיל', 'דנה', 'הילה', 'ויקי', 'זאב', 'חנה', 'טל', 'יעל', 'כרמל', 'לוי'];
async function bootSolo(n) {
  n = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, n));
  const c = '0000';
  try { localStorage.removeItem(`mdc.table.${c}`); } catch {}
  soloIds = Array.from({ length: n }, (_, i) => `solo${i + 1}`);
  await sync.create(c, newTable(c, soloIds[0], SOLO_NAMES[0]));
  for (let i = 1; i < n; i++) await sync.dispatch(c, { type: 'join', name: SOLO_NAMES[i], now: Date.now() + i, by: soloIds[i] });
  pid = soloIds[0];
  document.body.classList.add('solo');
  const bar = document.createElement('nav');
  bar.id = 'solo';
  document.body.appendChild(bar);
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.restart) location.reload();
    else soloSwitch(b.dataset.pid);
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
    const i = e.key === '0' ? 9 : +e.key - 1;
    if (soloIds[i]) soloSwitch(soloIds[i]);
  });
  openTable(c, false);
  setInterval(tick, 250);
  setInterval(renderSoloBar, 250);
  renderSoloBar();
}
function soloSwitch(id) {
  if (!soloIds || id === pid || !soloIds.includes(id)) return;
  soloUi[pid] = { ...ui };
  pid = id;
  for (const k of Object.keys(ui)) delete ui[k];
  Object.assign(ui, ui0, soloUi[id] || { revealSeen: game?.reveal?.seq || 0 });
  render();
  renderSoloBar();
}
let soloSig = '';
function renderSoloBar() {
  const bar = $('#solo');
  if (!bar || !game) return;
  const holder = currentTaker(game);
  const sig = [pid, game.phase, game.godfatherId, holder, ...soloIds.map((id) => nameOf(game, id))].join('|');
  if (sig === soloSig) return;
  soloSig = sig;
  bar.innerHTML = soloIds.map((id, i) => {
    const tags = (id === game.godfatherId ? ' 👑' : '') + (id === holder ? ' ●' : '');
    return `<button data-pid="${id}" class="${id === pid ? 'on' : ''}" title="${i + 1 > 9 ? 0 : i + 1}">${esc(nameOf(game, id))}${tags}</button>`;
  }).join('') + `<button data-restart="1" title="${esc(t('solo.new'))}">↻</button>`;
}

// ---------- boot ----------
async function boot() {
  applyStatic();
  $('#app').innerHTML = `<div class="hero"><h1>${t('app.title')}</h1><p class="muted">${t('boot.loading')}</p></div>`;
  try { sync = await createSync(firebaseConfig); }
  catch (e) { console.error(e); $('#app').innerHTML = `<div class="hero"><h1>${t('app.title')}</h1><p>${t('boot.fail')}</p></div>`; return; }
  pid = store.get('mdc.pid', pidArea()) || newPid();
  store.set('mdc.pid', pid, pidArea());
  sync.onConnection((c) => { connected = c; render(); });

  const params = new URLSearchParams(location.search);
  if (params.has('solo') && sync.mode === 'local') { await bootSolo(+params.get('solo') || 6); return; }
  const urlCode = (params.get('t') || '').replace(/\D/g, '').slice(0, 4);
  const saved = store.get('mdc.code', pidArea());
  if (saved && (!urlCode || urlCode === saved)) openTable(saved, false);
  else { ui.prefillCode = urlCode; render(); }
  setInterval(tick, 250);
}

function openTable(c, joinIfNew = true) {
  if (unsub) unsub();
  code = c; game = undefined; ui.joining = joinIfNew; ui.closedNotice = false; ui.chatOpen = false; ui.chatSeen = 0;
  store.set('mdc.code', c, pidArea());
  let first = true;
  unsub = sync.subscribe(c, (s, reason) => {
    if (ui.closing) return; // we are the host, closing the table ourselves
    if (s === null) {
      // the host closed the table, or stayed unreachable too long: the table is gone for everyone
      if (reason === 'closed' || !first) { tableClosed(); return; }
      toast(t('toast.noTable')); leaveTable();
      return;
    }
    if (first) { ui.revealSeen = s.reveal ? s.reveal.seq : 0; first = false; }
    game = s;
    autoJoin();
    render();
  }, { resume: !joinIfNew });
  render();
}

async function autoJoin() {
  if (!game || game.players[pid] || game.phase !== 'lobby' || ui.busy) return;
  if (!ui.joining) return;
  const name = store.get('mdc.name', pidArea()) || '';
  if (!name) return;
  await act({ type: 'join', name, now: Date.now() });
}

async function leaveTable(closeForAll = false) {
  if (closeForAll && code) {
    ui.closing = true;
    try { if (sync.close) await sync.close(code); else if (sync.forget) sync.forget(code); }
    catch (e) { console.error(e); }
    finally { ui.closing = false; }
  }
  if (unsub) unsub();
  unsub = null; code = null; game = null;
  store.set('mdc.code', null, pidArea());
  history.replaceState(null, '', location.pathname);
  render();
}

// The host closed the table (or vanished): drop this player back to the home screen with a lasting notice.
function tableClosed() {
  if (unsub) unsub();
  unsub = null; code = null; game = null;
  store.set('mdc.code', null, pidArea());
  history.replaceState(null, '', location.pathname);
  Object.assign(ui, { rules: false, menu: false, accuseTarget: null, joining: false, pocket: false, boxOpen: false, pick: null, closedNotice: true, chatOpen: false });
  render();
}

async function act(action) {
  if (!code) return false;
  ui.busy = true;
  try { await sync.dispatch(code, { ...action, by: pid }); return true; }
  catch (e) {
    if (e instanceof GameError) toast(tErr(e.message));
    else { console.error(e); toast(t('toast.wrong')); }
    return false;
  } finally { ui.busy = false; }
}

// ---------- timers ----------
function tick() {
  if (!game) return;
  renderChat(); // messages expire on their own clock, not on state updates
  const acc = game.accusation;
  if (acc) {
    if (ui.accSeq !== acc.seq) { ui.accSeq = acc.seq; ui.accAt = Date.now(); renderOverlay(); }
    const elapsed = Date.now() - ui.accAt;
    const limit = pid === game.godfatherId ? 4000 : 10000; // backup resolver if the godfather's phone drops
    if (elapsed >= limit && ui.resolvedSent !== acc.seq) { ui.resolvedSent = acc.seq; act({ type: 'resolve', seq: acc.seq }); }
    updateCountdown();
  }
  if (ui.revealAt && Date.now() - ui.revealAt > 1400 && !$('#overlay').dataset.shown) renderOverlay();
}
// A join that failed once (host busy, link blinked) is retried on its own until the player is seated.
setInterval(() => {
  if (code && game && ui.joining && !game.players[pid] && game.phase === 'lobby' && !ui.busy && Date.now() - (ui.joinTry || 0) > 2500) { ui.joinTry = Date.now(); autoJoin(); }
}, 1000);

// ---------- render ----------
function render() {
  renderChat();
  if (drag) { drag.stale = true; return; } // don't rebuild the DOM under a finger mid-drag
  const app = $('#app');
  if (!code) { app.innerHTML = viewHome(); renderOverlay(); return; }
  if (game === undefined) {
    app.innerHTML = `${band()}<div class="hero"><p class="muted">${connected ? t('connecting', { code: esc(code) }) : t('waitHost')}</p>
      <button class="ghost" data-act="leave">${t('backHome')}</button></div>`;
    return;
  }
  if (!game) return;
  const me = game.players[pid];
  let body;
  if (!me) body = viewOutsider();
  else if (game.phase === 'lobby') body = viewLobby();
  else if (game.phase === 'setup') body = viewSetup();
  else if (game.phase === 'theft') body = viewTheft();
  else if (game.phase === 'investigation') body = viewInvestigation();
  else body = viewEnd();
  const iHost = game.hostId === pid;
  const offline = connected ? '' : `<p class="notice">${sync.mode === 'p2p' && !iHost ? t('offline.p2p') : sync.mode === 'server' ? t('offline.server') : t('offline.net')}</p>`;
  const test = sync.mode === 'local' && !soloIds ? `<p class="notice">${t('test.tabs')}</p>` : '';
  app.innerHTML = band() + offline + test + body;
  if (game.phase === 'lobby') drawQR();
  renderOverlay();
  if (ui.gripFocus) { app.querySelector(`[data-drag="${ui.gripFocus}"]`)?.focus(); ui.gripFocus = null; }
}

function band() {
  return `<header class="band">
    <span class="title">${t('app.title')}</span>
    ${code ? `<span class="code num" aria-label="${t('band.code')}">${esc(code)}</span>` : ''}
    <button data-act="lang" lang="${getLang() === 'he' ? 'en' : 'he'}" aria-label="${t('lang.aria')}">${t('lang.other')}</button>
    <button data-act="rules">${t('band.rules')}</button>
    ${code ? `<button data-act="menu" aria-label="${t('band.menu')}">⋯</button>` : ''}
  </header>`;
}

// ----- home -----
function viewHome() {
  const name = store.get('mdc.name', pidArea()) || '';
  const test = sync.mode === 'local' ? `<p class="notice">${t('test.home')}</p>` : '';
  return `${band()}
  <div class="hero">
    <span class="hero-band">${t('home.band')}</span>
    <h1>${t('app.title')}</h1>
    <p class="sub">${t('home.sub')}</p>
  </div>
  ${ui.closedNotice ? `<section><div class="banner" role="alert"><h2>${t('home.closedTitle')}</h2>
    <p>${t('home.closedText')}</p></div></section>` : ''}
  ${test}
  <section>
    <label class="field">${t('field.name')}
      <input id="name" maxlength="16" autocomplete="nickname" placeholder="${t('field.namePh')}" value="${esc(name)}">
    </label>
  </section>
  <section>
    <h2>${t('home.join')}</h2>
    <input id="joincode" class="code-input num" inputmode="numeric" maxlength="4" placeholder="0000" aria-label="${t('band.code')}" value="${esc(ui.prefillCode || '')}">
    <button class="primary block" data-act="join">${t('home.joinBtn')}</button>
    <div class="or">${t('home.or')}</div>
    <button class="block" data-act="create">${t('home.create')}</button>
  </section>
  <p class="disclaimer">${t('home.disclaimer')}</p>`;
}

function readName() {
  const v = ($('#name')?.value || '').trim().slice(0, 16);
  if (!v) { toast(t('toast.needName')); $('#name')?.focus(); return null; }
  store.set('mdc.name', v, pidArea());
  return v;
}

async function createTable() {
  const name = readName(); if (!name) return;
  for (let i = 0; i < 6; i++) {
    const c = String(Math.floor(1000 + Math.random() * 9000));
    try {
      if (await sync.exists(c)) continue;
      if (await sync.create(c, newTable(c, pid, name))) { openTable(c, false); return; }
    } catch (e) { console.error(e); toast(t('toast.createFail')); return; }
  }
  toast(t('toast.createRetry'));
}

function joinTable() {
  const name = readName(); if (!name) return;
  const c = ($('#joincode')?.value || '').replace(/\D/g, '');
  if (c.length !== 4) { toast(t('toast.code4')); return; }
  openTable(c, true);
}

function viewOutsider() {
  const name = store.get('mdc.name', pidArea()) || '';
  if (game.phase === 'lobby') {
    return `<section><h2>${t('out.joining')}</h2>
      <label class="field">${t('field.name')}<input id="name" maxlength="16" value="${esc(name)}"></label>
      <button class="primary block" data-act="joinNow">${t('out.sit')}</button></section>`;
  }
  ui.joining = true;
  return `<section><div class="banner calm"><h2>${t('out.started')}</h2><p>${t('out.startedText')}</p></div></section>`;
}

// ----- lobby -----
function viewLobby() {
  const s = game, isHost = pid === s.hostId, n = s.order.length;
  const preview = tokensFor(Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, n)), { cleaner: s.settings.cleaner && n >= 6, rng: () => 0 });
  const link = `${location.origin}${location.pathname}?t=${s.code}`;
  const rows = s.order.map((id, i) => {
    const p = s.players[id];
    const tags = [
      id === s.godfatherId ? `<span class="tag gold">${t('tag.godfather')}</span>` : '',
      id === s.hostId ? `<span class="tag">${t('tag.host')}</span>` : '',
    ].join('');
    // Buttons first, drag handle last: the handle sits in the same spot on every row, and rows that lack the
    // crown / kick button simply give that room back to the name instead of leaving an empty gap.
    const ctrls = isHost ? `
      ${id !== s.godfatherId ? `<button class="icon ghost" data-act="gf" data-id="${id}" aria-label="${t('aria.setGf')}">${I.crown}</button>` : ''}
      ${id !== s.hostId ? `<button class="icon ghost" data-act="kick" data-id="${id}" aria-label="${t('aria.kick')}">✕</button>` : ''}
      <span class="grip" data-drag="${id}" role="button" tabindex="0" aria-label="${t('aria.drag')}">${I.grip}</span>` : '';
    return `<li class="${id === pid ? 'me' : ''}"><span class="seat num">${i + 1}</span><div class="pcell"><span class="pname">${esc(p.name)}</span>${tags}</div>${ctrls}</li>`;
  }).join('');
  const enough = n >= MIN_PLAYERS;
  return `
  <section>
    <p class="eyebrow">${t('lobby.table', { code: esc(s.code) })}${s.round ? t('lobby.round', { n: s.round + 1 }) : ''}</p>
    <h2>${t('lobby.count', { n })}</h2>
    <div class="row" style="align-items:flex-start">
      <div id="qr" style="background:#f3e7cc;border-radius:10px;padding:6px;line-height:0" aria-label="${t('lobby.qr')}"></div>
      <div class="stack grow" style="gap:8px">
        <p class="small muted">${t('lobby.scan', { code: esc(s.code) })}</p>
        <button data-act="copy" data-link="${esc(link)}">${t('lobby.copy')}</button>
      </div>
    </div>
  </section>
  ${isHost && sync.mode === 'p2p' ? `<p class="notice">${t('lobby.hostPhone')}</p>` : ''}
  <section>
    <h3>${t('lobby.seats')}</h3>
    <p class="small muted">${isHost ? t('lobby.seatsHost') : t('lobby.seatsGuest')}</p>
    <ul class="players">${rows}</ul>
  </section>
  ${isHost ? `
  <section>
    <h3>${t('lobby.settings')}</h3>
    <label class="switch"><span>${t('lobby.cleaner')} <span class="small muted">${t('lobby.cleanerHint')}</span></span>
      <input type="checkbox" id="cleaner" data-act="cleaner" ${s.settings.cleaner ? 'checked' : ''} ${n === 5 ? 'disabled' : ''}></label>
    <div class="switch"><span>${t('lobby.whiskey')}${n === 5 ? ` <span class="small muted">${t('lobby.whiskeyHint')}</span>` : ''}</span>
      <div class="row"><button class="icon" data-act="jokers" data-d="-1" aria-label="${t('aria.less')}">−</button><b class="num" style="min-width:1.5em;text-align:center">${s.settings.jokers}</b><button class="icon" data-act="jokers" data-d="1" aria-label="${t('aria.more')}">+</button></div></div>
  </section>` : ''}
  <section>
    <h3>${t('lobby.inBox')}</h3>
    <div class="row">${I.gem.replace('<svg', '<svg width="22" height="22"')}<b>${t('lobby.diamonds15')}</b></div>
    ${preview ? previewChips(preview) : ''}
    ${n === 5 ? `<p class="notice">${t('lobby.five')}</p>` : ''}
  </section>
  <section>
    ${isHost
      ? `<button class="primary block" data-act="start" ${enough ? '' : 'disabled'}>${enough ? t('lobby.start', { name: esc(nameOf(s, s.godfatherId)) }) : t('lobby.need', { n: MIN_PLAYERS - n })}</button>`
      : `<p class="center muted">${t('lobby.waitHost', { name: esc(nameOf(s, s.hostId)) })}</p>`}
  </section>`;
}

function previewChips(tk) {
  const one = tk.fbi + tk.cia === 1;
  const parts = ['henchman', 'driver', 'cleaner'].filter((k) => tk[k]).map((k) => chip(k, tk[k]));
  parts.splice(1, 0, one ? `<span class="chip fbi">${I.badge}${t('chip.agentEither')}</span>` : chip('fbi', 1) + chip('cia', 1));
  return `<div class="chips">${parts.join('')}</div>${one ? `<p class="small muted">${t('chip.agentNote')}</p>` : ''}`;
}

function drawQR() {
  const el = $('#qr');
  if (!el || !window.qrcode || !game) return;
  try {
    const q = window.qrcode(0, 'M');
    q.addData(`${location.origin}${location.pathname}?t=${game.code}`);
    q.make();
    el.innerHTML = q.createSvgTag({ cellSize: 3, margin: 0, scalable: false });
  } catch {}
}

// ----- setup -----
function viewSetup() {
  const s = game;
  if (pid !== s.godfatherId) {
    return `<section><div class="banner calm"><h2>${t('setup.preparing', { name: esc(nameOf(s, s.godfatherId)) })}</h2>
      <p>${t('setup.preparingText')}</p></div></section>
      <section><h3>${t('boxOrder')}</h3>${seatList(s)}</section>`;
  }
  return `<section>
    <p class="eyebrow">${t('setup.youGf')}</p>
    <h2>${t('setup.howMany')}</h2>
    <p class="muted">${t('setup.nobody')}</p>
    <div class="stepper"><button data-act="hideN" data-d="-1" aria-label="${t('aria.less')}">−</button><span class="val">${ui.hideN}</span><button data-act="hideN" data-d="1" aria-label="${t('aria.more')}">+</button></div>
    <p class="center muted num">${t('setup.stay', { n: 15 - ui.hideN })}</p>
    <button class="primary block" data-act="hide">${t('setup.close', { name: esc(nameOf(s, takers(s)[0])) })}</button>
  </section>`;
}

function seatList(s, opts = {}) {
  const list = takers(s), holder = currentTaker(s);
  const rows = [s.godfatherId, ...list].map((id) => {
    const tIdx = list.indexOf(id);
    let status = '';
    if (id === s.godfatherId) status = `<span class="tag gold">${t('tag.godfather')}</span>`;
    else if (s.phase === 'theft' && id === holder) status = `<span class="tag red">${t('seat.box')}</span>`;
    else if (s.phase === 'theft' && tIdx < s.turn) status = `<span class="tag">${t('seat.passed')}</span>`;
    if (opts.jokers && s.jokersGiven[id]) status += `<span class="tag teal">${t('seat.whiskey', { n: s.jokersGiven[id] })}</span>`;
    if (isOut(s, id)) status += `<span class="tag red">${t('seat.out')}</span>`;
    return `<li class="${id === pid ? 'me' : ''} ${isOut(s, id) ? 'out' : ''} ${s.phase === 'theft' && id === holder ? 'holder' : ''}">
      <span class="seat num">${s.order.indexOf(id) + 1}</span><div class="pcell"><span class="pname">${esc(nameOf(s, id))}${id === pid ? t('seat.you') : ''}</span>${status}</div></li>`;
  }).join('');
  return `<ul class="players">${rows}</ul>`;
}

// ----- pocket -----
function pocket(s) {
  if (pid === s.godfatherId) {
    return `<div class="pocket open"><div class="rolecard">${roleImg('godfather', 'card')}<div class="grow"><span class="role">${I.crown}${roleName('godfather')}</span><p class="small">${t('pocket.gf', { n: s.hidden, goal: roleGoal(s, pid) })}</p></div></div></div>`;
  }
  const take = s.takes[pid];
  if (!take) return '';
  if (!ui.pocket) {
    return `<div class="pocket" data-hold="pocket" role="button" tabindex="0" aria-label="${t('pocket.hold')}">
      <b>${t('pocket.title')}</b><span class="small muted">${t('pocket.peek')}</span></div>`;
  }
  const r = roleOf(s, pid);
  const jokers = s.jokersGiven[pid] ? `<p class="small">${I.bottle.replace('<svg', '<svg width="18" height="18" style="vertical-align:-4px"')} ${t('pocket.whiskey', { n: s.jokersGiven[pid] })}</p>` : '';
  return `<div class="pocket open" data-hold="pocket" role="button" tabindex="0"><div class="rolecard">
    ${roleImg(r, 'card')}
    <div class="grow">
      <span class="role">${ROLE_ICON[r]}<span>${roleName(r)}${r === 'thief' ? t('pocket.thiefN', { n: take.n }) : ''}</span></span>
      ${r === 'thief' ? gems(take.n) : ''}
      <p class="small">${roleGoal(s, pid)}</p>${jokers}
    </div></div>
  </div>`;
}

// ----- theft -----
function viewTheft() {
  const s = game, holder = currentTaker(s);
  const turnKey = `${s.round}:${s.turn}`;
  if (ui.boxTurnKey !== turnKey) { ui.boxTurnKey = turnKey; ui.boxOpen = false; ui.pick = null; ui.pickN = 1; }
  if (holder !== pid) {
    const myIdx = takers(s).indexOf(pid);
    const ahead = myIdx - s.turn;
    const note = myIdx < 0 ? '' : ahead > 0 ? `<p class="muted">${ahead === 1 ? t('theft.next') : t('theft.ahead', { n: ahead })}</p>` : '';
    return `<section><div class="banner calm"><p class="eyebrow">${t('theft.eyebrow')}</p><h2>${t('theft.boxWith', { name: esc(nameOf(s, holder)) })}</h2>${note}</div></section>
      ${s.takes[pid] || pid === s.godfatherId ? `<section>${pocket(s)}</section>` : ''}
      <section><h3>${t('boxOrder')}</h3>${seatList(s)}</section>`;
  }
  return `<section><p class="eyebrow">${t('theft.yourTurn', { n: s.turn + 1, total: takers(s).length })}</p>${boxView(s)}</section>`;
}

function boxView(s) {
  const box = s.box;
  if (!ui.boxOpen) {
    return `<div class="box closed"><span class="label">${t('box.label')}</span>
      <h2>${t('box.yours')}</h2><p class="muted">${t('box.hide')}</p>
      <button class="primary block" data-act="openBox">${t('box.open')}</button></div>`;
  }
  const list = takers(s);
  const last = s.turn === list.length - 1;
  const anyTokens = TOKEN_TYPES.some((tk) => box.tokens[tk] > 0);
  const contents = `<div class="gems"><span class="count num">${box.diamonds}</span>${I.gem}</div>${gems(box.diamonds)}
    <div><p class="small muted" style="margin-bottom:6px">${t('box.tokens')}</p>${tokenChips(box.tokens)}</div>
    <p class="small muted">${t('box.remember')}</p>`;

  if (boxEmpty(box)) {
    return `<div class="box lid-open"><span class="label">${t('box.label')}</span>${contents}
      <div class="banner"><h3>${t('box.emptyTitle')}</h3><p>${t('box.emptyText')}</p></div>
      <button class="primary block" data-act="takeNothing">${t('box.pretended')}</button></div>`;
  }
  if (s.turn === 0 && !s.bagDone && anyTokens) {
    const opts = TOKEN_TYPES.filter((tk) => box.tokens[tk] > 0).map((tk) => `<button data-act="bag" data-token="${tk}">${TOKEN_ICON[tk]}${roleName(tk)}</button>`).join('');
    return `<div class="box lid-open"><span class="label">${t('box.label')}</span>${contents}</div>
      <div class="stack"><h3>${t('bag.title')}</h3>
      <p class="small muted">${t('bag.text')}</p>
      <div class="choice">${opts}</div>
      <button class="block ghost" data-act="bag" data-token="">${t('bag.none')}</button></div>`;
  }
  const pick = ui.pick;
  const tokenBtns = TOKEN_TYPES.filter((tk) => box.tokens[tk] > 0).map((tk) =>
    `<button data-act="pickToken" data-token="${tk}" class="${pick && pick.kind === 'token' && pick.token === tk ? 'chosen' : ''}">${TOKEN_ICON[tk]}${roleName(tk)}</button>`).join('');
  const dChosen = pick && pick.kind === 'diamonds';
  let confirm = t('take.choose');
  if (pick) confirm = pick.kind === 'diamonds' ? t('take.diamonds', { n: ui.pickN }) : pick.kind === 'token' ? t('take.token', { token: roleName(pick.token) }) : t('take.nothing');
  const nextId = s.turn + 1 < list.length ? list[s.turn + 1] : null;
  return `<div class="box lid-open"><span class="label">${t('box.label')}</span>${contents}</div>
  <div class="stack">
    <h3>${t('take.title')}</h3>
    ${box.diamonds > 0 ? `<div class="stack" style="gap:8px">
      <button class="block ${dChosen ? 'chosen' : ''}" data-act="pickDiamonds">${I.gem.replace('<svg', '<svg width="22" height="22" style="vertical-align:-5px"')} ${t('take.diamondsBtn')}</button>
      ${dChosen ? `<div class="slider"><span class="val" id="pickval">${ui.pickN}</span>${box.diamonds > 1 ? `<input type="range" id="pickrange" dir="ltr" min="1" max="${box.diamonds}" step="1" value="${ui.pickN}" style="--p:${(ui.pickN - 1) / (box.diamonds - 1) * 100}%" aria-label="${t('take.howMany')}"><div class="ends num" dir="ltr"><span>1</span><span>${box.diamonds}</span></div>` : ''}</div>` : ''}
    </div>` : ''}
    ${tokenBtns ? `<p class="small muted">${t('take.orToken')}</p><div class="choice">${tokenBtns}</div>` : ''}
    ${last ? `<button class="block ghost ${pick && pick.kind === 'nothing' ? 'chosen' : ''}" data-act="pickNothing">${I.cap.replace('<svg', '<svg width="22" height="22" style="vertical-align:-5px;color:var(--muted)"')} ${t('take.urchinBtn')}</button>
      <p class="small muted">${t('take.urchinNote')}</p>` : ''}
    <button class="primary block" data-act="take" ${pick ? '' : 'disabled'}>${confirm}</button>
    <p class="small muted center">${nextId ? t('take.passTo', { name: esc(nameOf(s, nextId)) }) : t('take.passToGf')}</p>
  </div>`;
}

// ----- investigation -----
function viewInvestigation() {
  const s = game;
  const isGf = pid === s.godfatherId;
  const out = isOut(s, pid);
  const publicStats = `<div class="stats">
      <div class="stat"><b class="num">${s.recovered}</b><span>${t('inv.diamondsBack')}</span></div>
      <div class="stat"><b class="num">${s.jokers}</b><span>${t('inv.whiskeyGf')}</span></div>
      <div class="stat"><b class="num">${s.order.filter((id) => isOut(s, id)).length}</b><span>${t('inv.outCount')}</span></div></div>`;
  const logHtml = s.log.length ? `<section><h3>${t('inv.log')}</h3><ul class="log">${s.log.slice().reverse().map(logLine).join('')}</ul></section>` : '';

  if (isGf) {
    const left = s.box.diamonds;
    const rows = takers(s).map((id) => {
      const outP = isOut(s, id);
      const cleared = !!s.jokersGiven[id]; // already accused and found innocent: accusing again is not allowed
      const j = s.jokersGiven[id] ? `<span class="tag teal">${t('seat.whiskey', { n: s.jokersGiven[id] })}</span>` : '';
      return `<li class="${outP ? 'out' : ''}"><span class="seat num">${s.order.indexOf(id) + 1}</span><div class="pcell"><span class="pname">${esc(nameOf(s, id))}</span>${j}</div>
        ${outP ? `<span class="tag red">${t('seat.out')}</span>` : cleared ? `<span class="tag">${t('inv.cleared')}</span>` : `<button class="danger" style="min-height:40px;padding:6px 12px" data-act="accuse" data-id="${id}">${t('inv.accuse')}</button>`}</li>`;
    }).join('');
    return `<section>
      <p class="eyebrow">${t('inv.eyebrowGf')}</p>
      <div class="stats">
        <div class="stat"><b class="num">${s.stolen}</b><span>${t('inv.stolen')}</span></div>
        <div class="stat"><b class="num">${s.recovered}</b><span>${t('inv.recovered')}</span></div>
        <div class="stat"><b class="num">${s.jokers}</b><span>${t('inv.whiskey')}</span></div>
      </div>
      <div class="box"><span class="label">${t('inv.cameBack')}</span>
        <div class="gems"><span class="count num">${left}</span>${I.gem}</div>
        ${tokenChips(s.box.tokens)}
        <p class="small muted">${t('inv.hid', { n: s.hidden })}</p>
      </div>
    </section>
    <section>
      <h3>${t('inv.investigate')}</h3>
      <p class="small muted">${t('inv.investigateText')}</p>
      <ul class="players">${rows}</ul>
      <details><summary>${t('inv.goodQ')}</summary><ul>
        <li>${t('inv.q1')}</li>
        <li>${t('inv.q2')}</li>
        <li>${t('inv.q3')}</li>
        <li>${t('inv.q4')}</li>
        <li>${t('inv.q5')}</li>
      </ul></details>
    </section>${logHtml}`;
  }
  return `${out ? `<section><div class="silenced"><h2>${t('inv.youOut')}</h2><p>${t('inv.youOutText')}</p></div></section>` : ''}
    <section><p class="eyebrow">${t('inv.eyebrow')}</p>
      <h2>${t('inv.investigating', { name: esc(nameOf(s, s.godfatherId)) })}</h2>
      <p class="muted small">${t('inv.answer')}</p>
      ${publicStats}
    </section>
    <section>${pocket(s)}</section>
    <section><h3>${t('inv.atTable')}</h3>${seatList(s, { jokers: true })}</section>
    ${logHtml}`;
}

function logLine(e) {
  const s = game, who = esc(nameOf(s, e.target));
  switch (e.outcome) {
    case 'thief': return `<li class="thief">${t('log.thief', { who, n: e.n })}</li>`;
    case 'innocent': return `<li class="innocent">${e.role === 'urchin' ? t('log.innocentUrchin', { who }) : t('log.innocentRole', { who, role: roleA(e.role) })}</li>`;
    case 'agent': return `<li class="bad">${t('log.agent', { who, role: roleA(e.role) })}</li>`;
    case 'godfatherOut': return `<li class="bad">${t('log.godfatherOut', { who })}</li>`;
    case 'pow': return `<li class="bad">${t('log.pow', { by: esc(nameOf(s, e.by)), who, what: e.role === 'thief' ? t('log.powThief', { n: e.n }) : e.role === 'urchin' ? t('log.powUrchin') : roleA(e.role) })}</li>`;
    case 'powAgent': return `<li class="bad">${t('log.powAgent', { by: esc(nameOf(s, e.by)), who, role: roleA(e.role) })}</li>`;
    default: return '';
  }
}

// ----- end -----
function viewEnd() {
  const s = game, r = s.result || { winners: [] };
  const winners = new Set(r.winners);
  const titles = {
    godfather: [t('end.gf1'), t('end.gf2')],
    agent: [t('end.agent1'), t('end.agent2')],
    cleaner: [t('end.cleaner1'), t('end.cleaner2')],
    thieves: [t('end.thieves1'), winners.size ? t('end.thieves2') : t('end.thieves2none')],
  }[r.type] || [t('end.over'), ''];
  const iWon = winners.has(pid);
  const wnames = r.winners.map((id) => esc(nameOf(s, id))).join(', ') || t('end.nobody');
  const rows = s.order.map((id) => {
    const role = roleOf(s, id);
    const tk = s.takes[id];
    const take = id === s.godfatherId ? t('end.hid', { n: s.hidden }) : tk && tk.kind === 'diamonds' ? t('nDiamonds', { n: tk.n }) : '';
    return `<tr class="${winners.has(id) ? 'win' : ''}"><td class="num">${s.order.indexOf(id) + 1}</td>
      <td><b>${esc(nameOf(s, id))}</b>${isOut(s, id) ? ` <span class="tag red">${t('seat.out')}</span>` : ''}</td>
      <td>${role ? `<span class="rolecell">${roleImg(role, 'tiny')}${roleName(role)}</span>` : '—'}</td><td class="num">${esc(take)}</td><td>${winners.has(id) ? `<span class="tag ok">${t('end.won')}</span>` : ''}</td></tr>`;
  }).join('');
  const isHost = pid === s.hostId;
  const order = [...r.winners, ...s.order.filter((id) => !winners.has(id))];
  if (!ui.newGf || !s.players[ui.newGf]) ui.newGf = r.winners.find((id) => s.players[id]) || s.godfatherId;
  return `<section>
    <div class="banner"><p class="eyebrow" style="color:var(--gold-hi)">${t('end.eyebrow')}</p><h2>${titles[0]}</h2><p>${titles[1]}</p></div>
    <div class="banner calm"><h3>${iWon ? t('end.youWon') : t('end.youLost')}</h3><p>${t('end.winners', { names: wnames })}</p></div>
  </section>
  <section><h3>${t('end.whatEach')}</h3>
    <div class="tablewrap"><table class="reveal"><tbody>${rows}</tbody></table></div>
    <p class="small muted">${t('end.bag', { bag: s.bag ? roleName(s.bag) : t('end.bagNone'), n: s.box ? s.box.diamonds : 0 })}</p>
  </section>
  ${s.log.length ? `<section><h3>${t('end.investigation')}</h3><ul class="log">${s.log.map(logLine).join('')}</ul></section>` : ''}
  <section>
    ${isHost ? `<h3>${t('end.newRound')}</h3><p class="small muted">${t('end.newRoundText')}</p>
      <label class="field">${t('end.nextGf')}<select id="newgf" data-act="newgf">${order.map((id) => `<option value="${id}" ${id === ui.newGf ? 'selected' : ''}>${esc(nameOf(s, id))}${winners.has(id) ? t('end.wonSuffix') : ''}</option>`).join('')}</select></label>
      <button class="primary block" data-act="newRound">${t('end.backLobby')}</button>`
      : `<p class="center muted">${t('end.hostNew', { name: esc(nameOf(s, s.hostId)) })}</p>`}
  </section>`;
}

// ---------- overlays ----------
let lastOverlay = '';
function renderOverlay() {
  const ov = $('#overlay');
  let html = '';
  delete ov.dataset.shown;
  if (ui.rules) html = rulesSheet();
  else if (ui.menu) html = menuSheet();
  else if (game && game.accusation) html = accusationSheet();
  else if (game && game.reveal && game.reveal.seq > ui.revealSeen && game.players[pid]) html = revealSheet();
  else if (game && ui.accuseTarget && game.phase === 'investigation') html = confirmAccuseSheet();
  ov.hidden = !html;
  if (lastOverlay !== html) { lastOverlay = html; ov.innerHTML = html; }
}

function confirmAccuseSheet() {
  const s = game, id = ui.accuseTarget;
  const cost = s.jokers > 0 ? t('acc.costJokers', { n: s.jokers }) : t('acc.costNone');
  return `<div class="sheet accuse" role="dialog" aria-modal="true">
    <p class="who">${esc(nameOf(s, id))}</p>
    <p class="muted small">${cost}</p>
    <button class="danger block" style="font-family:var(--font-display);font-size:1.5rem;min-height:72px" data-act="confirmAccuse">${t('acc.cry')}</button>
    <button class="ghost block" data-act="cancelAccuse">${t('acc.notYet')}</button></div>`;
}

function accusationSheet() {
  const s = game, acc = s.accusation;
  const amCleaner = roleOf(s, pid) === 'cleaner' && !isOut(s, pid) && acc.target !== pid;
  const isTarget = acc.target === pid;
  return `<div class="sheet accuse" role="dialog" aria-modal="true">
    <p class="muted">${t('acc.accuses', { name: esc(nameOf(s, s.godfatherId)) })}</p>
    <p class="who">${isTarget ? t('acc.you') : esc(nameOf(s, acc.target))}</p>
    <p class="cry">${t('acc.cry')}</p>
    ${amCleaner ? `<button class="pow" data-act="pow">${t('acc.pow')}</button><p class="small muted">${t('acc.powNote')}</p>` : '<p class="count-ring num" id="countdown">…</p>'}
  </div>`;
}
function updateCountdown() {
  const el = $('#countdown'); if (!el) return;
  const left = Math.max(0, 4 - Math.floor((Date.now() - ui.accAt) / 1000));
  el.textContent = left > 0 ? left : '…';
}

function revealSheet() {
  const s = game, e = s.reveal;
  if (!ui.revealAt || ui.revealFor !== e.seq) { ui.revealAt = Date.now(); ui.revealFor = e.seq; }
  const who = esc(nameOf(s, e.target));
  if (Date.now() - ui.revealAt < 1400) {
    return `<div class="sheet accuse"><p class="who">${who}</p><p class="muted">${t('rev.emptying')}</p><p class="suspense">• • •</p></div>`;
  }
  const by = e.by ? esc(nameOf(s, e.by)) : '';
  let v = '', cls = 'gold', sub = '';
  switch (e.outcome) {
    case 'thief': v = t('rev.thiefV', { n: e.n }); sub = t('rev.thiefSub', { who, n: e.n }); break;
    case 'innocent': v = e.role === 'urchin' ? t('rev.emptyPockets') : t('rev.whoIs', { who, role: roleA(e.role) }); cls = 'good'; sub = t('rev.innocentSub', { who, n: e.jokersLeft }); break;
    case 'agent': v = t('rev.agentV', { role: roleName(e.role) }); cls = 'bad'; sub = t('rev.agentSub', { who }); break;
    case 'godfatherOut': v = t('rev.gfOutV'); cls = 'bad'; sub = e.role === 'urchin' ? t('rev.gfOutPockets', { who }) : t('rev.gfOutRole', { who, role: roleA(e.role) }); break;
    case 'pow': v = 'POW!'; cls = 'bad'; sub = t('rev.powSub', { by, who, what: e.role === 'thief' ? t('rev.powThief', { n: e.n }) : t('rev.powOther', { role: e.role === 'urchin' ? t('rev.powUrchin') : roleA(e.role) }) }); break;
    case 'powAgent': v = t('rev.powAgentV'); cls = 'gold'; sub = t('rev.powAgentSub', { by, who, role: roleA(e.role) }); break;
  }
  $('#overlay').dataset.shown = '1';
  return `<div class="sheet accuse" role="dialog" aria-modal="true"><p class="muted">${who}</p>
    ${e.role ? roleImg(e.role, 'big') : ''}
    <p class="verdict ${cls}">${v}</p><p>${sub}</p>
    <button class="primary block" data-act="closeReveal">${t('rev.continue')}</button></div>`;
}

function menuSheet() {
  const isHost = game && pid === game.hostId;
  const mid = game && game.phase !== 'lobby' && game.phase !== 'end';
  return `<div class="sheet" role="dialog" aria-modal="true">
    <h2>${t('menu.title')}</h2>
    <label class="field">${t('field.name')}<input id="rename" maxlength="16" value="${esc(store.get('mdc.name', pidArea()) || '')}"></label>
    ${isHost ? `<label class="field">${t('menu.chatTtl')}<input id="chattl" type="number" inputmode="numeric" min="${MIN_CHAT_TTL}" max="${MAX_CHAT_TTL}" value="${game.settings.chatTtl}"></label>
    <label class="field">${t('menu.chatCd')}<input id="chatcd" type="number" inputmode="numeric" min="${MIN_CHAT_COOLDOWN}" max="${MAX_CHAT_COOLDOWN}" value="${game.settings.chatCooldown}"></label>` : ''}
    <button class="primary" data-act="saveMenu">${t('menu.save')}</button>
    ${isHost && mid ? `<button class="danger" data-act="abort">${t('menu.abort')}</button>` : ''}
    ${isHost && sync.mode === 'p2p'
      ? `<p class="small muted">${t('menu.hostNote')}</p><button class="ghost" data-act="closeTable">${t('menu.closeTable')}</button>`
      : (isHost && sync.mode === 'server' ? `<button class="ghost" data-act="closeTable">${t('menu.closeTable')}</button>` : '') + `<button class="ghost" data-act="leave">${t('menu.leave')}</button>`}
    <button class="ghost" data-act="closeSheet">${t('menu.close')}</button></div>`;
}

// One save for everything in the menu: the name, and for the host the chat settings. Everything is checked first,
// and only what changed is sent. If a send fails, the menu stays open with the typed values.
async function saveMenu() {
  const name = ($('#rename')?.value || '').trim().slice(0, 16);
  if (!name) { toast(t('toast.needName2')); $('#rename')?.focus(); return; }
  const me = game && game.players[pid];
  const isHost = game && pid === game.hostId;
  const jobs = [];
  if (isHost) {
    const field = (id, min, max, label) => {
      const raw = ($(id)?.value || '').trim(), v = Math.round(+raw);
      if (raw === '' || !(v >= min && v <= max)) { toast(t('menu.range', { label, min, max })); $(id)?.focus(); return null; }
      return v;
    };
    const ttl = field('#chattl', MIN_CHAT_TTL, MAX_CHAT_TTL, t('menu.ttlLabel')); if (ttl === null) return;
    const cooldown = field('#chatcd', MIN_CHAT_COOLDOWN, MAX_CHAT_COOLDOWN, t('menu.cdLabel')); if (cooldown === null) return;
    if (ttl !== game.settings.chatTtl || cooldown !== game.settings.chatCooldown) jobs.push({ type: 'chatSettings', ttl, cooldown });
  }
  const renamed = name !== (store.get('mdc.name', pidArea()) || '') || (me && me.name !== name);
  store.set('mdc.name', name, pidArea());
  if (renamed && me) jobs.unshift({ type: 'rename', name });
  for (const a of jobs) if (!(await act(a))) return;
  ui.menu = false;
  render();
  if (renamed || jobs.length) toast(t('toast.saved'));
}

function rulesSheet() {
  return `<div class="sheet rules" role="dialog" aria-modal="true" aria-label="${t('rules.aria')}">
    <h2>${t('rules.title')}</h2>
    ${t('rules.html')}
    <button class="primary" data-act="closeSheet">${t('rules.ok')}</button></div>`;
}

// ---------- chat ----------
// The chat lives outside #app on purpose: render() rebuilds #app on every state change, which would wipe a half-typed
// message. A message is shown while it is younger than the table's chatTtl (set by the host in the menu); the
// reducer drops the expired ones from the state whenever the next message is sent.
const chatTtl = () => (game && game.settings.chatTtl) || DEFAULT_CHAT_TTL;
const chatCooldown = () => (game ? game.settings.chatCooldown ?? DEFAULT_CHAT_COOLDOWN : DEFAULT_CHAT_COOLDOWN);
function fmtTtl(sec) {
  if (sec === 1) return t('dur.second');
  if (sec === 60) return t('dur.minute');
  return sec % 60 === 0 ? t('dur.minutes', { n: sec / 60 }) : t('dur.seconds', { n: sec });
}
// Send stays locked for the table's chatCooldown (set by the host) after my last message: taken from the state, or
// from the moment I pressed send so it locks before the round trip. The reducer enforces the same limit.
function chatLocked() {
  const cd = chatCooldown() * 1000;
  const last = game.chatLast[pid];
  return Date.now() < Math.max(Math.min(ui.chatLockUntil, Date.now() + cd), last != null ? last + cd : 0);
}
// One color per player, so messages are easy to tell apart. 12 colors for up to 12 players, handed out by join
// order (not seat order, which the host reorders), so a player keeps the same color for the whole evening.
const CHAT_COLORS = ['#ff8a7a', '#7cc48f', '#6fb7ff', '#f5c451', '#c49bff', '#5fd3c8', '#ff9f43', '#ff7eb6', '#a3d65c', '#8fa8ff', '#e6b980', '#d6d6d6'];
function chatColor(id) {
  const ids = Object.keys(game.players).sort((a, b) => (game.players[a].joinedAt || 0) - (game.players[b].joinedAt || 0) || (a < b ? -1 : 1));
  const i = ids.indexOf(id);
  return i < 0 ? 'var(--muted)' : CHAT_COLORS[i % CHAT_COLORS.length]; // -1: the sender has left the table
}
let chatSig = '';
function renderChat() {
  const root = $('#chat');
  const on = !!(code && game && game.players[pid]);
  root.hidden = !on;
  if (!on) { chatSig = ''; return; }
  const ttl = chatTtl();
  const live = game.chat.filter((m) => Date.now() - m.at < ttl * 1000);
  if (ui.chatOpen) ui.chatSeen = game.chatSeq;
  const unread = !ui.chatOpen && live.some((m) => m.by !== pid && m.id > ui.chatSeen);
  $('#chatpanel').hidden = !ui.chatOpen;
  $('#chatbtn').hidden = ui.chatOpen;
  $('#chatbtn .dot').hidden = !unread;
  const cd = chatCooldown();
  $('#chatnote').textContent = t('chat.note', { ttl: fmtTtl(ttl) }) + (cd ? t('chat.noteRate', { cd: fmtTtl(cd) }) : '');
  $('#chatform button').disabled = chatLocked(); // re-checked every tick, so it unlocks on its own
  const sig = [pid, ttl, ...live.map((m) => m.id + nameOf(game, m.by) + chatColor(m.by))].join('|');
  if (sig === chatSig) return;
  chatSig = sig;
  const log = $('#chatlog');
  log.innerHTML = live.length
    ? live.map((m) => `<li class="${m.by === pid ? 'me' : ''}" style="--pc:${chatColor(m.by)}"><b>${esc(nameOf(game, m.by))}</b><span>${esc(m.text)}</span></li>`).join('')
    : `<li class="empty muted small">${t('chat.empty')}</li>`;
  log.scrollTop = log.scrollHeight;
}
async function sendChat() {
  const input = $('#chatinput');
  const text = input.value.trim();
  if (!text || chatLocked()) return; // locked: Enter does nothing and the text stays
  ui.chatLockUntil = Date.now() + chatCooldown() * 1000;
  renderChat();
  input.value = '';
  if (!(await act({ type: 'chat', text, now: Date.now() }))) {
    ui.chatLockUntil = 0; // nothing was sent, so nothing to wait for
    if (!input.value) input.value = text; // give the text back
    renderChat();
  }
  input.focus();
}
document.addEventListener('submit', (ev) => {
  if (ev.target.id !== 'chatform') return;
  ev.preventDefault();
  sendChat();
});

// ---------- events ----------
document.addEventListener('click', async (ev) => {
  wake();
  const el = ev.target.closest('[data-act]');
  if (!el || el.tagName === 'SELECT' || (el.tagName === 'INPUT' && el.type !== 'checkbox')) return;
  const a = el.dataset.act, id = el.dataset.id;
  switch (a) {
    case 'create': return createTable();
    case 'join': return joinTable();
    case 'joinNow': { const n = readName(); if (n) { ui.joining = true; await act({ type: 'join', name: n, now: Date.now() }); } return; }
    case 'lang': setLang(getLang() === 'he' ? 'en' : 'he'); lastOverlay = ''; chatSig = ''; return render();
    case 'rules': ui.rules = true; return renderOverlay();
    case 'menu': ui.menu = true; return renderOverlay();
    case 'closeSheet': ui.rules = false; ui.menu = false; return renderOverlay();
    case 'leave': ui.menu = false; ui.joining = false; return leaveTable();
    case 'closeTable': ui.menu = false; ui.joining = false; renderOverlay(); return leaveTable(true);
    case 'saveMenu': return saveMenu();
    case 'abort': ui.menu = false; renderOverlay(); return act({ type: 'abort' });
    case 'chatToggle': ui.chatOpen = !ui.chatOpen; if (ui.chatOpen) ui.chatSeen = game ? game.chatSeq : 0; renderChat(); if (ui.chatOpen) $('#chatinput').focus(); return;
    case 'copy': {
      const link = el.dataset.link;
      try { await navigator.clipboard.writeText(link); toast(t('toast.linkCopied')); }
      catch { toast(link); }
      return;
    }
    case 'move': return act({ type: 'move', target: id, dir: +el.dataset.dir });
    case 'gf': return act({ type: 'setGodfather', target: id });
    case 'kick': return act({ type: 'kick', target: id });
    case 'cleaner': return act({ type: 'settings', cleaner: el.checked });
    case 'jokers': return act({ type: 'settings', jokers: game.settings.jokers + +el.dataset.d });
    case 'start': ui.hideN = 0; return act({ type: 'start' });
    case 'hideN': ui.hideN = Math.max(0, Math.min(5, ui.hideN + +el.dataset.d)); return render();
    case 'hide': return act({ type: 'hide', n: ui.hideN });
    case 'openBox': ui.boxOpen = true; return render();
    case 'bag': return act({ type: 'bag', token: el.dataset.token || null });
    case 'pickDiamonds': ui.pick = { kind: 'diamonds' }; ui.pickN = Math.max(1, Math.min(ui.pickN, game.box.diamonds)); return render();
    case 'pickToken': ui.pick = { kind: 'token', token: el.dataset.token }; return render();
    case 'pickNothing': ui.pick = { kind: 'nothing' }; return render();
    case 'take': {
      const p = ui.pick; if (!p) return;
      const action = p.kind === 'diamonds' ? { type: 'take', kind: 'diamonds', n: ui.pickN } : p.kind === 'token' ? { type: 'take', kind: 'token', token: p.token } : { type: 'take', kind: 'nothing' };
      return act(action);
    }
    case 'takeNothing': return act({ type: 'take', kind: 'nothing' });
    case 'accuse': ui.accuseTarget = id; return renderOverlay();
    case 'cancelAccuse': ui.accuseTarget = null; return renderOverlay();
    case 'confirmAccuse': { const t = ui.accuseTarget; ui.accuseTarget = null; renderOverlay(); return act({ type: 'accuse', target: t }); }
    case 'pow': return act({ type: 'pow', seq: game.accusation && game.accusation.seq });
    case 'closeReveal': ui.revealSeen = game.reveal ? game.reveal.seq : ui.revealSeen; ui.revealAt = 0; return render();
    case 'newRound': return act({ type: 'newRound', godfatherId: ui.newGf });
  }
});
document.addEventListener('input', (ev) => {
  const r = ev.target;
  if (r.id !== 'pickrange' || !game || !game.box) return;
  const n = Math.max(1, Math.min(game.box.diamonds, +r.value || 1));
  ui.pickN = n;
  r.style.setProperty('--p', game.box.diamonds > 1 ? `${(n - 1) / (game.box.diamonds - 1) * 100}%` : '0%');
  const v = $('#pickval'); if (v) v.textContent = n;
  const b = $('[data-act="take"]'); if (b) b.textContent = t('take.diamonds', { n });
});
document.addEventListener('change', (ev) => {
  if (ev.target.id === 'newgf') ui.newGf = ev.target.value;
});
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter') return;
  if (['rename', 'chattl', 'chatcd'].includes(ev.target.id)) { ev.preventDefault(); saveMenu(); return; }
  if (ev.target.id === 'joincode' || (ev.target.id === 'name' && !code)) joinTable();
});

// Hold-to-peek pocket
const holdOn = (ev) => { if (ev.target.closest('[data-hold="pocket"]')) { ui.pocket = true; render(); } };
const holdOff = () => { if (ui.pocket) { ui.pocket = false; render(); } };
document.addEventListener('pointerdown', holdOn);
document.addEventListener('pointerup', holdOff);
document.addEventListener('pointercancel', holdOff);
document.addEventListener('contextmenu', (e) => { if (e.target.closest('[data-hold]')) e.preventDefault(); });
document.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && e.target.closest && e.target.closest('[data-hold="pocket"]') && !e.repeat) { e.preventDefault(); ui.pocket = true; render(); $('[data-hold="pocket"]')?.focus(); } });
document.addEventListener('keyup', (e) => { if ((e.key === ' ' || e.key === 'Enter') && ui.pocket) { ui.pocket = false; render(); $('[data-hold="pocket"]')?.focus(); } });

// ---------- drag to reorder seats (host, lobby) ----------
document.addEventListener('pointerdown', (ev) => {
  const grip = ev.target.closest && ev.target.closest('[data-drag]');
  if (!grip || drag || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
  const li = grip.closest('li'), ul = li && li.parentElement;
  if (!ul) return;
  ev.preventDefault();
  const rows = [...ul.children];
  const rects = rows.map((r) => r.getBoundingClientRect());
  const from = rows.indexOf(li);
  drag = {
    id: grip.dataset.drag, li, ul, rows, from, to: from, pointerId: ev.pointerId, grip,
    startY: ev.clientY, curY: ev.clientY, scrollY0: window.scrollY,
    centers: rects.map((r) => r.top + r.height / 2 + window.scrollY),
    step: rects[from].height + (rects[1] ? Math.max(0, rects[1].top - rects[0].bottom) : 6),
    raf: 0, stale: false,
  };
  try { grip.setPointerCapture(ev.pointerId); } catch {}
  li.classList.add('dragging');
  ul.classList.add('sorting');
  document.body.classList.add('seat-sorting');
  dragLoop();
});
function dragLoop() {
  if (!drag) return;
  const d = drag;
  // auto-scroll near the screen edges
  const edge = 80;
  if (d.curY < edge) window.scrollBy(0, -Math.ceil((edge - d.curY) / 6));
  else if (d.curY > window.innerHeight - edge) window.scrollBy(0, Math.ceil((d.curY - (window.innerHeight - edge)) / 6));
  const dy = d.curY - d.startY + (window.scrollY - d.scrollY0);
  d.li.style.transform = `translateY(${dy}px)`;
  const mid = d.centers[d.from] + dy; // dragged row's centre in page coordinates
  let to = d.from, best = Infinity;
  d.centers.forEach((c, i) => { const dist = Math.abs(c - mid); if (dist < best) { best = dist; to = i; } });
  d.to = to;
  d.rows.forEach((r, i) => {
    if (i === d.from) return;
    const shift = d.from < to && i > d.from && i <= to ? -d.step : d.from > to && i < d.from && i >= to ? d.step : 0;
    r.style.transform = shift ? `translateY(${shift}px)` : '';
  });
  d.raf = requestAnimationFrame(dragLoop);
}
document.addEventListener('pointermove', (ev) => {
  if (drag && ev.pointerId === drag.pointerId) { drag.curY = ev.clientY; ev.preventDefault(); }
}, { passive: false });
function endDrag(commit) {
  if (!drag) return;
  const d = drag; drag = null;
  cancelAnimationFrame(d.raf);
  try { d.grip.releasePointerCapture(d.pointerId); } catch {}
  d.rows.forEach((r) => { r.style.transform = ''; });
  d.li.classList.remove('dragging'); d.ul.classList.remove('sorting');
  document.body.classList.remove('seat-sorting');
  if (commit && d.to !== d.from) {
    // show the new order straight away; the state update re-renders with the same result
    d.ul.insertBefore(d.li, d.rows[d.to + (d.to > d.from ? 1 : 0)] || null);
    act({ type: 'reorder', target: d.id, to: d.to });
  } else if (d.stale) render();
}
document.addEventListener('pointerup', (ev) => { if (drag && ev.pointerId === drag.pointerId) endDrag(true); });
document.addEventListener('pointercancel', (ev) => { if (drag && ev.pointerId === drag.pointerId) endDrag(false); });
document.addEventListener('contextmenu', (e) => { if (e.target.closest && e.target.closest('[data-drag]')) e.preventDefault(); });
// keyboard fallback: arrows on the handle
document.addEventListener('keydown', (ev) => {
  const grip = ev.target.closest && ev.target.closest('[data-drag]');
  if (!grip || (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown')) return;
  ev.preventDefault();
  ui.gripFocus = grip.dataset.drag;
  act({ type: 'move', target: grip.dataset.drag, dir: ev.key === 'ArrowUp' ? -1 : 1 });
});

// ---------- back button ----------
// The browser's Back button steps back inside the app instead of leaving it.
// One sentinel history entry sits on top of the real one; each Back press pops it,
// we handle the press, and re-push it. Chrome ignores entries pushed before the
// first user interaction, so the sentinel is armed on the first tap.
let backArmed = false;
function armBack() {
  if (backArmed) return;
  backArmed = true;
  history.pushState({ mdc: 1 }, '', location.href);
}
['click', 'pointerup', 'touchend', 'keydown'].forEach((t) => document.addEventListener(t, armBack, { capture: true, passive: true }));

// Returns true when Back was consumed inside the app, false when the app should let go.
function handleBack() {
  if (ui.chatOpen) { ui.chatOpen = false; renderChat(); return true; }
  if (ui.rules || ui.menu) { ui.rules = false; ui.menu = false; renderOverlay(); return true; }
  if (game && ui.accuseTarget) { ui.accuseTarget = null; renderOverlay(); return true; }
  if (game && (game.accusation || (game.reveal && game.reveal.seq > ui.revealSeen && game.players[pid]))) return true; // can't dismiss a live accusation/reveal
  if (code && game === undefined) { ui.joining = false; leaveTable(); return true; } // still connecting: back to home
  if (code && game) {
    if (ui.pick) { ui.pick = null; render(); return true; }
    if (ui.boxOpen) { ui.boxOpen = false; render(); return true; }
    ui.menu = true; renderOverlay(); return true; // at a table: open the menu (has "leave") instead of exiting by accident
  }
  return false; // home screen: normal Back
}
window.addEventListener('popstate', () => {
  if (!backArmed) return;
  if (handleBack()) history.pushState({ mdc: 1 }, '', location.href);
  else { backArmed = false; history.back(); }
});

// Keep the screen awake during a game
let lock = null;
async function wake() {
  try { if (!lock && navigator.wakeLock) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => (lock = null)); } } catch {}
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wake(); });

boot();
