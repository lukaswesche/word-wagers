import { useState } from 'react';
import { socket } from './socket';
import Board from './Board';
import RoomHeader from './RoomHeader';
import TeamClocks from './TeamClocks';
import { teamLabel, type AckResponse, type RoomState } from './types';

type Props = { room: RoomState; myId: string | null };

function Bidding({ room, myId }: Props) {
  const [bidInput, setBidInput] = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [busy,     setBusy]     = useState(false);

  if (!room.bidding || !room.captains || !room.words) return <p>Loading game state…</p>;

  const { bidding, captains } = room;
  const me              = room.players.find(p => p.id === myId);
  const myTeam          = me?.team ?? null;
  const myCaptainTeam   = captains.red === myId ? 'red' : captains.blue === myId ? 'blue' : null;
  const isMyTurn        = myCaptainTeam !== null && myCaptainTeam === bidding.currentTurn;
  const lastBid         = bidding.history[bidding.history.length - 1] ?? null;
  const minNextBid      = lastBid ? lastBid.count + 1 : 2;
  const turnName        = bidding.currentTurn === 'red'
    ? (room.players.find(p => p.id === captains.red)?.name  ?? '?')
    : (room.players.find(p => p.id === captains.blue)?.name ?? '?');

  const placeBid = () => {
    const count = parseInt(bidInput, 10);
    if (Number.isNaN(count)) { setError('Enter a number'); return; }
    setBusy(true);
    setError(null);
    socket.emit('place-bid', { count }, (res: AckResponse) => {
      setBusy(false);
      if (res.ok) setBidInput('');
      else setError(res.error);
    });
  };

  const challenge = () => {
    setBusy(true);
    setError(null);
    socket.emit('challenge', {}, (res: AckResponse) => {
      setBusy(false);
      if (!res.ok) setError(res.error);
    });
  };

  return (
    <section className="game-layout">
      <div className="game-sidebar">
        <RoomHeader code={room.code} />
        <TeamClocks room={room} />

        {/* Captain cards */}
        <div className="captains-row">
          {(['red', 'blue'] as const).map(team => {
            const captainId = captains[team];
            const captain   = room.players.find(p => p.id === captainId);
            const isTurn    = bidding.currentTurn === team;
            return (
              <div
                key={team}
                className={[
                  'captain-card',
                  isTurn ? `active-${team}` : '',
                  captain?.connected === false ? 'offline' : '',
                ].join(' ')}
              >
                <p className={`captain-team-label ${team}`}>{teamLabel(team)} captain</p>
                <p className="captain-name">
                  {captain?.name ?? '?'}
                  {captainId === myId && <span className="player-tag">(you)</span>}
                  {captain?.connected === false && <span className="player-tag" style={{ color: 'var(--red)' }}>(offline)</span>}
                </p>
              </div>
            );
          })}
        </div>

        {/* Bid log */}
        <div className="card">
          <p className="card-label">Bid history</p>
          <p style={{ margin: '0.5rem 0 0', fontWeight: 600 }}>
            {isMyTurn
              ? 'Your move.'
              : `Waiting for ${turnName} (${teamLabel(bidding.currentTurn)}) …`}
          </p>
          <p className="info-line">
            Opening team: <strong>{teamLabel(bidding.openingTeam)}</strong>
          </p>
          {bidding.history.length > 0 ? (
            <ol className="bid-log">
              {bidding.history.map((b, i) => (
                <li key={i} className="bid-row">
                  <span className={`bid-dot ${b.team}`} />
                  <span>
                    <strong style={{ color: b.team === 'red' ? 'var(--red)' : 'var(--blue)' }}>
                      {teamLabel(b.team)}
                    </strong>{' '}
                    bids <strong>{b.count}</strong>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="bid-empty-msg mt-1">No bids yet.</p>
          )}
        </div>

        {/* Your turn */}
        {isMyTurn && (
          <div className={`action-zone active-${bidding.currentTurn}`}>
            <p className="action-title">Your turn — bid or challenge</p>
            <div className="action-row">
              <input
                type="number"
                min={minNextBid}
                className="input-field input-number"
                value={bidInput}
                onChange={e => setBidInput(e.target.value)}
                placeholder={`≥ ${minNextBid}`}
              />
              <button className="btn btn-primary btn-sm" onClick={placeBid} disabled={busy}>
                {lastBid ? 'Raise' : 'Open bid'}
              </button>
              {lastBid && (
                <button className="btn btn-danger btn-sm" onClick={challenge} disabled={busy}>
                  Challenge
                </button>
              )}
            </div>
            <p className="action-hint">
              {lastBid
                ? `Raise above ${lastBid.count}, or challenge to make ${teamLabel(lastBid.team)} deliver on ${lastBid.count} words.`
                : 'Opening bid must be at least 2.'}
            </p>
          </div>
        )}

        {error && <p className="error-msg" role="alert">{error}</p>}
      </div>

      <div className="game-board-col">
        <p className="board-section-title">Board</p>
        <p className="board-section-hint">
          {myTeam
            ? myCaptainTeam
              ? 'You are captain — think about which words you can connect with one hint.'
              : 'Study the 25 words. Your captain is deciding the bid.'
            : 'You are unassigned — you can watch but not play.'}
        </p>
        <Board words={room.words} />
      </div>
    </section>
  );
}

export default Bidding;
