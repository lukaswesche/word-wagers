import { io } from 'socket.io-client';
const URL = 'http://localhost:3001';
const delay = (ms) => new Promise(r => setTimeout(r, ms));

function waitFor(socket, pred, timeout = 12000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      socket.off('mg-state', h);
      reject(new Error(`Timeout (${timeout}ms)`));
    }, timeout);
    const h = (s) => { if (pred(s)) { clearTimeout(t); socket.off('mg-state', h); resolve(s); } };
    socket.on('mg-state', h);
  });
}

async function mkClient(id) {
  return new Promise(res => {
    const s = io(URL, { transports: ['websocket'] });
    s._pid = id;
    s.on('connect', () => { s.emit('hello', { playerId: id }); res(s); });
  });
}

const BUGS = [], INFO = [];
let T = '';
const bug = m => { BUGS.push(`[BUG] ${T}: ${m}`); console.error(`[BUG] ${m}`); };
const info = m => { INFO.push(`[INFO] ${T}: ${m}`); console.log(`[INFO] ${m}`); };

async function test(name, fn) {
  T = name; console.log(`\n--- ${name} ---`);
  try { await fn(); console.log('  PASS'); }
  catch(e) { bug(e.message); console.log('  FAIL'); }
}

async function createRoom(host, name) {
  return new Promise((res, rej) =>
    host.emit('mg-create', { playerId: host._pid, name }, r => r.ok ? res(r.code) : rej(r.error))
  );
}
async function joinRoom(guest, code, name) {
  return new Promise((res, rej) =>
    guest.emit('mg-join', { code, playerId: guest._pid, name }, r => r.ok ? res() : rej(r.error))
  );
}
async function playRound(s1, s2, b1=2, b2=2, i1=[], i2=[]) {
  const bid = await waitFor(s1, s => s.phase === 'bidding');
  info(`  Round: "${bid.category?.short}" | bids: ${b1} vs ${b2}`);
  s1.emit('mg-bid', { count: b1 });
  s2.emit('mg-bid', { count: b2 });
  await waitFor(s1, s => s.phase === 'performing');
  if (i1.length) s1.emit('mg-perform-batch', { items: i1 });
  if (i2.length) s2.emit('mg-perform-batch', { items: i2 });
  s1.emit('mg-perform-done', {});
  s2.emit('mg-perform-done', {});
  return waitFor(s1, s => s.phase === 'result' || s.phase === 'matchOver');
}

// ── T1: Basic flow ──
await test('T1: create + join + game starts', async () => {
  const s1 = await mkClient('p1a');
  const s2 = await mkClient('p1b');
  const code = await createRoom(s1, 'Alice');
  info(`code=${code}`);
  await joinRoom(s2, code, 'Bob');
  const st = await waitFor(s1, s => s.phase === 'reveal' || s.phase === 'bidding');
  if (!st.category) throw new Error('no category');
  if (st.players.length !== 2) throw new Error(`${st.players.length} players`);
  info(`phase=${st.phase}, cat="${st.category.short}"`);
  s1.disconnect(); s2.disconnect();
});
await delay(300);

// ── T2: Early bid advance ──
await test('T2: both bid → reach performing in <5s (not 10s)', async () => {
  const s1 = await mkClient('p2a');
  const s2 = await mkClient('p2b');
  const code = await createRoom(s1, 'Alice');
  await joinRoom(s2, code, 'Bob');
  await waitFor(s1, s => s.phase === 'bidding');
  const t0 = Date.now();
  s1.emit('mg-bid', { count: 3 });
  s2.emit('mg-bid', { count: 3 });
  await waitFor(s1, s => s.phase === 'performing', 5000);
  const ms = Date.now() - t0;
  info(`reached performing in ${ms}ms`);
  if (ms > 5000) bug(`took ${ms}ms, expected <5000ms`);
  s1.emit('mg-perform-done', {});
  s2.emit('mg-perform-done', {});
  await waitFor(s1, s => s.phase === 'result' || s.phase === 'matchOver');
  s1.disconnect(); s2.disconnect();
});
await delay(300);

// ── T3: Result phase is always shown (final round fix) ──
await test('T3: final round goes to result then matchOver (not directly matchOver)', async () => {
  const s1 = await mkClient('p3a');
  const s2 = await mkClient('p3b');
  const code = await createRoom(s1, 'Alice');
  await joinRoom(s2, code, 'Bob');
  const phases = [];
  const listener = s => { if (!phases.includes(s.phase)) phases.push(s.phase); };
  s1.on('mg-state', listener);
  
  // Play rounds until matchOver (p1 wins every tie via lower bid)
  let rounds = 0;
  while (rounds < 5) {
    const res = await playRound(s1, s2, 1, 2);
    rounds++;
    info(`round ${rounds}: phase=${res.phase}, scores=${JSON.stringify(res.scores)}`);
    if (res.phase === 'matchOver') break; // final round should go through result first
    if (res.phase === 'result') s1.emit('mg-next-round', {});
  }
  
  // Check phases seen
  info(`phases seen: ${phases.join(' → ')}`);
  if (!phases.includes('result')) bug('result phase was never seen');
  const resultIdx = phases.lastIndexOf('result');
  const matchOverIdx = phases.indexOf('matchOver');
  if (matchOverIdx !== -1 && resultIdx !== -1 && resultIdx > matchOverIdx) {
    bug('matchOver appeared before final result phase');
  }
  s1.disconnect(); s2.disconnect();
});
await delay(300);

// ── T4: Percentage scoring tie-break ──
await test('T4: tie at 0% → lower bidder wins', async () => {
  const s1 = await mkClient('p4a');
  const s2 = await mkClient('p4b');
  const code = await createRoom(s1, 'Alice');
  await joinRoom(s2, code, 'Bob');
  const res = await playRound(s1, s2, 5, 1); // p1 bid 5, p2 bid 1, both 0 valid → p2 wins
  const hist = res.history?.at(-1);
  const winner = hist?.winnerId;
  const p1r = hist?.results?.[s1._pid];
  const p2r = hist?.results?.[s2._pid];
  info(`p1 bid=5 pct=${p1r?.pct} | p2 bid=1 pct=${p2r?.pct} | winner=${winner}`);
  if (winner !== s2._pid) bug(`expected p2 (lower bid=1) to win tie, got ${winner}`);
  s1.disconnect(); s2.disconnect();
});
await delay(300);

// ── T5: Full best-of-3 ──
await test('T5: best-of-3 completes in ≤3 rounds', async () => {
  const s1 = await mkClient('p5a');
  const s2 = await mkClient('p5b');
  const code = await createRoom(s1, 'Alice');
  await joinRoom(s2, code, 'Bob');
  let rounds = 0;
  while (rounds < 5) {
    await waitFor(s1, s => s.phase === 'reveal' || s.phase === 'bidding' || s.phase === 'matchOver');
    const res = await playRound(s1, s2, 1, 2);
    rounds++;
    if (res.phase === 'matchOver') break;
    s1.emit('mg-next-round', {});
  }
  info(`completed in ${rounds} rounds`);
  if (rounds > 3) bug(`took ${rounds} rounds (max 3 expected)`);
  s1.disconnect(); s2.disconnect();
});
await delay(300);

// ── T6: Disconnect → paused → rejoin ──
await test('T6: disconnect → paused, rejoin via mg-join → resume', async () => {
  const s1 = await mkClient('p6a');
  const s2 = await mkClient('p6b');
  const code = await createRoom(s1, 'Alice');
  await joinRoom(s2, code, 'Bob');
  await waitFor(s1, s => s.phase === 'bidding');
  s1.emit('mg-bid', { count: 2 });
  s2.emit('mg-bid', { count: 2 });
  await waitFor(s1, s => s.phase === 'performing');
  s2.disconnect();
  info('p2 disconnected');
  const paused = await waitFor(s1, s => s.phase === 'paused' || s.phase === 'result', 5000);
  info(`after disconnect: phase=${paused.phase}`);
  if (paused.phase !== 'paused') bug(`expected paused, got ${paused.phase}`);
  // Reconnect via mg-join
  await delay(300);
  const s2b = await mkClient('p6b');
  await joinRoom(s2b, code, 'Bob');
  const resumed = await waitFor(s1, s => s.phase !== 'paused', 8000);
  info(`after rejoin: phase=${resumed.phase}`);
  s1.emit('mg-perform-done', {});
  s2b.emit('mg-perform-done', {});
  await waitFor(s1, s => s.phase === 'result' || s.phase === 'matchOver', 12000);
  s1.disconnect(); s2b.disconnect();
});
await delay(300);

// ── T7: Rematch resets scores ──
await test('T7: rematch clears scores and history', async () => {
  const s1 = await mkClient('p7a');
  const s2 = await mkClient('p7b');
  const code = await createRoom(s1, 'Alice');
  await joinRoom(s2, code, 'Bob');
  let rounds = 0;
  while (rounds < 5) {
    await waitFor(s1, s => s.phase === 'reveal' || s.phase === 'bidding' || s.phase === 'matchOver');
    const res = await playRound(s1, s2, 1, 2);
    rounds++;
    if (res.phase === 'matchOver') break;
    s1.emit('mg-next-round', {});
  }
  info(`match over after ${rounds} rounds`);
  s1.emit('mg-rematch', {});
  s2.emit('mg-rematch', {});
  const rm = await waitFor(s1, s => s.phase === 'reveal' || s.phase === 'bidding' || s.phase === 'waiting', 8000);
  info(`after rematch: phase=${rm.phase}, scores=${JSON.stringify(rm.scores)}`);
  const scoresReset = Object.values(rm.scores).every(v => v === 0);
  if (!scoresReset) bug(`scores not reset: ${JSON.stringify(rm.scores)}`);
  if (rm.history?.length !== 0) bug('history not cleared');
  s1.disconnect(); s2.disconnect();
});
await delay(300);

// ── T8: Bid clamped to 1 ──
await test('T8: bid of 0 clamped to 1 (no division by zero)', async () => {
  const s1 = await mkClient('p8a');
  const s2 = await mkClient('p8b');
  const code = await createRoom(s1, 'Alice');
  await joinRoom(s2, code, 'Bob');
  await waitFor(s1, s => s.phase === 'bidding');
  s1.emit('mg-bid', { count: 0 });
  s2.emit('mg-bid', { count: 2 });
  const perf = await waitFor(s1, s => s.phase === 'performing');
  const p1bid = perf.bids?.[s1._pid];
  info(`bid(0) → server stored: ${p1bid}`);
  if (p1bid === 0) bug('0 bid stored — div by zero risk');
  s1.emit('mg-perform-done', {});
  s2.emit('mg-perform-done', {});
  const res = await waitFor(s1, s => s.phase === 'result' || s.phase === 'matchOver');
  // pct should not be NaN or Infinity
  const p1pct = res.history?.at(-1)?.results?.[s1._pid]?.pct;
  info(`p1 pct = ${p1pct}`);
  if (!Number.isFinite(p1pct)) bug(`pct is ${p1pct} (not finite) for bid ${p1bid}`);
  s1.disconnect(); s2.disconnect();
});
await delay(300);

// ── T9: Category no back-to-back repeats ──
await test('T9: no back-to-back category repeats', async () => {
  const s1 = await mkClient('p9a');
  const s2 = await mkClient('p9b');
  const code = await createRoom(s1, 'Alice');
  await joinRoom(s2, code, 'Bob');
  const cats = [];
  for (let i = 0; i < 3; i++) {
    const bid = await waitFor(s1, s => s.phase === 'bidding');
    cats.push(bid.category?.id);
    s1.emit('mg-bid', { count: 1 });
    s2.emit('mg-bid', { count: 1 });
    await waitFor(s1, s => s.phase === 'performing');
    s1.emit('mg-perform-done', {});
    s2.emit('mg-perform-done', {});
    const res = await waitFor(s1, s => s.phase === 'result' || s.phase === 'matchOver');
    if (res.phase === 'matchOver') break;
    s1.emit('mg-next-round', {});
  }
  info(`cats: ${cats.join(', ')}`);
  for (let i = 1; i < cats.length; i++) {
    if (cats[i] === cats[i-1]) bug(`back-to-back repeat: ${cats[i]}`);
  }
  s1.disconnect(); s2.disconnect();
});

await delay(300);
console.log('\n====== DONE ======');
console.log(`Bugs: ${BUGS.length}`);
BUGS.forEach(b => console.log(b));
console.log(`\nInfo:`);
INFO.forEach(i => console.log(i));
process.exit(0);
