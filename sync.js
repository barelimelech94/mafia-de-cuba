// Shared-state layer. Every phone talks to the table through dispatch(); the reducer in game.js
// is the only thing that changes state.
//   - FirebaseSync: real multi-phone play (Realtime Database transactions).
//   - LocalSync: same device only (tabs share localStorage) — for testing without Firebase.
import { reduce, normalize, GameError } from './game.js';

const strip = (o) => JSON.parse(JSON.stringify(o)); // drop undefined (Firebase rejects it)

export async function createSync(firebaseConfig) {
  if (firebaseConfig && firebaseConfig.databaseURL) return FirebaseSync(firebaseConfig);
  if (new URLSearchParams(location.search).has('local') || !window.Peer) return LocalSync();
  return P2PSync();
}

// ---------- Peer-to-peer: the host's phone keeps the table and runs the reducer ----------
// Other phones connect to it directly (WebRTC). The public PeerJS server only introduces the phones.
function P2PSync() {
  const PREFIX = 'mafiadecuba-v1-table-';
  const hostKey = (code) => `mdc.host.${code}`;
  const loadHost = (code) => { try { const v = localStorage.getItem(hostKey(code)); return v ? normalize(JSON.parse(v)) : null; } catch { return null; } };
  const saveHost = (code, s) => { try { localStorage.setItem(hostKey(code), JSON.stringify(s)); } catch {} };
  const connListeners = new Set();
  let connected = true;
  const setConnected = (v) => { if (connected !== v) { connected = v; connListeners.forEach((fn) => fn(v)); } };

  let session = null; // the one table this phone has open
  let handoff = null;

  // ?peer=host:port points at a self-hosted PeerJS server (used for local testing).
  const custom = new URLSearchParams(location.search).get('peer');
  const peerOpts = { debug: 0 };
  if (custom) { const [host, port] = custom.split(':'); Object.assign(peerOpts, { host, port: +port || 9000, path: '/', secure: false }); }

  function openPeer(id) {
    return new Promise((resolve, reject) => {
      const peer = id ? new window.Peer(id, peerOpts) : new window.Peer(peerOpts);
      const onErr = (e) => { peer.off('open', onOpen); peer.destroy(); reject(e); };
      const onOpen = () => { peer.off('error', onErr); resolve(peer); };
      peer.once('open', onOpen);
      peer.once('error', onErr);
    });
  }

  // A player whose host stays unreachable this long is told the table is closed.
  // Long enough to ride out a Wi-Fi blip or the host reloading the page, short enough not to leave people hanging.
  const GRACE_MS = 10000;
  const SILENT_MS = 6000; // the host pings every 2s; this long without any message counts as a lost connection

  function closeSession() {
    if (!session) return;
    session.closed = true;
    clearTimeout(session.timer);
    clearTimeout(session.dropTimer);
    clearInterval(session.pinger);
    clearInterval(session.watch);
    try { session.peer && session.peer.destroy(); } catch {}
    session = null;
  }

  // ----- host side -----
  function startHost(code, cb) {
    const ses = { code, host: true, state: loadHost(code), conns: new Set(), cb, closed: false, peer: null };
    session = ses;
    const broadcast = () => ses.conns.forEach((c) => { try { c.open && c.send({ t: 'state', s: ses.state }); } catch {} });
    ses.apply = (action) => {
      const next = normalize(strip(reduce(ses.state, action)));
      ses.state = next; saveHost(code, next);
      cb(next); broadcast();
      return next;
    };
    const claim = async () => {
      if (ses.closed) return;
      try {
        if (handoff && handoff.code === code && !handoff.peer.destroyed) { ses.peer = handoff.peer; handoff = null; }
        else ses.peer = await openPeer(PREFIX + code);
        if (ses.closed) { ses.peer.destroy(); return; }
        setConnected(true);
        ses.peer.on('connection', (c) => {
          c.on('open', () => { ses.conns.add(c); c.send({ t: 'state', s: ses.state }); });
          c.on('data', (d) => {
            if (!d || d.t !== 'act') return;
            try { ses.apply(d.a); c.send({ t: 'ack', id: d.id }); }
            catch (e) { c.send({ t: 'ack', id: d.id, err: e instanceof GameError ? e.message : 'שגיאה' }); }
          });
          c.on('close', () => ses.conns.delete(c));
          c.on('error', () => ses.conns.delete(c));
        });
        ses.peer.on('disconnected', () => { if (!ses.closed) { setConnected(false); setTimeout(() => { try { ses.peer.reconnect(); } catch {} }, 1500); } });
        ses.peer.on('open', () => setConnected(true));
        ses.peer.on('error', (e) => console.warn('host peer', e.type));
      } catch (e) {
        // ID still held by our previous page load (reload) or the network is down: keep trying.
        setConnected(false);
        ses.timer = setTimeout(claim, 3000);
      }
    };
    setTimeout(() => cb(ses.state), 0);
    claim();
    // heartbeat: lets players tell "host is gone" from "host is just quiet"
    ses.pinger = setInterval(() => ses.conns.forEach((c) => { try { c.open && c.send({ t: 'ping' }); } catch {} }), 2000);
  }

  // ----- player side -----
  function startClient(code, cb, { resume }) {
    const ses = { code, host: false, conn: null, pending: new Map(), cb, closed: false, peer: null, got: false, fails: 0, lastSeen: Date.now(), dropTimer: null };
    session = ses;
    // Host unreachable for GRACE_MS (twice that if we never reached it) → the table is closed for this player.
    const markLost = () => {
      if (ses.closed || ses.dropTimer) return;
      ses.dropTimer = setTimeout(() => { if (!ses.closed) { ses.closed = true; cb(null, 'closed'); } }, ses.got ? GRACE_MS : GRACE_MS * 2);
    };
    const markOk = () => { clearTimeout(ses.dropTimer); ses.dropTimer = null; };
    const retry = (ms) => { if (!ses.closed) { markLost(); clearTimeout(ses.timer); ses.timer = setTimeout(connect, ms); } };
    // a connection that looks open but has gone silent is as good as lost: drop it so the normal reconnect path runs
    ses.watch = setInterval(() => {
      if (ses.conn && ses.conn.open && Date.now() - ses.lastSeen > SILENT_MS) { try { ses.conn.close(); } catch {} }
    }, 1000);
    const connect = async () => {
      if (ses.closed) return;
      try {
        if (!ses.peer || ses.peer.destroyed) {
          ses.peer = await openPeer();
          ses.peer.on('error', (e) => {
            if (e.type === 'peer-unavailable') {
              ses.fails += 1;
              if (!ses.got && !resume && ses.fails >= 2) { ses.closed = true; cb(null); return; }
              setConnected(false); retry(2500);
            } else if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') { setConnected(false); retry(3000); }
          });
          ses.peer.on('disconnected', () => { if (!ses.closed) setTimeout(() => { try { ses.peer.reconnect(); } catch {} }, 1500); });
        }
        if (ses.closed) return;
        const c = ses.peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
        const openTimer = setTimeout(() => { if (!c.open) { try { c.close(); } catch {} retry(500); } }, 9000);
        c.on('open', () => { clearTimeout(openTimer); ses.conn = c; ses.fails = 0; ses.lastSeen = Date.now(); markOk(); setConnected(true); });
        c.on('data', (d) => {
          if (!d) return;
          ses.lastSeen = Date.now();
          if (d.t === 'closed') { // the host closed the table on purpose: no waiting, no retrying
            if (!ses.closed) { ses.closed = true; markOk(); cb(null, 'closed'); }
            return;
          }
          if (d.t === 'state') { ses.got = true; cb(normalize(d.s)); }
          if (d.t === 'ack') { const p = ses.pending.get(d.id); if (p) { ses.pending.delete(d.id); d.err ? p.reject(new GameError(d.err)) : p.resolve(); } }
        });
        c.on('close', () => { clearTimeout(openTimer); if (ses.conn === c) ses.conn = null; setConnected(false); retry(1500); });
        c.on('error', () => {});
      } catch (e) { setConnected(false); retry(3000); }
    };
    ses.send = (action) => new Promise((resolve, reject) => {
      if (!ses.conn || !ses.conn.open) { reject(new GameError('אין חיבור לטלפון של המארח. מנסה להתחבר מחדש…')); return; }
      const id = Math.random().toString(36).slice(2);
      ses.pending.set(id, { resolve, reject });
      ses.conn.send({ t: 'act', id, a: strip(action) });
      setTimeout(() => { if (ses.pending.has(id)) { ses.pending.delete(id); reject(new GameError('המארח לא ענה. נסו שוב.')); } }, 8000);
    });
    connect();
  }

  return {
    mode: 'p2p',
    async exists() { return false; },
    async create(code, state) {
      closeSession();
      try {
        const peer = await openPeer(PREFIX + code);
        handoff = { code, peer }; // startHost takes this peer over instead of re-claiming the id
      } catch (e) {
        if (e && e.type === 'unavailable-id') return false;
        throw e;
      }
      saveHost(code, normalize(strip(state)));
      return true;
    },
    isHostOf(code) { return !!loadHost(code); },
    subscribe(code, cb, opts = {}) {
      closeSession();
      if (loadHost(code)) startHost(code, cb); else startClient(code, cb, opts);
      const mine = session;
      return () => { if (session === mine) closeSession(); };
    },
    async dispatch(code, action) {
      if (!session || session.code !== code) throw new GameError('אין שולחן פתוח');
      if (session.host) return session.apply(action);
      await session.send(action);
    },
    forget(code) { try { localStorage.removeItem(hostKey(code)); } catch {} },
    // Host closes the table for everyone: tell the players first, then forget the saved table.
    async close(code) {
      if (session && session.host && session.code === code) {
        session.conns.forEach((c) => { try { c.open && c.send({ t: 'closed' }); } catch {} });
        await new Promise((r) => setTimeout(r, 350)); // let the message go out before the connection is torn down
      }
      try { localStorage.removeItem(hostKey(code)); } catch {}
    },
    onConnection(fn) { connListeners.add(fn); fn(connected); return () => connListeners.delete(fn); },
  };
}

async function FirebaseSync(config) {
  const V = '10.12.2';
  const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);
  const fdb = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-database.js`);
  const app = initializeApp(config);
  const db = fdb.getDatabase(app);
  const ref = (code) => fdb.ref(db, `tables/${code}`);
  const connected = { value: true, listeners: new Set() };
  fdb.onValue(fdb.ref(db, '.info/connected'), (snap) => {
    connected.value = !!snap.val();
    connected.listeners.forEach((fn) => fn(connected.value));
  });

  async function transact(code, fn) {
    let err = null;
    let attempts = 0;
    while (attempts < 2) {
      attempts++;
      err = null;
      const res = await fdb.runTransaction(ref(code), (cur) => {
        if (cur === null) return undefined; // cache cold; retry after a read
        try { return strip(fn(normalize(cur))); } catch (e) { err = e; return undefined; }
      }, { applyLocally: true });
      if (err) throw err;
      if (res.committed) return normalize(res.snapshot.val());
      await fdb.get(ref(code));
    }
    throw new GameError('אין חיבור לשולחן. בדקו את האינטרנט ונסו שוב.');
  }

  return {
    mode: 'firebase',
    async exists(code) { return (await fdb.get(ref(code))).exists(); },
    async create(code, state) {
      const res = await fdb.runTransaction(ref(code), (cur) => (cur === null ? strip(state) : undefined));
      return res.committed;
    },
    subscribe(code, cb) {
      return fdb.onValue(ref(code), (snap) => cb(snap.exists() ? normalize(snap.val()) : null));
    },
    dispatch(code, action) { return transact(code, (s) => reduce(s, action)); },
    onConnection(fn) { connected.listeners.add(fn); fn(connected.value); return () => connected.listeners.delete(fn); },
  };
}

function LocalSync() {
  const key = (code) => `mdc.table.${code}`;
  const ch = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('mdc') : null;
  const subs = new Map();
  const read = (code) => { try { const v = localStorage.getItem(key(code)); return v ? normalize(JSON.parse(v)) : null; } catch { return null; } };
  const write = (code, s) => {
    try { localStorage.setItem(key(code), JSON.stringify(s)); } catch {}
    ch && ch.postMessage(code);
    notify(code);
  };
  const notify = (code) => (subs.get(code) || []).forEach((cb) => cb(read(code)));
  ch && (ch.onmessage = (e) => notify(e.data));
  window.addEventListener('storage', (e) => { if (e.key && e.key.startsWith('mdc.table.')) notify(e.key.slice(10)); });

  return {
    mode: 'local',
    async exists(code) { return !!read(code); },
    async create(code, state) { if (read(code)) return false; write(code, strip(state)); return true; },
    subscribe(code, cb) {
      const list = subs.get(code) || [];
      list.push(cb); subs.set(code, list);
      setTimeout(() => cb(read(code)), 0);
      return () => subs.set(code, (subs.get(code) || []).filter((x) => x !== cb));
    },
    async dispatch(code, action) {
      const next = strip(reduce(read(code), action));
      write(code, next);
      return normalize(next);
    },
    onConnection(fn) { fn(true); return () => {}; },
  };
}
