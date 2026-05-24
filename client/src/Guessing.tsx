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

function Guessing({ room, myId }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!room.performing || !room.guessing || !room.words || !room.performing.hint) {
    return <p>Loading game state…</p>;
  }

  const { performing, guessing } = room;
  const hint = performing.hint as string;
  const me = room.players.find((p) => p.id === myId);
  const isOnPerformerTeam = me?.team === performing.team;
  const isPerformer = myId === performing.captainId;
  const canGuess = isOnPerformerTeam && !isPerformer;
  const performerPlayer = room.players.find((p) => p.id === performing.captainId);
  const performerName = performerPlayer?.name ?? '?';
  const teamColor = TEAM_COLORS[performing.team];

  const toggle = (word: string) => {
    setError(null);
    socket.emit('toggle-guess', { word }, (response: AckResponse) => {
      if (!response.ok) setError(response.error);
    });
  };

  const submit = () => {
    setBusy(true);
    setError(null);
    socket.emit('submit-guesses', {}, (response: AckResponse) => {
      setBusy(false);
      if (!response.ok) setError(response.error);
    });
  };

  const ready = guessing.pendingGuesses.length === performing.bidCount;

  return (
    <section>
      <RoomHeader code={room.code} />

      <div
        style={{
          marginTop: '1.5rem',
          padding: '1rem',
          border: `2px solid ${teamColor}`,
          borderRadius: '0.5rem',
          background: `${teamColor}10`,
          textAlign: 'center',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: teamColor,
            textTransform: 'uppercase',
          }}
        >
          Hint from {performerName} ({teamLabel(performing.team)})
        </p>
        <p style={{ margin: '0.5rem 0', fontSize: '2rem', fontWeight: 700, letterSpacing: '0.05em' }}>
          {hint.toUpperCase()}
        </p>
        <p style={{ margin: 0, fontSize: '0.95rem', color: '#333' }}>
          for <strong>{performing.bidCount}</strong>{' '}
          {performing.bidCount === 1 ? 'word' : 'words'}
        </p>
      </div>

      <div
        style={{
          marginTop: '1.5rem',
          padding: '1rem',
          border: '1px solid #ddd',
          borderRadius: '0.5rem',
        }}
      >
        {canGuess ? (
          <>
            <p style={{ margin: 0, fontWeight: 600 }}>
              You are guessing for {teamLabel(performing.team)} team.
            </p>
            <p style={{ marginTop: '0.25rem', fontSize: '0.85rem', color: '#666' }}>
              Click words to add/remove. Selections are shared with your teammates. Pick exactly{' '}
              <strong>{performing.bidCount}</strong>, then any teammate can submit.
            </p>
            <p style={{ marginTop: '0.5rem', fontSize: '0.95rem' }}>
              Selected: <strong>{guessing.pendingGuesses.length}</strong> /{' '}
              {performing.bidCount}
            </p>
            <button
              onClick={submit}
              disabled={busy || !ready}
              style={{
                marginTop: '0.5rem',
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                fontWeight: 500,
                background: ready ? '#111' : '#ccc',
                color: '#fff',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: ready ? 'pointer' : 'not-allowed',
              }}
            >
              Submit guesses
            </button>
          </>
        ) : isPerformer ? (
          <p style={{ margin: 0, fontStyle: 'italic', color: '#666' }}>
            Your team is guessing. You can't help — just watch.
            <br />
            <span style={{ fontSize: '0.85rem' }}>
              Selected so far: {guessing.pendingGuesses.length} / {performing.bidCount}
            </span>
          </p>
        ) : (
          <p style={{ margin: 0, fontStyle: 'italic', color: '#666' }}>
            The other team is guessing. Watch what they pick.
            <br />
            <span style={{ fontSize: '0.85rem' }}>
              Selected so far: {guessing.pendingGuesses.length} / {performing.bidCount}
            </span>
          </p>
        )}
      </div>

      {error && (
        <p style={{ color: '#aa0000', marginTop: '1rem' }} role="alert">
          {error}
        </p>
      )}

      <h3 style={{ marginTop: '2rem', marginBottom: '0.5rem' }}>Board</h3>
      <Board
        words={room.words}
        selectable={canGuess}
        selected={guessing.pendingGuesses}
        onToggle={toggle}
        maxSelections={performing.bidCount}
      />
    </section>
  );
}

export default Guessing;
