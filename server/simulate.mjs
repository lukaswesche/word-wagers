import { io } from 'socket.io-client';

const URL = 'http://localhost:3001';
const delay = ms => new Promise(r => setTimeout(r, ms));

async function mkClient(pid) {
  return new Promise(res => {
    const s = io(URL, { transports: ['websocket'] });
    s.pid = pid;
    s.on('connect', () => { s.emit('hello', { playerId: pid }); res(s); });
  });
}

function waitFor(socket, pred, timeout = 12000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      socket.off('mg-state', h);
      reject(new Error(`Timeout ${timeout}ms waiting for state`));
    }, timeout);
    const h = s => { if (pred(s)) { clearTimeout(t); socket.off('mg-state', h); resolve(s); } };
    socket.on('mg-state', h);
  });
}

function emit(socket, event, payload) {
  return new Promise((res, rej) => {
    socket.emit(event, payload, r => {
      if (r && r.ok === false) rej(new Error(r.error || event + ' failed'));
      else res(r);
    });
  });
}

const BUGS = [], INFO = [];
let T = '';
const bug = m => { BUGS.push(`[BUG] ${T}: ${m}`); console.error(`  [BUG] ${m}`); };
const info = m => { INFO.push(m); console.log(`  [INFO] ${m}`); };

async function runTest(name, fn) {
  T = name;
  console.log(`\n--- ${name} ---`);
  try { await fn(); console.log('  PASS'); }
  catch(e) { bug(e.message || String(e)); console.log('  FAIL'); }
}

async function createRoom(host, name) {
  const r = await emit(host, 'mg-create', { playerId: host.pid, name });
  return r.code;
}
async function joinRoom(guest, code, name) {
  await emit(guest, 'mg-join', { code, playerId: guest.pid, name });
}
async function playRound(s1, s2, b1=2, b2=2, items1=[], items2=[]) {
  const bidSt = await waitFor(s1, s => s.phase === 'bidding');
  info(`Round category: "${bidSt.category?.short}"`);
  s1.emit('mg-bid', { count: b1 });
  s2.emit('mg-bid', { count: b2 });
  await waitFor(s1, s => s.phase === 'performing');
  if (items1.length) s1.emit('mg-perform-batch', { items: items1 });
  if (items2.length) s2.emit('mg-perform-batch', { items: items2 });
  s1.emit('mg-perform-done', {});
  s2.emit('mg-perform-done', {});
  return waitFor(s1, s => s.phase === 'result' || s.phase === 'matchOver');
}

// ─────────────────────────────────────────
await runTest('T1: create + join', async () => {
  const s1 = await mkClient('t1a');
  const s2 = await mkClient('t1b');
  const code = await createRoom(s1, 'Alice');
  info(`code=${code}`);
  await joinRoom(s2, code, 'Bob');
  const st = await waitFor(s1, s => s.phase === 'reveal' || s.phase === 'bidding');
  if (!st.category) throw new Error('no category');
  info(`phase=${st.phase} cat="${st.category.short}"`);
  if (st.players.length !== 2) throw new Error(`${st.players.length} players`);
  s1.disconnect(); s2.disconnect();
});
await delay(300);

await runTest('T2: early-bid advance <5s', async () => {
  const s1 = await mkClient('t2a');
  const s2 = await mkClient('t2b');
  const code = await createRoom(s1, 'Alice');
  await joinRoom(s2, code, 'Bob');
  await waitFor(s1, s => s.phase === 'bidding');
  const t0 = Date.now();
  s1.emit('mg-bid', { count: 3 });
  s2.emit('mg-bid', { count: 3 });
  await waitFor(s1, s => s.phase === 'performing', 5000);
  const ms = Date.now() - t0;
  info(`reached performing in ${ms}ms`);
  if (ms > 5000) bug(`too slow: ${ms}ms`);
  s1.emit('mg-perform-done', {}); s2.emit('mg-perform-done', {});
  await waitFor(s1, s => s.phase === 'result' || s.phase === 'matchOver');
  s1.disconnect(); s2.disconnect();
});
await delay(300);

await runTest('T3: final round shows result phase (not direct matchOver)', async () => {
  const s1 = await mkClient('t3a');
  const s2 = await mkClient('t3b');
  const code = await createRoom(s1, 'Alice');
  await joinRoom(s2, code, 'Bob');
  const phases = [];
  s1.on('mg-state', s => { if (!phases.at(-1) || phases.at(-1) !== s.phase) phases.push(s.phase); });
  let rounds = 0;
  while (rounds < 5) {
    await waitFor(s1, s => s.phase === 'reveal' || s.phase === 'bidding' || s.phase === 'matchOver');
    const res = await playRound(s1, s2, 1, 2);
    rounds++;
    info(`Round ${rounds} ended: phase=${res.phase}`);
    if (res.phase === 'matchOver') break;
    if (res.phase === 'result') s1.emit('mg-next-round', {});
  }
  info(`phases seen: ${phases.join(' → ')}`);
  if (!phases.includes('result')) bug('result phase never seen');
  // Make sure matchOver didn't appear before the last result
  const riLast = phases.lastIndexOf('result');
  const moI = phases.lastIndexOf('matchOver');
  if (moI > -1 && riLast > -1 && moI < riLast) bug('matchOver appeared before last result');
  s1.disconnect(); s2.disconnect();
});
await delay(300);

await runTest('T4: tie at 0% → lower bidder wins', async () => {
  const s1 = await mkClient('t4a');
  const s2 = await mkClient('t4b');
  const code = await createRoom(s1, 'Alice');
  await joinRoom(s2, code, 'Bob');
  const res = await playRound(s1, s2, 5, 1);
  const hist = res.history?.at(-1);
  const winner = hist?.winnerId;
  const p1r = hist?.results?.[s1.pid];
  const p2r = hist?.results?.[s2.pid];
  info(`p1 bid=5 pct=${p1r?.pct} | p2 bid=1 pct=${p2r?.pct} | winner=${winner}`);
  if (winner !== s2.pid) bug(`expected ${s2.pid} (bid=1) to win, got ${winner}`);
  s1.disconnect(); s2.disconnect();
});
await delay(300);

await runTest('T5: best-of-3 completes in ≤3 rounds', async () => {
  const s1 = await mkClient('t5a');
  const s2 = await mkClient('t5b');
  const code = await createRoom(s1, 'Alice');
  await joinRoom(s2, code, 'Bob');
  let rounds = 0;
  while (rounds < 5) {
    await waitFor(s1, s => ['reveal','bidding','matchOver'].includes(s.phase));
    const res = await playRound(s1, s2, 1, 2);
    rounds++;
    info(`Round ${rounds}: scores=${JSON.stringify(res.scores)} phase=${res.phase}`);
    if (res.phase === 'matchOver') break;
    s1.emit('mg-next-round', {});
  }
  if (rounds > 3) bug(`took ${rounds} rounds`);
  info(`Completed in ${rounds} rounds`);
  s1.disconnect(); s2.disconnect();
});
await delay(300);

await runTest('T6: disconnect → paused, rejoin → resume', async () => {
  const s1 = await mkClient('t6a');
  const s2 = await mkClient('t6b');
  const code = await createRoom(s1, 'Alice');
  await joinRoom(s2, code, 'Bob');
  await waitFor(s1, s => s.phase === 'bidding');
  s1.emit('mg-bid', { count: 2 }); s2.emit('mg-bid', { count: 2 });
  await waitFor(s1, s => s.phase === 'performing');
  s2.disconnect();
  info('p2 disconnected');
  const paused = await waitFor(s1, s => s.phase === 'paused' || s.phase === 'result', 5000);
  info(`phase after disconnect: ${paused.phase}`);
  if (paused.phase !== 'paused') bug(`expected paused, got ${paused.phase}`);
  await delay(300);
  const s2b = await mkClient('t6b');
  await joinRoom(s2b, code, 'Bob');
  const resumed = await waitFor(s1, s => s.phase !== 'paused', 8000);
  info(`phase after rejoin: ${resumed.phase}`);
  s1.emit('mg-perform-done', {}); s2b.emit('mg-perform-done', {});
  await waitFor(s1, s => s.phase === 'result' || s.phase === 'matchOver', 12000);
  s1.disconnect(); s2b.disconnect();
});
await delay(300);

await runTest('T7: rematch resets scores + history', async () => {
  const s1 = await mkClient('t7a');
  const s2 = await mkClient('t7b');
  const code = await createRoom(s1, 'Alice');
  await joinRoom(s2, code, 'Bob');
  let rounds = 0;
  while (rounds < 5) {
    await waitFor(s1, s => ['reveal','bidding','matchOver'].includes(s.phase));
    const res = await playRound(s1, s2, 1, 2);
    rounds++;
    if (res.phase === 'matchOver') break;
    s1.emit('mg-next-round', {});
  }
  info(`match over after ${rounds} rounds`);
  s1.emit('mg-rematch', {}); s2.emit('mg-rematch', {});
  const rm = await waitFor(s1, s => ['waiting','reveal','bidding'].includes(s.phase), 8000);
  info(`after rematch: phase=${rm.phase} scores=${JSON.stringify(rm.scores)}`);
  if (Object.values(rm.scores).some(v => v !== 0)) bug(`scores not reset: ${JSON.stringify(rm.scores)}`);
  if (rm.history?.length !== 0) bug('history not cleared');
  s1.disconnect(); s2.disconnect();
});
await delay(300);

await runTest('T8: bid(0) clamped to 1, pct is finite', async () => {
  const s1 = await mkClient('t8a');
  const s2 = await mkClient('t8b');
  const code = await createRoom(s1, 'Alice');
  await joinRoom(s2, code, 'Bob');
  await waitFor(s1, s => s.phase === 'bidding');
  s1.emit('mg-bid', { count: 0 }); s2.emit('mg-bid', { count: 2 });
  const perf = await waitFor(s1, s => s.phase === 'performing');
  const p1bid = perf.bids?.[s1.pid];
  info(`bid(0) → server stored: ${p1bid}`);
  if (p1bid === 0) bug('0 bid stored');
  s1.emit('mg-perform-done', {}); s2.emit('mg-perform-done', {});
  const res = await waitFor(s1, s => s.phase === 'result' || s.phase === 'matchOver');
  const pct = res.history?.at(-1)?.results?.[s1.pid]?.pct;
  info(`p1 pct = ${pct}`);
  if (!Number.isFinite(pct)) bug(`pct is ${pct}`);
  s1.disconnect(); s2.disconnect();
});
await delay(300);

await runTest('T9: no back-to-back category repeats', async () => {
  const s1 = await mkClient('t9a');
  const s2 = await mkClient('t9b');
  const code = await createRoom(s1, 'Alice');
  await joinRoom(s2, code, 'Bob');
  const cats = [];
  for (let i = 0; i < 3; i++) {
    const bid = await waitFor(s1, s => s.phase === 'bidding');
    cats.push(bid.category?.id);
    info(`Round ${i+1}: ${bid.category?.short}`);
    s1.emit('mg-bid', { count: 1 }); s2.emit('mg-bid', { count: 1 });
    await waitFor(s1, s => s.phase === 'performing');
    s1.emit('mg-perform-done', {}); s2.emit('mg-perform-done', {});
    const res = await waitFor(s1, s => s.phase === 'result' || s.phase === 'matchOver');
    if (res.phase === 'matchOver') break;
    s1.emit('mg-next-round', {});
  }
  info(`cats: ${cats.join(', ')}`);
  for (let i = 1; i < cats.length; i++) {
    if (cats[i] === cats[i-1]) bug(`repeated: "${cats[i]}"`);
  }
  s1.disconnect(); s2.disconnect();
});

await delay(200);
console.log('\n====== SIMULATION COMPLETE ======');
console.log(`\nBugs: ${BUGS.length}`);
BUGS.forEach(b => console.log(' ', b));
if (BUGS.length === 0) console.log('  (none!)');
process.exit(0);
