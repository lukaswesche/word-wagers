import { useState } from 'react';
import { socket } from './socket';
import Board from './Board';
import SeriesStrip from './SeriesStrip';
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

  const MAX_HINT_WORDS = 25;
  const trimmedHint = hint.trim().replace(/\s+/g, ' ');
  const hintWordCount = trimmedHint ? trimmedHint.split(' ').length : 0;
  const hintOverLimit = hintWordCount > MAX_HINT_WORDS;

  const toggle = (word: string) => {
    const isSelected = selected.includes(word);
    setSelected(prev => isSelected ? prev.filter(w => w !== word) : [...prev, word]);
    playSound(isSelected ? 'tile_deselect' : 'tile_pick');
  };

  const submit = () => {
    if (selected.length !== bidCount) { setError('Pick exactly ' + bidCount + ' words'); return; }
    if (!trimmedHint)                 { setError('Enter a hint');                         return; }
    if (hintOverLimit)                { setError('Hint must be at most ' + MAX_HINT_WORDS + ' words'); return; }
    setBusy(true); setError(null);
    socket.emit('submit-targets-and-hint', { targets: selected, hint: trimmedHint }, (res: AckResponse) => {
      setBusy(false);
      if (res.ok) playSound('submit');
      else setError(res.error);
    });
  };

  const canSubmit = selected.length === bidCount && trimmedHint.length > 0 && !hintOverLimit;
  const copyCode  = () => navigator.clipboard.writeText(room.code).catch(() => {});
  const teamColor = teamClass === 'red' ? 'var(--red)' : 'var(--blue)';

  return (
    <div className="fs-panel fs-panel--perform">
      <div className="fs-top-bar">
        <div className="fs-top-bar-left">
          <span className="fs-phase-label" style={{ color: teamColor }}>
            {teamLabel(performing.team)} · Performing
          </span>
          <button className="fs-room-tag" onClick={copyCode} title="Copy room code">{room.code}</button>
        </div>
      </div>

      <SeriesStrip room={room} />
      <TeamClocks room={room} />

      <div className="fs-context-strip">
        <span className="fs-context-text">
          <strong className={'team-' + teamClass}>{performer?.name ?? '?'}</strong>
          {' '}must connect{' '}
          <strong>{bidCount}</strong>
          {' '}{bidCount === 1 ? 'word' : 'words'} with a hint
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
              placeholder="your hint"
              maxLength={200}
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
          <p className={'fs-hint-counter' + (hintOverLimit ? ' over' : '')}>
            {hintWordCount} / {MAX_HINT_WORDS} words
          </p>
        </div>
      )}
    </div>
  );
}

export default Performing;
