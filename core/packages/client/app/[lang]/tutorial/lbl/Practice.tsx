'use client';

import MoreToggle from '@/components/MoreToggle';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alg } from 'cubing/alg';
import { ArrowLeft, ArrowRight, Trophy, X } from '@app-foundation/icons/lucide';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import Link from '@/components/AppLink';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import { resolvePlayerSetup } from '@/components/AlgPlayer/player-setup';
import { pickStickering } from '@/components/AlgPlayer/stickering';
import TrainingFeedbackOverlay from '@/components/TrainingFeedbackOverlay';
import { VisualCube } from '@/components/VisualCube';
import { stickeringMaskFn, mergeStickeringMaskFns, FM_FIXED_COLOR, FM_IGNORED } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { resolveStageMaskFn } from '@cuberoot/puzzle-render-core/engine/nxn/vcStageMask';
import { stageStickerColors } from '@/lib/sim-stage-thumbnail';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import { tr, T } from '@/i18n/tr';
import { LBL_STEPS, LESSON_STICKERING, LBL_INITIAL_VIEW, type LblExample } from './content';
import { practiceState, practiceTargetStates, bottomCornerGoal, middleEdgeGoal, isFishWithSolvedLowerLayers, isWallWithSolvedLowerLayers } from './practice-state';
import AlgSteps from './AlgSteps';
import { practiceObjective } from './practice-objective';
import { crossMask, crossStickering } from './cross-display';
import { daisyPracticeExample, DAISY_PRACTICE_TARGET } from './daisy-practice';

/* 暂停按钮操作时保留的动作标签。
const practiceMoves = [
  { moves: ['R', "R'"], zh: '右边一层', en: 'Right layer', labels: ['右手上', '右手下'], english: ['Right up', 'Right down'], arrows: ['↑', '↓'] },
  { moves: ["L'", 'L'], zh: '左边一层', en: 'Left layer', labels: ['左手上', '左手下'], english: ['Left up', 'Left down'], arrows: ['↑', '↓'] },
  { moves: ['U', "U'"], zh: '最上面一层', en: 'Top layer', labels: ['顶层向左', '顶层向右'], english: ['Top left', 'Top right'], arrows: ['←', '→'] },
  { moves: ['F', "F'"], zh: '前面一层', en: 'Front layer', labels: ['前面顺时针', '前面逆时针'], english: ['Front clockwise', 'Front counterclockwise'], arrows: ['↻', '↺'] },
  { moves: ["D'", 'D'], zh: '最下面一层', en: 'Bottom layer', labels: ['底层向左', '底层向右'], english: ['Bottom left', 'Bottom right'], arrows: ['←', '→'] },
  { moves: ['B', "B'"], zh: '后面一层', en: 'Back layer', labels: ['后面顺时针', '后面逆时针'], english: ['Back clockwise', 'Back counterclockwise'], arrows: ['↻', '↺'] },
  { moves: ['f', "f'"], zh: '前面两层', en: 'Front two layers', labels: ['双层顺时针', '双层逆时针'], english: ['Two layers clockwise', 'Two layers counterclockwise'], arrows: ['↻', '↺'] },
  { moves: ['y', "y'"], zh: '整个魔方', en: 'Whole cube', labels: ['整体向左', '整体向右'], english: ['Rotate left', 'Rotate right'], arrows: ['←', '→'] },
  { moves: ["d'", 'd'], zh: '下面两层', en: 'Lower two layers', labels: ['下面两层向左', '下面两层向右'], english: ['Lower two left', 'Lower two right'], arrows: ['←', '→'] },
];
function moveLabel(move: string): string {
  const base = move.replace(/2'?$/, '');
  for (const row of practiceMoves) {
    const index = row.moves.indexOf(base);
    if (index >= 0) return tr({ zh: row.labels[index], en: row.english[index] }) + (move.includes('2') ? tr({ zh: '两次', en: ' twice' }) : '');
  }
  return move;
}

*/
export default function Practice({ step, initialIndex, exampleOrder, extraExample, onClose, onPreviousChapter, onNextChapter }: {
  step: typeof LBL_STEPS[number]; initialIndex: number; exampleOrder?: number[]; extraExample?: LblExample; onClose: () => void; onPreviousChapter?: () => void; onNextChapter?: () => void;
}) {
  // const [textMoves, setTextMoves] = useState(false);
  const [index, setIndex] = useState(() => extraExample ? 0 : Math.max(0, exampleOrder?.indexOf(initialIndex) ?? initialIndex));
  const chapterExamples = useMemo(() => step.id === 'daisy' ? step.examples.map(daisyPracticeExample) : step.examples, [step]);
  const orderedExamples = exampleOrder ? exampleOrder.map(index => chapterExamples[index]) : chapterExamples;
  const examples = extraExample ? [extraExample, ...orderedExamples] : orderedExamples;
  return <main className="lbl-support-page lbl-support-practice-page lbl-practice-page">
    <header className="lbl-header">
      <button type="button" className="lbl-button lbl-practice-back" onClick={onClose} aria-label={tr({ zh: '回看本节教程', en: 'Review this lesson' })}><ArrowLeft size={18} /></button>
      <h1><T zh="分步练习" en="Guided practice" /></h1>
    </header>
    <Exercise key={index} step={step} example={examples[index]} index={index} total={examples.length}
      onNext={() => { if (index < examples.length - 1) setIndex(index + 1); else onNextChapter?.(); }}
      canPrevious={index > 0 || !!onPreviousChapter} canNext={index < examples.length - 1 || !!onNextChapter}
      onClose={onClose} onPrevious={() => { if (index > 0) setIndex(index - 1); else onPreviousChapter?.(); }} />
  </main>;
}

function Exercise({ step, example, index, total, onNext, onClose, onPrevious, canPrevious, canNext }: {
  step: typeof LBL_STEPS[number]; example: LblExample; index: number; total: number; onNext: () => void; onClose: () => void;
  onPrevious: () => void; canPrevious: boolean; canNext: boolean;
  // textMoves: boolean; onTextMovesChange: (value: boolean) => void;
}) {
  const beginner = step.id === 'daisy';
  const setup = new Alg(resolvePlayerSetup('3x3', example.alg, example.setup, example.startSolved ?? false)).expand().toString();
  const target = beginner ? DAISY_PRACTICE_TARGET : new Alg(`${setup} ${example.alg}`).expand().toString();
  const colors = useMemo(() => {
    const name = pickStickering('3x3', LESSON_STICKERING[step.id], 'sim')!;
    const mask = step.id === 'cross' ? crossMask : stickeringMaskFn(3, name) ?? resolveStageMaskFn(3, name);
    const practiceMask = ['yellow-cross', 'yellow-face', 'edge-position'].includes(step.id) ? mergeStickeringMaskFns([mask, stickeringMaskFn(3, 'F2L')]) : mask;
    return stageStickerColors(3, practiceMask, orientedCubeFaceColors('z2'));
  }, [step.id]);
  const ejectCorner = step.id === 'corners' && example === step.examples[1];
  const cornerGoal = useMemo(() => ejectCorner ? bottomCornerGoal(setup, target, colors) : null, [ejectCorner, setup, target, colors]);
  const ejectEdge = step.id === 'middle' && (example === step.examples[2] || example === step.examples[3]);
  const edgeGoal = useMemo(() => ejectEdge ? middleEdgeGoal(setup, target, colors) : null, [ejectEdge, setup, target, colors]);
  const fishGoal = step.id === 'yellow-face' && (example === step.examples[2] || example === step.examples[3]);
  const wallGoal = step.id === 'edge-position' && example === step.examples[2];
  const pieceGoal = cornerGoal ?? edgeGoal;
  const targetStates = useMemo(() => practiceTargetStates(colors, target), [colors, target]);
  const [hint, setHint] = useState(false);
  const [solved, setSolved] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [completed, setCompleted] = useState(false);
  const finalExercise = step.id === 'edge-position' && index < 2;
  const player = useRef<AlgPlayerHandle>(null);
  const moves = useRef<string[]>([]);
  const [history, setHistory] = useState('');
  const [restoredMoves, setRestoredMoves] = useState('');
  const record = (move: string) => {
    moves.current.push(move);
    setHistory(moves.current.join(' '));
    setSolved(false);
  };
  const reset = () => {
    setCompleted(false);
    moves.current = []; setHistory(''); setRestoredMoves(''); setSolved(false); setGeneration(n => n + 1);
  };
  const undo = () => {
    if (!moves.current.length) return;
    moves.current.pop();
    const remaining = moves.current.join(' ');
    setHistory(remaining); setRestoredMoves(remaining);
    setSolved(false); setGeneration(n => n + 1);
  };
  /* 暂停按钮操作。
  const turn = (move: string) => {
    player.current?.applyUserMove?.(move);
  };
  */
  useEffect(() => {
    if (!history) return;
    const timer = window.setInterval(() => {
      if (!player.current || player.current.isUserMovePending?.()) return;
      window.clearInterval(timer);
      if (!(wallGoal ? isWallWithSolvedLowerLayers(`${setup} ${history}`) : fishGoal ? isFishWithSolvedLowerLayers(`${setup} ${history}`) : pieceGoal ? pieceGoal.matches(`${setup} ${history}`) : targetStates.has(practiceState(colors, `${setup} ${history}`)))) return;
      setSolved(true);
      if (finalExercise) setCompleted(true);
    }, 100);
    return () => window.clearInterval(timer);
  }, [history, colors, setup, targetStates, finalExercise, pieceGoal, fishGoal, wallGoal]);

  useEffect(() => {
    const nextOnSpace = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || completed) return;
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"], dialog')) return;
      event.preventDefault();
      event.stopPropagation();
      if (canNext) onNext();
    };
    document.addEventListener('keydown', nextOnSpace, true);
    return () => document.removeEventListener('keydown', nextOnSpace, true);
  });
  /* 暂停按钮操作。
  const actionRows = (rows: typeof practiceMoves) => rows.map(row => <div className="lbl-action-row" key={row.en}>
    <span>{tr(row)}</span>{row.moves.map((move, i) => <button className="lbl-button" type="button" key={move} onClick={() => turn(move)}><b aria-hidden="true">{row.arrows[i]}</b>{moveLabel(move)}</button>)}
  </div>);
  */
  return <section className="lbl-basics lbl-exercise">
    {completed && <CompletionDialog onClose={() => setCompleted(false)} onReview={onClose} />}
    <div className="lbl-exercise-heading"><h2>{tr({ zh: `${step.title.zh}：${example.title.zh}`, en: `${step.title.en}: ${example.title.en}` })}</h2><span className="lbl-basic-progress">{index + 1} / {total}</span></div>
    <div className="lbl-basic-content">
      <div className="lbl-basic-demo">
        <div className="lbl-cube"><AlgPlayer ref={player} key={generation} puzzle="3x3" engine="sim" hiddenStickers={edgeGoal?.hiddenStickers} set={LESSON_STICKERING[step.id]} additionalStickering={step.id === 'corners' ? 'centers-only' : ['yellow-cross', 'yellow-face', 'edge-position'].includes(step.id) ? 'F2L' : undefined} orientation="z2" sceneRot={example.sceneRot ?? LBL_INITIAL_VIEW} highlightDaisyAlignment={step.id === 'cross'} alg="" setup={`${setup} ${restoredMoves}`} controlMode="none" hideResetView interactionMode={solved ? 'view' : 'turn'} onUserMove={record} fillPane moveDurationMs={525}
          stickeringAtStep={step.id === 'cross' ? crossStickering : undefined} />
          <TrainingFeedbackOverlay kind={solved ? 'correct' : null} correctLabel={tr({ zh: '已达到本题目标', en: 'Target reached' })} wrongLabel="" />
        </div>
        <p className="lbl-help"><T zh="拖动色块转层，拖动空白调整视角" en="Drag stickers to turn; drag the background to change your view." /></p>
        {/* 暂停按钮操作，练习直接拖动 AlgPlayer；保留以便恢复。
        <div className="lbl-move-display"><select className="lbl-move-select" aria-label={tr({ zh: '操作显示方式', en: 'Move label format' })} value={textMoves ? 'text' : 'notation'} onChange={event => onTextMovesChange(event.target.value === 'text')}><option value="notation">{tr({ zh: '字母操作', en: 'Letter controls' })}</option><option value="text">{tr({ zh: '文字操作', en: 'Word controls' })}</option></select></div>
        {textMoves ? <div className="lbl-beginner-controls" role="group" aria-label={tr({ zh: '转动魔方', en: 'Turn the cube' })}>
          <p><T zh="想动哪一层？" en="Which layer?" /><small><T zh="每点一次转四分之一圈" en="Each tap turns a quarter turn" /></small></p>
          {actionRows(practiceMoves.slice(0, 3))}
          {step.id === 'cross' && actionRows(practiceMoves.slice(7))}
          <details><MoreToggle as="summary"><T zh="更多动作" en="More moves" /></MoreToggle><p><T zh="顺、逆时针都要正对所转的面判断；转后面时，想象从背后看它。" en="Judge clockwise while looking directly at the face being turned; for the back face, imagine looking from behind." /></p>{actionRows(practiceMoves.slice(3, step.id === 'cross' ? 7 : 8))}</details>
        </div> : <div className="lbl-move-buttons" role="group" aria-label={tr({ zh: '转动魔方', en: 'Turn the cube' })}>{['R', "R'", 'L', "L'", 'U', "U'", 'F', "F'", 'D', "D'", 'B', "B'", 'f', "f'", 'y', "y'", ...(step.id === 'cross' ? ['d', "d'"] : [])].map(move => <button className="lbl-button" type="button" key={move} onClick={() => turn(move)}>{move}</button>)}</div>}
        */}
        <div className="lbl-exercise-tools">{beginner && <button className="lbl-button" type="button" onClick={undo} disabled={!history}><T zh="撤销一步" en="Undo" /></button>}<button className="lbl-button" type="button" onClick={reset}>{beginner ? <T zh="重新开始" en="Restart" /> : <T zh="重来" en="Restart" />}</button><MoreToggle className="lbl-button" type="button" expanded={hint} onClick={() => setHint(!hint)}>{hint ? tr({ zh: '收起提示', en: 'Hide hint' }) : tr({ zh: '给我提示', en: 'Show hint' })}</MoreToggle></div>
      </div>
      <div className="lbl-basic-copy"><h3>{wallGoal ? <T zh="造出一面墙，保留完整底下两层；对色在左或右均可。" en="Create a wall while keeping the first two layers solved; either edge-cycle direction is accepted." /> : fishGoal ? <T zh="变成左小鱼或右小鱼，保持下两层复原。" en="Form either a left or right fish, keeping the first two layers solved." /> : edgeGoal ? <T zh="把目标中棱移到顶层，保留完整底层；顶层位置和朝向不限。" en="Move the target middle edge to the top layer in any position or orientation, keeping the entire bottom layer intact." /> : cornerGoal ? <T zh="把目标角块移到顶层，保留底十字和其他已复原的底层角块。" en="Move the target corner to the top layer, keeping the bottom cross and the other solved bottom corners intact." /> : tr(practiceObjective(step, example))}</h3>
        <div className="lbl-exercise-reference">
        <div className="lbl-exercise-target" aria-hidden={hint}><VisualCube local view="iso" size={140} setup={target} stickerColors={pieceGoal?.targetColors ?? colors} stickerMaskColor={FM_FIXED_COLOR[FM_IGNORED]} alt={tr({ zh: '本题目标状态', en: 'Target state' })} /></div>
        <div className="lbl-exercise-hint" aria-hidden={!hint}><p>{edgeGoal ? tr({ zh: '把目标棱所在槽位放到右前方，做“去右”将它取到顶层。', en: 'Bring the target slot to front-right and use the right insertion to eject the edge into the top layer.' }) : tr(example.hint)}</p><AlgSteps step={step.id} alg={example.alg} /></div>
        </div>
      </div>
    </div>
    <div className="lbl-basic-footer">
      <button className="lbl-button lbl-exercise-navigation lbl-exercise-previous" type="button" onClick={onPrevious} disabled={!canPrevious}><T zh="上一个练习" en="Previous exercise" /></button>
      <button className="lbl-button lbl-practice-review" type="button" onClick={onClose}><T zh="回看本节教程" en="Review this lesson" /></button>
      <button className="lbl-button lbl-exercise-navigation lbl-exercise-next" type="button" onClick={onNext} disabled={!canNext}><T zh="下一个练习" en="Next exercise" /></button>
    </div>
  </section>;
}

function CompletionDialog({ onClose, onReview }: { onClose: () => void; onReview: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const backdropProps = useModalDismiss(onClose);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  return <dialog ref={dialog} className="lbl-completion" {...backdropProps} onCancel={event => { event.preventDefault(); onClose(); }} aria-labelledby="lbl-completion-title">
    <section className="lbl-completion-card" data-site-surface="panel">
      <button type="button" className="lbl-button lbl-completion-close" onClick={onClose} aria-label={tr({ zh: '关闭', en: 'Close' })}><X size={22} /></button>
      <div className="lbl-completion-art" aria-hidden="true"><span>✦</span><Trophy size={42} /><span>✧</span></div>
      <p className="lbl-completion-tag"><T zh="层先法 · 学习完成" en="Layer by layer · Complete" /></p>
      <h2 id="lbl-completion-title"><T zh="恭喜你！" en="Congratulations!" /><br /><T zh="完成三阶层先法学习" en="You’ve completed the 3×3 LBL course" /></h2>
      <p className="lbl-completion-copy"><T zh="从第一朵小花，到六面还原。" en="From your first daisy to all six faces solved." /><br /><T zh="接下来，试着独立完成一次，记录你的进步。" en="Now try a solve on your own and track your progress." /></p>
      <Link className="lbl-completion-primary" href="/timer" prefetch={false}><T zh="开始计时练习" en="Start timed practice" /><ArrowRight size={20} /></Link>
      <button type="button" className="lbl-completion-review" onClick={onReview}><T zh="回看本节教程" en="Review this lesson" /></button>
      <p className="lbl-completion-footnote"><T zh="不急着拼速度，先把每一步练熟。" en="Build confidence with each step before chasing speed." /></p>
    </section>
  </dialog>;
}
