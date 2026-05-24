import { useState } from 'react';
import { socket } from './socket';
import Board from './Board';
import RoomHeader from './RoomHeader';
import {
  TEAM_COLORS,
  teamLabel,
  type AckResponse,
  type RoomState,
} from './types';

type Props = {
  room: RoomState;
  myId: string | null;
};

function Resolved({ room, myId }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!room.resolution || !room.words) {
    return <p>Loading resolution…</p>;
  }

  const { resolution } = room;
  const me = room.players.find((p) => p.id === myId);
  const myTeam = me?.team ?? null;
  const iWon = myTeam !== null && myTeam === resolution.winner;
  const winnerColor = TEAM_COLORS[resolution.winner];
  const correctCount = resolution.guesses.filter((g) =>
    resolution.targets.includes(g),
  ).length;

  const playAgain = () => {
    setBusy(true);
    setError(null);
    socket.emit('play-again', {}, (response: AckResponse) => {
      setBusy(false);
      if (!response.ok) setError(response.error);
    });
  };

  return (
    <section>
      <RoomHeader code={room.code} />

      <div
        style={{
          marginTop: '1.5rem',
          padding: '1.5rem',
          border: `3px solid ${winnerColor}`,
          borderRadius: '0.5rem',
          background: `${winnerColor}15`,
          textAlign: 'center',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '0.15em',
            color: winnerColor,
            textTransform: 'uppercase',
          }}
        >
          {myTeam ? (iWon ? 'You win' : 'You lose') : 'Result'}
        </p>
        <h2
          style={{
            margin: '0.5rem 0',
            fontSize: '2.25rem',
            color: winnerColor,
            letterSpacing: '0.05em',
          }}
        >
          {teamLabel(resolution.winner)} wins
        </h2>
        <p style={{ margin: 0, fontSize: '0.95rem', color: '#333' }}>
          {teamLabel(resolution.performerTeam)} team got{' '}
          <strong>{correctCount}</strong> / <strong>{resolution.bidCount}</strong> correct on hint{' '}
          <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>
            {resolution.hint.toUpperCase()}
          </span>
          .
        </p>
      </div>

      <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
        <button
          onClick={playAgain}
          disabled={busy}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            fontWeight: 500,
            background: '#111',
            color: '#fff',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
          }}
        >
          Play again
        </button>
        <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#666' }}>
          Same teams. Captains and board re-rolled.
        </p>
      </div>

      {error && (
        <p style={{ color: '#aa0000', marginTop: '1rem' }} role="alert">
          {error}
        </p>
      )}

      <h3 style={{ marginTop: '2rem', marginBottom: '0.5rem' }}>Board (revealed)</h3>
      <p style={{ fontSize: '0.8rem', color: '#666', margin: 0, marginBottom: '0.5rem' }}>
        <span style={{ background: '#1f6f3a', color: '#fff', padding: '0 0.3rem', borderRadius: '0.15rem' }}>CORRECT</span>{' '}
        = target the team identified ·{' '}
        <span style={{ background: '#aa2222', color: '#fff', padding: '0 0.3rem', borderRadius: '0.15rem' }}>WRONG</span>{' '}
        = guess that was not a target ·{' '}
        <span style={{ background: '#fff6dd', color: '#7a5a00', border: '1px dashed #c79a00', padding: '0 0.3rem', borderRadius: '0.15rem' }}>MISSED</span>{' '}
        = target the team didn't pick
      </p>
      <Board
        words={room.words}
        reveal={{ targets: resolution.targets, guesses: resolution.guesses }}
      />
    </section>
  );
}

export default Resolved;
