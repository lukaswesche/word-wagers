import { useEffect, useRef, useState } from 'react';
import { socket } from './socket';
import Board from './Board';
import SeriesStrip from './SeriesStrip';
import TeamClocks from './TeamClocks';
import { playSound } from './useSound';
import { teamLabel, type AckResponse, type RoomState } from './types';

type Props = { room: RoomState; myId: string | null };

function Guessing({ room, myId }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy,  setBusy]  = useState(false);
  const revealedRef = useRef(false);

  if (!room.performing || !room.guessing || !room.words || !room.performing.hint) return null;

  const { performing, guessing } = room;
  const hint              = performing.hint as string;
  const me                = room.players.find(p => p.id === myId);
  const isOnPerformerTeam = me?.team === performing.team;
  const isPerformer       = myId === performing.captainId;
  const canGuess          = isOnPerformerTeam && !isPerformer;
  const teamClass         = performing.team;
  const bidCount          = performing.bidCount;
  const pendingCount      = guessing.pendingGuesses.length;
  const ready             = pendingCount === bidCount;
  const opposingTeam      = performing.team === 'red' ? 'blue' : 'red';

  useEffect(() => {
    if (!revealedRef.current && isOnPerformerTeam) {
      revealedRef.current = true;
      playSound('hint_reveal');
    }
  }, []);

  const toggle = (word: string) => {
    const wasSelected = guessing.pendingGuesses.includes(word);
    setError(null);
    socket.emit('toggle-guess', { word }, (res: AckResponse) => {
      if (res.ok) playSound(wasSelected ? 'tile_deselect' : 'tile_pick');
      else setError(res.error);
    });
  };

  const submit = () => {
    setBusy(true); setError(null);
    socket.emit('submit-guesses', {}, (res: AckResponse) => {
      setBusy(false);
      if (res.ok) playSound('submit');
      else setError(res.error);
    });
  };

  const copyCode = () => navigator.clipboard.writeText(room.code).catch(() => {});
  const teamColor = teamClass === 'red' ? 'var(--red)' : 'var(--blue)';

  return (
    <div className="fs-panel fs-panel--guess">
      <div className="fs-top-bar">
        <div className="fs-top-bar-left">
          <span
            className="fs-phase-label"
            style={{ color: isOnPerformerTeam ? teamColor : 'var(--muted)' }}
          >
            {isOnPerformerTeam ? teamLabel(teamClass) + ' · Guessing' : teamLabel(opposingTeam) + ' watching'}
          </span>
          <button className="fs-room-tag" onClick={copyCode} title="Copy room code">{room.code}</button>
        </div>
      </div>

      <SeriesStrip room={room} />
      <TeamClocks room={room} />

      {/* HINT is visible to BOTH teams (chess-clock model) */}
      {isOnPerformerTeam ? (
        <div className="hint-banner-prominent">
          <span className="hint-banner-label">Hint</span>
          <span className="hint-banner-word">{hint.toUpperCase()}</span>
          <span className="hint-banner-for">
            for <strong>{bidCount}</strong>
          </span>
        </div>
      ) : (
        <div className="hint-banner-watching">
          <span className="hint-banner-label">Hint</span>
          <span className="hint-banner-word">{hint.toUpperCase()}</span>
          <span className="hint-banner-for">
            for <strong>{bidCount}</strong> · <strong>{teamLabel(performing.team)}</strong> is guessing ({pendingCount}/{bidCount})
          </span>
        </div>
      )}

      <div className="fs-context-strip">
        <span className="fs-context-text" style={{ fontSize: '0.9rem' }}>
          {canGuess
            ? <>Tap words to select — need exactly <strong>{bidCount}</strong></>
            : isPerformer
              ? <>You gave the hint — watch your team guess</>
              : <>Watching the other team make their picks</>}
        </span>
      </div>

      <div className="fs-board-zone">
        <Board
          words={room.words}
          selectable={canGuess}
          selected={guessing.pendingGuesses}
          onToggle={toggle}
          maxSelections={bidCount}
        />
        {error && <p className="error-msg" role="alert">{error}</p>}
      </div>

      <div className="fs-action-zone">
        <div className="fs-action-row">
          <span className="fs-action-counter fs-action-flex">
            <span className="num">{pendingCount}</span>
            {' / '}
            <strong>{bidCount}</strong>
            {' selected'}
          </span>
          {canGuess ? (
            <button
              className="fs-action-primary"
              onClick={submit}
              disabled={busy || !ready}
            >
              {ready ? 'Submit' : 'Need ' + (bidCount - pendingCount) + ' more'}
            </button>
          ) : (
            <button className="fs-action-primary" disabled>
              Watching...
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default Guessing;
