import { useEffect, useRef, useState } from 'react';
import { socket } from './socket';
import Board from './Board';
import RoomHeader from './RoomHeader';
import TeamClocks from './TeamClocks';
import { playSound } from './useSound';
import { teamLabel, type AckResponse, type RoomState } from './types';

type Props = { room: RoomState; myId: string | null };

function Bidding({ room, myId }: Props) {
  const [myBid,  setMyBid]  = useState(0);
  const [error,  setError]  = useState<string | null>(null);
  const [busy,   setBusy]   = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);

  if (!room.bidding || !room.captains || !room.words) return null;

  const { bidding, captains } = room;
  const me              = room.players.find(p => p.id === myId);
  const myCaptainTeam   = captains.red === myId ? 'red' : captains.blue === myId ? 'blue' : null;
  const isMyTurn        = myCaptainTeam !== null && myCaptainTeam === bidding.currentTurn;
  const lastBid         = bidding.history[bidding.history.length - 1] ?? null;
  const minNextBid      = lastBid ? lastBid.count + 1 : 2;

  useEffect(() => { setMyBid(minNextBid); }, [minNextBid]);

  const turnName = bidding.currentTurn === 'red'
    ? (room.players.find(p => p.id === captains.red)?.name  ?? '?')
    : (room.players.find(p => p.id === captains.blue)?.name ?? '?');

  const placeBid = () => {
    if (myBid < minNextBid) { setError('Minimum bid is ' + minNextBid); return; }
    setBusy(true); setError(null);
    socket.emit('place-bid', { count: myBid }, (res: AckResponse) => {
      setBusy(false);
      if (res.ok) playSound('bid_raise');
      else setError(res.error);
    });
  };

  const challenge = () => {
    setBusy(true); setError(null);
    socket.emit('challenge', {}, (res: AckResponse) => {
      setBusy(false);
      if (res.ok) playSound('challenge');
      else setError(res.error);
    });
  };

  const scrollToBoard = () => boardRef.current?.scrollIntoView({ behavior: 'smooth' });
  const copyCode = () => navigator.clipboard.writeText(room.code).catch(() => {});
  const lastBidTeamColor = lastBid ? (lastBid.team === 'red' ? 'c-red' : 'c-blue') : 'c-neutral';

  return (
    <>
      <div className="fs-panel fs-panel--bidding">
        <div className="fs-top-bar">
          <div className="fs-top-bar-left">
            <span className="fs-phase-label">Bidding</span>
          </div>
        </div>
        <RoomHeader code={room.code} />
        <TeamClocks room={room} />
        <div className="fs-panel-body">
          <div className="fs-room-hero small">
            <p className="fs-room-hero-label">Room</p>
            <button className="fs-room-hero-code" onClick={copyCode}>{room.code}</button>
          </div>

          <div className="bid-captains-strip">
            {(['red', 'blue'] as const).map(team => {
              const cap = room.players.find(p => p.id === captains[team]);
              const isTurn = bidding.currentTurn === team;
              return (
                <div key={team} className={'bid-captain-pill' + (isTurn ? ' active-' + team : '')}>
                  <span className={'bid-captain-team ' + team}>{teamLabel(team)} captain</span>
                  <span className="bid-captain-name">
                    {cap?.name ?? '?'}
                    {captains[team] === myId && <span className="player-tag">(you)</span>}
                    {cap?.connected === false && <span className="player-tag" style={{ color: 'var(--red)' }}>(offline)</span>}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="bid-current-display">
            <p className="bid-current-label">{lastBid ? teamLabel(lastBid.team) + ' bid' : 'No bids yet'}</p>
            <span key={lastBid?.count ?? 'none'} className={'bid-current-number ' + lastBidTeamColor}>
              {lastBid ? lastBid.count : '—'}
            </span>
            <p className="bid-hint-text">
              Opening team: <strong style={{ color: 'var(--text)' }}>{teamLabel(bidding.openingTeam)}</strong>
            </p>
          </div>

          {isMyTurn ? (
            <div className="bid-arrow-section">
              <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Your bid</p>
              <div className="bid-arrow-row">
                <button className="bid-arrow-btn" onClick={() => setMyBid(v => Math.max(v - 1, minNextBid))} disabled={myBid <= minNextBid} aria-label="Decrease bid">−</button>
                <span className="bid-my-number">{myBid}</span>
                <button className="bid-arrow-btn" onClick={() => setMyBid(v => v + 1)} aria-label="Increase bid">+</button>
              </div>
              <div className="bid-action-row">
                <button className="bid-raise-btn" onClick={placeBid} disabled={busy || myBid < minNextBid}>
                  {lastBid ? 'Raise to ' + myBid : 'Open at ' + myBid}
                </button>
                {lastBid && <button className="bid-challenge-btn" onClick={challenge} disabled={busy}>Challenge</button>}
              </div>
              <p className="bid-hint-text">
                {lastBid
                  ? 'Raise above ' + lastBid.count + ' or challenge to make ' + teamLabel(lastBid.team) + ' deliver.'
                  : 'Opening bid must be >= 2.'}
              </p>
            </div>
          ) : (
            <div className="bid-waiting-panel">
              <p className="bid-current-label">Waiting for</p>
              <p className="bid-waiting-name">{turnName}</p>
              <p className="bid-hint-text">{teamLabel(bidding.currentTurn)} team captain is deciding...</p>
            </div>
          )}

          {error && <p className="error-msg" role="alert">{error}</p>}

          {bidding.history.length > 0 && (
            <div className="bid-history-strip">
              <p className="bid-history-title">Bid history</p>
              <ul className="bid-history-list">
                {bidding.history.map((b, i) => (
                  <li key={i} className={'bid-history-chip ' + b.team}>{teamLabel(b.team)} · {b.count}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="fs-board-anchor">
            <button className="fs-board-btn" onClick={scrollToBoard}>View Board ↓</button>
          </div>
        </div>
      </div>

      <div className="fs-panel fs-panel--board" ref={boardRef}>
        <div className="fs-top-bar">
          <span className="fs-phase-label">Board — 25 words</span>
        </div>
        <div className="fs-panel-body">
          <p className="board-hint-bar">
            {me?.team
              ? myCaptainTeam
                ? "You're captain — think about which words you can connect with one hint."
                : 'Study the board. Your captain is deciding the bid.'
              : 'Spectating — watch the board.'}
          </p>
          <Board words={room.words} />
        </div>
      </div>
    </>
  );
}

export default Bidding;
