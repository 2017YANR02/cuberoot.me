import type { ReactNode } from 'react';
import { tr } from '@/i18n/tr';
import AlgSteps from './AlgSteps';
import { getLblAlgGroups } from './alg-cues';
import { INSTRUCTION_PHASES, splitInstruction } from './instruction-phases';

function emphasizeDirection(text: string) {
  return text.split(/(左|右|\bleft\b|\bright\b)/i).map((part, index) =>
    index % 2 ? <span className="lbl-direction-emphasis" key={index}>{part}</span> : part);
}

export default function SegmentedInstructions({ step, alg, instruction, exampleIndex, playbackStep, finalMoveSettled, selectedStepStart, onMoveClick, onStepClick, preparation, introduction, onWhiteRight, onMiddleRight, onHeadlights, onLine, onFish }: {
  step: string; alg: string; instruction: string; exampleIndex: number; playbackStep: number; finalMoveSettled: boolean; selectedStepStart: number | null; onMoveClick: (index: number) => void; onStepClick: (moveCount: number) => void; preparation?: string;
  introduction?: ReactNode;
  onWhiteRight?: () => void;
  onMiddleRight?: () => void;
  onHeadlights?: () => void;
  onLine?: () => void;
  onFish?: () => void;
}) {
  const groups = getLblAlgGroups(step, alg);
  const phrases = instruction.split(' → ');
  const countText = step === 'yellow-face' && [2, 3].includes(exampleIndex)
    ? tr(exampleIndex === 2 ? { zh: '先数顶面非黄格，共2格', en: 'Count the non-yellow squares on top: two' }
      : { zh: '先数顶面非黄格，共4格', en: 'Count the non-yellow squares on top: four' }) : undefined;
  const actionInstruction = countText && instruction.startsWith(countText) ? instruction.slice(countText.length).replace(/^[。\s.]+/, '') : instruction;
  const originalPhases = INSTRUCTION_PHASES[step]?.[exampleIndex] ?? [];
  const phases = step === 'edge-position' && exampleIndex < 2 && !alg.startsWith('y')
    ? originalPhases.slice(1).map(phase => ({ ...phase, moves: phase.moves.map(move => move - 1) }))
    : originalPhases;
  const rows: { text: string; moves: number[]; note: string; onSelect?: () => void }[] = [];
  const edgeFormulaLesson = step === 'edge-position' && [0, 1, 2].includes(exampleIndex) && !alg.startsWith('y');
  if (edgeFormulaLesson) {
    rows.push({ text: tr(exampleIndex === 2 ? { zh: '右鱼', en: 'Right Sune' } : exampleIndex === 0
      ? { zh: '对色在左做右鱼', en: 'Opposite color on the left, do right Sune' }
      : { zh: '对色在右做左鱼', en: 'Opposite color on the right, do left Sune' }), moves: groups[0].map(move => move.index + 1), note: '' });
    rows.push({ text: tr({ zh: '按小鱼还原余下流程', en: 'Finish the remaining steps with Sune' }), moves: groups.slice(1).flat().map(move => move.index + 1), note: '' });
  } else if (step === 'middle' && [2, 3].includes(exampleIndex)) {
    const next = tr({ zh: '再对齐，选择“去右”或“去左”归位', en: 'Then align it and choose the right or left insertion' });
    const split = instruction.indexOf(next);
    const moves = groups.flat().map(move => move.index + 1);
    if (exampleIndex === 2) {
      rows.push({ text: tr({ zh: '直接做“去右”', en: 'Use the right insertion directly' }), moves: moves.slice(0, -2), note: '' });
      rows.push({ text: tr({ zh: '对齐', en: 'Align' }), moves: moves.slice(-2), note: '' });
      rows.push({ text: tr({ zh: '转化为“去右”情况', en: 'Now a right-insertion case' }), moves: [], note: '', onSelect: onMiddleRight });
    } else {
      rows.push({ text: (split >= 0 ? instruction.slice(0, split) : instruction).replace(/[。\s.]+$/g, ''), moves, note: '' });
      rows.push({ text: next, moves: [], note: '' });
    }
  } else if (step === 'middle' && phrases.length === groups.length && phrases.length > 1) {
    phrases.forEach((text, index) => rows.push({ text, moves: groups[index].map(move => move.index + 1), note: '' }));
  } else {
    let prefix = '';
    for (const part of splitInstruction(actionInstruction, phases, tr)) {
      if (part.moves) {
        rows.push({ text: prefix + part.text, moves: part.moves, note: '' });
        prefix = '';
      } else if (rows.length) rows[rows.length - 1].note += part.text;
      else prefix += part.text;
    }
  }
  if (!rows.length) {
    const lead = step === 'trigger-learning' ? emphasizeDirection(instruction) : instruction;
    if (groups.length === 1 && !introduction) return <>
      {instruction && <p className="lbl-lead lbl-instruction-phase" aria-current={selectedStepStart === 0 ? 'step' : undefined}><button type="button" className="lbl-step-start" onClick={() => onStepClick(0)}>{lead}</button></p>}
      <AlgSteps step={step} alg={alg} activeMove={selectedStepStart === null ? playbackStep - 1 : undefined} onMoveClick={onMoveClick} />
    </>;
    groups.forEach((group, index) => rows.push({ text: index === 0 ? instruction : '', moves: group.map(move => move.index + 1), note: '' }));
  }
  // Keep all moves reachable, even if a legacy prose excerpt no longer matches.
  const covered = new Set(rows.flatMap(row => row.moves));
  const missing = groups.flat().filter(move => !covered.has(move.index + 1));
  if (missing.length) rows.push({ text: '', moves: missing.map(move => move.index + 1), note: '' });
  if (step === 'corners' && exampleIndex === 1) {
    rows.push({ text: tr({ zh: '根据白色情况选择白朝右', en: 'For this white sticker position, choose “White faces right”' }), moves: [], note: '', onSelect: onWhiteRight });
  }
  if (step === 'yellow-cross' && exampleIndex === 2) {
    rows[rows.length - 1].note = '';
    rows.push({ text: tr({ zh: '转化为“横线”情况', en: 'Now a “Line” case' }), moves: [], note: '', onSelect: onLine });
  }
  if (step === 'corner-position' && exampleIndex === 1) {
    rows.push({ text: tr({ zh: '造出眼后，按“有眼”继续', en: 'Once headlights appear, continue with the “Headlights” case' }), moves: [], note: '', onSelect: onHeadlights });
  }
  if (step === 'edge-position' && exampleIndex === 2) {
    rows.push({ text: tr({ zh: '出现墙后，选择对应情况继续', en: 'Once a wall appears, choose the matching case to continue' }), moves: [], note: '' });
  }
  if (preparation) rows.unshift({ text: preparation, moves: [], note: '' });
  if (countText) rows.unshift({ text: countText, moves: [], note: '' });
  if (countText) rows.push({ text: tr({ zh: '转化为小鱼', en: 'Now a fish case' }), moves: [], note: '', onSelect: onFish });
  const clean = (text: string) => {
    const note = text.replace(/^[\s，。、；：,.!;:→“”]+|[\s，。、；：,.!;:→]+$/g, '').trim();
    return /^(再|先|做|做完|then(?: do)?|and(?: then)?(?: do)?)$/.test(note) ? '' : note;
  };
  const showClosingStep = finalMoveSettled && rows.at(-1)?.moves.length === 0;
  const atIntroduction = Boolean(introduction) && playbackStep === 0 && selectedStepStart === null;
  return <ol className="lbl-demo-stages" aria-label={tr({ zh: '操作步骤', en: 'Teaching steps' })}>
    {introduction && <li className="lbl-demo-stage lbl-j-lesson-intro"
      data-current-step={atIntroduction || undefined} aria-current={atIntroduction ? 'step' : undefined}>{introduction}</li>}
    {rows.map((row, index) => {
      const label = (edgeFormulaLesson || step === 'middle' && (exampleIndex === 0 || exampleIndex === 1)) && row.moves[0] === 1
        ? emphasizeDirection(row.text) : row.text;
      const active = atIntroduction ? false : selectedStepStart !== null ? row.moves[0] === selectedStepStart + 1
        : (preparation || countText) && playbackStep === 0 ? index === 0
        : showClosingStep ? index === rows.length - 1
          : row.moves.includes(Math.max(1, playbackStep));
      return <li className="lbl-demo-stage" key={index} data-current-step={active || undefined}>
        <div className="lbl-demo-stage-body">
          {row.text && <p className="lbl-instruction-phase" aria-current={active ? 'step' : undefined}>
            {row.onSelect ? <button type="button" className="lbl-step-start lbl-direction-emphasis" onClick={row.onSelect}>{label}</button> : row.moves.length > 0 ? <button type="button" className="lbl-step-start" onClick={() => onStepClick(row.moves[0] - 1)}>{label}</button> : label}
          </p>}
          {row.moves.length > 0 && <AlgSteps step={step} alg={alg} bracketFormula={edgeFormulaLesson && index === 1} activeMove={showClosingStep || selectedStepStart !== null ? undefined : playbackStep - 1} moveIndices={row.moves.map(move => move - 1)} onMoveClick={onMoveClick} />}
          {clean(row.note) && <p className="lbl-demo-stage-note">{clean(row.note)}</p>}
        </div>
      </li>;
    })}
  </ol>;
}
