type RevealState = { targets: string[]; guesses: string[] };

type Props = {
  words: string[];
  selectable?: boolean;
  selected?: string[];
  onToggle?: (word: string) => void;
  maxSelections?: number;
  reveal?: RevealState;
};

/**
 * Pick a `font-size` scale (relative to the tile's base 1em) based on the
 * longest token in the displayed word. Keeps words on a single line by
 * shrinking longer ones instead of wrapping.
 */
function fitScale(display: string): number {
  const longest = display.split(' ').reduce((m, t) => Math.max(m, t.length), 0);
  if (longest <= 7)  return 1;
  if (longest <= 8)  return 0.92;
  if (longest <= 9)  return 0.85;
  if (longest <= 10) return 0.78;
  if (longest <= 11) return 0.72;
  if (longest <= 12) return 0.66;
  if (longest <= 13) return 0.6;
  return 0.55;
}

function Board({
  words,
  selectable = false,
  selected = [],
  onToggle,
  maxSelections,
  reveal,
}: Props) {
  const selectedSet = new Set(selected);
  const targetSet = new Set(reveal?.targets ?? []);
  const guessSet  = new Set(reveal?.guesses  ?? []);
  const atMax = maxSelections !== undefined && selected.length >= maxSelections;

  return (
    <div className="board">
      {words.map((word, i) => {
        const display = word.replace(/_/g, ' ');
        const wordStyle = { fontSize: `${fitScale(display)}em` };
        if (reveal) {
          const isTarget = targetSet.has(word);
          const isGuess  = guessSet.has(word);
          let stateClass = 'r-neutral';
          let badge: string | null = null;
          if (isTarget && isGuess)  { stateClass = 'r-correct'; badge = 'CORRECT'; }
          else if (!isTarget && isGuess) { stateClass = 'r-wrong';   badge = 'WRONG'; }
          else if (isTarget && !isGuess) { stateClass = 'r-missed';  badge = 'MISSED'; }

          return (
            <div key={`${i}-${word}`} className={`board-tile ${stateClass}`}>
              <span className="board-tile-word" style={wordStyle}>{display}</span>
              {badge && <span className="tile-badge">{badge}</span>}
            </div>
          );
        }

        const isSelected = selectedSet.has(word);
        const clickable  = selectable && (isSelected || !atMax);
        const classes = [
          'board-tile',
          selectable && clickable ? 'clickable' : '',
          selectable && !clickable && !isSelected ? 'at-max' : '',
          isSelected ? 'selected' : '',
        ].filter(Boolean).join(' ');

        return (
          <button
            key={`${i}-${word}`}
            type="button"
            className={classes}
            onClick={() => clickable && onToggle?.(word)}
            disabled={selectable && !clickable}
          >
            <span className="board-tile-word" style={wordStyle}>{display}</span>
          </button>
        );
      })}
    </div>
  );
}

export default Board;
