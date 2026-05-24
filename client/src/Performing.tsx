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

function Performing({ room, myId }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [hint, setHint] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!room.performing || !room.words) {
    return <p>Loading game state…</p>;
  }

  const { performing } = room;
  const isPerformer = performing.captainId === myId;
  const performerPlayer = room.players.find((p) => p.id === performing.captainId);
  const performerName = performerPlayer?.name ?? '?';
  const performerConnected = performerPlayer?.connected ?? false;
  const teamColor = TEAM_COLORS[performing.team];

  const toggle = (word: string) => {
    setSelected((prev) =>
      prev.includes(word) ? prev.filter((w) => w !== word) : [...prev, word],
    );
  };

  const submit = () => {
    if (selected.length !== performing.bidCount) {
      setError(`Pick exactly ${performing.bidCount} words`);
      return;
    }
    if (!hint.trim()) {
      setError('Enter a one-word hint');
      return;
    }
    setBusy(true);
    setError(null);
    socket.emit(
      'submit-targets-and-hint',
      { targets: selected, hint: hint.trim() },
      (response: AckResponse) => {
        setBusy(false);
        if (!response.ok) setError(response.error);
      },
    );
  };

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
          Performer — {teamLabel(performing.team)} team
        </p>
        <p style={{ margin: '0.25rem 0', fontSize: '1.25rem', fontWeight: 600 }}>
          {performerName}
          {!performerConnected && (
            <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: '#aa0000', fontWeight: 500 }}>
              (offline)
            </span>
          )}{' '}
          must hit <span style={{ color: teamColor }}>{performing.bidCount}</span>{' '}
          {performing.bidCount === 1 ? 'word' : 'words'} with a one-word hint.
        </p>
      </div>

      {isPerformer ? (
        <div
          style={{
            marginTop: '1.5rem',
            padding: '1rem',
            border: '1px solid #ddd',
            borderRadius: '0.5rem',
          }}
        >
          <p style={{ margin: 0, fontWeight: 600 }}>
            Step 1: Pick your {performing.bidCount} target words ({selected.length}/
            {performing.bidCount})
          </p>
          <p style={{ marginTop: '0.25rem', fontSize: '0.85rem', color: '#666' }}>
            Click words on the board below. These stay secret — only you can see them.
          </p>
          <label style={{ display: 'block', marginTop: '1rem' }}>
            <span style={{ fontWeight: 600 }}>Step 2: Your one-word hint</span>
            <input
              type="text"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="one word, no spaces"
              maxLength={30}
              style={{
                display: 'block',
                marginTop: '0.25rem',
                padding: '0.5rem',
                width: '100%',
                boxSizing: 'border-box',
                fontSize: '1rem',
                border: '1px solid #ccc',
                borderRadius: '0.25rem',
              }}
            />
          </label>
          <button
            onClick={submit}
            disabled={busy || selected.length !== performing.bidCount || !hint.trim()}
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontWeight: 500,
              background:
                selected.length === performing.bidCount && hint.trim() ? '#111' : '#ccc',
              color: '#fff',
              border: 'none',
              borderRadius: '0.375rem',
              cursor:
                selected.length === performing.bidCount && hint.trim()
                  ? 'pointer'
                  : 'not-allowed',
            }}
          >
            Submit hint
          </button>
        </div>
      ) : (
        <p style={{ marginTop: '1.5rem', fontStyle: 'italic', color: '#666' }}>
          Waiting for {performerName} to pick {performing.bidCount} words and give a hint…
        </p>
      )}

      {error && (
        <p style={{ color: '#aa0000', marginTop: '1rem' }} role="alert">
          {error}
        </p>
      )}

      <h3 style={{ marginTop: '2rem', marginBottom: '0.5rem' }}>Board</h3>
      <Board
        words={room.words}
        selectable={isPerformer}
        selected={selected}
        onToggle={toggle}
        maxSelections={performing.bidCount}
      />
    </section>
  );
}

export default Performing;
