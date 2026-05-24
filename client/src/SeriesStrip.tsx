import type { RoomState } from './types';

type Props = { room: RoomState };

/**
 * Compact series score strip. Lives under the top bar on in-game screens so
 * both teams' running series totals are always visible.
 */
function SeriesStrip({ room }: Props) {
  const { red, blue } = room.scores;
  return (
    <div className="series-strip" role="status" aria-label="Series score">
      <span className="series-strip-team series-strip-team-red">
        <span className="series-strip-name">{room.teamNames.red}</span>
        <span className="series-strip-score">{red}</span>
      </span>
      <span className="series-strip-divider">Series</span>
      <span className="series-strip-team series-strip-team-blue">
        <span className="series-strip-score">{blue}</span>
        <span className="series-strip-name">{room.teamNames.blue}</span>
      </span>
    </div>
  );
}

export default SeriesStrip;
