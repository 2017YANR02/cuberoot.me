'use client';

import { useEffect, useState } from 'react';
import MagicCube from '@cuberoot/puzzle-render-core/engine/magic/MagicCube';
import { magicStepCount, type MagicDirection, type MagicPuzzle } from '@cuberoot/puzzle-solvers/magic';
import { useT } from '@/hooks/useT';

/** Controls specific to the documented folding route; the regular player below
 * still owns the editable formula, timeline, playback speed and share URL. */
export default function MagicRouteControls({ cube, puzzle, valid, onRoute, onFold }: {
  cube: MagicCube | null;
  puzzle: MagicPuzzle;
  valid: boolean;
  onRoute(direction: MagicDirection): void;
  onFold(dir: 1 | -1): void;
}) {
  const tr = useT();
  const [, redraw] = useState(0);
  useEffect(() => {
    if (!cube) return;
    const changed = () => redraw(value => value + 1);
    cube.callbacks.push(changed);
    return () => {
      const index = cube.callbacks.indexOf(changed);
      if (index >= 0) cube.callbacks.splice(index, 1);
    };
  }, [cube]);
  const direction = cube?.state.direction ?? 'Forward';
  const busy = !cube || cube.twister.busy;
  return (
    <div className="sim-player-status" style={{ flexWrap: 'wrap' }}>
      <label>
        {tr('练习方向', 'Practice direction')}{' '}
        <select className="sim-player-mode" aria-label={tr('练习方向', 'Practice direction')} value={direction}
          onChange={event => onRoute(event.target.value as MagicDirection)}>
          <option value="Forward">{tr('正向', 'Forward')}</option>
          <option value="Backward">{tr('反向', 'Backward')}</option>
        </select>
      </label>
      <button type="button" className="sim-player-scramble" onClick={() => onRoute(direction)}>
        {tr('载入标准折法', 'Load folding route')}
      </button>
      <button type="button" className="sim-player-scramble" disabled={busy || !valid || !cube?.canFold(-1)} onClick={() => onFold(-1)}>
        {tr('退一步', 'Unfold one step')}
      </button>
      <button type="button" className="sim-player-scramble" disabled={busy || !valid || !cube?.canFold(1)} onClick={() => onFold(1)}>
        {tr('折一步', 'Fold one step')}
      </button>
      <output aria-live="polite">{cube?.state.step ?? 0} / {magicStepCount(puzzle)}{cube?.complete ? ` · ${tr('完成', 'Complete')}` : ''}</output>
      <span style={{ flexBasis: '100%' }}>
        {valid
          ? tr('标准路线练习：F 前进一步，F′ 退回一步；也可拖动活动板片。包含必要的整体翻面。', 'Guided route: F advances one step, F′ retraces it. Drag a moving tile to fold. Includes whole-puzzle flips.')
          : tr('记号无效或已越过路线端点。可载入标准折法重新开始。', 'Invalid notation or a fold beyond the route endpoints. Load the folding route to restart.')}
      </span>
    </div>
  );
}
