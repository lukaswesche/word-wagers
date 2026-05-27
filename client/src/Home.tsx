import { useState } from 'react';
import { socket } from './socket';
import type { AckResponse } from './types';

type HomeProps = { onTryMiniGame?: () => void };

function Home({ onTryMiniGame }: HomeProps = {}) {
  const [name,      setName]      = useState('');
  const [joinCode,  setJoinCode]  = useState('');
  const [error,     setError]     = useState<string | null>(null);
  const [errorKey,  setErrorKey]  = useState(0);
  const [busy,      setBusy]      = useState(false);

  const showError = (msg: string) => {
    setError(msg);
    setErrorKey(k => k + 1);
  };

  const createRoom = () => {
    if (!name.trim()) { showError('Enter your name first'); return; }
    setBusy(true);
    setError(null);
    socket.emit('create-room', { name: name.trim() }, (res: AckResponse<{ code: string }>) => {
      setBusy(false);
      if (!res.ok) showError(res.error);
    });
  };

  const joinRoom = () => {
    if (!name.trim())     { showError('Enter your name first'); return; }
    if (!joinCode.trim()) { showError('Enter a room code');     return; }
    setBusy(true);
    setError(null);
    socket.emit('join-room', { name: name.trim(), code: joinCode.trim().toUpperCase() }, (res: AckResponse) => {
      setBusy(false);
      if (!res.ok) showError(res.error);
    });
  };

  return (
    <div className="home-screen">

      {/* ── Hero ── */}
      <div className="home-hero">
        <div className="home-eyebrow">Party word game · 4+ players</div>
        <h1 className="home-title">Word<br />Wagers</h1>
        <p className="home-tagline">
          One hint. How many can your team get?
        </p>
      </div>

      {/* ── Name input ── */}
      <div className="home-name-section">
        <label className="form-label" htmlFor="player-name">Your name</label>
        <input
          id="player-name"
          type="text"
          className="home-name-input"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && createRoom()}
          placeholder="Enter your name…"
          maxLength={20}
          autoComplete="off"
          autoFocus
        />
      </div>

      {/* ── Action cards ── */}
      <div className="home-actions">

        {/* Create */}
        <div className="home-action-card create-card">
          <div className="action-card-icon">+</div>
          <div className="action-card-title">Create a room</div>
          <div className="action-card-desc">Start a new game and invite your friends with a shareable code.</div>
          <button
            className="btn btn-cta btn-full"
            onClick={createRoom}
            disabled={busy}
          >
            {busy ? 'Creating…' : 'Create room'}
          </button>
        </div>

        {/* Join */}
        <div className="home-action-card join-card">
          <div className="action-card-icon">&gt;</div>
          <div className="action-card-title">Join a room</div>
          <div className="action-card-desc">Have a code? Jump straight into an existing game.</div>
          <input
            type="text"
            className="code-input"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && joinRoom()}
            placeholder="ROOM CODE"
            maxLength={6}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            className="btn btn-primary btn-full"
            onClick={joinRoom}
            disabled={busy}
          >
            {busy ? 'Joining…' : 'Join room'}
          </button>
        </div>

      </div>

      {/* ── Error ── */}
      {error && (
        <p key={errorKey} className="home-error" role="alert">
          {error}
        </p>
      )}

      {/* ── Mini-game launcher ── */}
      {onTryMiniGame && (
        <button className="home-minigame-link" onClick={onTryMiniGame}>
          Try the mini-game (beta)
        </button>
      )}

    </div>
  );
}

export default Home;
