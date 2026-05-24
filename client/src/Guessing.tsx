import { useState } from 'react';
import { socket } from './socket';
import Board from './Board';
import RoomHeader from './RoomHeader';
import TeamClocks from './TeamClocks';
import { teamLabel, type AckResponse, type RoomState } from './types';

type Props = { room: RoomState; myId: string | null };

function Guessing({ room, myId }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy,  setBusy]  = useState(false);

  if (!room.performing || !room.guessing || !room.words || !room.performing.hint) {
    return <p>Loading game state…</p>;
  }

  const { performing, guessing } = room;
  const hint              = performing.hint as string;
  const me                = room.players.find(p => p.id === myId);
  const isOnPerformerTeam = me?.team === performing.team;
  const isPerformer       = myId === performing.captainId;
  const canGuess          = isOnPerformerTeam && !isPerformer;
  const performer         = room.players.find(p => p.id === performing.captainId);
  const teamClass         = performing.team;
  const bidCount          = performing.bidCount;
  const pendingCount      = guessing.pendingGuesses.length;
  const ready             = pendingCount === bidCount;

  const toggle = (word: string) => {
    setError(null);
    socket.emit('toggle-guess', { word }, (res: AckResponse) => {
      if (!res.ok) setError(res.error);
    });
  };

  const submit = () => {
    setBusy(true);
    setError(null);
    socket.emit('submit-guesses', {}, (res: AckResponse) => {
      setBusy(false);
      if (!res.ok) setError(res.error);
    });
  };

  return (
    <section className="game-layout">
      <div className="game-sidebar">
        <RoomHeader code={room.code} />
        <TeamClocks room={room} />

        {/* Hint display — visible to BOTH teams (public info once announced) */}
        <div className={`hint-display phase-banner team-${teamClass}`}>
          <p className="hint-super">
            Hint from {performer?.name ?? '?'} ({teamLabel(performing.team)})
          </p>
          <p className="hint-word">{hint.toUpperCase()}</p>
          <p className="hint-for">
            for <strong>{bidCount}</strong> {bidCount === 1 ? 'word' : 'words'}
          </p>
          {!isOnPerformerTeam && (
            <p className="phase-body" style={{ marginTop: '0.75rem', opacity: 0.85 }}>
              {teamLabel(performing.team)} team is guessing — {guessing.pendingGuesses.length} / {bidCount} selected so far.
            </p>
          )}
        </div>

        {/* Guesser panel */}
        <div className="card">
          {canGuess ? (
            <>
              <p className="card-title">Guess for {teamLabel(performing.team)} team</p>
              <p className="card-body">
                Click words to add/remove. Selections are shared with your team.
                Pick exactly <strong>{bidCount}</strong>, then any teammate can submit.
              </p>
              <p className="guess-counter mt-1">
                Selected: <strong>{pendingCount}</strong> / {bidCount}
              </p>
              <div className="mt-1">
                <button
                  className="btn btn-primary"
                  onClick={submit}
                  disabled={busy || !ready}
                >
                  Submit guesses
                </button>
              </div>
            </>
          ) : isPerformer ? (
            <>
              <p className="card-title">Your team is guessing…</p>
              <p className="card-body">You gave the hint — just watch.</p>
              <p className="guess-counter mt-1">
                Selected: <strong>{pendingCount}</strong> / {bidCount}
              </p>
            </>
          ) : (
            <>
              <p className="card-title">The other team is guessing</p>
              <p className="card-body">Watch what they pick.</p>
              <p className="guess-counter mt-1">
                Selected: <strong>{pendingCount}</strong> / {bidCount}
              </p>
            </>
          )}
        </div>

        {error && <p className="error-msg" role="alert">{error}</p>}
      </div>

      <div className="game-board-col">
        <p className="board-section-title">Board</p>
        <Board
          words={room.words}
          selectable={canGuess}
          selected={guessing.pendingGuesses}
          onToggle={toggle}
          maxSelections={bidCount}
        />
      </div>
    </section>
  );
}

export default Guessing;
