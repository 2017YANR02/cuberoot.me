'use client';

import { useMemo, useState } from 'react';
import { FM_REGULAR, FM_IGNORED } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { VisualCube } from '@/components/VisualCube';
import { tr } from '@/i18n/tr';
import { f2lDiagramFacelets } from '../lib/cube-preview';

const slotStickers = [12, 15, 23, 26, 29]; // R3, R6, F5, F8, D2

export default function TerminologySummary({ orientation }: { orientation: string }) {
  const [active, setActive] = useState<number | null>(null);
  const diagrams = useMemo(() => {
    const slot = [...f2lDiagramFacelets('', orientation)].map((color, index) => slotStickers.includes(index) ? 'd' : color).join('');
    return [
      f2lDiagramFacelets('', orientation, initial => initial === 20 || initial === 23 ? FM_REGULAR : FM_IGNORED),
      slot,
      f2lDiagramFacelets("R U R'", orientation),
    ];
  }, [orientation]);
  const terms = [
    { title: { zh: '一组棱角', en: 'Pair' }, subtitle: 'pair',
      description: { zh: '一个角块和与它对应的棱块', en: 'A corner and its matching edge' },
      alt: { zh: '高亮显示一组对应的棱角', en: 'One matching corner and edge highlighted' } },
    { title: { zh: '槽', en: 'Slot' }, subtitle: 'slot',
      description: { zh: '底层角位与它上方的棱位；棱角归位的槽就是目标槽', en: 'A bottom-layer corner position and the edge position above it. Where a pair belongs is its target slot.' },
      alt: { zh: '描边标出右前槽的角位和棱位', en: 'The corner and edge positions of the front-right slot outlined' } },
    { title: { zh: '基态', en: 'Standard case' }, subtitle: 'standard case',
      description: { zh: '目标棱角都在顶层或自己的目标槽内', en: 'Both target pieces are in the top layer or their own target slot' },
      alt: { zh: '基态示例：目标棱角都在顶层', en: 'Standard case example: both target pieces in the top layer' } },
  ];
  return <div className="f2l-terminology-triangle" data-active-term={active ?? ''}
    onPointerLeave={event => { if (event.pointerType === 'mouse') setActive(null); }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setActive(null); }}>
    {terms.map((term, index) => <div key={term.subtitle} className="f2l-terminology-term" data-active={active === index}
      onPointerEnter={event => { if (event.pointerType === 'mouse') setActive(index); }}>
      <button type="button" className="f2l-terminology-thumbnail" aria-label={tr(term.alt)} aria-pressed={active === index}
        onFocus={event => { if (event.currentTarget.matches(':focus-visible')) setActive(index); }}
        onClick={() => setActive(current => current === index ? null : index)}>
        <VisualCube local view="iso" size={180} faceletColors={diagrams[index]}
          outlinedFacelets={index === 1 ? slotStickers : undefined} alt={tr(term.alt)} />
      </button>
      <h3>{tr(term.title)}</h3>
    </div>)}
    <div className="f2l-terminology-description" aria-live="polite">
      {terms.map((term, index) => <p key={term.subtitle} data-visible={active === index} aria-hidden={active !== index}>{tr(term.description)}</p>)}
    </div>
  </div>;
}
