import { useState } from 'react';
import { socket } from './socket';
import RoomHeader from './RoomHeader';
import {
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
  const [sliderDraft,     setSliderDraft]     = useState<number | null>(null);

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
        <div className="host-settings-card">
          <p className="host-settings-title">Host Settings</p>

          {/* Time limit slider — sentinel value (SLIDER_MAX) means "No limit" */}
          {(() => {
            const SLIDER_MIN = MIN_TIMEOUT_SECONDS;     // 5
            const SLIDER_MAX = 305;                     // rightmost = No limit
            const SLIDER_STEP = 5;
            const stored = room.settings.roundTimeoutSeconds;
            const liveValue =
              sliderDraft !== null
                ? sliderDraft
                : stored === null
                  ? SLIDER_MAX
                  : Math.min(Math.max(stored, SLIDER_MIN), SLIDER_MAX);
            const isNoLimit = liveValue >= SLIDER_MAX;
            const displayLabel = isNoLimit ? 'No limit' : formatTimeLimit(liveValue);

            const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
              setSliderDraft(Number(e.target.value));
            };
            const commit = (e: React.SyntheticEvent<HTMLInputElement>) => {
              const v = Number((e.target as HTMLInputElement).value);
              setTimeLimit(v >= SLIDER_MAX ? null : v);
              setSliderDraft(null);
            };

            return (
              <div className="host-setting-row">
                <div className="host-setting-label">
                  <span className="host-setting-name">Time limit per decision</span>
                  <span className="host-setting-value">{displayLabel}</span>
                </div>
                <input
                  type="range"
                  className="host-slider"
                  min={SLIDER_MIN}
                  max={SLIDER_MAX}
                  step={SLIDER_STEP}
                  value={liveValue}
                  onChange={onChange}
                  onPointerUp={commit}
                  onKeyUp={commit}
                  aria-label="Time limit per decision in seconds"
                />
                <div className="host-setting-marks">
                  <span>5s</span>
                  <span>5 min</span>
                  <span>No limit</span>
                </div>
                <p className="host-setting-hint">
                  If a player runs out of time on their turn, their team loses the round.
                  Slide all the way right for no limit.
                </p>
              </div>
            );
          })()}
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
