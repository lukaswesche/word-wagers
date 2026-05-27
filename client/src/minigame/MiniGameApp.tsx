import { Component, useEffect, useState, type ReactNode } from 'react';
import MiniGameSolo from './MiniGameSolo';
import MiniGameOnline from './MiniGameOnline';
import { type Difficulty, DIFFICULTY_LABEL } from './difficulty';

// ───────────── Error boundary ─────────────
type EBProps = { onBack: () => void; children: ReactNode };
type EBState = { crashed: boolean; message: string };
class GameErrorBoundary extends Component<EBProps, EBState> {
  state: EBState = { crashed: false, message: '' };
  static getDerivedStateFromError(e: unknown): EBState {
    return { crashed: true, message: String(e) };
  }
  componentDidCatch() { /* logged automatically */ }
  render() {
    if (this.state.crashed) {
      return (
        <div className="mg-root">
          <div className="mg-topbar">
            <button className="mg-back" onClick={() => { this.setState({ crashed: false, message: '' }); this.props.onBack(); }}>Back</button>
            <div className="mg-title-small">Bid &amp; Brag</div>
            <div />
          </div>
          <div className="mg-stage">
            <div className="mg-panel mg-enter">
              <div className="mg-eyebrow">Something went wrong</div>
              <h2 className="mg-h2" style={{ color: 'var(--clr-sub)', fontSize: '1rem', fontWeight: 400 }}>
                The game hit an error. Try switching to text input mode instead of voice.
              </h2>
              <button className="mg-cta" onClick={() => { this.setState({ crashed: false, message: '' }); this.props.onBack(); }}>
                Back to lobby
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

type View =
  | { kind: 'lobby' }
  | { kind: 'solo'; difficulty: Difficulty }
  | { kind: 'online'; mode: 'create' | 'join'; name: string; code?: string };

type Props = { onExit: () => void };

export default function MiniGameApp({ onExit }: Props) {
  // Restore an in-progress online game after a page refresh
  const [view, setView] = useState<View>(() => {
    try {
      const saved = sessionStorage.getItem('mg:session');
      if (saved) {
        const { code, name } = JSON.parse(saved) as { code: string; name: string };
        if (code && name) return { kind: 'online', mode: 'join', name, code };
      }
    } catch { /* ignore */ }
    return { kind: 'lobby' };
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [view.kind]);

  const toLobby = () => {
    try { sessionStorage.removeItem('mg:session'); } catch { /* ignore */ }
    setView({ kind: 'lobby' });
  };

  if (view.kind === 'solo') {
    return (
      <GameErrorBoundary onBack={toLobby}>
        <MiniGameSolo onExit={toLobby} difficulty={view.difficulty} />
      </GameErrorBoundary>
    );
  }
  if (view.kind === 'online') {
    return (
      <GameErrorBoundary onBack={toLobby}>
        <MiniGameOnline
          onExit={toLobby}
          initialMode={view.mode}
          initialName={view.name}
          initialCode={view.code}
        />
      </GameErrorBoundary>
    );
  }

  return <Lobby onExit={onExit} onStart={(v) => {
    // Persist online sessions so a page refresh re-joins automatically
    if (v.kind === 'online' && v.code) {
      try { sessionStorage.setItem('mg:session', JSON.stringify({ code: v.code, name: v.name })); } catch { /* ignore */ }
    }
    setView(v);
  }} />;
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
