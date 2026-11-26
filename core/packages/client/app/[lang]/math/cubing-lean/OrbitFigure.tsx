'use client';

import { useState } from 'react';
import { Rotate3D } from '@app-foundation/icons/lucide';
import { VisualCube } from '@/components/VisualCube';
import { useT } from '@/hooks/useT';
import s from './research.module.css';

// The four screen coordinates of `wire` in Representatives.lean, converted to
// zero-based (column, row). Transposition gives the other off-diagonal orbit.
const slots = [[2, 1], [4, 2], [3, 4], [1, 3]];
const faces = ['top', 'side', 'front', 'top', 'side', 'front'];
const colours = [false, true].map(mirror => faces.flatMap(face =>
  Array.from({ length: 36 }, (_, index) => {
    const selected = slots.some(([x, y]) => (mirror ? x * 6 + y : y * 6 + x) === index);
    return selected ? 'var(--orbit-mark)' : `var(--orbit-${face})`;
  })));
const projection = { cubeColor: 'var(--orbit-grid)' };

export default function OrbitFigure() {
  const t = useT();
  const [orbit, setOrbit] = useState(0);
  return <figure className={s.figure}>
    <div className={s.figureHead}>
      <span className={s.figureTitle}>{t('中心贴纸轨道', 'Centre sticker orbits')}</span>
      <span className={s.mono}>6 × 6 × 6</span>
    </div>
    <div className={s.specimen}>
      <VisualCube local interactive puzzleSize={6} view="iso" size={246} stickerColors={colours[orbit]}
        projection={projection} alt={t(`六阶魔方，轨道 ${orbit ? 'B' : 'A'} 的每面四枚贴纸已高亮`, `Six-layer cube with four stickers highlighted on each face of orbit ${orbit ? 'B' : 'A'}`)} />
    </div>
    <figcaption className={s.figureFoot}>
      <span><i className={s.dot} />{t('每面 4 枚，共 24 枚', '4 per face, 24 in all')}</span>
      <div className={s.orbits} role="group" aria-label={t('选择中心轨道', 'Select centre orbit')}>
        {['A', 'B'].map((letter,i) => <button key={letter} className={s.orbitButton} type="button" aria-pressed={orbit === i}
          aria-label={t(`轨道 ${letter}`, `Orbit ${letter}`)} onClick={() => setOrbit(i)}>{letter}</button>)}
      </div>
    </figcaption>
    <span className={s.rotateHint} aria-hidden="true"><Rotate3D size={14} />{t('拖动旋转', 'Drag to rotate')}</span>
  </figure>;
}
