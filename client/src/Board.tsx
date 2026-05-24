type RevealState = {
  targets: string[];
  guesses: string[];
};

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
  const guessSet = new Set(reveal?.guesses ?? []);
  const atMax = maxSelections !== undefined && selected.length >= maxSelections;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '0.5rem',
        marginTop: '1.5rem',
      }}
    >
      {words.map((word, i) => {
        if (reveal) {
          return <RevealTile key={`${i}-${word}`} word={word} isTarget={targetSet.has(word)} isGuess={guessSet.has(word)} />;
        }

        const isSelected = selectedSet.has(word);
        const clickable = selectable && (isSelected || !atMax);

        return (
          <button
            key={`${i}-${word}`}
            type="button"
            onClick={() => clickable && onToggle?.(word)}
            disabled={!clickable && selectable}
            style={{
              padding: '1rem 0.5rem',
              background: isSelected ? '#1f6f3a' : '#fff',
              color: isSelected ? '#fff' : '#111',
              border: isSelected ? '2px solid #1f6f3a' : '1px solid #ccc',
              borderRadius: '0.375rem',
              textAlign: 'center',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: '0.875rem',
              fontWeight: 500,
              letterSpacing: '0.05em',
              userSelect: 'none',
              minHeight: '2.5rem',
              cursor: selectable ? (clickable ? 'pointer' : 'not-allowed') : 'default',
              opacity: selectable && !clickable && !isSelected ? 0.5 : 1,
              transition: 'background 0.15s, border-color 0.15s',
            }}
          >
            {word}
          </button>
        );
      })}
    </div>
  );
}

function RevealTile({
  word,
  isTarget,
  isGuess,
}: {
  word: string;
  isTarget: boolean;
  isGuess: boolean;
}) {
  let background = '#fff';
  let color = '#111';
  let border = '1px solid #ddd';
  let badge: string | null = null;

  if (isTarget && isGuess) {
    background = '#1f6f3a';
    color = '#fff';
    border = '2px solid #1f6f3a';
    badge = 'CORRECT';
  } else if (!isTarget && isGuess) {
    background = '#aa2222';
    color = '#fff';
    border = '2px solid #aa2222';
    badge = 'WRONG';
  } else if (isTarget && !isGuess) {
    background = '#fff6dd';
    color = '#7a5a00';
    border = '2px dashed #c79a00';
    badge = 'MISSED';
  } else {
    color = '#999';
  }

  return (
    <div
      style={{
        padding: '0.75rem 0.5rem',
        background,
        color,
        border,
        borderRadius: '0.375rem',
        textAlign: 'center',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: '0.875rem',
        fontWeight: 500,
        letterSpacing: '0.05em',
        minHeight: '2.5rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.15rem',
      }}
    >
      <span>{word}</span>
      {badge && (
        <span
          style={{
            fontSize: '0.55rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            opacity: 0.85,
          }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

export default Board;
