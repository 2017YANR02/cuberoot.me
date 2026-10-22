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
  quadx: ['Quad-X：每步棱转 180°，支持外层、内层和宽转；当前仅支持保形转动，不含 jumbling。', 'Quad-X: 180° edge turns with outer, inner and wide layers. Currently supports shape-preserving turns only, without jumbling.'],
  dinoocta: ['恐龙八面体：每步面转 120°，支持外层、第二层与两层宽转。', 'Dino Octa: 120° face turns, with outer, second-layer and two-layer wide turns.'],
  fto5: ['五阶 FTO：每步面转 120°，支持外层、第二层、第三层和宽转。', '5-layer FTO: 120° face turns, with outer, second, third and wide layers.'],
  fto6: ['六阶 FTO：每步面转 120°，支持外层、第二层、第三层和宽转。', '6-layer FTO: 120° face turns, with outer, second, third and wide layers.'],
  eto: ['ETO 棱转八面体：每步棱转 180°，采用保形标准转动，不含 jumbling。', "Eitan's ETO: 180° edge turns using the standard moves that preserve the octahedral shape, without jumbling."],
  radiocrystal: ['Radio Crystal：二十面体，每步面转 120°，采用保形标准转动，不含 jumbling。', 'Radio Crystal: an icosahedron with 120° face turns using the standard moves that preserve its shape, without jumbling.'],
  cube3skewb: ['三阶＋斜转：面转 90°，角转 120°，两种切割可以混合转动。', '3×3 + Skewb: combine 90° face turns with 120° corner turns.'],
  heliskewb: ['直升机斜转：角转 120°，棱转 180°；当前支持保形标准转动，不含 jumbling。', 'Helicopter Skewb: combine 120° corner turns with 180° edge turns. The current standard moves preserve the cube shape, without jumbling.'],
  comboctahedron: ['Comboctahedron：面转 120°，顶点转 90°；顶点轴支持外层、第二层、第三层和宽转。', 'Comboctahedron: face turns are 120° and vertex turns are 90°. Vertex axes support outer, second, third and wide layers.'],
  circoradiolarian: ['Circo-Radiolarian：二十面体，每步面转 120°；当前支持保形标准转动，不含 jumbling。', 'Circo-Radiolarian: an icosahedron with 120° face turns. The current standard moves preserve its shape, without jumbling.'],
  icosababyface: ['深切角转二十面体：每步绕顶点转动 72°，二十个面各保留一个可见色块。', 'Deep-Cut Icosahedron: 72° vertex turns, with one visible colored region on each of its twenty faces.'],
  cube2heli: ['二阶＋直升机：面转 90°，棱转 180°；第二层与宽转仅用于棱轴。当前仅支持保形转动，不含 jumbling。', '2×2 + Helicopter: 90° face turns and 180° edge turns. Inner and wide turns apply only to edge axes. Supports shape-preserving turns only, without jumbling.'],
  cube3heli: ['三阶＋直升机：面转 90°，棱转 180°，支持外层、第二层与宽转；当前仅支持保形转动，不含 jumbling。', '3×3 + Helicopter: 90° face turns and 180° edge turns, with outer, second and wide layers. Supports shape-preserving turns only, without jumbling.'],
  radiojewel: ['Radio Jewel（Radiolarian 7）：二十面体，每面十五个三角形和一个六边形，每步面转 120°，支持外层、第二层与宽转；当前仅支持保形转动，不含 jumbling。', 'Radio Jewel (Radiolarian 7): an icosahedron with fifteen triangles and one hexagon per face. Turns are 120°, with outer, second and wide layers. Supports shape-preserving turns only, without jumbling.'],
  radioweb: ['Radio Web（Radiolarian 6）：二十面体，每步面转 120°，支持外层、第二层与宽转。每面保留 22 个色块，包括细小翼块；当前仅支持保形转动，不含 jumbling。', 'Radio Web (Radiolarian 6): an icosahedron with 120° face turns and outer, second and wide layers. Each face retains 22 stickers, including the small wings. Supports shape-preserving turns only, without jumbling.'],
  radiojam: ['Radio Jam（Radiolarian 8）：深切面转二十面体，每步 120°，支持外层、第二层与宽转。每面保留 22 个色块，包括细小三角块；当前仅支持保形转动，不含 jumbling。', 'Radio Jam (Radiolarian 8): a deep-cut face-turning icosahedron with 120° outer, second and wide turns. Each face retains 22 stickers, including small triangles. Supports shape-preserving turns only, without jumbling.'],
  catscradle: ['Cat’s Cradle（Radiolarian 5）：二十面体，每面十五个三角形、三个四边形和一个六边形，每步面转 120°，支持外层、第二层与宽转；当前仅支持保形转动，不含 jumbling。', 'Cat’s Cradle (Radiolarian 5): an icosahedron with fifteen triangles, three quadrilaterals and one hexagon per face. Turns are 120°, with outer, second and wide layers. Supports shape-preserving turns only, without jumbling.'],
  radiocanon: ['Radio Canon（Radiolarian 1.5）：中心固定的二十面体，每面七个三角形和九个四边形，每步面转 120°，支持外层、第二层与宽转；当前仅支持保形转动，不含 jumbling。', 'Radio Canon (Radiolarian 1.5): an icosahedron with fixed centers, seven triangles and nine quadrilaterals per face. Turns are 120°, with outer, second and wide layers. Supports shape-preserving turns only, without jumbling.'],
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
  const mixedOrders = new Set(moves.map((move) => move.order)).size > 1;
  const rangeWide = moves.some(({ move, depth }) => depth.startsWith('wide') && move.includes('-'));
  const suffixWide = moves.some(({ move, depth }) => depth.startsWith('wide') && move.endsWith('w'));
  const [selected, setSelected] = useState('');
  const [amount, setAmount] = useState(1);
  const current = moves.find((move) => move.move === selected) ?? moves[0];
  const powers = [1, -1, 2, -2].filter((power) => power % current.order !== 0);
  // A previous puzzle's double turn must not become an identity on a half-turn axis.
  const turnAmount = powers.includes(amount) ? amount : amount < 0 ? -1 : 1;
  const token = new Move(current.move).modified({ amount: turnAmount }).toString();
  return (
    <div className="twisty-native-controls">
      {/* Keep these native form controls on their shared CSS radii. The global
          corner surface decorator must not repaint the measured control strip. */}
      <div className="twisty-fallback-controls" data-corner-shape="native" role="group" aria-label={t('手动转动', 'Manual turns')}>
        <label className="twisty-fallback-angle-label">
          <span>{t('转轴', 'Move')}</span>
          <select className="btn-secondary twisty-fallback-angle" aria-label={t('转动记号', 'Move notation')} value={current.move} onChange={(e) => setSelected(e.target.value)}>
            {moves.map(({ move, label }) => <option key={move} value={move}>{label}</option>)}
          </select>
        </label>
        <label className="twisty-fallback-angle-label">
          <span>{t('角度', 'Angle')}</span>
          <select className="btn-secondary twisty-fallback-angle" aria-label={t('转动角度', 'Turn angle')} value={turnAmount} onChange={(e) => setAmount(Number(e.target.value))}>
            {powers.map((power) => <option key={power} value={power}>{power * 360 / current.order}°</option>)}
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
        <p className="twisty-fallback-notice">{t(...NOTES[id])}</p>
        {mixedOrders && <p>{t('不同转轴使用不同的基本转角，以“角度”选项为准。转轴名称与手动转动列表一致，后缀 v 表示绕该轴整体转体。', 'Different axes use different base angles, as shown in the Angle options. Axis names match the manual-turn list; the v suffix rotates the whole puzzle around that axis.')}</p>}
        {rangeWide && <p>{t('对列表中使用层号范围的转轴 A：A 转外层，2A 只转第二层，1-2A 同时转最外两层，Av 转动整体。', 'For an axis A that uses layer ranges in the move list: A turns the outer layer, 2A turns only the second layer, 1-2A turns both outer layers, and Av rotates the whole puzzle.')}</p>}
        {suffixWide && <p>{t('对列表中使用 w 的转轴 A：A 转外层，2A 只转第二层，Aw 同时转最外两层，Av 转动整体。', 'For an axis A that uses w in the move list: A turns the outer layer, 2A turns only the second layer, Aw turns both outer layers, and Av rotates the whole puzzle.')}</p>}
        {spec.layers > 2 && <p>{t('3A 只转第三层；三层宽转写作 ', '3A turns only the third layer; a three-layer wide turn is written ')}{[...(rangeWide ? ['1-3A'] : []), ...(suffixWide ? ['3Aw'] : [])].join(t(' 或 ', ' or '))}{t('。仅在该转轴支持时可用。', '. These apply only to axes that support the depth.')}</p>}
        <p>{spec.order === 2
          ? t('加撇号改变转动方向；同一招式连续转动两次回到原状态。支持分组、换位子和 // 行注释。随机打乱用于练习。', 'A prime reverses the turn direction; two identical turns return to the original state. Groups, commutators and // line comments are supported. Random-move scrambles are for practice.')
          : t('加撇号表示逆转，加 2 表示两步。支持分组、换位子和 // 行注释。随机打乱用于练习。', 'A prime reverses the turn; 2 means two steps. Groups, commutators and // line comments are supported. Random-move scrambles are for practice.')}</p>
      </details>
    </div>
  );
}
