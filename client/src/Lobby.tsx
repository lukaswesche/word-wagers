import { useState } from 'react';
import { socket } from './socket';
import { playSound } from './useSound';
import {
  type AckResponse,
  type Player,
  type RoomState,
  type Team,
} from './types';

type Props = { room: RoomState; myId: string | null };

function Lobby({ room, myId }: Props) {
  const [error,         setError]         = useState<string | null>(null);
  const [busy,          setBusy]          = useState(false);
  const [redNameDraft,  setRedNameDraft]  = useState<string | null>(null);
  const [blueNameDraft, setBlueNameDraft] = useState<string | null>(null);

  const me          = room.players.find(p => p.id === myId) ?? null;
  const redPlayers  = room.players.filter(p => p.team === 'red');
  const bluePlayers = room.players.filter(p => p.team === 'blue');
  const unassigned  = room.players.filter(p => p.team === null);
  const isHost      = myId === room.host;

  const setTeam = (team: Team | null) => {
    setError(null);
    socket.emit('set-team', { team }, (res: AckResponse) => {
      if (res.ok) playSound('join');
      else setError(res.error);
    });
  };

  const commitTeamName = (team: Team, name: string) => {
    const val = name.trim();
    if (!val) return;
    socket.emit('set-team-name', { team, name: val }, (res: AckResponse) => {
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

  const canStartReason =
    room.players.length < 4 ? 'Need >=4 players (have ' + room.players.length + ')' :
    redPlayers.length  < 2  ? 'Red needs >=2 players' :
    bluePlayers.length < 2  ? 'Blue needs >=2 players' :
    null;

  const canStart = canStartReason === null && isHost;
  const redName  = redNameDraft  ?? room.teamNames.red;
  const blueName = blueNameDraft ?? room.teamNames.blue;

  const copyCode = () => navigator.clipboard.writeText(room.code).catch(() => {});

  return (
    <div className="fs-panel fs-panel--lobby">
      <div className="fs-top-bar">
        <div className="fs-top-bar-left">
          <span className="fs-phase-label">Lobby</span>
        </div>
      </div>

      <div className="fs-panel-body">
        <div className="fs-room-hero">
          <p className="fs-room-hero-label">Room code · tap to copy</p>
          <button className="fs-room-hero-code" onClick={copyCode} title="Copy code">
            {room.code}
          </button>
        </div>

        <p className="lobby-pick-heading">Pick your team</p>

        <div className="lobby-teams-grid">
          <TeamCard
            team="red"
            teamName={redName}
            nameDraft={redNameDraft}
            players={redPlayers}
            myId={myId}
            hostId={room.host}
            isMine={me?.team === 'red'}
            isHost={isHost}
            onJoin={() => setTeam('red')}
            onNameChange={setRedNameDraft}
            onNameCommit={v => { commitTeamName('red', v); setRedNameDraft(null); }}
          />
          <TeamCard
            team="blue"
            teamName={blueName}
            nameDraft={blueNameDraft}
            players={bluePlayers}
            myId={myId}
            hostId={room.host}
            isMine={me?.team === 'blue'}
            isHost={isHost}
            onJoin={() => setTeam('blue')}
            onNameChange={setBlueNameDraft}
            onNameCommit={v => { commitTeamName('blue', v); setBlueNameDraft(null); }}
          />
        </div>

        {unassigned.length > 0 && (
          <div className="lobby-unassigned-row">
            <span className="lobby-unassigned-label">Unassigned</span>
            {unassigned.map(p => (
              <span key={p.id} className="lobby-unassigned-chip">
                {p.name}{p.id === myId ? ' (you)' : ''}{!p.connected ? ' · offline' : ''}
              </span>
            ))}
          </div>
        )}

        {error && <p className="error-msg" role="alert">{error}</p>}
      </div>

      <div className="lobby-bottom-bar">
        <button
          className={'lobby-spectator-btn' + (me?.team === null ? ' is-mine' : '')}
          onClick={() => setTeam(null)}
        >
          {me?.team === null ? 'Spectating' : 'Spectator'}
        </button>

        {isHost ? (
          <button
            className={'lobby-start-btn' + (canStart ? ' is-promoted' : '')}
            onClick={startGame}
            disabled={!canStart || busy}
            title={canStartReason ?? ''}
          >
            {busy ? 'Starting...' : canStartReason ?? 'Start Game'}
          </button>
        ) : (
          <span className="fs-sub" style={{ marginLeft: 'auto', textAlign: 'right' }}>
            Waiting for&nbsp;
            <strong style={{ color: 'var(--text)' }}>
              {room.players.find(p => p.id === room.host)?.name ?? 'host'}
            </strong>
          </span>
        )}
      </div>

      {isHost && canStart && (
        <div className="start-popup-wrapper">
          <button className="start-popup-btn" onClick={startGame} disabled={busy}>
            <span className="start-popup-eyebrow">Ready to play</span>
            <span className="start-popup-title">{busy ? 'STARTING...' : 'START GAME'}</span>
            <span className="start-popup-arrow">&gt;</span>
          </button>
        </div>
      )}
    </div>
  );
}

type TeamCardProps = {
  team: Team;
  teamName: string;
  nameDraft: string | null;
  players: Player[];
  myId: string | null;
  hostId: string;
  isMine: boolean;
  isHost: boolean;
  onJoin: () => void;
  onNameChange: (v: string) => void;
  onNameCommit: (v: string) => void;
};

function TeamCard({
  team, teamName, nameDraft, players, myId, hostId, isMine, isHost, onJoin, onNameChange, onNameCommit,
}: TeamCardProps) {
  return (
    <div
      className={'lobby-team-card lobby-team-card--' + team + (isMine ? ' is-mine' : '')}
      onClick={!isMine ? onJoin : undefined}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && !isMine && onJoin()}
    >
      {isHost ? (
        <input
          className="lobby-team-name-input"
          value={nameDraft ?? teamName}
          maxLength={24}
          placeholder={team === 'red' ? 'Red' : 'Blue'}
          onChange={e => onNameChange(e.target.value)}
          onBlur={e => onNameCommit(e.target.value)}
          onKeyDown={e => {
            e.stopPropagation();
            if (e.key === 'Enter') {
              onNameCommit((e.target as HTMLInputElement).value);
              (e.target as HTMLInputElement).blur();
            }
          }}
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <p className="lobby-team-name-display">{teamName}</p>
      )}

      <div className="lobby-player-bubbles">
        {players.length === 0 ? (
          <div className="lobby-empty-state">empty — be the first</div>
        ) : (
          players.map(p => (
            <span
              key={p.id}
              className={'lobby-player-bubble' + (p.id === myId ? ' is-me' : '') + (!p.connected ? ' is-offline' : '')}
            >
              {p.name}
              {p.id === myId   && <span className="lobby-player-bubble-tag">you</span>}
              {p.id === hostId && <span className="lobby-player-bubble-tag">host</span>}
              {!p.connected    && <span className="lobby-player-bubble-tag">off</span>}
            </span>
          ))
        )}
      </div>

      <button
        className={'lobby-join-pill' + (isMine ? ' is-mine' : '')}
        onClick={e => { e.stopPropagation(); if (!isMine) onJoin(); }}
      >
        {isMine ? "You're here" : 'Join ' + (team === 'red' ? 'Red' : 'Blue')}
      </button>
    </div>
  );
}

export default Lobby;
