import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type Category,
  type JudgedItem,
  judge,
  normalize,
  randomCategory,
  validCount,
} from './categories';
import { useVoice } from './useVoice';
import { useSound } from './useSound';
import {
  type Difficulty,
  DIFFICULTY_LABEL,
  cpuBidFor,
  cpuCadenceMs,
  cpuCeiling,
  cpuHitChance,
} from './difficulty';

type Phase =
  | 'reveal'
  | 'bidding'
  | 'bidReveal'
  | 'performing'
  | 'result'
  | 'matchOver';

type Round = {
  category: Category;
  playerBid: number;
  cpuBid: number;
  playerValid: number;
  playerPct: number;
  cpuValid: number;
  cpuPct: number;
  judged: JudgedItem[];
  cpuJudged: { text: string; status: 'valid' | 'invalid' | 'duplicate' }[];
  winner: 'player' | 'cpu';
};

const BID_SECONDS = 8;
const REVEAL_SECONDS = 3;
const BID_REVEAL_SECONDS = 2;
const PERFORM_SECONDS = 25;
const BEST_OF = 3;

type Props = { onExit: () => void; difficulty: Difficulty };

type CpuPlan = {
  items: { text: string; status: 'valid' | 'invalid' | 'duplicate' }[];
  finalValid: number;
};

function buildCpuPlan(category: Category, bid: number, ceiling: number, diff: Difficulty): CpuPlan {
  const hitChance = cpuHitChance(bid, ceiling, diff);
  const hit = Math.random() < hitChance;

  // When CPU misses, the shortfall is meaningful — random drop between
  // 30% and 80% of the bid on easy, smaller drops on harder tiers.
  let targetValid: number;
  if (hit) {
    targetValid = bid;
  } else {
    const dropPct = diff === 'easy' ? 0.30 + Math.random() * 0.50
                  : diff === 'medium' ? 0.20 + Math.random() * 0.40
                  : 0.10 + Math.random() * 0.25;
    targetValid = Math.max(0, Math.floor(bid * (1 - dropPct)));
  }

  const realPool = category.answers
    .map(a => (Array.isArray(a) ? a[0] : a))
    .sort(() => Math.random() - 0.5);
  const reals = realPool.slice(0, Math.min(targetValid, realPool.length));

  // Wrong-answer rate scales with difficulty (easy CPU blurts nonsense more)
  const wrongChance = diff === 'easy' ? 0.60 : diff === 'medium' ? 0.35 : 0.15;
  const wrongs: string[] = [];
  if (!hit && Math.random() < wrongChance) {
    const bogus = ['Inception', 'Madagascar', 'Texas State', 'Eiffel', 'Pluto-99', 'Blobfish', 'Sandwich', 'Tomato'];
    wrongs.push(bogus[Math.floor(Math.random() * bogus.length)]);
  }

  const items: CpuPlan['items'] = reals.map(t => ({ text: t, status: 'valid' as const }));
  for (const w of wrongs) items.push({ text: w, status: 'invalid' as const });
  return { items, finalValid: reals.length };
}

export default function MiniGameSolo({ onExit, difficulty }: Props) {
  const [phase, setPhase] = useState<Phase>('reveal');
  const [roundIdx, setRoundIdx] = useState(0);
  const [history, setHistory] = useState<Round[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [playerBid, setPlayerBid] = useState(5);
  const [playerLocked, setPlayerLocked] = useState(false);
  const [cpuBid, setCpuBid] = useState(0);
  const [timer, setTimer] = useState(0);
  const phaseStartedAt = useRef<number>(0);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const [cpuPlan, setCpuPlan] = useState<CpuPlan | null>(null);
  const [cpuSpoken, setCpuSpoken] = useState<CpuPlan['items']>([]);
  const cpuTimerRef = useRef<number | null>(null);

  const [playerDone, setPlayerDone] = useState(false);

  const voice = useVoice();
  const sfx = useSound();
  const [typedAnswer, setTypedAnswer] = useState('');
  const [useText, setUseText] = useState(() => {
    if (!voice.supported) return true;
    try {
      const saved = localStorage.getItem('mg:inputMode');
      if (saved === 'text') return true;
      if (saved === 'voice') return false;
    } catch { /* ignore */ }
    return !voice.supported;
  });
  useEffect(() => {
    try { localStorage.setItem('mg:inputMode', useText ? 'text' : 'voice'); } catch { /* ignore */ }
  }, [useText]);
  const httpWarning = !voice.supported &&
    typeof window !== 'undefined' &&
    window.location.protocol === 'http:' &&
    window.location.hostname !== 'localhost';
  const [typePreview, setTypePreview] = useState<'match' | 'no-match' | null>(null);

  // Preview: check if typed text would match category
  useEffect(() => {
    if (!typedAnswer.trim() || !category || typedAnswer.trim().length < 2) {
      setTypePreview(null);
      return;
    }
    const n = normalize(typedAnswer);
    const matches = category.answers.some(a =>
      (Array.isArray(a) ? a : [a]).some(v => normalize(v) === n)
    );
    setTypePreview(matches ? 'match' : 'no-match');
  }, [typedAnswer, category]);

  const prevScoresRef = useRef({ player: 0, cpu: 0 });
  const [scoreFlash, setScoreFlash] = useState<{ player?: boolean; cpu?: boolean }>({});

  const playerWins = history.filter(r => r.winner === 'player').length;
  const cpuWins = history.filter(r => r.winner === 'cpu').length;
  const winsNeeded = Math.ceil(BEST_OF / 2);

  // Score flash
  useEffect(() => {
    const flash: { player?: boolean; cpu?: boolean } = {};
    if (playerWins > prevScoresRef.current.player) flash.player = true;
    if (cpuWins > prevScoresRef.current.cpu) flash.cpu = true;
    if (flash.player || flash.cpu) {
      setScoreFlash(flash);
      setTimeout(() => setScoreFlash({}), 800);
    }
    prevScoresRef.current = { player: playerWins, cpu: cpuWins };
  }, [playerWins, cpuWins]);

  const leading = playerWins > cpuWins ? 'player' : cpuWins > playerWins ? 'cpu' : 'tied';

  const cpuCeilingFor = (c: Category) => cpuCeiling(c, difficulty);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    rootRef.current?.scrollTo?.({ top: 0 });
    startMatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startMatch = () => {
    setHistory([]);
    setRoundIdx(0);
    startRound(0, []);
  };

  const startRound = (idx: number, prior: Round[]) => {
    const prev = prior[prior.length - 1]?.category.id;
    const c = randomCategory(prev);
    setCategory(c);
    setRoundIdx(idx);
    setPlayerBid(Math.min(7, Math.max(3, Math.round(c.answers.length * 0.18))));
    setPlayerLocked(false);
    setCpuBid(cpuBidFor(c, difficulty));
    voice.stop();
    voice.reset();
    setTypedAnswer('');
    setTypePreview(null);
    setCpuSpoken([]);
    setCpuPlan(null);
    setPlayerDone(false);
    enterPhase('reveal', REVEAL_SECONDS);
  };

  const enterPhase = (p: Phase, seconds: number) => {
    setPhase(p);
    phaseStartedAt.current = Date.now();
    setTimer(seconds);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (p === 'reveal') sfx.play('reveal');
  };

  useEffect(() => {
    if (phase === 'matchOver' || phase === 'result') return;
    const id = setInterval(() => {
      const elapsed = (Date.now() - phaseStartedAt.current) / 1000;
      const totalForPhase =
        phase === 'reveal' ? REVEAL_SECONDS :
        phase === 'bidding' ? BID_SECONDS :
        phase === 'bidReveal' ? BID_REVEAL_SECONDS :
        phase === 'performing' ? PERFORM_SECONDS : 0;
      const remaining = Math.max(0, totalForPhase - elapsed);
      setTimer(remaining);
      if (remaining <= 0) {
        clearInterval(id);
        advancePhase();
      }
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const advancePhase = () => {
    if (phase === 'reveal') enterPhase('bidding', BID_SECONDS);
    else if (phase === 'bidding') enterPhase('bidReveal', BID_REVEAL_SECONDS);
    else if (phase === 'bidReveal') startPerformPhase();
    else if (phase === 'performing') finishRound();
  };

  const startPerformPhase = () => {
    if (!category) return;
    // Both player and CPU perform simultaneously
    const plan = buildCpuPlan(category, cpuBid, cpuCeilingFor(category), difficulty);
    setCpuPlan(plan);
    setCpuSpoken([]);
    setPlayerDone(false);
    if (!useText && voice.supported) voice.start();
    enterPhase('performing', PERFORM_SECONDS);
  };

  // Drip-feed CPU items
  useEffect(() => {
    if (phase !== 'performing' || !cpuPlan) return;
    let i = 0;
    setCpuSpoken([]);
    const tick = () => {
      if (i >= cpuPlan.items.length) return;
      setCpuSpoken(prev => [...prev, cpuPlan.items[i]]);
      i += 1;
      cpuTimerRef.current = window.setTimeout(tick, cpuCadenceMs(difficulty));
    };
    cpuTimerRef.current = window.setTimeout(tick, cpuCadenceMs(difficulty));
    return () => {
      if (cpuTimerRef.current) window.clearTimeout(cpuTimerRef.current);
    };
  }, [phase, cpuPlan, difficulty]);

  const lockBid = () => { setPlayerLocked(true); sfx.play('bidLock'); };

  // Play sound on new judged items during solo performing
  const prevJudgedCountRef = useRef(0);
  useEffect(() => {
    if (phase !== 'performing' || !category) { prevJudgedCountRef.current = 0; return; }
    const j = judge(category, voice.items);
    if (j.length > prevJudgedCountRef.current) {
      const newOnes = j.slice(prevJudgedCountRef.current);
      for (const it of newOnes) {
        if (it.status === 'valid') sfx.play('correct');
        else if (it.status === 'duplicate') sfx.play('duplicate');
        else sfx.play('wrong');
      }
    }
    prevJudgedCountRef.current = j.length;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.items.length, phase, category]);

  // Tick on last 3 seconds
  const lastTickRef = useRef(0);
  useEffect(() => {
    if (phase !== 'bidding' && phase !== 'performing') return;
    const sec = Math.ceil(timer);
    if (sec > 0 && sec <= 3 && sec !== lastTickRef.current) {
      lastTickRef.current = sec;
      sfx.play('tick');
    }
    if (sec > 3) lastTickRef.current = 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer, phase]);

  // Auto-lock bid when timer runs out
  useEffect(() => {
    if (phase === 'bidding' && timer <= 0 && !playerLocked) setPlayerLocked(true);
  }, [phase, timer, playerLocked]);

  useEffect(() => {
    if (phase === 'bidding' && playerLocked) {
      const id = setTimeout(() => enterPhase('bidReveal', BID_REVEAL_SECONDS), 400);
      return () => clearTimeout(id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, playerLocked]);

  // Finish round: percentage-based comparison
  const finishRound = () => {
    voice.stop();
    if (cpuTimerRef.current) window.clearTimeout(cpuTimerRef.current);
    if (!category) return;

    // Cap attempts at bid: only the first `bid` non-duplicate items count
    const allJudged = judge(category, voice.items);
    const playerJudged: typeof allJudged = [];
    let attemptsUsed = 0;
    for (const j of allJudged) {
      if (j.status !== 'duplicate') {
        if (attemptsUsed >= playerBid) break;
        attemptsUsed += 1;
      }
      playerJudged.push(j);
    }
    const playerValid = validCount(playerJudged);
    const playerPct = playerValid / Math.max(1, playerBid);

    const plan = cpuPlan ?? buildCpuPlan(category, cpuBid, cpuCeilingFor(category), difficulty);
    const cpuValid = plan.finalValid;
    const cpuPct = cpuValid / Math.max(1, cpuBid);

    // Higher percentage wins; tie → higher valid count; tie → lower bidder
    let winner: 'player' | 'cpu';
    if (playerPct > cpuPct) winner = 'player';
    else if (cpuPct > playerPct) winner = 'cpu';
    else if (playerValid > cpuValid) winner = 'player';
    else if (cpuValid > playerValid) winner = 'cpu';
    else winner = playerBid <= cpuBid ? 'player' : 'cpu';

    sfx.play(winner === 'player' ? 'roundWin' : 'roundLose');

    const round: Round = {
      category,
      playerBid,
      cpuBid,
      playerValid,
      playerPct,
      cpuValid,
      cpuPct,
      judged: playerJudged,
      cpuJudged: plan.items,
      winner,
    };

    setHistory(h => [...h, round]);
    setPhase('result');
  };

  const handlePlayerDone = () => {
    voice.stop();
    setPlayerDone(true);
    // Check if CPU is also done (all items dripped)
    finishRound();
  };

  const nextRound = () => {
    const pw = history.filter(r => r.winner === 'player').length;
    const cw = history.filter(r => r.winner === 'cpu').length;
    if (pw >= winsNeeded || cw >= winsNeeded) {
      sfx.play(pw > cw ? 'matchWin' : 'matchLose');
      setPhase('matchOver');
    } else {
      startRound(roundIdx + 1, history);
    }
  };

  const liveJudge = useMemo(() => {
    if (phase !== 'performing' || !category) return null;
    return judge(category, voice.items);
  }, [phase, category, voice.items]);

  const liveValid = liveJudge ? validCount(liveJudge) : 0;
  const cpuLiveValid = cpuSpoken.filter(i => i.status === 'valid').length;

  return (
    <div className="mg-root" ref={rootRef}>
      {/* ── Prominent scoreboard topbar ── */}
      <div className="mg-topbar mg-topbar-score">
        <div className="mg-topbar-left">
          <button className="mg-back" onClick={onExit}>Back</button>
          <button
            className="mg-sound-toggle"
            onClick={() => { sfx.toggle(); }}
            aria-label="Toggle sound"
            title="Toggle sound"
          >🔊</button>
        </div>

        <div className="mg-scoreboard">
          <div className={`mg-score-side ${leading === 'player' ? 'leading' : ''}`}>
            <div className="mg-score-name">You</div>
            <div className={`mg-score-num ${scoreFlash.player ? 'mg-score-flash' : ''}`} key={`p-${playerWins}`}>
              {playerWins}
            </div>
            {leading === 'player' && <div className="mg-leading-pip">LEADING</div>}
          </div>

          <div className="mg-score-center">
            <div className="mg-score-round-info">Round {roundIdx + 1}</div>
            <div className="mg-score-divider">:</div>
            <div className="mg-diff-chip">{DIFFICULTY_LABEL[difficulty]}</div>
          </div>

          <div className={`mg-score-side opp ${leading === 'cpu' ? 'leading' : ''}`}>
            <div className="mg-score-name">CPU</div>
            <div className={`mg-score-num ${scoreFlash.cpu ? 'mg-score-flash' : ''}`} key={`c-${cpuWins}`}>
              {cpuWins}
            </div>
            {leading === 'cpu' && <div className="mg-leading-pip opp">LEADING</div>}
          </div>
        </div>

        <div className="mg-series">
          <span className={`mg-dot ${playerWins >= 1 ? 'on player' : ''}`} />
          <span className={`mg-dot ${playerWins >= 2 ? 'on player' : ''}`} />
          <span className="mg-vs">vs</span>
          <span className={`mg-dot ${cpuWins >= 1 ? 'on cpu' : ''}`} />
          <span className={`mg-dot ${cpuWins >= 2 ? 'on cpu' : ''}`} />
        </div>
      </div>

      <div className={`mg-stage phase-${phase}`} key={phase}>

        {phase === 'reveal' && category && (
          <div className="mg-panel mg-reveal mg-enter">
            <div className="mg-eyebrow">Round {roundIdx + 1}</div>
            <h1 className="mg-h1 mg-prompt mg-pop">{category.prompt}</h1>
            <div className="mg-countdown big mg-countdown-pulse" key={Math.ceil(timer)}>
              {Math.ceil(timer)}
            </div>
            {httpWarning && (
              <div className="mg-http-warning">Voice unavailable on HTTP — using text input</div>
            )}
          </div>
        )}

        {phase === 'bidding' && category && (
          <div className="mg-panel mg-bid mg-enter">
            <div className="mg-eyebrow">{category.short}</div>
            <p className="mg-prompt-small">{category.prompt}</p>
            <h2 className="mg-h2">How many can you name?</h2>
            <div className="mg-bidder">
              <button className="mg-step" onClick={() => setPlayerBid(b => Math.max(1, b - 1))} disabled={playerLocked}>−</button>
              <div key={playerBid} className={`mg-bidnum ${playerLocked ? 'locked' : ''} mg-num-pop`}>{playerBid}</div>
              <button className="mg-step" onClick={() => setPlayerBid(b => b + 1)} disabled={playerLocked}>+</button>
            </div>
            {playerLocked
              ? <div className="mg-locked mg-pop">Locked in — {playerBid} answers</div>
              : <button className="mg-cta" onClick={lockBid}>Lock in</button>}
            <div className="mg-cpu-status">CPU: thinking...</div>
            <div className="mg-timer-bar">
              <div className="mg-timer-fill" style={{ width: `${(timer / BID_SECONDS) * 100}%` }} />
            </div>
            <div className="mg-timer-text">{Math.ceil(timer)}s</div>
          </div>
        )}

        {phase === 'bidReveal' && category && (
          <div className="mg-panel mg-bid-reveal mg-enter">
            <div className="mg-eyebrow">Bids revealed — both perform!</div>
            <div className="mg-reveal-row">
              <div className="mg-reveal-side mg-slide-in-left">
                <div className="mg-side-label">YOU</div>
                <div className="mg-side-bid mg-num-pop">{playerBid}</div>
              </div>
              <div className="mg-reveal-vs">vs</div>
              <div className="mg-reveal-side mg-slide-in-right">
                <div className="mg-side-label">CPU</div>
                <div className="mg-side-bid mg-num-pop">{cpuBid}</div>
              </div>
            </div>
            <div className="mg-verdict mg-fade-in-late">
              Higher percentage wins. {playerBid > cpuBid ? 'You bid higher — can you deliver?' : cpuBid > playerBid ? 'CPU bid higher — beat their %!' : 'Tied bids — lower score wins on tie!'}
            </div>
          </div>
        )}

        {phase === 'performing' && category && (
          <div className="mg-panel mg-perform mg-enter">
            <p className="mg-prompt-performing">{category.prompt}</p>
            {/* Dual-perform bar */}
            <div className="mg-dual-perf-bar">
              <div className={`mg-dual-slot ${playerDone ? 'done' : ''}`}>
                <span className="mg-dual-label">YOU</span>
                <span key={liveValid} className="mg-dual-count mg-num-pop">{liveValid}</span>
                <span className="mg-dual-of">/ {playerBid}</span>
                {playerDone && <span className="mg-dual-done">done</span>}
              </div>
              <div className="mg-dual-divider">{category.short}</div>
              <div className="mg-dual-slot opp">
                <span className="mg-dual-label">CPU</span>
                <span key={`cpu-${cpuLiveValid}`} className="mg-dual-count mg-num-pop">{cpuLiveValid}</span>
                <span className="mg-dual-of">/ {cpuBid}</span>
              </div>
            </div>

            <div className="mg-perf-timer">{Math.ceil(timer)}s</div>

            {!playerDone ? (
              <>
                {!useText && voice.supported ? (
                  <div className="mg-voice-section">
                    <div className={`mg-mic ${voice.listening ? 'on' : ''}`}>
                      <span className="mg-mic-dot" />
                      {voice.listening ? 'Listening — say your answers' : 'Mic warming up...'}
                    </div>
                    {voice.interim && <div className="mg-interim">{voice.interim}</div>}
                    {voice.error && <div className="mg-error">{voice.error}</div>}
                    <button className="mg-switch" onClick={() => { voice.stop(); setUseText(true); }}>
                      Switch to typing
                    </button>
                  </div>
                ) : (
                  <div className="mg-text-section">
                    <form
                      className="mg-typed-big"
                      onSubmit={e => {
                        e.preventDefault();
                        const t = typedAnswer.trim();
                        if (t) { voice.pushItem(t); setTypedAnswer(''); setTypePreview(null); }
                      }}
                    >
                      <input
                        autoFocus
                        value={typedAnswer}
                        onChange={e => setTypedAnswer(e.target.value)}
                        placeholder="Type an answer and press Enter..."
                        className={`mg-typed-input ${typePreview === 'match' ? 'preview-match' : typePreview === 'no-match' ? 'preview-nomatch' : ''}`}
                      />
                      <button type="submit" className="mg-typed-btn">Add</button>
                    </form>
                    {typePreview === 'match' && (
                      <div className="mg-type-preview match">Looks like a match!</div>
                    )}
                    {typePreview === 'no-match' && (
                      <div className="mg-type-preview no-match">Might not match — try anyway</div>
                    )}
                    {voice.supported && (
                      <button className="mg-switch" onClick={() => { setUseText(false); voice.start(); }}>
                        Switch to mic
                      </button>
                    )}
                  </div>
                )}

                <ul className="mg-answers">
                  {liveJudge?.length === 0 && <li className="mg-ans-empty">your answers appear here</li>}
                  {[...(liveJudge ?? [])].reverse().map((j, i) => (
                    <li key={i} className={`mg-ans ${j.status} mg-ans-slide`}>
                      <span className="mg-ans-mark">{j.status === 'valid' ? '✓' : j.status === 'duplicate' ? '↻' : '✗'}</span>
                      <span>{j.raw}</span>
                    </li>
                  ))}
                </ul>
                <button className="mg-done" onClick={handlePlayerDone}>I am done</button>
              </>
            ) : (
              <div className="mg-waiting-done">
                <div className="mg-locked mg-pop">Locked in — {liveValid} valid</div>
                <p className="mg-tag">CPU is still going...</p>
              </div>
            )}

            {/* CPU's live answers */}
            <div className="mg-cpu-live">
              <div className="mg-cpu-live-head">
                <span className="mg-mic-dot live" /> CPU answers
              </div>
              <ul className="mg-answers small">
                {cpuSpoken.length === 0 && <li className="mg-ans-empty">CPU is thinking...</li>}
                {[...cpuSpoken].reverse().map((it, i) => (
                  <li key={i} className={`mg-ans ${it.status} mg-ans-slide`}>
                    <span className="mg-ans-mark">{it.status === 'valid' ? '✓' : it.status === 'duplicate' ? '↻' : '✗'}</span>
                    <span>{it.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {phase === 'result' && (() => {
          const r = history[history.length - 1];
          if (!r) return null;
          return (
            <div className="mg-panel mg-result mg-enter">
              <div className="mg-eyebrow">{r.category.short}</div>
              <h2 className={`mg-result-headline mg-pop ${r.winner === 'player' ? 'win' : 'lose'}`}>
                {r.winner === 'player' ? 'You win the round' : 'CPU wins the round'}
              </h2>

              {/* Percentage comparison */}
              <div className="mg-pct-compare">
                <div className={`mg-pct-side ${r.winner === 'player' ? 'win' : ''}`}>
                  <div className="mg-pct-label">YOU</div>
                  <div className="mg-pct-score">{r.playerValid}/{r.playerBid}</div>
                  <div className="mg-pct-num">{Math.round(r.playerPct * 100)}%</div>
                </div>
                <div className="mg-pct-vs">vs</div>
                <div className={`mg-pct-side ${r.winner === 'cpu' ? 'win' : ''}`}>
                  <div className="mg-pct-label">CPU</div>
                  <div className="mg-pct-score">{r.cpuValid}/{r.cpuBid}</div>
                  <div className="mg-pct-num">{Math.round(r.cpuPct * 100)}%</div>
                </div>
              </div>

              {/* Both players' answers */}
              <div className="mg-result-dual">
                <div className="mg-result-col">
                  <div className="mg-result-col-head">Your answers</div>
                  <ul className="mg-answers small">
                    {r.judged.map((j, i) => (
                      <li key={i} className={`mg-ans ${j.status}`}>
                        <span className="mg-ans-mark">{j.status === 'valid' ? '✓' : j.status === 'duplicate' ? '↻' : '✗'}</span>
                        <span>{j.raw}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mg-result-col">
                  <div className="mg-result-col-head">CPU answers</div>
                  <ul className="mg-answers small">
                    {r.cpuJudged.map((j, i) => (
                      <li key={i} className={`mg-ans ${j.status}`}>
                        <span className="mg-ans-mark">{j.status === 'valid' ? '✓' : j.status === 'duplicate' ? '↻' : '✗'}</span>
                        <span>{j.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <button className="mg-cta" onClick={nextRound}>
                {playerWins >= winsNeeded || cpuWins >= winsNeeded ? 'See match result' : 'Next round'}
              </button>
            </div>
          );
        })()}

        {phase === 'matchOver' && (
          <div className="mg-panel mg-matchover mg-enter">
            <div className="mg-eyebrow">Match complete</div>
            <h1 className={`mg-h1 mg-pop ${playerWins > cpuWins ? 'win' : 'lose'}`}>
              {playerWins > cpuWins ? 'You win!' : 'CPU wins'}
            </h1>
            <div className="mg-pct-compare">
              <div className={`mg-pct-side ${playerWins > cpuWins ? 'win' : ''}`}>
                <div className="mg-pct-label">YOU</div>
                <div className="mg-pct-score" style={{ fontSize: '2.5rem' }}>{playerWins}</div>
              </div>
              <div className="mg-pct-vs">final</div>
              <div className={`mg-pct-side ${cpuWins > playerWins ? 'win' : ''}`}>
                <div className="mg-pct-label">CPU</div>
                <div className="mg-pct-score" style={{ fontSize: '2.5rem' }}>{cpuWins}</div>
              </div>
            </div>
            <div className="mg-recap">
              {history.map((r, i) => (
                <div key={i} className={`mg-recap-row ${r.winner === 'player' ? 'win' : 'lose'}`}>
                  <span>R{i + 1}</span>
                  <span>{r.category.short}</span>
                  <span>You {Math.round(r.playerPct * 100)}% vs CPU {Math.round(r.cpuPct * 100)}%</span>
                  <span>{r.winner === 'player' ? 'YOU' : 'CPU'}</span>
                </div>
              ))}
            </div>
            <div className="mg-row">
              <button className="mg-cta" onClick={startMatch}>Rematch</button>
              <button className="mg-secondary" onClick={onExit}>Exit</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
