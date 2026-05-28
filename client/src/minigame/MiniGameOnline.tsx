import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVoice } from './useVoice';
import { useSound } from './useSound';
import { useMiniGameSocket, type MGSnapshot } from './useMiniGameSocket';
import CATEGORIES from './data/mg-categories.json';

type CategoryData = { id: string; short: string; prompt: string; answers: (string | string[])[] };
const CAT_MAP = new Map<string, CategoryData>(
  (CATEGORIES as CategoryData[]).map(c => [c.id, c])
);

function normalizeAnswer(s: string): string {
  return s.toLowerCase()
    .replace(/[.,!?'"`’]/g, '')
    .replace(/[-_/]/g, ' ')
    .replace(/^(the|a|an)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

type Props = {
  onExit: () => void;
  // 'rejoin' = server already has us in a room (after refresh); skip create/join
  initialMode: 'create' | 'join' | 'rejoin';
  initialName: string;
  initialCode?: string;
};

export default function MiniGameOnline({ onExit, initialMode, initialName, initialCode }: Props) {
  const sock = useMiniGameSocket();
  const [localError, setLocalError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [playerBid, setPlayerBid] = useState(() => Math.floor(Math.random() * 10) + 1);
  const [playerLocked, setPlayerLocked] = useState(false);
  const [phaseTimer, setPhaseTimer] = useState(0);
  const lastPhaseRef = useRef<string>('');
  const lastSentItemCountRef = useRef(0);
  const prevScoresRef = useRef<{ [pid: string]: number }>({});
  const [scoreFlash, setScoreFlash] = useState<{ [pid: string]: boolean }>({});

  const voice = useVoice();
  const sfx = useSound();
  const [typedAnswer, setTypedAnswer] = useState('');
  // Default to text (primary input). Voice is opt-in.
  const [useText, setUseText] = useState(() => {
    if (!voice.supported) return true;
    try {
      const saved = localStorage.getItem('mg:inputMode');
      if (saved === 'voice') return false; // only switch off if user explicitly chose voice
    } catch { /* ignore */ }
    return true;
  });
  // Persist choice
  useEffect(() => {
    try { localStorage.setItem('mg:inputMode', useText ? 'text' : 'voice'); } catch { /* ignore */ }
  }, [useText]);
  const httpWarning = !voice.supported &&
    typeof window !== 'undefined' &&
    window.location.protocol === 'http:' &&
    window.location.hostname !== 'localhost';
  const [myDone, setMyDone] = useState(false);
  const [typePreview, setTypePreview] = useState<'match' | 'no-match' | null>(null);

  // ── create/join on connect (skip if rejoin — server already has us) ──
  useEffect(() => {
    if (!sock.connected || joined) return;
    if (initialMode === 'rejoin') {
      // Server-driven recovery: hello already sent by parent, state will arrive.
      setJoined(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = initialMode === 'create'
        ? await sock.create(initialName)
        : await sock.join(initialCode ?? '', initialName);
      if (cancelled) return;
      if (!res.ok) setLocalError(res.error);
      else { setJoined(true); setLocalError(null); }
    })();
    return () => { cancelled = true; };
  }, [sock.connected, joined, initialMode, initialName, initialCode, sock]);

  const state = sock.state;
  const phase = state?.phase ?? 'waiting';

  // Score flash animation when scores change
  useEffect(() => {
    if (!state) return;
    const newFlash: { [pid: string]: boolean } = {};
    for (const [pid, score] of Object.entries(state.scores)) {
      if ((prevScoresRef.current[pid] ?? 0) < score) {
        newFlash[pid] = true;
      }
    }
    if (Object.keys(newFlash).length > 0) {
      setScoreFlash(newFlash);
      setTimeout(() => setScoreFlash({}), 800);
    }
    prevScoresRef.current = { ...state.scores };
  }, [state?.scores]);

  useEffect(() => {
    if (lastPhaseRef.current === phase) return;
    const prevPhase = lastPhaseRef.current;
    lastPhaseRef.current = phase;

    if (phase === 'reveal') sfx.play('reveal');
    if (phase === 'bidding') {
      setPlayerLocked(false);
      // Random default 1-10: if a skip happens, you're locked into your gamble
      setPlayerBid(Math.floor(Math.random() * 10) + 1);
    }
    if (phase === 'performing') {
      voice.reset();
      setTypedAnswer('');
      setMyDone(false);
      lastSentItemCountRef.current = 0;
      if (!useText && voice.supported) voice.start();
    } else {
      voice.stop();
    }
    // Round/match result sounds: fire on entering result/matchOver
    if (phase === 'result' && prevPhase !== 'result') {
      const last = state?.history[state.history.length - 1];
      if (last) {
        if (last.winnerId === sock.myId) sfx.play('roundWin');
        else sfx.play('roundLose');
      }
    }
    if (phase === 'matchOver' && prevPhase !== 'matchOver') {
      const myScoreNow = state?.scores[sock.myId] ?? 0;
      const oppScoreNow = opponent ? (state?.scores[opponent.id] ?? 0) : 0;
      if (myScoreNow > oppScoreNow) sfx.play('matchWin');
      else sfx.play('matchLose');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Server-driven countdown
  const skewRef = useRef(0);
  useEffect(() => {
    if (!state) return;
    skewRef.current = state.serverTime - Date.now();
  }, [state]);

  useEffect(() => {
    if (!state || state.phaseDurationMs <= 0) {
      setPhaseTimer(0);
      return;
    }
    const id = setInterval(() => {
      const nowServer = Date.now() + skewRef.current;
      const elapsed = nowServer - state.phaseStartedAt;
      const remaining = Math.max(0, state.phaseDurationMs - elapsed) / 1000;
      setPhaseTimer(remaining);
      if (remaining <= 0) clearInterval(id);
    }, 100);
    return () => clearInterval(id);
  }, [state]);

  // Batched voice → server
  const flushBuffer = useRef<string[]>([]);
  const flushTimer = useRef<number | null>(null);
  const scheduleFlush = useCallback(() => {
    if (flushTimer.current !== null) return;
    flushTimer.current = window.setTimeout(() => {
      flushTimer.current = null;
      if (flushBuffer.current.length === 0) return;
      sock.pushItems(flushBuffer.current);
      flushBuffer.current = [];
    }, 80); // tight latency — server batches further if needed
  }, [sock]);

  useEffect(() => {
    if (phase !== 'performing' || !state || myDone) return;
    const items = voice.items;
    if (items.length <= lastSentItemCountRef.current) return;
    for (let i = lastSentItemCountRef.current; i < items.length; i++) {
      flushBuffer.current.push(items[i]);
    }
    lastSentItemCountRef.current = items.length;
    if (flushBuffer.current.length >= 5) {
      if (flushTimer.current !== null) { window.clearTimeout(flushTimer.current); flushTimer.current = null; }
      sock.pushItems(flushBuffer.current);
      flushBuffer.current = [];
    } else {
      scheduleFlush();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.items, phase, myDone]);

  useEffect(() => {
    return () => {
      if (flushTimer.current !== null) window.clearTimeout(flushTimer.current);
      if (flushBuffer.current.length) {
        try { sock.pushItems(flushBuffer.current); } catch { /* noop */ }
        flushBuffer.current = [];
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live text-mode preview: check typed answer against local category data
  useEffect(() => {
    if (!typedAnswer.trim() || !state?.category) { setTypePreview(null); return; }
    const cat = CAT_MAP.get(state.category.id);
    if (!cat) { setTypePreview(null); return; }
    const n = normalizeAnswer(typedAnswer);
    const matches = cat.answers.some(a =>
      (Array.isArray(a) ? a : [a]).some(v => normalizeAnswer(v) === n)
    );
    setTypePreview(matches ? 'match' : 'no-match');
  }, [typedAnswer, state?.category]);

  // Confirm before kicking the user out mid-match — this was the silent
  // "back button switched me to lobby" trap. Now they have to confirm.
  const [confirmExit, setConfirmExit] = useState(false);
  const exitAndLeave = useCallback(() => {
    sock.leave();
    onExit();
  }, [sock, onExit]);
  const handleBackClick = useCallback(() => {
    // No confirm needed if the match is over or we're in the lobby waiting screen
    if (phase === 'matchOver' || phase === 'waiting' || !state) {
      exitAndLeave();
      return;
    }
    setConfirmExit(true);
  }, [phase, state, exitAndLeave]);

  const handleDone = useCallback(() => {
    if (flushTimer.current !== null) { window.clearTimeout(flushTimer.current); flushTimer.current = null; }
    if (flushBuffer.current.length) { sock.pushItems(flushBuffer.current); flushBuffer.current = []; }
    voice.stop();
    setMyDone(true);
    sock.performDone();
  }, [sock, voice]);

  const submitTyped = useCallback(() => {
    const t = typedAnswer.trim();
    if (!t) return;
    sock.pushItem(t);
    setTypedAnswer('');
  }, [typedAnswer, sock]);

  const opponent = state?.players.find(p => p.id !== sock.myId);
  const me = state?.players.find(p => p.id === sock.myId);
  const myScore = state ? (state.scores[sock.myId] ?? 0) : 0;
  const oppScore = state && opponent ? (state.scores[opponent.id] ?? 0) : 0;
  const winsNeeded = state?.winsNeeded ?? 2;

  const cat = state?.category;
  const myBid = state?.bids[sock.myId] ?? 0;
  const oppBid = opponent ? (state?.bids[opponent.id] ?? 0) : 0;
  const matchWon = myScore >= winsNeeded || oppScore >= winsNeeded;

  // Performing: per-player data
  const mySlot = state?.performing?.byPlayer[sock.myId];
  const oppSlot = state?.performing?.byPlayer[opponent?.id ?? ''];
  const myLiveValid = mySlot?.validCount ?? 0;
  const myLiveJudged = mySlot?.judged ?? [];
  const oppLiveValid = oppSlot?.validCount ?? 0;
  const oppDone = oppSlot?.done ?? false;

  // Leading indicator
  const leading = myScore > oppScore ? 'you' : oppScore > myScore ? 'opp' : 'tied';

  const lastRound = useMemo(() => {
    if (!state) return null;
    return state.history[state.history.length - 1] ?? null;
  }, [state]);

  const myLastResult = lastRound?.results?.[sock.myId];
  const oppLastResult = lastRound && opponent ? lastRound.results?.[opponent.id] : undefined;

  const lockBid = () => {
    sock.placeBid(playerBid);
    setPlayerLocked(true);
    sfx.play('bidLock');
  };

  // Play sound when new judged items appear in my own slot
  const prevJudgedCountRef = useRef(0);
  useEffect(() => {
    if (phase !== 'performing') { prevJudgedCountRef.current = 0; return; }
    const arr = mySlot?.judged ?? [];
    if (arr.length > prevJudgedCountRef.current) {
      const newOnes = arr.slice(prevJudgedCountRef.current);
      for (const j of newOnes) {
        if (j.status === 'valid') sfx.play('correct');
        else if (j.status === 'duplicate') sfx.play('duplicate');
        else sfx.play('wrong');
      }
    }
    prevJudgedCountRef.current = arr.length;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mySlot?.judged?.length, phase]);

  // Timer tick: last 3 seconds of bidding/performing
  const lastTickRef = useRef(0);
  useEffect(() => {
    if (phase !== 'bidding' && phase !== 'performing') return;
    const sec = Math.ceil(phaseTimer);
    if (sec > 0 && sec <= 3 && sec !== lastTickRef.current) {
      lastTickRef.current = sec;
      sfx.play('tick');
    }
    if (sec > 3) lastTickRef.current = 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseTimer, phase]);

  if (localError) {
    return (
      <div className="mg-root">
        <div className="mg-topbar">
          <button className="mg-back" onClick={onExit}>Back</button>
          <div className="mg-title-small">Online <span className="mg-beta">error</span></div>
          <div />
        </div>
        <div className="mg-stage">
          <div className="mg-panel mg-enter">
            <div className="mg-eyebrow">Could not join</div>
            <h2 className="mg-h2">{localError}</h2>
            <button className="mg-cta" onClick={onExit}>Back</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mg-root">
      {/* ── Prominent scoreboard topbar ── */}
      <div className="mg-topbar mg-topbar-score">
        <div className="mg-topbar-left">
          <button className="mg-back" onClick={handleBackClick} aria-label="Leave match">Leave</button>
          <button
            className="mg-sound-toggle"
            onClick={() => { sfx.toggle(); }}
            aria-label="Toggle sound"
            title="Toggle sound"
          >Sound</button>
        </div>

        <div className="mg-scoreboard">
          {/* My side */}
          <div className={`mg-score-side ${leading === 'you' ? 'leading' : ''}`}>
            <div className="mg-score-name">{me?.name ?? 'You'}</div>
            <div className={`mg-score-num ${scoreFlash[sock.myId] ? 'mg-score-flash' : ''}`}
                 key={`me-${myScore}`}>
              {myScore}
            </div>
            {leading === 'you' && <div className="mg-leading-pip">LEADING</div>}
          </div>

          <div className="mg-score-center">
            <div className="mg-score-round-info">
              {phase === 'matchOver' ? 'Final' :
               phase === 'waiting' ? 'Best of 3' :
               state ? `Round ${state.history.length + (phase === 'result' ? 0 : 1)} of ${state.bestOf}` : ''}
            </div>
            <div className="mg-score-divider">:</div>
            {state?.code && <div className="mg-code-chip">{state.code}</div>}
          </div>

          {/* Opponent side */}
          <div className={`mg-score-side opp ${leading === 'opp' ? 'leading' : ''}`}>
            <div className="mg-score-name">{opponent?.name ?? '...'}</div>
            <div className={`mg-score-num ${scoreFlash[opponent?.id ?? ''] ? 'mg-score-flash' : ''}`}
                 key={`opp-${oppScore}`}>
              {oppScore}
            </div>
            {leading === 'opp' && <div className="mg-leading-pip opp">LEADING</div>}
          </div>
        </div>

        <div className="mg-series">
          <span className={`mg-dot ${myScore >= 1 ? 'on player' : ''}`} />
          <span className={`mg-dot ${myScore >= 2 ? 'on player' : ''}`} />
          <span className="mg-vs">vs</span>
          <span className={`mg-dot ${oppScore >= 1 ? 'on cpu' : ''}`} />
          <span className={`mg-dot ${oppScore >= 2 ? 'on cpu' : ''}`} />
        </div>
      </div>

      <div className={`mg-stage phase-${phase}`} key={phase}>

        {phase === 'paused' && (
          <div className="mg-panel mg-enter">
            <div className="mg-eyebrow">Paused</div>
            <h2 className="mg-h2">{opponent?.name ?? 'Opponent'} disconnected</h2>
            <p className="mg-tag">
              Waiting up to 30 seconds for them to come back.
            </p>
            <div className="mg-spinner" />
          </div>
        )}

        {(!state || phase === 'waiting') && (
          <div className="mg-panel mg-enter">
            <div className="mg-eyebrow">Room code — share with your opponent</div>
            <div className="mg-room-code-block">
              <span className="mg-room-code">{state?.code ?? '...'}</span>
              {state?.code && (
                <button
                  className="mg-copy-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(state.code).catch(() => {});
                  }}
                >
                  Copy
                </button>
              )}
            </div>
            <p className="mg-tag">
              Your opponent goes to Bid &amp; Brag, taps "Online vs player", enters this code and their name, and hits Join.
            </p>
            <div className="mg-waiting-status">
              <div className="mg-spinner" />
              <span>{opponent ? `${opponent.name} joined! Starting...` : 'Waiting for opponent...'}</span>
            </div>
            {httpWarning && (
              <div className="mg-http-warning">
                Voice input requires HTTPS. Text input will be used instead.
              </div>
            )}
            {voice.supported && !httpWarning && (
              <div className="mg-input-pref">
                <div className="mg-input-pref-label">Input mode</div>
                <div className="mg-input-pref-row">
                  <button
                    className={`mg-pref-btn ${!useText ? 'active' : ''}`}
                    onClick={async () => {
                      const p = await voice.ensurePermission();
                      if (p === 'granted') setUseText(false);
                      else if (p === 'denied') setUseText(true);
                    }}
                  >
                    Voice
                    {voice.permission === 'denied' && <span className="mg-pref-warn"> (blocked)</span>}
                  </button>
                  <button
                    className={`mg-pref-btn ${useText ? 'active' : ''}`}
                    onClick={() => setUseText(true)}
                  >
                    Text
                  </button>
                </div>
                {voice.permission === 'denied' && (
                  <div className="mg-pref-hint">Unblock the mic in your browser settings to use voice</div>
                )}
              </div>
            )}
          </div>
        )}

        {phase === 'reveal' && cat && (
          <div className="mg-panel mg-enter">
            <div className="mg-eyebrow">Round {(state?.history.length ?? 0) + 1}</div>
            <h1 className="mg-h1 mg-prompt mg-pop">{cat.prompt}</h1>
            <div className="mg-countdown big mg-countdown-pulse" key={Math.ceil(phaseTimer)}>
              {Math.ceil(phaseTimer)}
            </div>
          </div>
        )}

        {phase === 'bidding' && cat && (
          <div className="mg-panel mg-enter">
            <div className="mg-eyebrow">{cat.short}</div>
            <p className="mg-prompt-small">{cat.prompt}</p>
            <h2 className="mg-h2">How many can you name?</h2>
            <div className="mg-bidder">
              <button className="mg-step" onClick={() => setPlayerBid(b => Math.max(1, b - 1))} disabled={playerLocked || !!state?.roundSkipperId}>−</button>
              <div key={playerBid} className={`mg-bidnum ${playerLocked ? 'locked' : ''} mg-num-pop`}>{playerBid}</div>
              <button className="mg-step" onClick={() => setPlayerBid(b => b + 1)} disabled={playerLocked || !!state?.roundSkipperId}>+</button>
            </div>
            {state?.roundSkipperId === sock.myId ? (
              <div className="mg-skip-status mg-pop">You skipped this round — wait for opponent to bid</div>
            ) : state?.roundSkipperId === opponent?.id ? (
              <div className="mg-skip-status mg-pop opp">
                {opponent?.name ?? 'Opponent'} skipped — hit your bid to win, miss it and they win!
              </div>
            ) : playerLocked ? (
              <div className="mg-locked mg-pop">Locked in — {playerBid} answers</div>
            ) : (
              <button className="mg-cta" onClick={lockBid}>Lock in</button>
            )}

            {/* SKIP button — only show if user has skips left and hasn't already bid/skipped this round */}
            {!playerLocked && !state?.roundSkipperId && (state?.skipsRemaining?.[sock.myId] ?? 0) > 0 && (
              <button
                className="mg-skip-btn"
                onClick={() => sock.skip()}
                title="Skip this round — opponent must hit their bid in full or you win"
              >
                Skip round ({state?.skipsRemaining?.[sock.myId]} left)
              </button>
            )}

            <div className="mg-cpu-status">
              {opponent?.name ?? 'Opponent'}: {state?.roundSkipperId === opponent?.id ? 'skipped' : oppBid ? 'locked' : 'thinking...'}
            </div>
            <div className="mg-timer-bar">
              <div className="mg-timer-fill" style={{ width: `${state ? (phaseTimer / (state.phaseDurationMs / 1000)) * 100 : 0}%` }} />
            </div>
            <div className="mg-timer-text">{Math.ceil(phaseTimer)}s</div>
          </div>
        )}

        {phase === 'bidReveal' && cat && (
          <div className="mg-panel mg-enter">
            {state?.roundSkipperId && state.roundSkipperId !== sock.myId ? (
              <>
                <div className="mg-eyebrow mg-skip-eyebrow">SURPRISE — {opponent?.name ?? 'opponent'} SKIPPED</div>
                <div className="mg-reveal-row">
                  <div className="mg-reveal-side mg-slide-in-left">
                    <div className="mg-side-label">YOUR BID</div>
                    <div className="mg-side-bid mg-num-pop">{myBid}</div>
                  </div>
                  <div className="mg-reveal-vs">!</div>
                  <div className="mg-reveal-side mg-slide-in-right opp">
                    <div className="mg-side-label">{(opponent?.name ?? 'OPP').toUpperCase()}</div>
                    <div className="mg-side-bid mg-num-pop">SKIP</div>
                  </div>
                </div>
                <div className="mg-verdict mg-fade-in-late mg-verdict-warn">
                  Hit all {myBid} or lose the round.
                </div>
              </>
            ) : state?.roundSkipperId === sock.myId ? (
              <>
                <div className="mg-eyebrow">You skipped — {opponent?.name ?? 'opponent'} doesn't know yet</div>
                <div className="mg-reveal-row">
                  <div className="mg-reveal-side mg-slide-in-left">
                    <div className="mg-side-label">YOU</div>
                    <div className="mg-side-bid mg-num-pop">SKIP</div>
                  </div>
                  <div className="mg-reveal-vs">vs</div>
                  <div className="mg-reveal-side mg-slide-in-right">
                    <div className="mg-side-label">{(opponent?.name ?? 'OPP').toUpperCase()}</div>
                    <div className="mg-side-bid mg-num-pop">{oppBid}</div>
                  </div>
                </div>
                <div className="mg-verdict mg-fade-in-late">
                  They need to hit {oppBid} — anything less and you win.
                </div>
              </>
            ) : (
              <>
                <div className="mg-eyebrow">Bids revealed — both perform!</div>
                <div className="mg-reveal-row">
                  <div className="mg-reveal-side mg-slide-in-left">
                    <div className="mg-side-label">YOU</div>
                    <div className="mg-side-bid mg-num-pop">{myBid}</div>
                  </div>
                  <div className="mg-reveal-vs">vs</div>
                  <div className="mg-reveal-side mg-slide-in-right">
                    <div className="mg-side-label">{(opponent?.name ?? 'OPP').toUpperCase()}</div>
                    <div className="mg-side-bid mg-num-pop">{oppBid}</div>
                  </div>
                </div>
                <div className="mg-verdict mg-fade-in-late">
                  Score = correct count × accuracy. Bigger bids hit fully = bigger reward.
                </div>
              </>
            )}
          </div>
        )}

        {phase === 'performing' && cat && (
          <div className="mg-panel mg-perform mg-enter">
            <p className="mg-prompt-performing">{cat.prompt}</p>
            {/* Dual-perform header: both players' live counts */}
            <div className="mg-dual-perf-bar">
              <div className={`mg-dual-slot ${myDone ? 'done' : ''}`}>
                <span className="mg-dual-label">YOU</span>
                <span key={myLiveValid} className="mg-dual-count mg-num-pop">{myLiveValid}</span>
                <span className="mg-dual-of">/ {myBid}</span>
                {myDone && <span className="mg-dual-done">done</span>}
              </div>
              <div className="mg-dual-divider">{cat.short}</div>
              <div className={`mg-dual-slot opp ${oppDone ? 'done' : ''}`}>
                <span className="mg-dual-label">{opponent?.name?.toUpperCase() ?? 'OPP'}</span>
                <span key={`opp-${oppLiveValid}`} className="mg-dual-count mg-num-pop">{oppLiveValid}</span>
                <span className="mg-dual-of">/ {oppBid}</span>
                {oppDone && <span className="mg-dual-done">done</span>}
              </div>
            </div>

            <div className="mg-perf-timer">{Math.ceil(phaseTimer)}s</div>

            {/* Skipper sits out — no input UI shown */}
            {state?.roundSkipperId === sock.myId ? (
              <div className="mg-skip-waiting">
                <div className="mg-eyebrow">You skipped this round</div>
                <h3 className="mg-h2">
                  {opponent?.name ?? 'Opponent'} must hit {oppBid} or you win
                </h3>
                <p className="mg-tag">They're on the clock now...</p>
              </div>
            ) : !myDone ? (
              <>
                {state?.roundSkipperId === opponent?.id && (
                  <div className="mg-skip-callout">
                    Skip pressure: name <strong>all {myBid}</strong> answers to win — anything less, opponent steals the round
                  </div>
                )}
                {!useText && voice.supported ? (
                  <div className="mg-voice-section">
                    <div className={`mg-mic ${voice.listening ? 'on' : ''}`}>
                      <span className="mg-mic-dot" />
                      {voice.listening ? 'Listening — say your answers' : 'Mic warming up...'}
                    </div>
                    {voice.interim && <div className="mg-interim">{voice.interim}</div>}
                    {voice.error && <div className="mg-error">{voice.error}</div>}
                  </div>
                ) : (
                  <div className="mg-text-section">
                    <form className="mg-typed-big" onSubmit={e => { e.preventDefault(); submitTyped(); }}>
                      <input
                        autoFocus
                        value={typedAnswer}
                        onChange={e => setTypedAnswer(e.target.value)}
                        placeholder="Type an answer and press Enter..."
                        className={`mg-typed-input${typePreview === 'match' ? ' preview-match' : typePreview === 'no-match' ? ' preview-nomatch' : ''}`}
                      />
                      <button type="submit" className="mg-typed-btn">Add</button>
                    </form>
                    {typePreview === 'match' && typedAnswer.trim().length > 0 && (
                      <div className="mg-type-preview match">That counts!</div>
                    )}
                    {typePreview === 'no-match' && typedAnswer.trim().length > 1 && (
                      <div className="mg-type-preview no-match">Not on the list...</div>
                    )}
                  </div>
                )}

                {/* Text-first toggle: Text on left as primary, Voice as opt-in */}
                {voice.supported && (
                  <div className="mg-input-toggle">
                    <button
                      className={`mg-toggle-pill ${useText ? 'active' : ''}`}
                      onClick={() => {
                        try { voice.stop(); } catch (e) { console.warn('voice stop failed', e); }
                        setUseText(true);
                      }}
                      type="button"
                    >Text (primary)</button>
                    <button
                      className={`mg-toggle-pill ${!useText ? 'active' : ''}`}
                      onClick={() => {
                        try {
                          setUseText(false);
                          if (voice.permission === 'granted') voice.start();
                          else voice.ensurePermission().then(p => { if (p === 'granted') voice.start(); });
                        } catch (e) { console.warn('voice start failed', e); }
                      }}
                      type="button"
                    >Voice</button>
                  </div>
                )}

                <ul className="mg-answers">
                  {myLiveJudged.length === 0 && <li className="mg-ans-empty">your answers appear here</li>}
                  {[...myLiveJudged].reverse().map((j, i) => (
                    <li key={i} className={`mg-ans ${j.status} mg-ans-slide`}>
                      <span className="mg-ans-mark">{j.status === 'valid' ? '+' : j.status === 'duplicate' ? '~' : 'x'}</span>
                      <span>{j.raw}</span>
                      {j.status === 'duplicate' && <span className="mg-ans-note">already said</span>}
                    </li>
                  ))}
                </ul>

                <button className="mg-done" onClick={handleDone}>I am done</button>
              </>
            ) : (
              <div className="mg-waiting-done">
                <div className="mg-locked mg-pop">Locked in — {myLiveValid} valid answers</div>
                <p className="mg-tag">Waiting for {oppDone ? 'results...' : `${opponent?.name ?? 'opponent'} to finish...`}</p>
              </div>
            )}
          </div>
        )}

        {phase === 'result' && lastRound && (
          <div className="mg-panel mg-enter">
            <div className="mg-eyebrow">{lastRound.short}</div>
            <h2 className={`mg-result-headline mg-pop ${lastRound.winnerId === sock.myId ? 'win' : 'lose'}`}>
              {lastRound.winnerId === sock.myId ? 'You win the round' : `${opponent?.name ?? 'Opponent'} wins`}
            </h2>

            {/* Percentage comparison */}
            {myLastResult && oppLastResult && (
              <div className="mg-pct-compare">
                <div className={`mg-pct-side ${lastRound.winnerId === sock.myId ? 'win' : ''}`}>
                  <div className="mg-pct-label">YOU</div>
                  <div className="mg-pct-score">{myLastResult.validCount}/{lastRound.bids[sock.myId] ?? '?'}</div>
                  <div className="mg-pct-num">{Math.round(myLastResult.pct * 100)}%</div>
                </div>
                <div className="mg-pct-vs">vs</div>
                <div className={`mg-pct-side ${lastRound.winnerId === opponent?.id ? 'win' : ''}`}>
                  <div className="mg-pct-label">{opponent?.name?.toUpperCase() ?? 'OPP'}</div>
                  <div className="mg-pct-score">{oppLastResult.validCount}/{lastRound.bids[opponent?.id ?? ''] ?? '?'}</div>
                  <div className="mg-pct-num">{Math.round(oppLastResult.pct * 100)}%</div>
                </div>
              </div>
            )}

            {/* Both players' answer lists */}
            <div className="mg-result-dual">
              <div className="mg-result-col">
                <div className="mg-result-col-head">Your answers</div>
                <ul className="mg-answers small">
                  {(myLastResult?.judged ?? []).map((j, i) => (
                    <li key={i} className={`mg-ans ${j.status}`}>
                      <span className="mg-ans-mark">{j.status === 'valid' ? '+' : j.status === 'duplicate' ? '~' : 'x'}</span>
                      <span>{j.raw}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mg-result-col">
                <div className="mg-result-col-head">{opponent?.name ?? 'Opp'}'s answers</div>
                <ul className="mg-answers small">
                  {(oppLastResult?.judged ?? []).map((j, i) => (
                    <li key={i} className={`mg-ans ${j.status}`}>
                      <span className="mg-ans-mark">{j.status === 'valid' ? '+' : j.status === 'duplicate' ? '~' : 'x'}</span>
                      <span>{j.raw}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <button className="mg-cta" onClick={() => sock.nextRound()}>
              {matchWon ? 'See match result' : 'Next round'}
            </button>
          </div>
        )}

        {phase === 'matchOver' && (
          <div className="mg-panel mg-enter">
            <div className="mg-eyebrow">Match complete</div>
            <h1 className={`mg-h1 mg-pop ${myScore > oppScore ? 'win' : 'lose'}`}>
              {myScore > oppScore ? 'You win the match!' : `${opponent?.name ?? 'Opponent'} wins the match`}
            </h1>

            {/* Overall score */}
            <div className="mg-pct-compare">
              <div className={`mg-pct-side ${myScore > oppScore ? 'win' : ''}`}>
                <div className="mg-pct-label">YOU</div>
                <div className="mg-pct-score" style={{ fontSize: '2.5rem' }}>{myScore}</div>
              </div>
              <div className="mg-pct-vs">final</div>
              <div className={`mg-pct-side ${oppScore > myScore ? 'win' : ''}`}>
                <div className="mg-pct-label">{opponent?.name?.toUpperCase() ?? 'OPP'}</div>
                <div className="mg-pct-score" style={{ fontSize: '2.5rem' }}>{oppScore}</div>
              </div>
            </div>

            {/* Round-by-round recap */}
            {state && state.history.length > 0 && (
              <div className="mg-match-recap">
                <div className="mg-recap-title">Round recap</div>
                {state.history.map((r, i) => {
                  const myR = r.results[sock.myId];
                  const oppR = opponent ? r.results[opponent.id] : undefined;
                  const iWon = r.winnerId === sock.myId;
                  return (
                    <div key={i} className="mg-recap-row">
                      <span className="mg-recap-round">{i + 1}</span>
                      <span className="mg-recap-cat">{r.short}</span>
                      <span className={`mg-recap-result ${iWon ? 'win' : 'lose'}`}>
                        {iWon ? 'You' : (opponent?.name ?? 'Opp')} won
                      </span>
                      {myR && oppR && (
                        <span className="mg-recap-pcts">
                          {Math.round(myR.pct * 100)}% vs {Math.round(oppR.pct * 100)}%
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mg-row">
              <button className="mg-cta" onClick={() => sock.rematch()}>Rematch</button>
              <button className="mg-secondary" onClick={exitAndLeave}>Exit</button>
            </div>
          </div>
        )}
      </div>

      {/* Confirm-leave modal — prevents accidental "Back" mid-game */}
      {confirmExit && (
        <div className="mg-modal-overlay" onClick={() => setConfirmExit(false)}>
          <div className="mg-modal" onClick={e => e.stopPropagation()}>
            <h2 className="mg-h2">Leave the match?</h2>
            <p className="mg-tag">Your opponent will see you disconnected. The match ends.</p>
            <div className="mg-row">
              <button className="mg-secondary" onClick={() => setConfirmExit(false)}>Keep playing</button>
              <button className="mg-cta-danger" onClick={() => { setConfirmExit(false); exitAndLeave(); }}>Leave match</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export type { MGSnapshot };
