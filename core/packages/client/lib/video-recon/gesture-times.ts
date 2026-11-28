import turnGeometry from './pose-fitter/tables/render-turns.json';
import type { MeasuredCubeFrame } from './engine/projected-cube';
import type { MoveStep } from './engine/move-search-types';

const geometry: Record<string, { axis: number; angles: number[] }> = turnGeometry;

/** Extend a state-change timestamp only through neighboring measured frames showing the same moving layer. */
export function measuredGestureTimes(steps: readonly MoveStep[], rows: readonly MeasuredCubeFrame[], start: number, clockFps: number) {
  const frames = new Map(rows.map((row, i) => [row.frame, i]));
  const commits = steps.filter(s => s.state_moves.length);
  const times = new Map<number, { start: number; end: number }>();
  for (let i = 0; i < commits.length; i++) {
    const step = commits[i], center = frames.get(step.frame_index);
    if (center === undefined) continue;
    const turns = step.state_moves.map(m => geometry[m.replaceAll('’', "'").replace(/2'$/, '2')]).filter(Boolean);
    const moving = (row: MeasuredCubeFrame) => turns.some(turn => turn.axis === row.pose.axis
      && turn.angles.some((angle, layer) => angle !== 0 && Math.abs(row.pose.angles[layer] % 90) > 5
        && Math.abs(row.pose.angles[layer] % 90) < 85));
    let first = center, last = center;
    const previous = commits[i - 1]?.frame_index ?? -Infinity, next = commits[i + 1]?.frame_index ?? Infinity;
    const maxGap = Math.max(.06, 2 / clockFps);
    while (first > 0 && rows[first - 1].frame > previous && rows[first].timestamp - rows[first - 1].timestamp <= maxGap && moving(rows[first - 1])) first--;
    while (last + 1 < rows.length && rows[last + 1].frame < next && rows[last + 1].timestamp - rows[last].timestamp <= maxGap && moving(rows[last + 1])) last++;
    const key = Math.round(Math.max(0, rows[center].timestamp - start) * 1000);
    times.set(key, { start: rows[first].timestamp, end: rows[last].timestamp });
  }
  return times;
}
