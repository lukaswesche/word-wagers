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

function Bidding({ room, myId }: Props) {
  const [bidInput, setBidInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!room.bidding || !room.captains || !room.words) {
    return <p>Loading game state…</p>;
  }

  const { bidding, captains } = room;
  const me = room.players.find((p) => p.id === myId);
  const myTeam = me?.team ?? null;
  const myCaptainTeam = captains.red === myId ? 'red' : captains.blue === myId ? 'blue' : null;
  const isMyTurn = myCaptainTeam !== null && myCaptainTeam === bidding.currentTurn;

  const lastBid = bidding.history[bidding.history.length - 1] ?? null;
  const minNextBid = lastBid ? lastBid.count + 1 : 2;

  const redCaptain = room.players.find((p) => p.id === captains.red);
  const blueCaptain = room.players.find((p) => p.id === captains.blue);
  const redCaptainName = redCaptain?.name ?? '?';
  const blueCaptainName = blueCaptain?.name ?? '?';
  const turnCaptainName = bidding.currentTurn === 'red' ? redCaptainName : blueCaptainName;

  const placeBid = () => {
    const count = parseInt(bidInput, 10);
    if (Number.isNaN(count)) {
      setError('Enter a number');
      return;
    }
    setBusy(true);
    setError(null);
    socket.emit('place-bid', { count }, (response: AckResponse) => {
      setBusy(false);
      if (response.ok) setBidInput('');
      else setError(response.error);
    });
  };

  const challenge = () => {
    setBusy(true);
    setError(null);
    socket.emit('challenge', {}, (response: AckResponse) => {
      setBusy(false);
      if (!response.ok) setError(response.error);
    });
  };

  return (
    <section>
      <RoomHeader code={room.code} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.75rem',
          marginTop: '1.5rem',
        }}
      >
        <CaptainCard
          team="red"
          name={redCaptainName}
          isMe={captains.red === myId}
          isTurn={bidding.currentTurn === 'red'}
          connected={redCaptain?.connected ?? false}
        />
        <CaptainCard
          team="blue"
          name={blueCaptainName}
          isMe={captains.blue === myId}
          isTurn={bidding.currentTurn === 'blue'}
          connected={blueCaptain?.connected ?? false}
        />
      </div>

      <div
        style={{
          marginTop: '1.5rem',
          padding: '1rem',
          border: '1px solid #ddd',
          borderRadius: '0.5rem',
          background: '#fafafa',
        }}
      >
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>
          Opening team (coin flip): <strong>{teamLabel(bidding.openingTeam)}</strong>
        </p>
        <p style={{ marginTop: '0.5rem', marginBottom: '0.75rem', fontWeight: 600 }}>
          {isMyTurn
            ? 'Your move.'
            : `Waiting for ${turnCaptainName} (${teamLabel(bidding.currentTurn)}) …`}
        </p>

        {bidding.history.length > 0 ? (
          <ol style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
            {bidding.history.map((b, i) => (
              <li key={i} style={{ marginBottom: '0.25rem' }}>
                <span style={{ color: TEAM_COLORS[b.team], fontWeight: 600 }}>
                  {teamLabel(b.team)}
                </span>{' '}
                bids <strong>{b.count}</strong>
              </li>
            ))}
          </ol>
        ) : (
          <p style={{ margin: 0, fontStyle: 'italic', color: '#888', fontSize: '0.9rem' }}>
            No bids yet.
          </p>
        )}
      </div>

      {isMyTurn && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            border: `2px solid ${TEAM_COLORS[bidding.currentTurn]}`,
            borderRadius: '0.5rem',
          }}
        >
          <p style={{ margin: 0, fontWeight: 600, marginBottom: '0.5rem' }}>
            Your turn — bid or challenge
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="number"
              min={minNextBid}
              value={bidInput}
              onChange={(e) => setBidInput(e.target.value)}
              placeholder={`≥ ${minNextBid}`}
              style={{
                padding: '0.5rem',
                fontSize: '1rem',
                width: '6rem',
                border: '1px solid #ccc',
                borderRadius: '0.25rem',
              }}
            />
            <button
              onClick={placeBid}
              disabled={busy}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '1rem',
                background: '#111',
                color: '#fff',
                border: 'none',
                borderRadius: '0.25rem',
                cursor: 'pointer',
              }}
            >
              {lastBid ? 'Raise' : 'Open bid'}
            </button>
            {lastBid && (
              <button
                onClick={challenge}
                disabled={busy}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '1rem',
                  background: '#fff',
                  color: '#aa0000',
                  border: '2px solid #aa0000',
                  borderRadius: '0.25rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Challenge
              </button>
            )}
          </div>
          <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#666' }}>
            {lastBid
              ? `Raise to any number > ${lastBid.count}, or challenge to force ${teamLabel(lastBid.team)} to deliver on ${lastBid.count} words.`
              : `Opening bid must be at least 2.`}
          </p>
        </div>
      )}

      {error && (
        <p style={{ color: '#aa0000', marginTop: '1rem' }} role="alert">
          {error}
        </p>
      )}

      <h3 style={{ marginTop: '2rem', marginBottom: '0.5rem' }}>Board</h3>
      <p style={{ fontSize: '0.8rem', color: '#888', margin: 0, marginBottom: '0.5rem' }}>
        {myTeam
          ? `Study the 25 words. ${myCaptainTeam ? 'You are captain — think about which words you could connect with one hint.' : 'Your captain is deciding the bid.'}`
          : 'You are unassigned — you can watch but not play.'}
      </p>
      <Board words={room.words} />
    </section>
  );
}

function CaptainCard({
  team,
  name,
  isMe,
  isTurn,
  connected,
}: {
  team: 'red' | 'blue';
  name: string;
  isMe: boolean;
  isTurn: boolean;
  connected: boolean;
}) {
  const color = TEAM_COLORS[team];
  return (
    <div
      style={{
        padding: '0.75rem',
        border: `2px solid ${isTurn ? color : '#ddd'}`,
        borderRadius: '0.375rem',
        background: isTurn ? `${color}10` : '#fff',
        opacity: connected ? 1 : 0.55,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: '0.7rem',
          fontWeight: 700,
          letterSpacing: '0.1em',
          color,
          textTransform: 'uppercase',
        }}
      >
        {teamLabel(team)} captain
      </p>
      <p style={{ margin: '0.25rem 0 0', fontSize: '1.1rem', fontWeight: 600 }}>
        {name}
        {isMe && <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: '#666' }}>(you)</span>}
        {!connected && (
          <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: '#aa0000' }}>
            (offline)
          </span>
        )}
      </p>
    </div>
  );
}

export default Bidding;
