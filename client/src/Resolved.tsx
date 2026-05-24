import { useEffect, useRef, useState } from 'react';
import { socket } from './socket';
import Board from './Board';
import TeamClocks from './TeamClocks';
import { playSound, vibrate } from './useSound';
import { type AckResponse, type RoomState, type Team } from './types';

type Props = { room: RoomState; myId: string | null };

function Resolved({ room, myId }: Props) {
  const [error,          setError]          = useState<string | null>(null);
  const [busy,           setBusy]           = useState(false);
  const [tauntMsg,       setTauntMsg]       = useState('');
  const [tauntBusy,      setTauntBusy]      = useState(false);
  const [tauntError,     setTauntError]     = useState<string | null>(null);
  const [tauntDismissed, setTauntDismissed] = useState(false);
  const soundedRef = useRef(false);
  const boardRef   = useRef<HTMLDivElement>(null);

  if (!room.resolution || !room.words) return null;

  const { resolution } = room;
  const me          = room.players.find(p => p.id === myId);
  const myTeam      = me?.team ?? null;
  const iWon        = myTeam !== null && myTeam === resolution.winner;
  const isLoser     = myTeam !== null && !iWon;
  const isHost      = myId === room.host;
  const hostName    = room.players.find(p => p.id === room.host)?.name ?? 'the host';
  const resultClass = myTeam === null ? 'neutral' : iWon ? 'win' : 'lose';

  const redName    = room.teamNames.red;
  const blueName   = room.teamNames.blue;
  const winnerName = resolution.winner === 'red' ? redName : blueName;
  const loserName  = resolution.winner === 'red' ? blueName : redName;

  const teamDisplayLabel = (team: Team) => (team === 'red' ? redName : blueName);

  const targets = resolution.targets;
  const guesses = resolution.guesses;
  const hint    = resolution.hint;
  const correctCount =
    targets && guesses ? guesses.filter(g => targets.includes(g)).length : null;

  useEffect(() => {
    if (soundedRef.current) return;
    soundedRef.current = true;
    if (myTeam === null) return;
    if (iWon) playSound('win');
    else      playSound('lose');
  }, []);

  useEffect(() => {
    if (!room.taunt) return;
    setTauntDismissed(false);
    playSound('taunt');
    if (isLoser) vibrate([100, 60, 150, 60, 250, 80, 300]);
  }, [room.taunt?.fromId]);

  const playAgain = () => {
    setBusy(true); setError(null);
    socket.emit('play-again', {}, (res: AckResponse) => {
      setBusy(false);
      if (!res.ok) setError(res.error);
    });
  };

  const sendTaunt = () => {
    if (!tauntMsg.trim()) return;
    setTauntBusy(true); setTauntError(null);
    socket.emit('send-taunt', { message: tauntMsg.trim() }, (res: AckResponse) => {
      setTauntBusy(false);
      if (!res.ok) setTauntError(res.error);
      else setTauntDismissed(true);
    });
  };

  const copyCode = () => navigator.clipboard.writeText(room.code).catch(() => {});

  return (
    <>
      <div className="fs-panel fs-panel--resolved">
        <div className="fs-top-bar">
          <div className="fs-top-bar-left">
            <span className="fs-phase-label">Result</span>
            <button className="fs-room-tag" onClick={copyCode} title="Copy room code">{room.code}</button>
          </div>
        </div>

        <TeamClocks room={room} />

        <div className="fs-panel-body">
          <div className={'result-fs-card ' + resultClass}>
            <p className="result-fs-outcome">
              {myTeam ? (iWon ? 'You win!' : 'You lose') : 'Round result'}
            </p>
            <h2 className={'result-fs-winner ' + resolution.winner}>
              {teamDisplayLabel(resolution.winner)}
              <br />
              <span style={{ fontSize: '0.5em', letterSpacing: '0.1em', textTransform: 'uppercase' }}>wins</span>
            </h2>

            {resolution.reason === 'timeout' ? (
              <p className="result-fs-summary">
                <strong>{teamDisplayLabel(resolution.timedOutTeam)}</strong> ran out of time.
                {hint && (
                  <> Hint was <span className="result-hint-chip">{hint.toUpperCase()}</span>
                    {resolution.bidCount !== null && <> for <strong>{resolution.bidCount}</strong></>}.</>
                )}
              </p>
            ) : (
              <p className="result-fs-summary">
                {teamDisplayLabel(resolution.performerTeam)} got{' '}
                <strong>{correctCount}</strong> / <strong>{resolution.bidCount}</strong> on hint{' '}
                <span className="result-hint-chip">{resolution.hint.toUpperCase()}</span>
              </p>
            )}
          </div>

          {iWon && !room.taunt && (
            <div className="taunt-composer">
              <p className="taunt-composer-label">Send a victory message to {loserName}</p>
              <textarea
                className="taunt-input"
                value={tauntMsg}
                onChange={e => setTauntMsg(e.target.value)}
                placeholder="Talk your sh*t..."
                maxLength={160}
                rows={3}
              />
              <button
                className="btn btn-taunt btn-full"
                onClick={sendTaunt}
                disabled={tauntBusy || !tauntMsg.trim()}
              >
                {tauntBusy ? 'Sending...' : 'SEND IT'}
              </button>
              {tauntError && <p className="error-msg" role="alert">{tauntError}</p>}
            </div>
          )}

          {iWon && room.taunt && (
            <div className="taunt-sent-confirm">
              Message delivered — {loserName} has been notified
            </div>
          )}

          <div style={{ textAlign: 'center' }}>
            {isHost ? (
              <>
                <button
                  className="btn btn-primary"
                  onClick={playAgain}
                  disabled={busy}
                  style={{ width: '100%', padding: '1rem', fontSize: '1rem', fontWeight: 800, letterSpacing: '0.06em' }}
                >
                  Play Again
                </button>
                <p className="info-line" style={{ marginTop: '0.5rem' }}>
                  Same teams. Captains and board re-rolled.
                </p>
              </>
            ) : (
              <p className="info-line">
                Waiting for <strong>{hostName}</strong> to start the next round...
              </p>
            )}
          </div>

          {error && <p className="error-msg" role="alert">{error}</p>}

          <div className="fs-board-anchor">
            <button
              className="fs-board-btn"
              onClick={() => boardRef.current?.scrollIntoView({ behavior: 'smooth' })}
            >
              View Board
            </button>
          </div>
        </div>
      </div>

      <div className="fs-panel fs-panel--board" ref={boardRef}>
        <div className="fs-top-bar">
          <span className="fs-phase-label">
            {targets ? 'Board — Revealed' : 'Board'}
          </span>
          {targets && (
            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.72rem', fontWeight: 700 }}>
              <span style={{ color: 'var(--correct)' }}>Correct</span>
              <span style={{ color: 'var(--wrong)' }}>Wrong</span>
              <span style={{ color: 'var(--missed)' }}>Missed</span>
            </div>
          )}
        </div>
        <div className="fs-panel-body">
          <Board
            words={room.words}
            reveal={targets ? { targets, guesses: guesses ?? [] } : undefined}
          />
        </div>
      </div>

      {room.taunt && !tauntDismissed && (
        <div
          className={'taunt-overlay ' + (isLoser ? 'loser-side' : 'winner-side')}
          onClick={() => setTauntDismissed(true)}
        >
          <div className="taunt-inner" onClick={e => e.stopPropagation()}>
            <div className="taunt-header">
              {isLoser ? winnerName + ' says:' : 'Victory message sent'}
            </div>

            <blockquote className="taunt-message">"{room.taunt.message}"</blockquote>

            <p className="taunt-from">— {room.taunt.fromName}</p>

            <button
              className="taunt-dismiss-btn"
              onClick={() => setTauntDismissed(true)}
            >
              {isLoser ? 'cry about it' : 'absolute unit'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default Resolved;
