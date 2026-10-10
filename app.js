import { firebaseConfig } from './config.js';
import { createSync } from './sync.js';
import {
  newTable, takers, currentTaker, rightNeighbor, boxEmpty, roleOf, isOut, tokensFor,
  TOKEN_TYPES, AGENTS, MIN_PLAYERS, MAX_PLAYERS, GameError,
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
const TOKEN_NAME = { henchman: 'חייל נאמן', fbi: 'סוכן FBI', cia: 'סוכן CIA', driver: 'נהג', cleaner: 'המנקה' };
const ROLE_NAME = { ...TOKEN_NAME, godfather: 'הסנדק', thief: 'גנב', urchin: 'ילד רחוב' };
// one portrait per role (roles/<role>.webp), preloaded so the pocket peek and the reveal never wait on the network
const ROLE_IMG = Object.fromEntries(Object.keys(ROLE_NAME).map((r) => [r, `roles/${r}.webp`]));
const roleImg = (r, cls = '') => ROLE_IMG[r] ? `<img class="roleimg ${cls}" src="${ROLE_IMG[r]}" alt="${ROLE_NAME[r]}" draggable="false" decoding="async">` : '';
Object.values(ROLE_IMG).forEach((src) => { const im = new Image(); im.src = src; });

function roleGoal(s, id) {
  const r = roleOf(s, id);
  switch (r) {
    case 'godfather': return 'להחזיר את כל היהלומים שנגנבו. כל האשמה של מי שלא גנב עולה לך וויסקי, ואם נגמר הוויסקי, אתה מודח.';
    case 'thief': return 'לא להיתפס. אם הסנדק מודח, הגנב עם הכי הרבה יהלומים שעוד במשחק מנצח.';
    case 'henchman': return 'לעזור לסנדק לתפוס את הגנבים. אתה מנצח אם הסנדק מחזיר את כל היהלומים.';
    case 'fbi': case 'cia': return 'לגרום לסנדק להאשים אותך. אם הוא מאשים אותך, אתה מנצח לבד.';
    case 'driver': return `אתה מנצח אם השחקן שמימינך מנצח: ${esc(nameOf(s, rightNeighbor(s, id)))}.`;
    case 'cleaner': return 'אתה בצד של הסנדק. כשהסנדק מאשים מישהו, אפשר ללחוץ POW לפני החשיפה: על סוכן אתה מנצח לבד, ועל כל אחד אחר שניכם מודחים.';
    case 'urchin': return 'אין לך כלום בכיס, אבל אף אחד לא יודע. תמשוך חשד כדי שהסנדק יבזבז וויסקי. אתה מנצח אם גנב מנצח.';
    default: return '';
  }
}
const nameOf = (s, id) => (s.players[id] && s.players[id].name) || 'שחקן';
const gems = (n, max = 15) => `<div class="gem-row" aria-hidden="true">${I.gem.repeat(Math.min(n, max))}</div>`;
const chip = (t, count) => `<span class="chip ${t}">${TOKEN_ICON[t]}${TOKEN_NAME[t]}${count > 1 ? ` <span class="x">×${count}</span>` : ''}</span>`;
const tokenChips = (tokens) => {
  const list = TOKEN_TYPES.filter((t) => tokens[t] > 0);
  return list.length ? `<div class="chips">${list.map((t) => chip(t, tokens[t])).join('')}</div>` : '<p class="muted">אין טוקנים</p>';
};
const takeText = (take) => !take ? '—' : take.kind === 'diamonds' ? `${take.n} יהלומים` : take.kind === 'urchin' ? 'כלום' : TOKEN_NAME[take.token];

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
  newGf: null, joining: false, busy: false,
};

function newPid() { return 'p' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }

// ---------- boot ----------
async function boot() {
  $('#app').innerHTML = '<div class="hero"><h1>מאפיה דה קובה</h1><p class="muted">טוען…</p></div>';
  try { sync = await createSync(firebaseConfig); }
  catch (e) { console.error(e); $('#app').innerHTML = '<div class="hero"><h1>מאפיה דה קובה</h1><p>לא הצלחתי להתחבר לשרת. רעננו את הדף.</p></div>'; return; }
  pid = store.get('mdc.pid', pidArea()) || newPid();
  store.set('mdc.pid', pid, pidArea());
  sync.onConnection((c) => { connected = c; render(); });

  const params = new URLSearchParams(location.search);
  const urlCode = (params.get('t') || '').replace(/\D/g, '').slice(0, 4);
  const saved = store.get('mdc.code', pidArea());
  if (saved && (!urlCode || urlCode === saved)) openTable(saved, false);
  else { ui.prefillCode = urlCode; render(); }
  setInterval(tick, 250);
}

function openTable(c, joinIfNew = true) {
  if (unsub) unsub();
  code = c; game = undefined; ui.joining = joinIfNew; ui.closedNotice = false;
  store.set('mdc.code', c, pidArea());
  let first = true;
  unsub = sync.subscribe(c, (s, reason) => {
    if (ui.closing) return; // we are the host, closing the table ourselves
    if (s === null) {
      // the host closed the table, or stayed unreachable too long: the table is gone for everyone
      if (reason === 'closed' || !first) { tableClosed(); return; }
      toast('לא מצאתי שולחן עם הקוד הזה'); leaveTable();
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
  Object.assign(ui, { rules: false, menu: false, accuseTarget: null, joining: false, pocket: false, boxOpen: false, pick: null, closedNotice: true });
  render();
}

async function act(action) {
  if (!code) return;
  ui.busy = true;
  try { await sync.dispatch(code, { ...action, by: pid }); }
  catch (e) {
    if (e instanceof GameError) toast(e.message);
    else { console.error(e); toast('משהו השתבש. נסו שוב.'); }
  } finally { ui.busy = false; }
}

// ---------- timers ----------
function tick() {
  if (!game) return;
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

// ---------- render ----------
function render() {
  if (drag) { drag.stale = true; return; } // don't rebuild the DOM under a finger mid-drag
  const app = $('#app');
  if (!code) { app.innerHTML = viewHome(); renderOverlay(); return; }
  if (game === undefined) {
    app.innerHTML = `${band()}<div class="hero"><p class="muted">${connected ? `מתחבר לשולחן ${esc(code)}…` : 'מחכה לטלפון של המארח. ודאו שהאפליקציה פתוחה אצלו.'}</p>
      <button class="ghost" data-act="leave">חזרה למסך הראשי</button></div>`;
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
  const offline = connected ? '' : `<p class="notice">${sync.mode === 'p2p' && !iHost ? 'אין חיבור לטלפון של המארח. מתחבר מחדש… אם הוא לא יחזור בעוד רגע, השולחן ייסגר.' : 'אין חיבור לאינטרנט. המשחק ימשיך כשהחיבור יחזור.'}</p>`;
  const test = sync.mode === 'local' ? '<p class="notice">מצב בדיקה: אין חיבור לשרת, אז כל ה"טלפונים" צריכים להיות לשוניות באותו דפדפן.</p>' : '';
  app.innerHTML = band() + offline + test + body;
  if (game.phase === 'lobby') drawQR();
  renderOverlay();
  if (ui.gripFocus) { app.querySelector(`[data-drag="${ui.gripFocus}"]`)?.focus(); ui.gripFocus = null; }
}

function band() {
  return `<header class="band">
    <span class="title">מאפיה דה קובה</span>
    ${code ? `<span class="code num" aria-label="קוד שולחן">${esc(code)}</span>` : ''}
    <button data-act="rules">חוקים</button>
    ${code ? '<button data-act="menu" aria-label="תפריט">⋯</button>' : ''}
  </header>`;
}

// ----- home -----
function viewHome() {
  const name = store.get('mdc.name', pidArea()) || '';
  const test = sync.mode === 'local' ? '<p class="notice">מצב בדיקה: עדיין לא מחובר לשרת. אפשר לנסות עם כמה לשוניות באותו דפדפן.</p>' : '';
  return `${band()}
  <div class="hero">
    <span class="hero-band">הוואנה · 1958</span>
    <h1>מאפיה דה קובה</h1>
    <p class="sub">הקופסה, היהלומים והטוקנים עוברים בטלפונים. החקירה נשארת סביב השולחן.</p>
  </div>
  ${ui.closedNotice ? `<section><div class="banner" role="alert"><h2>השולחן נסגר</h2>
    <p>המארח סגר את השולחן או שהתנתק, וזה סוף המשחק. אפשר לפתוח שולחן חדש או להצטרף לאחר.</p></div></section>` : ''}
  ${test}
  <section>
    <label class="field">השם שלך
      <input id="name" maxlength="16" autocomplete="nickname" placeholder="למשל: דון אלסנדרו" value="${esc(name)}">
    </label>
  </section>
  <section>
    <h2>הצטרפות לשולחן</h2>
    <input id="joincode" class="code-input num" inputmode="numeric" maxlength="4" placeholder="0000" aria-label="קוד שולחן" value="${esc(ui.prefillCode || '')}">
    <button class="primary block" data-act="join">הצטרף</button>
    <div class="or">או</div>
    <button class="block" data-act="create">פתח שולחן חדש</button>
  </section>`;
}

function readName() {
  const v = ($('#name')?.value || '').trim().slice(0, 16);
  if (!v) { toast('צריך שם כדי לשבת לשולחן'); $('#name')?.focus(); return null; }
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
    } catch (e) { console.error(e); toast('לא הצלחתי לפתוח שולחן. בדקו את החיבור.'); return; }
  }
  toast('לא הצלחתי לפתוח שולחן. נסו שוב.');
}

function joinTable() {
  const name = readName(); if (!name) return;
  const c = ($('#joincode')?.value || '').replace(/\D/g, '');
  if (c.length !== 4) { toast('הקוד הוא 4 ספרות'); return; }
  openTable(c, true);
}

function viewOutsider() {
  const name = store.get('mdc.name', pidArea()) || '';
  if (game.phase === 'lobby') {
    return `<section><h2>מצטרף לשולחן…</h2>
      <label class="field">השם שלך<input id="name" maxlength="16" value="${esc(name)}"></label>
      <button class="primary block" data-act="joinNow">שב לשולחן</button></section>`;
  }
  ui.joining = true;
  return `<section><div class="banner calm"><h2>הסיבוב כבר התחיל</h2><p>תיכנס אוטומטית לסיבוב הבא, כשהמארח יחזיר את כולם ללובי.</p></div></section>`;
}

// ----- lobby -----
function viewLobby() {
  const s = game, isHost = pid === s.hostId, n = s.order.length;
  const preview = tokensFor(Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, n)), { cleaner: s.settings.cleaner && n >= 6, rng: () => 0 });
  const link = `${location.origin}${location.pathname}?t=${s.code}`;
  const rows = s.order.map((id, i) => {
    const p = s.players[id];
    const tags = [
      id === s.godfatherId ? '<span class="tag gold">סנדק</span>' : '',
      id === s.hostId ? '<span class="tag">מארח</span>' : '',
    ].join('');
    // Buttons first, drag handle last: the handle sits in the same spot on every row, and rows that lack the
    // crown / kick button simply give that room back to the name instead of leaving an empty gap.
    const ctrls = isHost ? `
      ${id !== s.godfatherId ? `<button class="icon ghost" data-act="gf" data-id="${id}" aria-label="קבע כסנדק">${I.crown}</button>` : ''}
      ${id !== s.hostId ? `<button class="icon ghost" data-act="kick" data-id="${id}" aria-label="הוצא מהשולחן">✕</button>` : ''}
      <span class="grip" data-drag="${id}" role="button" tabindex="0" aria-label="גרור כדי לשנות מקום (או חצים במקלדת)">${I.grip}</span>` : '';
    return `<li class="${id === pid ? 'me' : ''}"><span class="seat num">${i + 1}</span><div class="pcell"><span class="pname">${esc(p.name)}</span>${tags}</div>${ctrls}</li>`;
  }).join('');
  const enough = n >= MIN_PLAYERS;
  return `
  <section>
    <p class="eyebrow">שולחן ${esc(s.code)}${s.round ? ` · סיבוב ${s.round + 1}` : ''}</p>
    <h2>${n} ${n === 1 ? 'שחקן' : 'שחקנים'} ליד השולחן</h2>
    <div class="row" style="align-items:flex-start">
      <div id="qr" style="background:#f3e7cc;border-radius:10px;padding:6px;line-height:0" aria-label="ברקוד להצטרפות"></div>
      <div class="stack grow" style="gap:8px">
        <p class="small muted">סרקו עם המצלמה, או הכנסו לאפליקציה והקלידו את הקוד <b class="num">${esc(s.code)}</b>.</p>
        <button data-act="copy" data-link="${esc(link)}">העתק קישור</button>
      </div>
    </div>
  </section>
  ${isHost && sync.mode === 'p2p' ? '<p class="notice">הטלפון שלך מחזיק את השולחן. השאירו את האפליקציה פתוחה עד סוף הערב.</p>' : ''}
  <section>
    <h3>מקומות ישיבה</h3>
    <p class="small muted">${isHost ? 'סדרו לפי הישיבה האמיתית עם כיוון השעון. הקופסה עוברת לפי הסדר הזה, מהשחקן שאחרי הסנדק.' : 'המארח מסדר את המקומות לפי הישיבה ובוחר סנדק.'}</p>
    <ul class="players">${rows}</ul>
  </section>
  ${isHost ? `
  <section>
    <h3>הגדרות</h3>
    <label class="switch"><span>לשחק עם המנקה <span class="small muted">(לא מומלץ במשחקים הראשונים)</span></span>
      <input type="checkbox" id="cleaner" data-act="cleaner" ${s.settings.cleaner ? 'checked' : ''} ${n === 5 ? 'disabled' : ''}></label>
    <div class="switch"><span>וויסקי לסנדק${n === 5 ? ' <span class="small muted">(במשחק של 5 אין וויסקי)</span>' : ''}</span>
      <div class="row"><button class="icon" data-act="jokers" data-d="-1" aria-label="פחות">−</button><b class="num" style="min-width:1.5em;text-align:center">${s.settings.jokers}</b><button class="icon" data-act="jokers" data-d="1" aria-label="יותר">+</button></div></div>
  </section>` : ''}
  <section>
    <h3>בקופסה יהיו</h3>
    <div class="row">${I.gem.replace('<svg', '<svg width="22" height="22"')}<b>15 יהלומים</b></div>
    ${preview ? previewChips(preview) : ''}
    ${n === 5 ? '<p class="notice">משחק של 5 שחקנים קשה יותר ולא מומלץ למשחק ראשון.</p>' : ''}
  </section>
  <section>
    ${isHost
      ? `<button class="primary block" data-act="start" ${enough ? '' : 'disabled'}>${enough ? `התחל סיבוב · ${esc(nameOf(s, s.godfatherId))} הסנדק` : `מחכים לעוד ${MIN_PLAYERS - n} שחקנים לפחות`}</button>`
      : `<p class="center muted">מחכים ש${esc(nameOf(s, s.hostId))} יתחיל את הסיבוב.</p>`}
  </section>`;
}

function previewChips(t) {
  const one = t.fbi + t.cia === 1;
  const parts = ['henchman', 'driver', 'cleaner'].filter((k) => t[k]).map((k) => chip(k, t[k]));
  parts.splice(1, 0, one ? `<span class="chip fbi">${I.badge}סוכן FBI או CIA</span>` : chip('fbi', 1) + chip('cia', 1));
  return `<div class="chips">${parts.join('')}</div>${one ? '<p class="small muted">איזה סוכן ייכנס לקופסה נקבע בהגרלה.</p>' : ''}`;
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
    return `<section><div class="banner calm"><h2>${esc(nameOf(s, s.godfatherId))} מכין את הקופסה</h2>
      <p>הסנדק מחביא בכיס בין 0 ל־5 יהלומים. בעוד רגע הקופסה תתחיל לעבור.</p></div></section>
      <section><h3>סדר הקופסה</h3>${seatList(s)}</section>`;
  }
  return `<section>
    <p class="eyebrow">אתה הסנדק</p>
    <h2>כמה יהלומים להחביא בכיס?</h2>
    <p class="muted">אף אחד לא יודע כמה החבאת. ככה הגנבים לא יכולים לחשב בדיוק כמה חסר.</p>
    <div class="stepper"><button data-act="hideN" data-d="-1" aria-label="פחות">−</button><span class="val">${ui.hideN}</span><button data-act="hideN" data-d="1" aria-label="יותר">+</button></div>
    <p class="center muted num">בקופסה יישארו ${15 - ui.hideN} יהלומים</p>
    <button class="primary block" data-act="hide">סגור את הקופסה ושלח ל${esc(nameOf(s, takers(s)[0]))}</button>
  </section>`;
}

function seatList(s, opts = {}) {
  const list = takers(s), holder = currentTaker(s);
  const rows = [s.godfatherId, ...list].map((id) => {
    const tIdx = list.indexOf(id);
    let status = '';
    if (id === s.godfatherId) status = '<span class="tag gold">סנדק</span>';
    else if (s.phase === 'theft' && id === holder) status = '<span class="tag red">הקופסה אצלו</span>';
    else if (s.phase === 'theft' && tIdx < s.turn) status = '<span class="tag">העביר</span>';
    if (opts.jokers && s.jokersGiven[id]) status += `<span class="tag teal">${s.jokersGiven[id]} וויסקי</span>`;
    if (isOut(s, id)) status += '<span class="tag red">מודח</span>';
    return `<li class="${id === pid ? 'me' : ''} ${isOut(s, id) ? 'out' : ''} ${s.phase === 'theft' && id === holder ? 'holder' : ''}">
      <span class="seat num">${s.order.indexOf(id) + 1}</span><div class="pcell"><span class="pname">${esc(nameOf(s, id))}${id === pid ? ' (אתה)' : ''}</span>${status}</div></li>`;
  }).join('');
  return `<ul class="players">${rows}</ul>`;
}

// ----- pocket -----
function pocket(s) {
  if (pid === s.godfatherId) {
    return `<div class="pocket open"><div class="rolecard">${roleImg('godfather', 'card')}<div class="grow"><span class="role">${I.crown}הסנדק</span><p class="small">בכיס שלך: <b class="num">${s.hidden}</b> יהלומים שהחבאת. ${roleGoal(s, pid)}</p></div></div></div>`;
  }
  const take = s.takes[pid];
  if (!take) return '';
  if (!ui.pocket) {
    return `<div class="pocket" data-hold="pocket" role="button" tabindex="0" aria-label="החזק כדי לראות מה בכיס">
      <b>הכיס שלי</b><span class="small muted">החזק את האצבע כדי להציץ. שימו לב לשכנים.</span></div>`;
  }
  const r = roleOf(s, pid);
  const jokers = s.jokersGiven[pid] ? `<p class="small">${I.bottle.replace('<svg', '<svg width="18" height="18" style="vertical-align:-4px"')} ${s.jokersGiven[pid]} וויסקי מהסנדק</p>` : '';
  return `<div class="pocket open" data-hold="pocket" role="button" tabindex="0"><div class="rolecard">
    ${roleImg(r, 'card')}
    <div class="grow">
      <span class="role">${ROLE_ICON[r]}${ROLE_NAME[r]}${r === 'thief' ? ` · <span class="num">${take.n}</span> יהלומים` : ''}</span>
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
    const note = myIdx < 0 ? '' : ahead > 0 ? `<p class="muted">${ahead === 1 ? 'אתה הבא בתור.' : `עוד ${ahead} שחקנים לפניך.`}</p>` : '';
    return `<section><div class="banner calm"><p class="eyebrow">גניבת היהלומים</p><h2>הקופסה אצל ${esc(nameOf(s, holder))}</h2>${note}</div></section>
      ${s.takes[pid] || pid === s.godfatherId ? `<section>${pocket(s)}</section>` : ''}
      <section><h3>סדר הקופסה</h3>${seatList(s)}</section>`;
  }
  return `<section><p class="eyebrow">תורך · ${s.turn + 1} מתוך ${takers(s).length}</p>${boxView(s)}</section>`;
}

function boxView(s) {
  const box = s.box;
  if (!ui.boxOpen) {
    return `<div class="box closed"><span class="label">קופסת הסנדק</span>
      <h2>הקופסה אצלך</h2><p class="muted">תסתיר את המסך מהשכנים, ותפתח.</p>
      <button class="primary block" data-act="openBox">פתח את הקופסה</button></div>`;
  }
  const list = takers(s);
  const last = s.turn === list.length - 1;
  const anyTokens = TOKEN_TYPES.some((t) => box.tokens[t] > 0);
  const contents = `<div class="gems"><span class="count num">${box.diamonds}</span>${I.gem}</div>${gems(box.diamonds)}
    <div><p class="small muted" style="margin-bottom:6px">טוקנים בקופסה</p>${tokenChips(box.tokens)}</div>
    <p class="small muted">תזכור מה ראית: אחר כך תצטרך להעיד, או לשקר בצורה משכנעת.</p>`;

  if (boxEmpty(box)) {
    return `<div class="box lid-open"><span class="label">קופסת הסנדק</span>${contents}
      <div class="banner"><h3>הקופסה ריקה. אתה ילד רחוב.</h3><p>תעמיד פנים שאתה לוקח משהו, ותעביר הלאה.</p></div>
      <button class="primary block" data-act="takeNothing">העמדתי פנים. העבר הלאה</button></div>`;
  }
  if (s.turn === 0 && !s.bagDone && anyTokens) {
    const opts = TOKEN_TYPES.filter((t) => box.tokens[t] > 0).map((t) => `<button data-act="bag" data-token="${t}">${TOKEN_ICON[t]}${TOKEN_NAME[t]}</button>`).join('');
    return `<div class="box lid-open"><span class="label">קופסת הסנדק</span>${contents}</div>
      <div class="stack"><h3>השקית: רק לשחקן הראשון</h3>
      <p class="small muted">אפשר להעלים טוקן אחד לשקית עד סוף המשחק. אף אחד לא יידע איזה. אחר כך לוקחים כרגיל.</p>
      <div class="choice">${opts}</div>
      <button class="block ghost" data-act="bag" data-token="">לא להעלים כלום</button></div>`;
  }
  const pick = ui.pick;
  const tokenBtns = TOKEN_TYPES.filter((t) => box.tokens[t] > 0).map((t) =>
    `<button data-act="pickToken" data-token="${t}" class="${pick && pick.kind === 'token' && pick.token === t ? 'chosen' : ''}">${TOKEN_ICON[t]}${TOKEN_NAME[t]}</button>`).join('');
  const dChosen = pick && pick.kind === 'diamonds';
  let confirm = 'בחר מה לקחת';
  if (pick) confirm = pick.kind === 'diamonds' ? `קח ${ui.pickN} ${ui.pickN === 1 ? 'יהלום' : 'יהלומים'} והעבר` : pick.kind === 'token' ? `קח ${TOKEN_NAME[pick.token]} והעבר` : 'לא לקחת כלום והעבר';
  const next = s.turn + 1 < list.length ? nameOf(s, list[s.turn + 1]) : 'הסנדק';
  return `<div class="box lid-open"><span class="label">קופסת הסנדק</span>${contents}</div>
  <div class="stack">
    <h3>מה לוקחים? חובה לקחת משהו</h3>
    ${box.diamonds > 0 ? `<div class="stack" style="gap:8px">
      <button class="block ${dChosen ? 'chosen' : ''}" data-act="pickDiamonds">${I.gem.replace('<svg', '<svg width="22" height="22" style="vertical-align:-5px"')} יהלומים (לפחות אחד)</button>
      ${dChosen ? `<div class="stepper"><button data-act="pickN" data-d="-1" aria-label="פחות">−</button><span class="val">${ui.pickN}</span><button data-act="pickN" data-d="1" aria-label="יותר">+</button></div>` : ''}
    </div>` : ''}
    ${tokenBtns ? `<p class="small muted">או טוקן אחד:</p><div class="choice">${tokenBtns}</div>` : ''}
    ${last ? `<button class="block ghost ${pick && pick.kind === 'nothing' ? 'chosen' : ''}" data-act="pickNothing">${I.cap.replace('<svg', '<svg width="22" height="22" style="vertical-align:-5px;color:var(--muted)"')} לא לקחת כלום (ילד רחוב)</button>
      <p class="small muted">אתה האחרון, אז מותר לך לא לקחת כלום. רק תעמיד פנים שכן.</p>` : ''}
    <button class="primary block" data-act="take" ${pick ? '' : 'disabled'}>${confirm}</button>
    <p class="small muted center">הקופסה תעבור ל${esc(next)}</p>
  </div>`;
}

// ----- investigation -----
function viewInvestigation() {
  const s = game;
  const isGf = pid === s.godfatherId;
  const out = isOut(s, pid);
  const publicStats = `<div class="stats">
      <div class="stat"><b class="num">${s.recovered}</b><span>יהלומים הוחזרו</span></div>
      <div class="stat"><b class="num">${s.jokers}</b><span>וויסקי לסנדק</span></div>
      <div class="stat"><b class="num">${s.order.filter((id) => isOut(s, id)).length}</b><span>מודחים</span></div></div>`;
  const logHtml = s.log.length ? `<section><h3>מה קרה עד עכשיו</h3><ul class="log">${s.log.slice().reverse().map(logLine).join('')}</ul></section>` : '';

  if (isGf) {
    const left = s.box.diamonds;
    const rows = takers(s).map((id) => {
      const outP = isOut(s, id);
      const cleared = !!s.jokersGiven[id]; // already accused and found innocent: accusing again is not allowed
      const j = s.jokersGiven[id] ? `<span class="tag teal">${s.jokersGiven[id]} וויסקי</span>` : '';
      return `<li class="${outP ? 'out' : ''}"><span class="seat num">${s.order.indexOf(id) + 1}</span><div class="pcell"><span class="pname">${esc(nameOf(s, id))}</span>${j}</div>
        ${outP ? '<span class="tag red">מודח</span>' : cleared ? '<span class="tag">נוקה</span>' : `<button class="danger" style="min-height:40px;padding:6px 12px" data-act="accuse" data-id="${id}">האשם</button>`}</li>`;
    }).join('');
    return `<section>
      <p class="eyebrow">החקירה · אתה הסנדק</p>
      <div class="stats">
        <div class="stat"><b class="num">${s.stolen}</b><span>נגנבו</span></div>
        <div class="stat"><b class="num">${s.recovered}</b><span>הוחזרו</span></div>
        <div class="stat"><b class="num">${s.jokers}</b><span>וויסקי</span></div>
      </div>
      <div class="box"><span class="label">מה חזר בקופסה</span>
        <div class="gems"><span class="count num">${left}</span>${I.gem}</div>
        ${tokenChips(s.box.tokens)}
        <p class="small muted">החבאת בכיס ${s.hidden}. בהתחלה היו 15.</p>
      </div>
    </section>
    <section>
      <h3>חקור ואז האשם</h3>
      <p class="small muted">שאלו בקול, ליד השולחן. כשאתה בטוח, לחץ "האשם" כדי לצעוק "רוקן את הכיסים!".</p>
      <ul class="players">${rows}</ul>
      <details><summary>שאלות טובות לשאול</summary><ul>
        <li>כשקיבלת את הקופסה, כמה יהלומים היו בה?</li>
        <li>אילו טוקנים היו בה?</li>
        <li>מה השארת כשהעברת הלאה?</li>
        <li>מה לקחת?</li>
        <li>מי ישב לפניך, ומה הוא אמר שהיה בקופסה?</li>
      </ul></details>
    </section>${logHtml}`;
  }
  return `${out ? `<section><div class="silenced"><h2>הודחת</h2><p>מעכשיו אסור לך לדבר או להשתתף בחקירה.</p></div></section>` : ''}
    <section><p class="eyebrow">החקירה</p>
      <h2>${esc(nameOf(s, s.godfatherId))} חוקר</h2>
      <p class="muted small">ענו בקול. מותר לשקר, להגזים, לשתוק או לסלף מה שאחרים אמרו.</p>
      ${publicStats}
    </section>
    <section>${pocket(s)}</section>
    <section><h3>ליד השולחן</h3>${seatList(s, { jokers: true })}</section>
    ${logHtml}`;
}

function logLine(e) {
  const s = game, who = esc(nameOf(s, e.target));
  switch (e.outcome) {
    case 'thief': return `<li class="thief">${who} נתפס עם ${e.n} יהלומים והודח.</li>`;
    case 'innocent': return `<li class="innocent">${who} הואשם, אבל ${e.role === 'urchin' ? 'הכיסים שלו ריקים' : `הוא ${ROLE_NAME[e.role]}`}. קיבל וויסקי.</li>`;
    case 'agent': return `<li class="bad">${who} הוא ${ROLE_NAME[e.role]}.</li>`;
    case 'godfatherOut': return `<li class="bad">${who} נקי, ולסנדק נגמר הוויסקי.</li>`;
    case 'pow': return `<li class="bad">POW! ${esc(nameOf(s, e.by))} ירה ב${who} (${e.role === 'thief' ? `גנב, ${e.n} יהלומים חזרו` : e.role === 'urchin' ? 'כיסים ריקים' : ROLE_NAME[e.role]}). שניהם הודחו.</li>`;
    case 'powAgent': return `<li class="bad">POW! ${esc(nameOf(s, e.by))} חיסל את ${who}, ${ROLE_NAME[e.role]}.</li>`;
    default: return '';
  }
}

// ----- end -----
function viewEnd() {
  const s = game, r = s.result || { winners: [] };
  const winners = new Set(r.winners);
  const titles = {
    godfather: ['הסנדק החזיר את כל היהלומים', 'הסנדק, החיילים הנאמנים והמנקה מנצחים.'],
    agent: ['הסנדק האשים סוכן', 'הסוכן מנצח לבד.'],
    cleaner: ['POW! המנקה חיסל סוכן', 'המנקה מנצח לבד.'],
    thieves: ['הסנדק הודח', winners.size ? 'הגנב עם הכי הרבה יהלומים מנצח, ואיתו ילדי הרחוב.' : 'לא נשאר גנב במשחק, אז אף גנב לא מנצח.'],
  }[r.type] || ['הסיבוב נגמר', ''];
  const iWon = winners.has(pid);
  const wnames = r.winners.map((id) => esc(nameOf(s, id))).join(', ') || 'אף אחד';
  const rows = s.order.map((id) => {
    const role = roleOf(s, id);
    const t = s.takes[id];
    const take = id === s.godfatherId ? `החביא ${s.hidden}` : t && t.kind === 'diamonds' ? `${t.n} יהלומים` : '';
    return `<tr class="${winners.has(id) ? 'win' : ''}"><td class="num">${s.order.indexOf(id) + 1}</td>
      <td><b>${esc(nameOf(s, id))}</b>${isOut(s, id) ? ' <span class="tag red">מודח</span>' : ''}</td>
      <td>${role ? `<span class="rolecell">${roleImg(role, 'tiny')}${ROLE_NAME[role]}</span>` : '—'}</td><td class="num">${esc(take)}</td><td>${winners.has(id) ? '<span class="tag ok">ניצח</span>' : ''}</td></tr>`;
  }).join('');
  const isHost = pid === s.hostId;
  const order = [...r.winners, ...s.order.filter((id) => !winners.has(id))];
  if (!ui.newGf || !s.players[ui.newGf]) ui.newGf = r.winners.find((id) => s.players[id]) || s.godfatherId;
  return `<section>
    <div class="banner"><p class="eyebrow" style="color:var(--gold-hi)">סוף הסיבוב</p><h2>${titles[0]}</h2><p>${titles[1]}</p></div>
    <div class="banner calm"><h3>${iWon ? 'ניצחת!' : 'הפעם לא ניצחת'}</h3><p>מנצחים: ${wnames}</p></div>
  </section>
  <section><h3>מה היה לכל אחד</h3>
    <div class="tablewrap"><table class="reveal"><tbody>${rows}</tbody></table></div>
    <p class="small muted">בשקית: ${s.bag ? TOKEN_NAME[s.bag] : 'כלום'} · נשארו בקופסה ${s.box ? s.box.diamonds : 0} יהלומים</p>
  </section>
  ${s.log.length ? `<section><h3>החקירה</h3><ul class="log">${s.log.map(logLine).join('')}</ul></section>` : ''}
  <section>
    ${isHost ? `<h3>סיבוב חדש</h3><p class="small muted">המנצחים בוחרים את הסנדק הבא. אפשר גם להחליף מקומות בלובי.</p>
      <label class="field">הסנדק הבא<select id="newgf" data-act="newgf">${order.map((id) => `<option value="${id}" ${id === ui.newGf ? 'selected' : ''}>${esc(nameOf(s, id))}${winners.has(id) ? ' (ניצח)' : ''}</option>`).join('')}</select></label>
      <button class="primary block" data-act="newRound">חזרה ללובי</button>`
      : `<p class="center muted">${esc(nameOf(s, s.hostId))} יפתח סיבוב חדש.</p>`}
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
  const cost = s.jokers > 0 ? `אם הוא לא גנב, תצטרך לתת לו וויסקי (נשארו לך ${s.jokers}). אם הוא סוכן, הפסדת.` : 'לא נשאר לך וויסקי: אם הוא לא גנב, אתה מודח. אם הוא סוכן, הפסדת.';
  return `<div class="sheet accuse" role="dialog" aria-modal="true">
    <p class="who">${esc(nameOf(s, id))}</p>
    <p class="muted small">${cost}</p>
    <button class="danger block" style="font-family:var(--font-display);font-size:1.5rem;min-height:72px" data-act="confirmAccuse">רוקן את הכיסים!</button>
    <button class="ghost block" data-act="cancelAccuse">עוד לא</button></div>`;
}

function accusationSheet() {
  const s = game, acc = s.accusation;
  const amCleaner = roleOf(s, pid) === 'cleaner' && !isOut(s, pid) && acc.target !== pid;
  const isTarget = acc.target === pid;
  return `<div class="sheet accuse" role="dialog" aria-modal="true">
    <p class="muted">${esc(nameOf(s, s.godfatherId))} מאשים את</p>
    <p class="who">${isTarget ? 'אותך!' : esc(nameOf(s, acc.target))}</p>
    <p class="cry">רוקן את הכיסים!</p>
    ${amCleaner ? '<button class="pow" data-act="pow">POW!</button><p class="small muted">יש לך רגע אחד לפני שהכיסים מתרוקנים.</p>' : '<p class="count-ring num" id="countdown">…</p>'}
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
    return `<div class="sheet accuse"><p class="who">${who}</p><p class="muted">מרוקן את הכיסים…</p><p class="suspense">• • •</p></div>`;
  }
  const by = e.by ? esc(nameOf(s, e.by)) : '';
  let v = '', cls = 'gold', sub = '';
  switch (e.outcome) {
    case 'thief': v = `גנב! ${e.n} יהלומים`; sub = `${who} מודח. היהלומים חזרו לסנדק.`; break;
    case 'innocent': v = e.role === 'urchin' ? 'הכיסים ריקים' : `${who} הוא ${ROLE_NAME[e.role]}`; cls = 'good'; sub = `הסנדק טעה ונותן ל${who} וויסקי. נשארו לו ${e.jokersLeft}.`; break;
    case 'agent': v = `${ROLE_NAME[e.role]}!`; cls = 'bad'; sub = `${who} היה סוכן סמוי. הסוכן מנצח.`; break;
    case 'godfatherOut': v = 'הסנדק מודח'; cls = 'bad'; sub = `${who} ${e.role === 'urchin' ? 'עם כיסים ריקים' : `הוא ${ROLE_NAME[e.role]}`}, ולסנדק אין יותר וויסקי.`; break;
    case 'pow': v = 'POW!'; cls = 'bad'; sub = `${by} ירה ב${who}${e.role === 'thief' ? `, שהיה גנב עם ${e.n} יהלומים. היהלומים חזרו לסנדק` : `, שהיה ${e.role === 'urchin' ? 'ילד רחוב' : ROLE_NAME[e.role]}`}. שניהם מודחים.`; break;
    case 'powAgent': v = 'POW! סוכן חוסל'; cls = 'gold'; sub = `${by} הוא המנקה, ו${who} היה ${ROLE_NAME[e.role]}. המנקה מנצח לבד.`; break;
  }
  $('#overlay').dataset.shown = '1';
  return `<div class="sheet accuse" role="dialog" aria-modal="true"><p class="muted">${who}</p>
    ${e.role ? roleImg(e.role, 'big') : ''}
    <p class="verdict ${cls}">${v}</p><p>${sub}</p>
    <button class="primary block" data-act="closeReveal">המשך</button></div>`;
}

function menuSheet() {
  const isHost = game && pid === game.hostId;
  const mid = game && game.phase !== 'lobby' && game.phase !== 'end';
  return `<div class="sheet" role="dialog" aria-modal="true">
    <h2>תפריט</h2>
    <label class="field">השם שלך<input id="rename" maxlength="16" value="${esc(store.get('mdc.name', pidArea()) || '')}"></label>
    <button data-act="rename">שמור שם</button>
    ${isHost && mid ? '<button class="danger" data-act="abort">בטל את הסיבוב וחזור ללובי</button>' : ''}
    ${isHost && sync.mode === 'p2p'
      ? '<p class="small muted">אתה המארח: הטלפון שלך מחזיק את השולחן. אם תסגור אותו, המשחק ייגמר לכולם.</p><button class="ghost" data-act="closeTable">סגור את השולחן לכולם</button>'
      : '<button class="ghost" data-act="leave">צא מהשולחן</button>'}
    <button class="primary" data-act="closeSheet">סגור</button></div>`;
}

function rulesSheet() {
  return `<div class="sheet rules" role="dialog" aria-modal="true" aria-label="חוקים">
    <h2>איך משחקים</h2>
    <p>משחק בלופים ל־6 עד 12 שחקנים. הטלפון מחליף רק את הקופסה, היהלומים והטוקנים. כל השאר קורה בקול סביב השולחן.</p>
    <h3>1. ההכנה</h3>
    <ul><li>הסנדק מחביא בכיס בין 0 ל־5 יהלומים מתוך 15.</li><li>בקופסה יש גם טוקנים של דמויות, לפי מספר השחקנים.</li></ul>
    <h3>2. גניבת היהלומים</h3>
    <ul>
      <li>הקופסה עוברת עם כיוון השעון, מהשחקן שמשמאל לסנדק.</li>
      <li>כל שחקן מסתכל בחשאי, זוכר מה ראה, ולוקח <b>לפחות יהלום אחד</b> או <b>טוקן אחד</b>. אסור לא לקחת כלום.</li>
      <li>השחקן הראשון יכול להעלים קודם טוקן אחד לשקית, עד סוף המשחק.</li>
      <li>מי שמקבל קופסה ריקה הופך לילד רחוב, ומעמיד פנים שהוא לוקח.</li>
      <li>השחקן האחרון יכול לבחור לא לקחת כלום ולהיות ילד רחוב.</li>
    </ul>
    <h3>3. החקירה</h3>
    <ul>
      <li>הסנדק שואל את מי שהוא רוצה, באיזה סדר שהוא רוצה. מותר לשקר, לשתוק ולסלף.</li>
      <li>כשהוא בטוח, הוא מאשים: "רוקן את הכיסים!".</li>
      <li><b>גנב:</b> היהלומים חוזרים לסנדק, והגנב מודח ואסור לו לדבר.</li>
      <li><b>מי שלא גנב:</b> הסנדק נותן לו וויסקי. אם לסנדק נגמר הוויסקי, הסנדק מודח.</li>
      <li><b>סוכן FBI או CIA:</b> המשחק נגמר והסוכן מנצח.</li>
    </ul>
    <h3>מי מנצח</h3>
    <ul>
      <li><b>הסנדק והחיילים הנאמנים:</b> אם הסנדק החזיר את כל היהלומים.</li>
      <li><b>סוכן:</b> אם הסנדק האשים אותו. מנצח לבד.</li>
      <li><b>גנב:</b> אם הסנדק הודח, הגנב שעוד במשחק עם הכי הרבה יהלומים מנצח. בתיקו, כולם מנצחים.</li>
      <li><b>ילד רחוב:</b> אם גנב מנצח.</li>
      <li><b>נהג:</b> אם השחקן שמימינו מנצח.</li>
      <li><b>המנקה (אופציונלי):</b> בצד של הסנדק. כשהסנדק מאשים, הוא יכול לצעוק POW! לפני החשיפה. על סוכן הוא מנצח לבד. על כל אחד אחר, שניהם מודחים: גנב מחזיר את היהלומים, ומי שלא גנב לא מקבל וויסקי.</li>
    </ul>
    <h3>שולחן עם הטלפונים</h3>
    <ul><li>המארח פותח שולחן, וכולם נכנסים עם הקוד או הברקוד.</li><li>סדרו את המקומות בלובי לפי הישיבה האמיתית.</li><li>"הכיס שלי": החזיקו את האצבע כדי להציץ במה שלקחתם.</li></ul>
    <button class="primary" data-act="closeSheet">הבנתי</button></div>`;
}

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
    case 'rules': ui.rules = true; return renderOverlay();
    case 'menu': ui.menu = true; return renderOverlay();
    case 'closeSheet': ui.rules = false; ui.menu = false; return renderOverlay();
    case 'leave': ui.menu = false; ui.joining = false; return leaveTable();
    case 'closeTable': ui.menu = false; ui.joining = false; renderOverlay(); return leaveTable(true);
    case 'rename': { const v = ($('#rename').value || '').trim().slice(0, 16); if (!v) return; store.set('mdc.name', v, pidArea()); ui.menu = false; await act({ type: 'rename', name: v }); return render(); }
    case 'abort': ui.menu = false; renderOverlay(); return act({ type: 'abort' });
    case 'copy': {
      const link = el.dataset.link;
      try { await navigator.clipboard.writeText(link); toast('הקישור הועתק'); }
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
    case 'pickN': ui.pickN = Math.max(1, Math.min(game.box.diamonds, ui.pickN + +el.dataset.d)); return render();
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
document.addEventListener('change', (ev) => {
  if (ev.target.id === 'newgf') ui.newGf = ev.target.value;
});
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter') return;
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
