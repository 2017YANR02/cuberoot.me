'use client';

import type { Solve } from '@cuberoot/shared/timer/types';
import { cfopPracticeSolveId } from './cfop-diagnosis';
import type { SlotReference } from '@cuberoot/shared/timer/reconstruct/reference';
import type { F2lSlotsResult } from '@cuberoot/shared/timer/reconstruct/f2l-slots';
import { useReconstructHost } from './ReconstructHost';

export default function CfopPairComparison({ solve, rotation, slots, references, pending, active, onSelect }: {
  solve: Solve;
  rotation?: string;
  slots: F2lSlotsResult;
  references: SlotReference[] | null;
  pending: boolean;
  active: string | null;
  onSelect: (slot: string | null) => void;
}) {
  const { localize: tr, renderPairPlayer, renderPairTraining } = useReconstructHost();
  const pair = slots.slots.find(item => item.slot === active);
  const reference = references?.find(item => item.slot === pair?.slot);
  const preview = reference?.comparison;
  return <section className="cfop-pair-comparison" aria-label={tr({ zh: 'F2L 同槽对照', en: 'Same-slot F2L comparison' })}>
    <div className="cfop-pair-toolbar"><h4>{tr({ zh: 'F2L 同槽对照', en: 'Same-slot F2L comparison' })}</h4>
    <div className="rc-actions">{slots.slots.map(item =>
      <button type="button" key={item.slot} className="rc-action rc-action--ghost" aria-pressed={item.slot === active}
        onClick={() => onSelect(item.slot === active ? null : item.slot)}>F{item.order} · {item.slot}</button>)}</div></div>
    {pair && <article key={pair.slot} data-site-surface="panel">
      <h4>F{pair.order} · {pair.slot}</h4>
      {pair.free ? <p>{tr({ zh: '十字完成时已就位。', en: 'Already in place when the cross finished.' })}</p>
        : !preview ? <p>{tr(pending ? { zh: '正在核对原局和参考路线…', en: 'Checking the recorded and reference lines…' }
          : { zh: '没有可独立核对的同槽片段。', en: 'No independently verifiable segment for this slot.' })}</p>
        : <>
          <p>{tr({ zh: `两条路线从同一局面开始，十字朝下。阶段结束时须保留十字${preview.preserved.length ? '、' + preview.preserved.join('、') : ''}。`,
            en: `Both lines start with the cross down in the same position. At the end, preserve the cross${preview.preserved.length ? ' and ' + preview.preserved.join(', ') : ''}.` })}</p>
          <div className="cfop-pair-lines">{[
            { title: tr({ zh: '原解', en: 'Recorded' }), alg: preview.original, count: reference.userTurns },
            { title: tr({ zh: '同槽参考', en: 'Same-slot reference' }), alg: reference.refSolution, count: reference.refTurns },
          ].map(line => <section key={line.title} aria-label={line.title}>
            <strong>{line.title}{line.count != null && ` · ${line.count} HTM`}</strong>
            {line.alg ? <><p dir="ltr">{line.alg}</p>{renderPairPlayer?.(preview.setup, line.alg, pair.slot, rotation)}</>
              : <p>{tr(line.count === 0 ? { zh: '目标已满足。', en: 'Target already satisfied.' }
                : { zh: '暂无可验证的参考路线。', en: 'No verified reference line available.' })}</p>}
          </section>)}</div>
          {pair.caseFingerprint && renderPairTraining?.(pair.caseFingerprint, `F${pair.order}`, null,
            {solve, scope: JSON.stringify([cfopPracticeSolveId(solve), 'slot-'+pair.slot])})}
          <p className="cfop-pair-note">{tr({zh: '两边独立计 HTM。原解保留设备记录的每次转动，连续同面转动可合为一步。', en: 'Both lines count HTM from this position. The recorded player shows every turn packet, including consecutive turns of the same face.'})}</p>
        </>}
    </article>}
  </section>;
}
