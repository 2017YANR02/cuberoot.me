'use client';

import { useMemo, useState } from 'react';
import { Move } from 'cubing/alg';
import { NATIVE_PUZZLES, nativePuzzleMoves, type NativePuzzleId, type NativePuzzleMoveDepth } from '@cuberoot/puzzle-solvers/native-puzzles';
import { useT } from '@/hooks/useT';

export type NativeDragDepth = 'auto' | NativePuzzleMoveDepth;

const NOTES: Record<NativePuzzleId, readonly [string, string]> = {
  superz: ['面转 90°，角转 120°；例如 R UFR F\'。', 'Face turns are 90°; corner turns are 120°. Try R UFR F\'.'],
  cube3dino: ['三阶＋恐龙：面转 90°，角转 120°；可混合外层、内层与宽转。', '3×3 + Dino: face turns are 90°; corner turns are 120°. Mix outer, inner and wide turns.'],
  dogic: ['二十色 Dogic，每步绕顶点转动 72°。', 'Twenty-color Dogic, with 72° turns around its vertices.'],
  octahedron4: ['每步绕顶点转动 90°，可以分别转动两层。', '90° vertex turns, with two independently movable layers.'],
  dinoskewb: ['外层为恐龙转，宽转为斜转；每步 120°。', 'Outer turns use the Dino cut; wide turns use the Skewb cut. Each step is 120°.'],
  lattice: ['Lattice：绕角转动 120°，支持外层、第二层与中间第三层。', 'Lattice: 120° corner turns, with outer, second and central third layers.'],
  hyperx: ['Hyper X：二阶面转 90°，大斜转角转 120°；角轴支持内层与宽转。', 'Hyper X: 90° two-half face turns and 120° Master Skewb corner turns. Inner and wide turns apply to corner axes.'],
  latticex: ['Lattice X：二阶面转 90°，Lattice 角转 120°；角轴支持三种层深。', 'Lattice X: 90° two-half face turns and 120° Lattice corner turns, with three corner-layer depths.'],
  masterbrilic: ['Master Brilic：十二面体，每步面转 72°，支持三种层深。', 'Master Brilic: a dodecahedron with 72° face turns and three layer depths.'],
  masterftov2: ['四阶 FTO v2：八面体，每步面转 120°，外切比普通四阶 FTO 更深。', 'Master FTO v2: an octahedron with 120° face turns and deeper outer cuts than the standard Master FTO.'],
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
  const spec = NATIVE_PUZZLES[id];
  const moves = useMemo(() => nativePuzzleMoves(id), [id]);
  const availableDepths = new Set(moves.map((move) => move.depth));
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
        {showDragDepth && spec.layers > 1 && (
          <label className="twisty-fallback-angle-label">
            <span>{t('拖转层', 'Drag layer')}</span>
            <select className="btn-secondary twisty-fallback-angle" aria-label={t('拖转层', 'Drag layer')} value={depth === 'auto' || availableDepths.has(depth) ? depth : 'auto'} onChange={(e) => onDepthChange(e.target.value as NativeDragDepth)}>
              <option value="auto">{t('按贴片', 'By sticker')}</option>
              <option value="outer">{t('外层', 'Outer')}</option>
              {availableDepths.has('inner') && <option value="inner">{t('第二层', 'Second layer')}</option>}
              {availableDepths.has('inner3') && <option value="inner3">{t('第三层', 'Third layer')}</option>}
              {availableDepths.has('wide') && <option value="wide">{t('两层宽转', 'Two-layer wide')}</option>}
              {availableDepths.has('wide3') && <option value="wide3">{t('三层宽转', 'Three-layer wide')}</option>}
            </select>
          </label>
        )}
      </div>
      <details className="twisty-native-notation">
        <summary>{t('记号说明', 'Notation guide')}</summary>
        {spec.order === 0 && <p>{t('R、U、F 等表示面转，UFR、DRF 等表示角转。后缀 v 表示整体转体，例如 Rv；整体转体不使用 x、y、z。', 'R, U and F name face turns; UFR and DRF name corner turns. The v suffix rotates the whole puzzle, for example Rv. Whole rotations use v instead of x, y or z.')}</p>}
        {spec.layers > 1 && ('rangeWide' in spec
          ? <p>{t('以面轴 A 为例：A 转外层，2A 只转第二层，1-2A 同时转最外两层，Av 转动整体。宽转使用层号范围，不使用 Aw。', 'For a face axis A: A turns the outer layer, 2A turns only the second layer, 1-2A turns both outer layers, and Av rotates the whole puzzle. Wide turns use a layer range, not Aw.')}</p>
          : <p>{t('对支持内层的转轴 A：A 转外层，2A 只转第二层，Aw 同时转最外两层，Av 转动整体。', 'For an axis A with inner layers: A turns the outer layer, 2A turns only the second layer, Aw turns both outer layers, and Av rotates the whole puzzle.')}</p>)}
        {spec.layers > 2 && <p>{t('3A 只转第三层；三层宽转写作 ', '3A turns only the third layer; a three-layer wide turn is written ')}{'rangeWide' in spec ? '1-3A' : '3Aw'}{t('。仅在该转轴支持时可用。', '. These apply only to axes that support the depth.')}</p>}
        <p>{t('加撇号表示逆转，加 2 表示两步。支持分组、换位子和 // 行注释。随机打乱用于练习。', 'A prime reverses the turn; 2 means two steps. Groups, commutators and // line comments are supported. Random-move scrambles are for practice.')}</p>
      </details>
    </div>
  );
}
