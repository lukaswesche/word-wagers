import { useState } from 'react';
import { socket } from './socket';
import Board from './Board';
import RoomHeader from './RoomHeader';
import TeamClocks from './TeamClocks';
import { teamLabel, type AckResponse, type RoomState } from './types';

type Props = { room: RoomState; myId: string | null };

function Performing({ room, myId }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [hint,     setHint]     = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [busy,     setBusy]     = useState(false);

  if (!room.performing || !room.words) return <p>Loading game state…</p>;

  const { performing } = room;
  const isPerformer    = performing.captainId === myId;
  const performer      = room.players.find(p => p.id === performing.captainId);
  const teamClass      = performing.team;
  const bidCount       = performing.bidCount;

  const toggle = (word: string) =>
    setSelected(prev =>
      prev.includes(word) ? prev.filter(w => w !== word) : [...prev, word],
    );

  const submit = () => {
    if (selected.length !== bidCount) { setError(`Pick exactly ${bidCount} words`); return; }
    if (!hint.trim())                 { setError('Enter a one-word hint');           return; }
    setBusy(true);
    setError(null);
    socket.emit('submit-targets-and-hint', { targets: selected, hint: hint.trim() }, (res: AckResponse) => {
      setBusy(false);
      if (!res.ok) setError(res.error);
    });
  };

  const canSubmit = selected.length === bidCount && hint.trim().length > 0;

  return (
    <section>
      <RoomHeader code={room.code} />
      <TeamClocks room={room} />

      {/* Phase banner */}
      <div className={`phase-banner team-${teamClass}`}>
        <p className={`phase-chip team-${teamClass}`}>
          Performer — {teamLabel(performing.team)} team
        </p>
        <p className="phase-title">
          {performer?.name ?? '?'}
          {!performer?.connected && <span className="player-tag" style={{ color: 'var(--red)', marginLeft: '0.4rem' }}>(offline)</span>}
          {' '}must hit{' '}
          <strong style={{ color: performing.team === 'red' ? 'var(--red)' : 'var(--blue)' }}>
            {bidCount}
          </strong>
          {' '}{bidCount === 1 ? 'word' : 'words'} with a one-word hint.
        </p>
      </div>

      {isPerformer ? (
        <div className="card mt-1">
          <p className="card-title">
            Step 1 — Pick your {bidCount} target words ({selected.length}/{bidCount})
          </p>
          <p className="card-body">
            Click words on the board below. These stay secret — only you can see them.
          </p>

          <div className="mt-1">
            <label className="form-label" htmlFor="hint-input">Step 2 — Your one-word hint</label>
            <input
              id="hint-input"
              type="text"
              className="input-field"
              value={hint}
              onChange={e => setHint(e.target.value)}
              placeholder="one word, no spaces"
              maxLength={30}
            />
          </div>

          <div className="mt-1">
            <button
              className="btn btn-primary"
              onClick={submit}
              disabled={busy || !canSubmit}
            >
              Submit hint
            </button>
          </div>
        </div>
      ) : (
        <p className="waiting-msg">
          Waiting for {performer?.name ?? '?'} to pick {bidCount} words and give a hint…
        </p>
      )}

      {error && <p className="error-msg" role="alert">{error}</p>}

      <p className="board-section-title">Board</p>
      <Board
        words={room.words}
        selectable={isPerformer}
        selected={selected}
        onToggle={toggle}
        maxSelections={bidCount}
      />
    </section>
  );
}

export default Performing;
