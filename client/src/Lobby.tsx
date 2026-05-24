import { useState } from 'react';
import { socket } from './socket';
import RoomHeader from './RoomHeader';
import {
  MAX_TIMEOUT_SECONDS,
  MIN_TIMEOUT_SECONDS,
  formatTimeLimit,
  type AckResponse,
  type Player,
  type RoomState,
  type Team,
} from './types';

type Props = { room: RoomState; myId: string | null };

function Lobby({ room, myId }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy,  setBusy]  = useState(false);

  // Local drafts for editable fields so typing feels instant
  const [redNameDraft,    setRedNameDraft]    = useState<string | null>(null);
  const [blueNameDraft,   setBlueNameDraft]   = useState<string | null>(null);
  const [timeLimitDraft,  setTimeLimitDraft]  = useState<string | null>(null);

  const me          = room.players.find(p => p.id === myId) ?? null;
  const redPlayers  = room.players.filter(p => p.team === 'red');
  const bluePlayers = room.players.filter(p => p.team === 'blue');
  const unassigned  = room.players.filter(p => p.team === null);

  const setTeam = (team: Team | null) => {
    setError(null);
    socket.emit('set-team', { team }, (res: AckResponse) => {
      if (!res.ok) setError(res.error);
    });
  };

  const commitTeamName = (team: Team, name: string) => {
    const val = name.trim();
    if (!val) return;
    socket.emit('set-team-name', { team, name: val }, (res: AckResponse) => {
      if (!res.ok) setError(res.error);
    });
  };

  const setTimeLimit = (seconds: number | null) => {
    setError(null);
    socket.emit('set-time-limit', { seconds }, (res: AckResponse) => {
      if (!res.ok) setError(res.error);
    });
  };

  const commitTimeLimit = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === '') {
      setTimeLimit(null);
      return;
    }
    const n = parseInt(trimmed, 10);
    if (!Number.isFinite(n) || n <= 0) {
      setError('Time limit must be a positive number, or empty for no limit');
      return;
    }
    if (n < MIN_TIMEOUT_SECONDS || n > MAX_TIMEOUT_SECONDS) {
      setError(`Time limit must be between ${MIN_TIMEOUT_SECONDS} and ${MAX_TIMEOUT_SECONDS} seconds`);
      return;
    }
    setTimeLimit(n);
  };

  const startGame = () => {
    setBusy(true);
    setError(null);
    socket.emit('start-game', {}, (res: AckResponse) => {
      setBusy(false);
      if (!res.ok) setError(res.error);
    });
  };

  const isHost = myId === room.host;

  const canStartReason =
    room.players.length < 4    ? `Need at least 4 players (have ${room.players.length})` :
    redPlayers.length  < 2     ? `Red needs ≥ 2 players (have ${redPlayers.length})` :
    bluePlayers.length < 2     ? `Blue needs ≥ 2 players (have ${bluePlayers.length})` :
    null;

  const canStart = canStartReason === null && isHost;

  const redName  = redNameDraft  ?? room.teamNames.red;
  const blueName = blueNameDraft ?? room.teamNames.blue;

  return (
    <section>
      <RoomHeader code={room.code} />

      {/* Team picker */}
      <div className="team-pick-section">
        <span className="team-pick-label">Your team</span>
        <div className="team-pick-row">
          <button
            className={`team-pick-btn ${me?.team === null ? 'active-none' : ''}`}
            onClick={() => setTeam(null)}
          >
            Spectator
          </button>
          <button
            className={`team-pick-btn ${me?.team === 'red' ? 'active-red' : ''}`}
            onClick={() => setTeam('red')}
          >
            Red
          </button>
          <button
            className={`team-pick-btn ${me?.team === 'blue' ? 'active-blue' : ''}`}
            onClick={() => setTeam('blue')}
          >
            Blue
          </button>
        </div>
      </div>

      {/* Team name inputs — host only */}
      {isHost && (
        <div className="team-names-row">
          <div className="team-name-field">
            <label htmlFor="red-team-name">Red team name</label>
            <input
              id="red-team-name"
              className="team-name-input red-team"
              value={redName}
              maxLength={24}
              onChange={e => setRedNameDraft(e.target.value)}
              onBlur={e => {
                commitTeamName('red', e.target.value);
                setRedNameDraft(null);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  commitTeamName('red', (e.target as HTMLInputElement).value);
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="Red"
            />
          </div>
          <div className="team-name-field">
            <label htmlFor="blue-team-name">Blue team name</label>
            <input
              id="blue-team-name"
              className="team-name-input blue-team"
              value={blueName}
              maxLength={24}
              onChange={e => setBlueNameDraft(e.target.value)}
              onBlur={e => {
                commitTeamName('blue', e.target.value);
                setBlueNameDraft(null);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  commitTeamName('blue', (e.target as HTMLInputElement).value);
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="Blue"
            />
          </div>
        </div>
      )}

      {/* Team columns */}
      <div className="team-grid">
        <TeamPanel
          title={room.teamNames.red}
          cssClass="red"
          players={redPlayers}
          myId={myId}
          hostId={room.host}
        />
        <TeamPanel
          title="Unassigned"
          cssClass=""
          players={unassigned}
          myId={myId}
          hostId={room.host}
        />
        <TeamPanel
          title={room.teamNames.blue}
          cssClass="blue"
          players={bluePlayers}
          myId={myId}
          hostId={room.host}
        />
      </div>

      {/* Start */}
      {isHost ? (
        <>
          <button
            className={`btn ${canStart ? 'btn-primary' : 'btn-ghost'}`}
            onClick={startGame}
            disabled={!canStart || busy}
          >
            Start game
          </button>
          {canStartReason && <p className="info-line">{canStartReason}</p>}
          <p className="info-line">Captains are picked randomly when the game starts.</p>
        </>
      ) : (
        <>
          <p className="info-line">
            Waiting for <strong>{room.players.find(p => p.id === room.host)?.name ?? 'the host'}</strong> to start the game.
          </p>
          <p className="info-line" style={{ fontSize: '0.8rem' }}>
            Round timer: <strong>{formatTimeLimit(room.settings.roundTimeoutSeconds)}</strong>
          </p>
        </>
      )}

      {error && <p className="error-msg" role="alert">{error}</p>}

      {/* ── Host Settings (host only) ── */}
      {isHost && (
        <div
          style={{
            marginTop: '1.75rem',
            padding: '1rem 1.1rem',
            background: 'var(--surface-soft)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '0.72rem',
              fontWeight: 800,
              color: 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              marginBottom: '0.85rem',
            }}
          >
            Host Settings
          </p>

          {/* Time limit input — a small, self-contained sub-card */}
          <div
            style={{
              padding: '0.75rem 0.9rem',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
            }}
          >
            <label
              htmlFor="time-limit-input"
              style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: '0.35rem',
              }}
            >
              Time limit per decision
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                id="time-limit-input"
                type="number"
                inputMode="numeric"
                min={MIN_TIMEOUT_SECONDS}
                max={MAX_TIMEOUT_SECONDS}
                value={
                  timeLimitDraft !== null
                    ? timeLimitDraft
                    : room.settings.roundTimeoutSeconds === null
                      ? ''
                      : String(room.settings.roundTimeoutSeconds)
                }
                onChange={(e) => setTimeLimitDraft(e.target.value)}
                onBlur={(e) => {
                  commitTimeLimit(e.target.value);
                  setTimeLimitDraft(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitTimeLimit((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                placeholder="empty = no limit"
                style={{
                  width: '7rem',
                  padding: '0.45rem 0.7rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface-soft)',
                  color: 'var(--text)',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  outline: 'none',
                }}
              />
              <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                seconds
              </span>
              <span
                style={{
                  marginLeft: 'auto',
                  padding: '0.3rem 0.7rem',
                  borderRadius: '999px',
                  background: 'rgba(124, 92, 252, 0.13)',
                  border: '1px solid rgba(124, 92, 252, 0.28)',
                  color: 'var(--text)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                }}
              >
                {formatTimeLimit(room.settings.roundTimeoutSeconds)}
              </span>
            </div>
            <p
              style={{
                margin: '0.5rem 0 0',
                fontSize: '0.75rem',
                color: 'var(--muted)',
                lineHeight: 1.45,
              }}
            >
              Min {MIN_TIMEOUT_SECONDS}s, max {MAX_TIMEOUT_SECONDS}s. Leave empty for no limit.
              If a player runs out of time, their team loses the round.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function TeamPanel({
  title, cssClass, players, myId, hostId,
}: { title: string; cssClass: string; players: Player[]; myId: string | null; hostId: string }) {
  return (
    <div className={`team-panel ${cssClass}`}>
      <p className="team-panel-title">{title} ({players.length})</p>
      {players.length === 0 ? (
        <p className="team-empty">Empty</p>
      ) : (
        <ul className="team-player-list">
          {players.map(p => (
            <li key={p.id} className={`team-player-item ${p.connected ? '' : 'offline'}`}>
              <span>{p.name}</span>
              {p.id === hostId  && <span className="player-tag">(host)</span>}
              {p.id === myId    && <span className="player-tag">(you)</span>}
              {!p.connected     && <span className="player-tag">(offline)</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Lobby;
