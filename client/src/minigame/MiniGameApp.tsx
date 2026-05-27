import { useEffect, useState } from 'react';
import MiniGameSolo from './MiniGameSolo';
import MiniGameOnline from './MiniGameOnline';
import { type Difficulty, DIFFICULTY_LABEL } from './difficulty';

type View =
  | { kind: 'lobby' }
  | { kind: 'solo'; difficulty: Difficulty }
  | { kind: 'online'; mode: 'create' | 'join'; name: string; code?: string };

type Props = { onExit: () => void };

export default function MiniGameApp({ onExit }: Props) {
  const [view, setView] = useState<View>({ kind: 'lobby' });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [view.kind]);

  if (view.kind === 'solo') {
    return <MiniGameSolo onExit={() => setView({ kind: 'lobby' })} difficulty={view.difficulty} />;
  }
  if (view.kind === 'online') {
    return (
      <MiniGameOnline
        onExit={() => setView({ kind: 'lobby' })}
        initialMode={view.mode}
        initialName={view.name}
        initialCode={view.code}
      />
    );
  }

  return <Lobby onExit={onExit} onStart={(v) => setView(v)} />;
}

// ───────────── Lobby ─────────────

type LobbyProps = {
  onExit: () => void;
  onStart: (v: View) => void;
};

function Lobby({ onExit, onStart }: LobbyProps) {
  const [mode, setMode] = useState<'solo' | 'online'>('solo');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const startSolo = () => onStart({ kind: 'solo', difficulty });

  const createRoom = () => {
    if (!name.trim()) { setError('Enter your name'); return; }
    onStart({ kind: 'online', mode: 'create', name: name.trim() });
  };

  const joinRoom = () => {
    if (!name.trim()) { setError('Enter your name'); return; }
    if (joinCode.trim().length < 3) { setError('Enter a code'); return; }
    onStart({ kind: 'online', mode: 'join', name: name.trim(), code: joinCode.trim().toUpperCase() });
  };

  return (
    <div className="mg-root">
      <div className="mg-topbar">
        <button className="mg-back" onClick={onExit}>Back</button>
        <div className="mg-title-small">Bid &amp; Brag <span className="mg-beta">beta</span></div>
        <div />
      </div>

      <div className="mg-stage">
        <div className="mg-panel mg-enter">
          <div className="mg-eyebrow">1 v 1 voice match</div>
          <h1 className="mg-h1 mg-title-big">Bid &amp; Brag</h1>
          <p className="mg-tag">
            Both players bid how many answers they can name from a category.
            Highest bidder has to deliver out loud or lose the round.
          </p>

          <div className="mg-tabs">
            <button
              className={`mg-tab ${mode === 'solo' ? 'active' : ''}`}
              onClick={() => setMode('solo')}
            >Solo vs CPU</button>
            <button
              className={`mg-tab ${mode === 'online' ? 'active' : ''}`}
              onClick={() => setMode('online')}
            >Online vs player</button>
          </div>

          {mode === 'solo' ? (
            <>
              <div className="mg-diff-label">Difficulty</div>
              <div className="mg-diff-row">
                {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
                  <button
                    key={d}
                    className={`mg-diff-btn ${difficulty === d ? 'active' : ''}`}
                    onClick={() => setDifficulty(d)}
                  >
                    {DIFFICULTY_LABEL[d]}
                  </button>
                ))}
              </div>
              <button className="mg-cta mg-cta-big" onClick={startSolo}>
                Start match
              </button>
            </>
          ) : (
            <>
              <div className="mg-online-form">
                <label className="mg-form-label">Your name</label>
                <input
                  className="mg-input"
                  value={name}
                  onChange={e => { setName(e.target.value); setError(null); }}
                  placeholder="Enter your name"
                  maxLength={20}
                />

                <div className="mg-online-actions">
                  <button className="mg-cta mg-cta-big" onClick={createRoom}>
                    Create room
                  </button>
                  <div className="mg-divider"><span>or</span></div>
                  <div className="mg-join-row">
                    <input
                      className="mg-input mg-code-input"
                      value={joinCode}
                      onChange={e => { setJoinCode(e.target.value.toUpperCase()); setError(null); }}
                      placeholder="CODE"
                      maxLength={6}
                    />
                    <button className="mg-secondary" onClick={joinRoom}>Join</button>
                  </div>
                </div>
                {error && <div className="mg-error">{error}</div>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
