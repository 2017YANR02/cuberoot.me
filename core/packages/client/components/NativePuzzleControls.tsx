'use client';

import { useMemo, useState } from 'react';
import { Move } from 'cubing/alg';
import { nativePuzzleMoves, type NativePuzzleId } from '@cuberoot/puzzle-solvers/native-puzzles';
import { useT } from '@/hooks/useT';

export type NativeDragDepth = 'auto' | 'outer' | 'inner' | 'wide';

const NOTES: Record<NativePuzzleId, readonly [string, string]> = {
  superz: ['面转 90°，角转 120°；例如 R UFR F\'。', 'Face turns are 90°; corner turns are 120°. Try R UFR F\'.'],
  dogic: ['二十色 Dogic，每步绕顶点转动 72°。', 'Twenty-color Dogic, with 72° turns around its vertices.'],
  octahedron4: ['每步绕顶点转动 90°，可以分别转动两层。', '90° vertex turns, with two independently movable layers.'],
  dinoskewb: ['外层为恐龙转，宽转为斜转；每步 120°。', 'Outer turns use the Dino cut; wide turns use the Skewb cut. Each step is 120°.'],
};

/** The same native tokens drive 3D gestures, accessible manual input and 2D. */
export default function NativePuzzleControls({ id, disabled, showDragDepth, depth, onDepthChange, onMove }: {
  id: NativePuzzleId;
  disabled: boolean;
  showDragDepth: boolean;
  depth: NativeDragDepth;
  onDepthChange: (depth: NativeDragDepth) => void;
  onMove: (move: string) => void;
}) {
  const t = useT();
  const moves = useMemo(() => nativePuzzleMoves(id), [id]);
  const [selected, setSelected] = useState('');
  const [amount, setAmount] = useState(1);
  const current = moves.find((move) => move.move === selected) ?? moves[0];
  const token = new Move(current.move).modified({ amount }).toString();
  return (
    <div className="twisty-native-controls">
      <p className="twisty-fallback-notice">{t(...NOTES[id])}</p>
      <div className="twisty-fallback-controls" role="group" aria-label={t('手动转动', 'Manual turns')}>
        <label className="twisty-fallback-angle-label">
          <span>{t('转轴', 'Move')}</span>
          <select className="btn-secondary twisty-fallback-angle" aria-label={t('转动记号', 'Move notation')} value={current.move} onChange={(e) => setSelected(e.target.value)}>
            {moves.map(({ move, label }) => <option key={move} value={move}>{label}</option>)}
          </select>
        </label>
        <label className="twisty-fallback-angle-label">
          <span>{t('角度', 'Angle')}</span>
          <select className="btn-secondary twisty-fallback-angle" aria-label={t('转动角度', 'Turn angle')} value={amount} onChange={(e) => setAmount(Number(e.target.value))}>
            {[1, -1, 2, -2].map((power) => <option key={power} value={power}>{power * 360 / current.order}°</option>)}
          </select>
        </label>
        <button className="btn-secondary twisty-fallback-move" type="button" disabled={disabled} onClick={() => onMove(token)}>
          {t('转动', 'Turn')} {token}
        </button>
        {showDragDepth && id !== 'superz' && (
          <label className="twisty-fallback-angle-label">
            <span>{t('拖转层', 'Drag layer')}</span>
            <select className="btn-secondary twisty-fallback-angle" aria-label={t('拖转层', 'Drag layer')} value={depth} onChange={(e) => onDepthChange(e.target.value as NativeDragDepth)}>
              <option value="auto">{t('按贴片', 'By sticker')}</option>
              <option value="outer">{t('外层', 'Outer')}</option>
              <option value="inner">{t('第二层', 'Second layer')}</option>
              <option value="wide">{t('两层宽转', 'Two-layer wide')}</option>
            </select>
          </label>
        )}
      </div>
      <details className="twisty-native-notation">
        <summary>{t('记号说明', 'Notation guide')}</summary>
        <p>{id === 'superz'
          ? t('R、U、F 等表示面转，UFR、DRF 等表示角转。后缀 v 表示整体转体，例如 Rv；整体转体不使用 x、y、z。', 'R, U and F name face turns; UFR and DRF name corner turns. The v suffix rotates the whole puzzle, for example Rv. Whole rotations use v instead of x, y or z.')
          : t('以任一转轴 A 为例：A 转外层，2A 只转第二层，Aw 同时转最外两层，Av 转动整体。', 'For any move family A: A turns the outer layer, 2A turns only the second layer, Aw turns both outer layers, and Av rotates the whole puzzle.')}</p>
        <p>{t('加撇号表示逆转，加 2 表示两步。支持分组、交换子和 // 行注释。随机打乱用于练习。', 'A prime reverses the turn; 2 means two steps. Groups, commutators and // line comments are supported. Random-move scrambles are for practice.')}</p>
      </details>
    </div>
  );
}
