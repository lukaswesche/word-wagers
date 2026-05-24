type RevealState = { targets: string[]; guesses: string[] };

type Props = {
  words: string[];
  selectable?: boolean;
  selected?: string[];
  onToggle?: (word: string) => void;
  maxSelections?: number;
  reveal?: RevealState;
};

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
              <span>{word}</span>
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
            {word}
          </button>
        );
      })}
    </div>
  );
}

export default Board;
