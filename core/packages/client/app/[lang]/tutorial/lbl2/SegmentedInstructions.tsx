import { tr } from '@/i18n/tr';
import AlgSteps from './AlgSteps';
import { getLblAlgGroups } from './alg-cues';
import { INSTRUCTION_PHASES, splitInstruction } from './instruction-phases';

export default function SegmentedInstructions({ step, alg, instruction, exampleIndex, playbackStep, finalMoveSettled, onMoveClick, preparation }: {
  step: string; alg: string; instruction: string; exampleIndex: number; playbackStep: number; finalMoveSettled: boolean; onMoveClick: (index: number) => void; preparation?: string;
}) {
  const groups = getLblAlgGroups(step, alg);
  const phrases = instruction.split(' → ');
  const countText = step === 'yellow-face' && [2, 3].includes(exampleIndex)
    ? tr(exampleIndex === 2 ? { zh: '先数顶面非黄格，共2格', en: 'Count the non-yellow squares on top: two' }
      : { zh: '先数顶面非黄格，共4格', en: 'Count the non-yellow squares on top: four' }) : undefined;
  const actionInstruction = countText && instruction.startsWith(countText) ? instruction.slice(countText.length).replace(/^[。\s.]+/, '') : instruction;
  const phases = INSTRUCTION_PHASES[step]?.[exampleIndex] ?? [];
  const rows: { text: string; moves: number[]; note: string }[] = [];
  if (step === 'middle' && [2, 3].includes(exampleIndex)) {
    const next = tr({ zh: '再对齐，选择“去右”或“去左”归位', en: 'Then align it and choose the right or left insertion' });
    const split = instruction.indexOf(next);
    rows.push({ text: (split >= 0 ? instruction.slice(0, split) : instruction).replace(/[。\s.]+$/g, ''), moves: groups.flat().map(move => move.index + 1), note: '' });
    rows.push({ text: next, moves: [], note: '' });
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
    const lead = step === 'trigger-learning' ? instruction.split(/(左|右|\bLeft\b|\bleft\b|\bRight\b|\bright\b)/).map((part, index) =>
      /^(左|右|Left|left|Right|right)$/.test(part) ? <span className="lbl2-direction-emphasis" key={index}>{part}</span> : part) : instruction;
    if (groups.length === 1) return <><p className="lbl2-lead">{lead}</p><AlgSteps step={step} alg={alg} activeMove={playbackStep - 1} onMoveClick={onMoveClick} /></>;
    groups.forEach((group, index) => rows.push({ text: index === 0 ? instruction : '', moves: group.map(move => move.index + 1), note: '' }));
  }
  // Keep all moves reachable, even if a legacy prose excerpt no longer matches.
  const covered = new Set(rows.flatMap(row => row.moves));
  const missing = groups.flat().filter(move => !covered.has(move.index + 1));
  if (missing.length) rows.push({ text: '', moves: missing.map(move => move.index + 1), note: '' });
  if (step === 'yellow-cross' && exampleIndex === 2) {
    rows[rows.length - 1].note = '';
    rows.push({ text: tr({ zh: '变成一条线后，再按“横线”状态继续', en: 'Once a line forms, continue with the “Line” case' }), moves: [], note: '' });
  }
  if (step === 'corner-position' && exampleIndex === 1) {
    rows.push({ text: tr({ zh: '造出眼后，按“有眼”继续', en: 'Once headlights appear, continue with the “Headlights” case' }), moves: [], note: '' });
  }
  if (step === 'edge-position' && exampleIndex === 2) {
    rows.push({ text: tr({ zh: '出现墙后，选择对应情况继续', en: 'Once a wall appears, choose the matching case to continue' }), moves: [], note: '' });
  }
  if (preparation) rows.unshift({ text: preparation, moves: [], note: '' });
  if (countText) rows.unshift({ text: countText, moves: [], note: '' });
  if (countText) rows.push({ text: tr({ zh: '最后按小鱼公式还原', en: 'Finish with the matching Sune algorithm' }), moves: [], note: '' });
  const clean = (text: string) => {
    const note = text.replace(/^[\s，。、；：,.!;:→“”]+|[\s，。、；：,.!;:→]+$/g, '').trim();
    return /^(再|先|做|做完|then(?: do)?|and(?: then)?(?: do)?)$/.test(note) ? '' : note;
  };
  const showClosingStep = finalMoveSettled && rows.at(-1)?.moves.length === 0;
  return <ol className="lbl-demo-stages" aria-label={tr({ zh: '操作步骤', en: 'Teaching steps' })}>
    {rows.map((row, index) => {
      const active = (preparation || countText) && playbackStep === 0 ? index === 0
        : showClosingStep ? index === rows.length - 1
          : row.moves.includes(Math.max(1, playbackStep));
      return <li className="lbl-demo-stage" key={index} data-current-step={active || undefined}>
        <span className="lbl-demo-stage-number" aria-hidden="true">{index + 1}</span>
        <div className="lbl-demo-stage-body">
          {row.text && <p className="lbl-instruction-phase" aria-current={active ? 'step' : undefined}>{row.text}</p>}
          {row.moves.length > 0 && <AlgSteps step={step} alg={alg} activeMove={showClosingStep ? undefined : playbackStep - 1} moveIndices={row.moves.map(move => move - 1)} onMoveClick={onMoveClick} />}
          {clean(row.note) && <p className="lbl-demo-stage-note">{clean(row.note)}</p>}
        </div>
      </li>;
    })}
  </ol>;
}
