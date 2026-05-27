/**
 * Simulates a full 1v1 online game via socket.io-client to find bugs.
 * Runs multiple permutations:
 *   - Both players bid and hit 100%
 *   - Player1 overbids, loses on %
 *   - Tie scenario (same %)
 *   - One player submits nothing
 *   - Full best-of-3 match
 */
import { io } from 'socket.io-client';

const URL = 'http://localhost:3001';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function createClient(name, id) {
  return new Promise(resolve => {
    const s = io(URL, { transports: ['websocket'] });
    s.on('connect', () => {
      s.emit('hello', { playerId: id });
      resolve({ socket: s, id, name });
    });
  });
}

let currentTest = '';
const BUGS = [];
const INFO = [];

function bug(msg) { BUGS.push(`[BUG] ${currentTest}: ${msg}`); console.error(`[BUG] ${msg}`); }
function info(msg) { INFO.push(`[INFO] ${currentTest}: ${msg}`); console.log(`[INFO] ${msg}`); }

function waitForPhase(socket, phase, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout waiting for phase "${phase}"`)), timeout);
    const handler = (state) => {
      if (state.phase === phase) {
        clearTimeout(t);
        socket.off('mg-state', handler);
        resolve(state);
      }
    };
    socket.on('mg-state', handler);
  });
}

function waitForState(socket, pred, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Timeout waiting for state')), timeout);
    const handler = (state) => {
      if (pred(state)) {
        clearTimeout(t);
        socket.off('mg-state', handler);
        resolve(state);
      }
    };
    socket.on('mg-state', handler);
  });
}

async function runTest(name, fn) {
  currentTest = name;
  console.log(`\n--- ${name} ---`);
  try {
    await fn();
    console.log(`  PASS`);
  } catch (e) {
    bug(e.message);
  }
}

// ──────────────────────────────────────────────────────
// TEST 1: Basic room create + join
// ──────────────────────────────────────────────────────
await runTest('Room create and join', async () => {
  const p1 = await createClient('Alice', 'player-alice');
  const p2 = await createClient('Bob', 'player-bob');

  // p1 creates
  const createResult = await new Promise(res =>
    p1.socket.emit('mg-create', { playerId: 'player-alice', name: 'Alice' }, res)
  );
  if (!createResult.ok) throw new Error(`Create failed: ${createResult.error}`);
  const code = createResult.code;
  info(`Room code: ${code}`);
  if (!code || code.length !== 4) bug(`Expected 4-char code, got "${code}"`);

  // p2 joins
  const joinResult = await new Promise(res =>
    p2.socket.emit('mg-join', { code, playerId: 'player-bob', name: 'Bob' }, res)
  );
  if (!joinResult.ok) throw new Error(`Join failed: ${joinResult.error}`);

  // Wait for reveal phase to start
  const state = await waitForPhase(p1.socket, 'reveal', 6000);
  if (!state.category) throw new Error('No category in reveal phase');
  if (state.players.length !== 2) throw new Error(`Expected 2 players, got ${state.players.length}`);
  info(`Category: "${state.category.short}"`);
  info(`Prompt: "${state.category.prompt}"`);

  p1.socket.disconnect();
  p2.socket.disconnect();
});

await delay(500);

// ──────────────────────────────────────────────────────
// TEST 2: Full round - both players bid, both perform, result
// ──────────────────────────────────────────────────────
await runTest('Full round - both bid and perform', async () => {
  const p1 = await createClient('Alice', 'player-a1');
  const p2 = await createClient('Bob', 'player-b1');

  const { code } = await new Promise(res =>
    p1.socket.emit('mg-create', { playerId: 'player-a1', name: 'Alice' }, res)
  );
  await new Promise(res =>
    p2.socket.emit('mg-join', { code, playerId: 'player-b1', name: 'Bob' }, res)
  );

  // Wait for bidding phase
  const bidState = await waitForPhase(p1.socket, 'bidding', 8000);
  info(`Phase: bidding. Category: ${bidState.category?.short}`);

  // Both bid 3
  p1.socket.emit('mg-bid', { count: 3 });
  p2.socket.emit('mg-bid', { count: 3 });

  // Wait for performing phase
  const perfState = await waitForPhase(p1.socket, 'performing', 8000);
  info(`Phase: performing. byPlayer keys: ${Object.keys(perfState.performing?.byPlayer || {}).join(', ')}`);

  // Validate performing state has both players
  const byPlayer = perfState.performing?.byPlayer;
  if (!byPlayer) throw new Error('No performing.byPlayer in state');
  if (!byPlayer['player-a1']) throw new Error('Missing player-a1 in byPlayer');
  if (!byPlayer['player-b1']) throw new Error('Missing player-b1 in byPlayer');

  // Push valid answers for both players
  // Use actual answers from the category
  const category = bidState.category;
  info(`Category answers preview: ${JSON.stringify(category?.prompt)}`);

  // Push generic items that might not match - we just want to test flow
  p1.socket.emit('mg-perform-batch', { items: ['item1', 'item2', 'item3'] });
  p2.socket.emit('mg-perform-batch', { items: ['item4', 'item5', 'item6'] });
  p1.socket.emit('mg-perform-done', {});
  p2.socket.emit('mg-perform-done', {});

  // Wait for result
  const resultState = await waitForPhase(p1.socket, 'result', 10000);
  info(`Result phase! Winner: ${resultState.history?.[0]?.winnerId}`);
  info(`Scores: ${JSON.stringify(resultState.scores)}`);

  const hist = resultState.history?.[0];
  if (!hist) throw new Error('No history in result state');
  if (!hist.winnerId) throw new Error('No winnerId in history');
  if (!hist.results['player-a1']) throw new Error('Missing player-a1 in results');
  if (!hist.results['player-b1']) throw new Error('Missing player-b1 in results');
  if (hist.results['player-a1'].pct === undefined) throw new Error('Missing pct for player-a1');

  // Check score updated correctly
  const winner = hist.winnerId;
  if (resultState.scores[winner] !== 1) {
    bug(`Winner's score should be 1, got ${resultState.scores[winner]}`);
  }

  p1.socket.disconnect();
  p2.socket.disconnect();
});

await delay(500);

// ──────────────────────────────────────────────────────
// TEST 3: Full best-of-3 match (3 rounds)
// ──────────────────────────────────────────────────────
await runTest('Full best-of-3 match', async () => {
  const p1 = await createClient('Alice', 'player-a2');
  const p2 = await createClient('Bob', 'player-b2');

  const { code } = await new Promise(res =>
    p1.socket.emit('mg-create', { playerId: 'player-a2', name: 'Alice' }, res)
  );
  await new Promise(res =>
    p2.socket.emit('mg-join', { code, playerId: 'player-b2', name: 'Bob' }, res)
  );

  let roundsPlayed = 0;
  let matchDone = false;

  while (!matchDone) {
    // Wait for bidding
    const bidState = await waitForPhase(p1.socket, 'bidding', 8000);
    roundsPlayed++;
    info(`Round ${roundsPlayed}, category: ${bidState.category?.short}`);

    p1.socket.emit('mg-bid', { count: 2 });
    p2.socket.emit('mg-bid', { count: 2 });

    await waitForPhase(p1.socket, 'performing', 8000);
    p1.socket.emit('mg-perform-done', {});
    p2.socket.emit('mg-perform-done', {});

    const resultState = await waitForPhase(p1.socket, 'result', 10000);
    info(`Round ${roundsPlayed} result: winner=${resultState.history?.at(-1)?.winnerId}, scores=${JSON.stringify(resultState.scores)}`);

    // Check for matchOver
    if (resultState.phase === 'matchOver') {
      matchDone = true;
      break;
    }

    // Check scores for early win
    const sc = resultState.scores;
    const winsNeeded = resultState.winsNeeded;
    if (Object.values(sc).some(v => v >= winsNeeded)) {
      // next round should be matchOver - but we need to trigger nextRound
      // Actually result phase shows, then nextRound takes us to matchOver or next round
    }

    // Advance to next round
    p1.socket.emit('mg-next-round', {});

    // Wait for either bidding (next round) or matchOver
    const next = await waitForState(p1.socket, s => s.phase === 'bidding' || s.phase === 'matchOver', 8000);
    if (next.phase === 'matchOver') {
      matchDone = true;
      info(`Match over after ${roundsPlayed} rounds, scores: ${JSON.stringify(next.scores)}`);
    }
  }

  if (roundsPlayed < 1) throw new Error('No rounds played');
  if (roundsPlayed > 3) bug(`Best-of-3 should end in ≤3 rounds, played ${roundsPlayed}`);
  info(`Match completed in ${roundsPlayed} rounds`);

  p1.socket.disconnect();
  p2.socket.disconnect();
});

await delay(500);

// ──────────────────────────────────────────────────────
// TEST 4: Percentage scoring - overbidder loses
// ──────────────────────────────────────────────────────
await runTest('Percentage scoring: overbidder loses', async () => {
  const p1 = await createClient('Alice', 'player-a3');
  const p2 = await createClient('Bob', 'player-b3');

  const { code } = await new Promise(res =>
    p1.socket.emit('mg-create', { playerId: 'player-a3', name: 'Alice' }, res)
  );
  await new Promise(res =>
    p2.socket.emit('mg-join', { code, playerId: 'player-b3', name: 'Bob' }, res)
  );

  const bidState = await waitForPhase(p1.socket, 'bidding', 8000);

  // p1 bids 10 (will get 0% = 0/10)
  // p2 bids 1 (will get 0% = 0/1) - actually both get 0 so tie → lower bidder wins
  // Let's do: p1 bids 5, gets 0 items = 0%; p2 bids 1, gets 0 items = 0% → tie → p2 wins (lower bid)
  p1.socket.emit('mg-bid', { count: 5 });
  p2.socket.emit('mg-bid', { count: 1 });

  await waitForPhase(p1.socket, 'performing', 8000);
  p1.socket.emit('mg-perform-done', {}); // 0 items
  p2.socket.emit('mg-perform-done', {}); // 0 items

  const resultState = await waitForPhase(p1.socket, 'result', 10000);
  const hist = resultState.history?.at(-1);
  const p1result = hist?.results?.['player-a3'];
  const p2result = hist?.results?.['player-b3'];

  info(`p1: bid=5, valid=${p1result?.validCount}, pct=${p1result?.pct}`);
  info(`p2: bid=1, valid=${p2result?.validCount}, pct=${p2result?.pct}`);
  info(`Winner: ${hist?.winnerId}`);

  // Both have 0% → tie → lower bid wins (p2 bid 1)
  if (hist?.winnerId !== 'player-b3') {
    bug(`Expected player-b3 to win tie-break (lower bid 1 vs 5), but winner was ${hist?.winnerId}`);
  }

  p1.socket.disconnect();
  p2.socket.disconnect();
});

await delay(500);

// ──────────────────────────────────────────────────────
// TEST 5: One player disconnects mid-game
// ──────────────────────────────────────────────────────
await runTest('Disconnect grace period during performing', async () => {
  const p1 = await createClient('Alice', 'player-a4');
  const p2 = await createClient('Bob', 'player-b4');

  const { code } = await new Promise(res =>
    p1.socket.emit('mg-create', { playerId: 'player-a4', name: 'Alice' }, res)
  );
  await new Promise(res =>
    p2.socket.emit('mg-join', { code, playerId: 'player-b4', name: 'Bob' }, res)
  );

  await waitForPhase(p1.socket, 'bidding', 8000);
  p1.socket.emit('mg-bid', { count: 2 });
  p2.socket.emit('mg-bid', { count: 2 });

  await waitForPhase(p1.socket, 'performing', 8000);

  // p2 disconnects abruptly
  p2.socket.disconnect();
  info('p2 disconnected during performing');

  // State should go to paused or eventually result
  const nextState = await waitForState(
    p1.socket,
    s => s.phase === 'paused' || s.phase === 'result' || s.phase === 'matchOver',
    15000
  );
  info(`After p2 disconnect, phase = ${nextState.phase}`);

  if (nextState.phase !== 'paused') {
    info(`NOTE: Expected paused, got ${nextState.phase} — may be by design`);
  }

  // p2 reconnects
  const p2b = await createClient('Bob', 'player-b4');
  const rejoinResult = await new Promise(res =>
    p2b.socket.emit('mg-rejoin', { code, playerId: 'player-b4' }, res)
  );
  info(`Rejoin result: ${JSON.stringify(rejoinResult)}`);

  p1.socket.disconnect();
  p2b.socket.disconnect();
});

await delay(500);

// ──────────────────────────────────────────────────────
// TEST 6: Invalid bid (0 or negative)
// ──────────────────────────────────────────────────────
await runTest('Edge case: bid of 0', async () => {
  const p1 = await createClient('Alice', 'player-a5');
  const p2 = await createClient('Bob', 'player-b5');

  const { code } = await new Promise(res =>
    p1.socket.emit('mg-create', { playerId: 'player-a5', name: 'Alice' }, res)
  );
  await new Promise(res =>
    p2.socket.emit('mg-join', { code, playerId: 'player-b5', name: 'Bob' }, res)
  );

  const bidState = await waitForPhase(p1.socket, 'bidding', 8000);

  // Try bid 0
  p1.socket.emit('mg-bid', { count: 0 });
  await delay(200);

  // Check if state still shows bid as 0 or clamped
  // Next we bid normally
  p1.socket.emit('mg-bid', { count: 2 });
  p2.socket.emit('mg-bid', { count: 2 });

  const perfState = await waitForPhase(p1.socket, 'performing', 8000);
  const p1bid = Object.values(perfState.bids || {})?.[0];
  info(`After bid(0) then bid(2): bids = ${JSON.stringify(perfState.bids)}`);

  if (perfState.bids?.['player-a5'] === 0) {
    bug(`Bid of 0 accepted — could cause division by zero in percentage calc`);
  }

  p1.socket.emit('mg-perform-done', {});
  p2.socket.emit('mg-perform-done', {});
  await waitForPhase(p1.socket, 'result', 10000);

  p1.socket.disconnect();
  p2.socket.disconnect();
});

await delay(500);

// ──────────────────────────────────────────────────────
// TEST 7: Duplicate item submissions
// ──────────────────────────────────────────────────────
await runTest('Duplicate item deduplication', async () => {
  const p1 = await createClient('Alice', 'player-a6');
  const p2 = await createClient('Bob', 'player-b6');

  const { code } = await new Promise(res =>
    p1.socket.emit('mg-create', { playerId: 'player-a6', name: 'Alice' }, res)
  );
  await new Promise(res =>
    p2.socket.emit('mg-join', { code, playerId: 'player-b6', name: 'Bob' }, res)
  );

  await waitForPhase(p1.socket, 'bidding', 8000);
  p1.socket.emit('mg-bid', { count: 3 });
  p2.socket.emit('mg-bid', { count: 2 });

  await waitForPhase(p1.socket, 'performing', 8000);

  // p1 submits same item multiple times
  p1.socket.emit('mg-perform-item', { item: 'California' });
  p1.socket.emit('mg-perform-item', { item: 'california' }); // lowercase dup
  p1.socket.emit('mg-perform-item', { item: 'CALIFORNIA' }); // uppercase dup
  p1.socket.emit('mg-perform-done', {});
  p2.socket.emit('mg-perform-done', {});

  const resultState = await waitForPhase(p1.socket, 'result', 10000);
  const p1judged = resultState.history?.at(-1)?.results?.['player-a6']?.judged;
  info(`p1 judged items: ${JSON.stringify(p1judged?.map(j => `${j.raw}:${j.status}`))}`);

  const dups = p1judged?.filter(j => j.status === 'duplicate') ?? [];
  info(`Duplicates detected: ${dups.length}`);
  if (dups.length !== 2) {
    bug(`Expected 2 duplicates (lowercase + uppercase same word), got ${dups.length}`);
  }

  p1.socket.disconnect();
  p2.socket.disconnect();
});

await delay(500);

// ──────────────────────────────────────────────────────
// TEST 8: Rematch flow
// ──────────────────────────────────────────────────────
await runTest('Rematch after match over', async () => {
  const p1 = await createClient('Alice', 'player-a7');
  const p2 = await createClient('Bob', 'player-b7');

  const { code } = await new Promise(res =>
    p1.socket.emit('mg-create', { playerId: 'player-a7', name: 'Alice' }, res)
  );
  await new Promise(res =>
    p2.socket.emit('mg-join', { code, playerId: 'player-b7', name: 'Bob' }, res)
  );

  // Play through 2 rounds to get a winner (each gets 1 win, then p1 wins 3rd via tie-break)
  let matchOver = false;
  let safetyCounter = 0;
  while (!matchOver && safetyCounter < 5) {
    safetyCounter++;
    const bidState = await waitForPhase(p1.socket, 'bidding', 8000);

    p1.socket.emit('mg-bid', { count: 1 });
    p2.socket.emit('mg-bid', { count: 2 }); // p1 always has lower bid = wins tie

    await waitForPhase(p1.socket, 'performing', 8000);
    p1.socket.emit('mg-perform-done', {});
    p2.socket.emit('mg-perform-done', {});

    const resultState = await waitForPhase(p1.socket, 'result', 10000);
    const winsNeeded = resultState.winsNeeded;
    const scores = resultState.scores;
    info(`Scores: ${JSON.stringify(scores)}, winsNeeded: ${winsNeeded}`);

    const someoneWon = Object.values(scores).some(v => v >= winsNeeded);
    if (someoneWon) {
      // trigger matchOver
      p1.socket.emit('mg-next-round', {});
      const moState = await waitForState(p1.socket, s => s.phase === 'matchOver', 6000);
      info(`Match over! Scores: ${JSON.stringify(moState.scores)}`);
      matchOver = true;

      // Both players rematch
      p1.socket.emit('mg-rematch', {});
      p2.socket.emit('mg-rematch', {});

      // Should go back to waiting/reveal
      const rematchState = await waitForState(
        p1.socket,
        s => s.phase === 'waiting' || s.phase === 'reveal' || s.phase === 'bidding',
        8000
      );
      info(`After rematch, phase = ${rematchState.phase}`);
      info(`Scores reset: ${JSON.stringify(rematchState.scores)}`);

      if (Object.values(rematchState.scores).some(v => v !== 0)) {
        bug(`Scores not reset after rematch: ${JSON.stringify(rematchState.scores)}`);
      }
    } else {
      p1.socket.emit('mg-next-round', {});
    }
  }

  if (!matchOver) bug('Match never ended after 5 rounds in best-of-3');

  p1.socket.disconnect();
  p2.socket.disconnect();
});

await delay(200);

// ──────────────────────────────────────────────────────
// SUMMARY
// ──────────────────────────────────────────────────────
console.log('\n\n====== SIMULATION COMPLETE ======');
console.log(`\nBugs found: ${BUGS.length}`);
BUGS.forEach(b => console.log(b));
console.log(`\nInfo: ${INFO.length} observations`);
INFO.forEach(i => console.log(i));

process.exit(0);
