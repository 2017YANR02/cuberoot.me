import { useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import { VisualCube } from '@/components/VisualCube';
import { tr, T } from '@/i18n/tr';
import type { NonstandardIntroScene } from '../data/nonstandard-intro';
import type { LocalizedText } from '../data/chapters';
import { f2lDiagramFacelets } from '../lib/cube-preview';

export default function NonstandardSummary({ states, orientation, caption }: {
  states: NonNullable<NonstandardIntroScene['comparisonSummary']>; orientation: string; caption: LocalizedText;
}) {
  const rows = useMemo(() => [
    { label: { zh: '标态 T', en: 'Standard T' }, adjustment: false, setups: [states.standard, states.paired, ''] },
    { label: { zh: '非标 T', en: 'Non-standard T' }, adjustment: true, setups: [states.nonstandard, states.unaligned, ''] },
  ].map(row => ({ ...row, diagrams: row.setups.map(setup => f2lDiagramFacelets(setup, orientation)) })), [states, orientation]);
  return <div className="f2l-treatment-summary" role="group" aria-label={tr({ zh: '转化路径总结', en: 'Transformation paths: summary' })}>
    <div className="f2l-treatment-paths">{rows.map(row => <div className="f2l-treatment-path" key={row.label.en}>
      <figure>
        <VisualCube local view="iso" size={104} faceletColors={row.diagrams[0]} alt={tr(row.label)} />
        <figcaption>{tr(row.label)}</figcaption>
      </figure>
      <div className="f2l-treatment-link"><span><T zh="前段转化" en="Transform" /></span><ArrowRight aria-hidden="true" /></div>
      <figure>
        <VisualCube local view="iso" size={104} faceletColors={row.diagrams[1]} alt={tr(row.adjustment ? { zh: 'A+，待顶面调整', en: 'A+, before U-layer alignment' } : { zh: 'A+', en: 'A+' })} />
        <figcaption>A+{row.adjustment && <small><T zh="待对位" en="To align" /></small>}</figcaption>
      </figure>
      <div className="f2l-treatment-link" data-adjustment={row.adjustment}>
        {row.adjustment && <strong><T zh="U' 调整" en="U' adjustment" /></strong>}
        <ArrowRight aria-hidden="true" /><span><T zh="三步复原" en="Three-move finish" /></span>
      </div>
      <figure>
        <VisualCube local view="iso" size={104} faceletColors={row.diagrams[2]} alt={tr({ zh: '目标棱角已还原', en: 'Target pair solved' })} />
        <figcaption><T zh="复原" en="Solved" /></figcaption>
      </figure>
    </div>)}</div>
    <p>{tr(caption)}</p>
  </div>;
}
