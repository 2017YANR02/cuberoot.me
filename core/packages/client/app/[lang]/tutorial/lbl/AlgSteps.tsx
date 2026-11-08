import { tr } from '@/i18n/tr';
import { getLblAlgGroups } from './alg-cues';

/** Shared by this lesson's demonstration and its optional practice hint. */
export default function AlgSteps({ step, alg, activeMove, moveIndices, onMoveClick, currentGroupOnMobile = false, bracketFormula = false }: { step: string; alg: string; activeMove?: number; moveIndices?: readonly number[]; onMoveClick?: (index: number) => void; currentGroupOnMobile?: boolean; bracketFormula?: boolean }) {
  const groups = getLblAlgGroups(step, alg).map(group => moveIndices ? group.filter(move => moveIndices.includes(move.index)) : group).filter(group => group.length > 0);
  const activeGroup = Math.max(0, groups.findIndex(group => group.some(move => move.index === activeMove)));
  return <div className="lbl-alg-steps" role="group" data-mobile-segmented={currentGroupOnMobile} aria-label={tr({ zh: '中文口诀与转动记号', en: 'Move cues and notation' })}>
    {currentGroupOnMobile && <span className="lbl-mobile-alg-counter">{activeGroup + 1} / {groups.length}</span>}
    {groups.map((group, i) => <div className="lbl-alg-group" data-mobile-current={i === activeGroup} style={{ flexGrow: group.length }} key={i}>
      {group.map(move => { const Tag = onMoveClick ? 'button' : 'span'; return <Tag type={onMoveClick ? 'button' : undefined} onClick={onMoveClick ? () => onMoveClick(move.index) : undefined} className="lbl-alg-move" key={move.index} aria-current={activeMove === move.index ? 'step' : undefined}>
        <code>{bracketFormula && group.length > 1 && move === group[0] && '('}{move.notation}{bracketFormula && group.length > 1 && move === group.at(-1) && ')'}</code>
        <span className="lbl-alg-cue">{tr(bracketFormula && group.length === 1 && (i === 0 || i === groups.length - 1)
          ? { zh: '顶层调整', en: 'Adjust top' } : move.cue)}</span>
      </Tag>; })}
    </div>)}
  </div>;
}
