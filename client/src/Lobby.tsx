import { useState } from 'react';
import { socket } from './socket';
import RoomHeader from './RoomHeader';
import { TEAM_COLORS, type AckResponse, type Player, type RoomState, type Team } from './types';

type Props = {
  room: RoomState;
  myId: string | null;
};

function Lobby({ room, myId }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const me = room.players.find((p) => p.id === myId) ?? null;
  const redPlayers = room.players.filter((p) => p.team === 'red');
  const bluePlayers = room.players.filter((p) => p.team === 'blue');
  const unassigned = room.players.filter((p) => p.team === null);

  const setTeam = (team: Team | null) => {
    setError(null);
    socket.emit('set-team', { team }, (response: AckResponse) => {
      if (!response.ok) setError(response.error);
    });
  };

  const startGame = () => {
    setBusy(true);
    setError(null);
    socket.emit('start-game', {}, (response: AckResponse) => {
      setBusy(false);
      if (!response.ok) setError(response.error);
    });
  };

  const canStartReason =
    room.players.length < 4
      ? `Need at least 4 players (currently ${room.players.length})`
      : redPlayers.length < 2
        ? `Red team needs at least 2 players (currently ${redPlayers.length})`
        : bluePlayers.length < 2
          ? `Blue team needs at least 2 players (currently ${bluePlayers.length})`
          : null;

  const canStart = canStartReason === null;

  return (
    <section>
      <RoomHeader code={room.code} />

      <div style={{ marginTop: '2rem' }}>
        <p style={{ marginBottom: '0.5rem', fontWeight: 500 }}>Your team:</p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <TeamButton label="Unassigned" active={me?.team === null} onClick={() => setTeam(null)} />
          <TeamButton
            label="Red"
            active={me?.team === 'red'}
            color={TEAM_COLORS.red}
            onClick={() => setTeam('red')}
          />
          <TeamButton
            label="Blue"
            active={me?.team === 'blue'}
            color={TEAM_COLORS.blue}
            onClick={() => setTeam('blue')}
          />
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '0.75rem',
          marginTop: '1.5rem',
        }}
      >
        <TeamPanel title="Red" color={TEAM_COLORS.red} players={redPlayers} myId={myId} />
        <TeamPanel title="Unassigned" color="#999" players={unassigned} myId={myId} />
        <TeamPanel title="Blue" color={TEAM_COLORS.blue} players={bluePlayers} myId={myId} />
      </div>

      <div style={{ marginTop: '2rem' }}>
        <button
          onClick={startGame}
          disabled={!canStart || busy}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            fontWeight: 500,
            background: canStart ? '#111' : '#ccc',
            color: '#fff',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: canStart ? 'pointer' : 'not-allowed',
          }}
        >
          Start game
        </button>
        {canStartReason && (
          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
            {canStartReason}
          </p>
        )}
        <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#888' }}>
          Captains are picked randomly when the game starts.
        </p>
      </div>

      {error && (
        <p style={{ color: '#aa0000', marginTop: '1rem' }} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function TeamButton({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.5rem 1rem',
        fontSize: '0.95rem',
        border: `2px solid ${active ? (color ?? '#111') : '#ccc'}`,
        background: active ? (color ?? '#111') : '#fff',
        color: active ? '#fff' : '#333',
        borderRadius: '0.375rem',
        cursor: 'pointer',
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </button>
  );
}

function TeamPanel({
  title,
  color,
  players,
  myId,
}: {
  title: string;
  color: string;
  players: Player[];
  myId: string | null;
}) {
  return (
    <div
      style={{
        border: '1px solid #ddd',
        borderTop: `4px solid ${color}`,
        borderRadius: '0.375rem',
        padding: '0.75rem',
        background: '#fff',
        minHeight: '6rem',
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: '0.875rem',
          fontWeight: 600,
          color: '#333',
          marginBottom: '0.5rem',
        }}
      >
        {title} ({players.length})
      </p>
      {players.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#999', fontStyle: 'italic' }}>
          (empty)
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {players.map((p) => (
            <li
              key={p.id}
              style={{
                fontSize: '0.9rem',
                padding: '0.25rem 0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                opacity: p.connected ? 1 : 0.45,
              }}
            >
              <span>{p.name}</span>
              {p.id === myId && (
                <span style={{ fontSize: '0.75rem', color: '#888' }}>(you)</span>
              )}
              {!p.connected && (
                <span style={{ fontSize: '0.75rem', color: '#888' }}>(offline)</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Lobby;
