import { useState } from 'react';
import { socket } from './socket';
import Board from './Board';
import RoomHeader from './RoomHeader';
import TeamClocks from './TeamClocks';
import { playSound } from './useSound';
import { teamLabel, type AckResponse, type RoomState } from './types';

type Props = { room: RoomState; myId: string | null };

function Performing({ room, myId }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [hint,     setHint]     = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [busy,     setBusy]     = useState(false);

  if (!room.performing || !room.words) return null;

  const { performing } = room;
  const isPerformer = performing.captainId === myId;
  const performer   = room.players.find(p => p.id === performing.captainId);
  const bidCount    = performing.bidCount;
  const teamClass   = performing.team;

  const toggle = (word: string) => {
    const isSelected = selected.includes(word);
    setSelected(prev => isSelected ? prev.filter(w => w !== word) : [...prev, word]);
    playSound(isSelected ? 'tile_deselect' : 'tile_pick');
  };

  const submit = () => {
    if (selected.length !== bidCount) { setError('Pick exactly ' + bidCount + ' words'); return; }
    if (!hint.trim())                 { setError('Enter a one-word hint');                return; }
    setBusy(true); setError(null);
    socket.emit('submit-targets-and-hint', { targets: selected, hint: hint.trim() }, (res: AckResponse) => {
      setBusy(false);
      if (res.ok) playSound('submit');
      else setError(res.error);
    });
  };

  const canSubmit = selected.length === bidCount && hint.trim().length > 0;
  const copyCode  = () => navigator.clipboard.writeText(room.code).catch(() => {});
  const teamColor = teamClass === 'red' ? 'var(--red)' : 'var(--blue)';

  return (
    <div className="fs-panel fs-panel--perform">
      <div className="fs-top-bar">
        <div className="fs-top-bar-left">
          <span className="fs-phase-label" style={{ color: teamColor }}>
            {teamLabel(performing.team)} · Performing
          </span>
        </div>
      </div>

      <RoomHeader code={room.code} />
      <TeamClocks room={room} />

      <div className="fs-context-strip">
        <button className="fs-room-tag" onClick={copyCode}>{room.code}</button>
        <span className="fs-context-text">
          <strong className={'team-' + teamClass}>{performer?.name ?? '?'}</strong>
          {' '}must connect{' '}
          <strong>{bidCount}</strong>
          {' '}{bidCount === 1 ? 'word' : 'words'} with one hint
        </span>
      </div>

      <div className="fs-board-zone">
        {isPerformer ? (
          <p className="fs-board-zone-meta">
            Pick your targets — <strong>{selected.length}</strong> / {bidCount} selected
          </p>
        ) : (
          <p className="fs-board-zone-meta">
            {performer?.name ?? '?'} is choosing targets in secret...
          </p>
        )}
        <Board
          words={room.words}
          selectable={isPerformer}
          selected={selected}
          onToggle={toggle}
          maxSelections={bidCount}
        />
        {error && <p className="error-msg" role="alert">{error}</p>}
      </div>

      {isPerformer && (
        <div className="fs-action-zone">
          <div className="fs-action-row">
            <input
              type="text"
              className="fs-hint-input"
              value={hint}
              onChange={e => setHint(e.target.value)}
              placeholder="one-word hint"
              maxLength={30}
              autoComplete="off"
            />
            <button
              className="fs-action-primary"
              onClick={submit}
              disabled={busy || !canSubmit}
            >
              Submit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Performing;
