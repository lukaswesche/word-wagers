import { useEffect, useState } from 'react';
import { socket } from './socket';
import Board from './Board';
import RoomHeader from './RoomHeader';
import { type AckResponse, type RoomState } from './types';

type Props = { room: RoomState; myId: string | null };

function Resolved({ room, myId }: Props) {
  const [error,           setError]          = useState<string | null>(null);
  const [busy,            setBusy]           = useState(false);
  const [tauntMsg,        setTauntMsg]       = useState('');
  const [tauntBusy,       setTauntBusy]      = useState(false);
  const [tauntError,      setTauntError]     = useState<string | null>(null);
  const [tauntDismissed,  setTauntDismissed] = useState(false);

  // Re-surface the overlay any time a new taunt arrives
  useEffect(() => {
    if (room.taunt) setTauntDismissed(false);
  }, [room.taunt?.fromId]);

  if (!room.resolution || !room.words) return <p>Loading resolution…</p>;

  const { resolution } = room;
  const me          = room.players.find(p => p.id === myId);
  const myTeam      = me?.team ?? null;
  const iWon        = myTeam !== null && myTeam === resolution.winner;
  const isLoser     = myTeam !== null && !iWon;
  const correctCount = resolution.guesses.filter(g => resolution.targets.includes(g)).length;
  const resultClass  = myTeam === null ? 'neutral' : iWon ? 'win' : 'lose';

  const redName  = room.teamNames.red;
  const blueName = room.teamNames.blue;
  const winnerName = resolution.winner === 'red' ? redName : blueName;
  const loserName  = resolution.winner === 'red' ? blueName : redName;

  const playAgain = () => {
    setBusy(true);
    setError(null);
    socket.emit('play-again', {}, (res: AckResponse) => {
      setBusy(false);
      if (!res.ok) setError(res.error);
    });
  };

  const sendTaunt = () => {
    if (!tauntMsg.trim()) return;
    setTauntBusy(true);
    setTauntError(null);
    socket.emit('send-taunt', { message: tauntMsg.trim() }, (res: AckResponse) => {
      setTauntBusy(false);
      if (!res.ok) {
        setTauntError(res.error);
      } else {
        setTauntDismissed(true); // sender skips seeing their own overlay
      }
    });
  };

  const teamDisplayLabel = (team: typeof resolution.winner) =>
    team === 'red' ? redName : blueName;

  return (
    <section>
      <RoomHeader code={room.code} />

      {/* Result card */}
      <div className={`result-card ${resultClass}`}>
        <p className="result-outcome">
          {myTeam ? (iWon ? 'You win 🎉' : 'You lose') : 'Round result'}
        </p>
        <h2 className={`result-winner ${resolution.winner}`}>
          {teamDisplayLabel(resolution.winner)} wins
        </h2>
        <p className="result-summary">
          {teamDisplayLabel(resolution.performerTeam)} got{' '}
          <strong>{correctCount}</strong> / <strong>{resolution.bidCount}</strong> on hint{' '}
          <span className="result-hint-chip">{resolution.hint.toUpperCase()}</span>
        </p>
      </div>

      {/* Taunt composer — only for winners, only if no taunt yet */}
      {iWon && !room.taunt && (
        <div className="taunt-composer">
          <p className="taunt-composer-label">🐐 Send a victory message to {loserName}</p>
          <textarea
            className="taunt-input"
            value={tauntMsg}
            onChange={e => setTauntMsg(e.target.value)}
            placeholder="Talk your sh*t…"
            maxLength={160}
            rows={3}
          />
          <button
            className="btn btn-taunt btn-full"
            onClick={sendTaunt}
            disabled={tauntBusy || !tauntMsg.trim()}
          >
            {tauntBusy ? 'Sending…' : 'SEND IT 🐐'}
          </button>
          {tauntError && <p className="error-msg" role="alert">{tauntError}</p>}
        </div>
      )}

      {/* Winner confirmation after taunt sent */}
      {iWon && room.taunt && (
        <div className="taunt-sent-confirm">
          🏆 Message delivered — {loserName} has been notified
        </div>
      )}

      {/* Play again */}
      <div style={{ textAlign: 'center' }}>
        <button className="btn btn-primary" onClick={playAgain} disabled={busy}>
          Play again
        </button>
        <p className="info-line mt-1">Same teams. Captains and board re-rolled.</p>
      </div>

      {error && <p className="error-msg" role="alert">{error}</p>}

      {/* Legend */}
      <p className="board-section-title">Board — revealed</p>
      <p className="board-section-hint">
        <span style={{ color: 'var(--correct)', fontWeight: 600 }}>●</span> Correct &nbsp;·&nbsp;
        <span style={{ color: 'var(--wrong)',   fontWeight: 600 }}>●</span> Wrong &nbsp;·&nbsp;
        <span style={{ color: 'var(--missed)',  fontWeight: 600 }}>●</span> Missed target
      </p>
      <Board
        words={room.words}
        reveal={{ targets: resolution.targets, guesses: resolution.guesses }}
      />

      {/* ── Taunt overlay ── */}
      {room.taunt && !tauntDismissed && (
        <div
          className={`taunt-overlay ${isLoser ? 'loser-side' : 'winner-side'}`}
          onClick={() => setTauntDismissed(true)}
        >
          <div className="taunt-inner" onClick={e => e.stopPropagation()}>
            <div className="taunt-emoji">{isLoser ? '🐐' : '🏆'}</div>

            <div className="taunt-header">
              {isLoser
                ? `${winnerName} says:`
                : 'Victory message sent'}
            </div>

            <blockquote className="taunt-message">
              "{room.taunt.message}"
            </blockquote>

            <p className="taunt-from">— {room.taunt.fromName}</p>

            <button
              className="taunt-dismiss-btn"
              onClick={() => setTauntDismissed(true)}
            >
              {isLoser ? '😤 cry about it' : '💪 absolute unit'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default Resolved;
