import { useCountdown } from './useCountdown';

type Props = {
  deadline: number | null;
  /** Optional label rendered before the timer (e.g., "Time left"). */
  label?: string;
};

/**
 * Reusable countdown pill. Renders nothing when there's no deadline.
 * Color shifts: normal -> warning at <=10s -> critical at <=5s.
 */
function CountdownTimer({ deadline, label = 'Time left' }: Props) {
  const remaining = useCountdown(deadline);
  if (remaining === null) return null;

  let color = 'var(--text)';
  let bg = 'rgba(255, 255, 255, 0.08)';
  let border = 'var(--border)';
  if (remaining <= 5) {
    color = '#fff';
    bg = 'rgba(248, 113, 113, 0.25)';
    border = 'rgba(248, 113, 113, 0.6)';
  } else if (remaining <= 10) {
    color = '#fff';
    bg = 'rgba(251, 191, 36, 0.22)';
    border = 'rgba(251, 191, 36, 0.55)';
  }

  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  const display = mm > 0 ? `${mm}:${ss.toString().padStart(2, '0')}` : `${ss}s`;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.4rem 0.85rem',
        borderRadius: '999px',
        background: bg,
        border: `1px solid ${border}`,
        color,
        fontWeight: 700,
        fontSize: '0.95rem',
        fontVariantNumeric: 'tabular-nums',
        transition: 'background 200ms ease, border-color 200ms ease',
      }}
      role="timer"
      aria-live="polite"
    >
      <span style={{ fontSize: '0.7rem', fontWeight: 600, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </span>
      <span>{display}</span>
    </div>
  );
}

export default CountdownTimer;
