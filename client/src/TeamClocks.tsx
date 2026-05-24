import { useTick } from './useTick';
import {
  TEAM_COLORS,
  formatClock,
  type RoomState,
  type Team,
  type TeamClock,
} from './types';

type Props = {
  room: RoomState;
};

/**
 * Side-by-side chess-clock display for both teams. Only one clock is running
 * at a time (the team currently on the clock). The active clock pulses;
 * paused clocks are dimmed. Color shifts at low time remaining.
 */
function TeamClocks({ room }: Props) {
  // Tick to recompute remaining ms; 250ms is smooth enough for M:SS display.
  useTick(250);

  const { teamClocks } = room;
  const redName = room.teamNames.red;
  const blueName = room.teamNames.blue;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '0.6rem',
        margin: '1rem 0 0.5rem',
      }}
    >
      <ClockCard team="red" label={redName} clock={teamClocks.red} />
      <ClockCard team="blue" label={blueName} clock={teamClocks.blue} />
    </div>
  );
}

function ClockCard({
  team,
  label,
  clock,
}: {
  team: Team;
  label: string;
  clock: TeamClock;
}) {
  const isRunning = clock.runningSince !== null;
  const remainingMs = isRunning
    ? Math.max(0, clock.remainingMs - (Date.now() - (clock.runningSince ?? 0)))
    : clock.remainingMs;

  const color = TEAM_COLORS[team];
  const lowTime = remainingMs <= 30_000;
  const criticalTime = remainingMs <= 10_000;

  const borderColor = isRunning ? color : 'var(--border)';
  const bg = isRunning ? `${color}1A` : 'var(--surface-soft)';
  const opacity = isRunning ? 1 : 0.55;

  let timeColor: string = 'var(--text)';
  if (criticalTime && isRunning) timeColor = 'var(--wrong, #f87171)';
  else if (lowTime && isRunning) timeColor = 'var(--missed, #fbbf24)';

  return (
    <div
      style={{
        padding: '0.65rem 0.85rem',
        border: `1.5px solid ${borderColor}`,
        borderRadius: '12px',
        background: bg,
        opacity,
        transition: 'opacity 200ms ease, border-color 200ms ease, background 200ms ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.5rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
        <span
          style={{
            width: '0.55rem',
            height: '0.55rem',
            borderRadius: '50%',
            background: color,
            boxShadow: isRunning ? `0 0 0 4px ${color}33` : 'none',
            flexShrink: 0,
            animation: isRunning ? 'clock-pulse 1.6s ease-in-out infinite' : undefined,
          }}
        />
        <span
          style={{
            fontSize: '0.78rem',
            fontWeight: 700,
            color: 'var(--text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
      </div>
      <span
        style={{
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 800,
          fontSize: '1.15rem',
          letterSpacing: '0.02em',
          color: timeColor,
          transition: 'color 200ms ease',
        }}
      >
        {formatClock(remainingMs)}
      </span>
    </div>
  );
}

export default TeamClocks;
