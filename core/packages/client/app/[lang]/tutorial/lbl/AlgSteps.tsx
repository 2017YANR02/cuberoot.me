'use client';

import { useEffect, useRef } from 'react';
import { tr } from '@/i18n/tr';
import { getLblAlgGroups, getLblPracticeSegments } from './alg-cues';

/** Shared by this lesson's demonstration and its optional practice hint. */
export default function AlgSteps({ step, alg, activeMove, completedMoves = 0, moveIndices, onMoveClick, currentGroupOnMobile = false, bracketFormula = false, karaoke = false, recovering = false }: { step: string; alg: string; activeMove?: number; completedMoves?: number; moveIndices?: readonly number[]; onMoveClick?: (index: number) => void; currentGroupOnMobile?: boolean; bracketFormula?: boolean; karaoke?: boolean; recovering?: boolean }) {
  const groups = getLblAlgGroups(step, alg).map(group => moveIndices ? group.filter(move => moveIndices.includes(move.index)) : group).filter(group => group.length > 0);
  const activeGroup = Math.max(0, groups.findIndex(group => group.some(move => move.index === activeMove)));
  const karaokeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = karaokeRef.current;
    if (!karaoke || recovering || !container) return;
    const followMove = (smooth: boolean) => {
      const current = container.querySelector<HTMLElement>('[aria-current="step"]');
      if (!current) return;
      const viewport = container.getBoundingClientRect();
      const move = current.getBoundingClientRect();
      const centered = container.scrollLeft + move.left - viewport.left + move.width / 2 - container.clientWidth / 2;
      const left = completedMoves === 0 ? 0 : Math.max(0, Math.min(centered, container.scrollWidth - container.clientWidth));
      container.scrollTo({ left, behavior: smooth && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant' });
    };
    followMove(completedMoves > 0);
    let initialObservation = true;
    const observer = new ResizeObserver(() => {
      if (initialObservation) { initialObservation = false; return; }
      followMove(false);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [karaoke, recovering, completedMoves, alg]);
  if (karaoke) {
    const moves = groups.flat();
    const segments = getLblPracticeSegments(moves);
    return <div ref={karaokeRef} className="lbl-practice-karaoke" data-recovering={recovering || undefined} style={{ gridTemplateColumns: `repeat(${moves.length}, minmax(max-content, 1fr))` }}>
      {moves.map((move, column) => <span className="lbl-alg-move" data-completed={move.index < completedMoves || undefined} aria-current={!recovering && move.index === completedMoves ? 'step' : undefined} key={move.index} style={{ gridColumn: column + 1 }}>
        <code>{move.notation}</code><span className="lbl-alg-cue">{tr(move.cue)}</span>
      </span>)}
      {segments.map(({ moves: group, name }, index) => {
        const done = group.filter(move => move.index < completedMoves).length;
        const inProgress = done > 0 && done < group.length;
        return <span className="lbl-practice-karaoke-label" data-completed={done === group.length || undefined} data-in-progress={inProgress || undefined} key={index}
        style={{ gridColumn: `${segments.slice(0, index).flatMap(segment => segment.moves).length + 1} / span ${group.length}`, gridRow: 3 }}>
        {name && tr(name)}
        {inProgress && <span className="lbl-practice-segment-progress" aria-hidden="true" style={{ width: `${done / group.length * 100}%` }} />}
      </span>; })}
    </div>;
  }
  return <div className="lbl-alg-steps" role="group" data-mobile-segmented={currentGroupOnMobile} aria-label={tr({ zh: '中文口诀与转动记号', en: 'Move cues and notation' })}>
    {currentGroupOnMobile && <span className="lbl-mobile-alg-counter">{activeGroup + 1} / {groups.length}</span>}
    {groups.map((group, i) => <div className="lbl-alg-group" data-mobile-current={i === activeGroup} style={{ flexGrow: group.length }} key={i}>
      {group.map(move => { const Tag = onMoveClick ? 'button' : 'span'; return <Tag type={onMoveClick ? 'button' : undefined} onClick={onMoveClick ? () => onMoveClick(move.index) : undefined} className="lbl-alg-move" data-completed={move.index < completedMoves || undefined} key={move.index} aria-current={activeMove === move.index ? 'step' : undefined}>
        <code>{bracketFormula && group.length > 1 && move === group[0] && '('}{move.notation}{bracketFormula && group.length > 1 && move === group.at(-1) && ')'}</code>
        <span className="lbl-alg-cue">{tr(bracketFormula && group.length === 1 && (i === 0 || i === groups.length - 1)
          ? { zh: '顶层调整', en: 'Adjust top' } : move.cue)}</span>
      </Tag>; })}
    </div>)}
  </div>;
}
