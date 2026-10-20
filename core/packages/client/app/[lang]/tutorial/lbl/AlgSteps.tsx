import { tr } from '@/i18n/tr';
import { getLblAlgGroups } from './alg-cues';

/** Shared by this lesson's demonstration and its optional practice hint. */
export default function AlgSteps({ step, alg, activeMove, moveIndices, onMoveClick }: { step: string; alg: string; activeMove?: number; moveIndices?: readonly number[]; onMoveClick?: (index: number) => void }) {
  return <div className="lbl-alg-steps" role="group" aria-label={tr({ zh: '中文口诀与转动记号', en: 'Move cues and notation' })}>
    {getLblAlgGroups(step, alg).map(group => moveIndices ? group.filter(move => moveIndices.includes(move.index)) : group).filter(group => group.length > 0).map((group, i) => <div className="lbl-alg-group" style={{ flexGrow: group.length }} key={i}>
      {group.map(move => { const Tag = onMoveClick ? 'button' : 'span'; return <Tag type={onMoveClick ? 'button' : undefined} onClick={onMoveClick ? () => onMoveClick(move.index) : undefined} className="lbl-alg-move" key={move.index} aria-current={activeMove === move.index ? 'step' : undefined}>
        <code>{move.notation}</code>
        <span className="lbl-alg-cue">{tr(move.cue)}</span>
      </Tag>; })}
    </div>)}
  </div>;
}
