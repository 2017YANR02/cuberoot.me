'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { parseAsInteger, useQueryState } from 'nuqs';
import { Alg } from 'cubing/alg';
import { ArrowRight, Trophy, X } from '@app-foundation/icons/lucide';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import BackHome from '@/components/BackHome';
import Link from '@/components/AppLink';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import { resolvePlayerSetup } from '@/components/AlgPlayer/player-setup';
import { pickStickering } from '@/components/AlgPlayer/stickering';
import TrainingFeedbackOverlay from '@/components/TrainingFeedbackOverlay';
import { VisualCube } from '@/components/VisualCube';
import { stickeringMaskFn, FM_FIXED_COLOR, FM_IGNORED } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { resolveStageMaskFn } from '@cuberoot/puzzle-render-core/engine/nxn/vcStageMask';
import { stageStickerColors } from '@/lib/sim-stage-thumbnail';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import { tr, T } from '@/i18n/tr';
import { LBL_STEPS, LESSON_STICKERING, LBL_INITIAL_VIEW } from './content';
import { practiceState } from './practice-state';
import AlgSteps from './AlgSteps';

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

export default function Practice({ step }: { step: typeof LBL_STEPS[number] }) {
  const [textMoves, setTextMoves] = useState(false);
  const [question, setQuestion] = useQueryState('case', parseAsInteger.withDefault(1).withOptions({ history: 'replace' }));
  const index = Math.max(0, Math.min(step.examples.length - 1, question - 1));
  return <main className="lbl-page lbl-practice-page">
    <header className="lbl-header"><BackHome /><Link href={`/tutorial/lbl?step=${step.id}`} prefetch={false}>{tr(step.title)}</Link><h1><T zh="分步练习" en="Guided practice" /></h1></header>
    <Exercise key={`${step.id}-${index}`} step={step} index={index} textMoves={textMoves} onTextMovesChange={setTextMoves} onNext={() => { void setQuestion(index + 2); }} />
  </main>;
}

function Exercise({ step, index, onNext, textMoves, onTextMovesChange }: { step: typeof LBL_STEPS[number]; index: number; onNext: () => void; textMoves: boolean; onTextMovesChange: (value: boolean) => void }) {
  const example = step.examples[index];
  const beginner = step.id === 'daisy';
  const setup = new Alg(resolvePlayerSetup('3x3', example.alg, example.setup, example.startSolved ?? false)).expand().toString();
  const target = new Alg(`${setup} ${example.alg}`).expand().toString();
  const colors = useMemo(() => {
    const name = pickStickering('3x3', LESSON_STICKERING[step.id], 'sim')!;
    return stageStickerColors(3, stickeringMaskFn(3, name) ?? resolveStageMaskFn(3, name), orientedCubeFaceColors('z2'));
  }, [step.id]);
  const [hint, setHint] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [generation, setGeneration] = useState(0);
  const [checking, setChecking] = useState(false);
  const [completed, setCompleted] = useState(false);
  const finalExercise = step.id === 'edge-position' && index < 2;
  const player = useRef<AlgPlayerHandle>(null);
  const moves = useRef<string[]>([]);
  const [history, setHistory] = useState('');
  const [restoredMoves, setRestoredMoves] = useState('');
  const record = (move: string) => {
    moves.current.push(move);
    setHistory(moves.current.join(' '));
    setFeedback(null);
    setChecking(false);
  };
  const reset = () => {
    setCompleted(false);
    moves.current = []; setHistory(''); setRestoredMoves(''); setFeedback(null); setChecking(false); setGeneration(n => n + 1);
  };
  const undo = () => {
    if (!moves.current.length) return;
    moves.current.pop();
    const remaining = moves.current.join(' ');
    setHistory(remaining); setRestoredMoves(remaining);
    setFeedback(null); setChecking(false); setGeneration(n => n + 1);
  };
  const turn = (move: string) => {
    player.current?.applyUserMove?.(move);
  };
  useEffect(() => {
    if (!checking) return;
    const timer = window.setInterval(() => {
      if (!player.current || player.current.isUserMovePending?.()) return;
      const correct = practiceState(colors, `${setup} ${moves.current.join(' ')}`) === practiceState(colors, target);
      setFeedback(correct ? 'correct' : 'wrong');
      if (correct && finalExercise) setCompleted(true);
      setChecking(false);
    }, 100);
    return () => window.clearInterval(timer);
  }, [checking, colors, setup, target, finalExercise]);
  const last = index === step.examples.length - 1;
  const nextStep = LBL_STEPS[LBL_STEPS.findIndex(item => item.id === step.id) + 1];
  const actionRows = (rows: typeof practiceMoves) => rows.map(row => <div className="lbl-action-row" key={row.en}>
    <span>{tr(row)}</span>{row.moves.map((move, i) => <button className="lbl-button" type="button" key={move} onClick={() => turn(move)}><b aria-hidden="true">{row.arrows[i]}</b>{moveLabel(move)}</button>)}
  </div>);
  return <section className="lbl-basics lbl-exercise">
    {completed && <CompletionDialog onClose={() => setCompleted(false)} />}
    <div className="lbl-exercise-heading"><h2>{tr(step.title)}</h2><span className="lbl-basic-progress">{index + 1} / {step.examples.length}</span></div>
    <div className="lbl-basic-content">
      <div className="lbl-basic-demo">
        <div className="lbl-cube"><AlgPlayer ref={player} key={generation} puzzle="3x3" engine="sim" set={LESSON_STICKERING[step.id]} orientation="z2" sceneRot={example.sceneRot ?? LBL_INITIAL_VIEW} highlightDaisyAlignment={step.id === 'cross'} alg="" setup={`${setup} ${restoredMoves}`} controlMode="none" hideResetView interactionMode="turn" onUserMove={record} fillPane moveDurationMs={525} />
          <TrainingFeedbackOverlay kind={feedback} correctLabel={tr({ zh: '已达到本题目标', en: 'Target reached' })} wrongLabel={tr({ zh: '尚未达到本题目标', en: 'Not at the target yet' })} />
        </div>
        <p className="lbl-help"><T zh="拖动色块转层，拖动空白调整视角" en="Drag stickers to turn; drag the background to change your view." /></p>
        <div className="lbl-move-display"><select className="lbl-move-select" aria-label={tr({ zh: '操作显示方式', en: 'Move label format' })} value={textMoves ? 'text' : 'notation'} onChange={event => onTextMovesChange(event.target.value === 'text')}><option value="notation">{tr({ zh: '字母操作', en: 'Letter controls' })}</option><option value="text">{tr({ zh: '文字操作', en: 'Word controls' })}</option></select></div>
        {textMoves ? <div className="lbl-beginner-controls" role="group" aria-label={tr({ zh: '转动魔方', en: 'Turn the cube' })}>
          <p><T zh="想动哪一层？" en="Which layer?" /><small><T zh="每点一次转四分之一圈" en="Each tap turns a quarter turn" /></small></p>
          {actionRows(practiceMoves.slice(0, 3))}
          {step.id === 'cross' && actionRows(practiceMoves.slice(7))}
          <details><summary><T zh="更多动作" en="More moves" /></summary><p><T zh="顺、逆时针都要正对所转的面判断；转后面时，想象从背后看它。" en="Judge clockwise while looking directly at the face being turned; for the back face, imagine looking from behind." /></p>{actionRows(practiceMoves.slice(3, step.id === 'cross' ? 7 : 8))}</details>
        </div> : <div className="lbl-move-buttons" role="group" aria-label={tr({ zh: '转动魔方', en: 'Turn the cube' })}>{['R', "R'", 'L', "L'", 'U', "U'", 'F', "F'", 'D', "D'", 'B', "B'", 'f', "f'", 'y', "y'", ...(step.id === 'cross' ? ['d', "d'"] : [])].map(move => <button className="lbl-button" type="button" key={move} onClick={() => turn(move)}>{move}</button>)}</div>}
        <div className="lbl-exercise-tools">{beginner && <button className="lbl-button" type="button" onClick={undo} disabled={!history}><T zh="撤销一步" en="Undo" /></button>}<button className="lbl-button" type="button" onClick={reset}>{beginner ? <T zh="重新开始" en="Restart" /> : <T zh="重来" en="Restart" />}</button><button className="lbl-button" type="button" aria-expanded={hint} onClick={() => setHint(!hint)}>{hint ? tr({ zh: '收起提示', en: 'Hide hint' }) : tr({ zh: '给我提示', en: 'Show hint' })}</button></div>
      </div>
      <div className="lbl-basic-copy"><h3>{step.id === 'cross' ? tr({ zh: '完成四条白棱，侧面颜色对齐中心。', en: 'Complete all four white edges, matching their side colors to the centers.' }) : tr({ zh: '转动魔方，让重点色块与目标图一致。', en: 'Turn the cube to match the highlighted stickers in the target image.' })}</h3>
        <div className="lbl-exercise-target"><VisualCube view="iso" size={112} setup={target} stickerColors={colors} stickerMaskColor={FM_FIXED_COLOR[FM_IGNORED]} alt={tr({ zh: '本题目标状态', en: 'Target state' })} /><p><T zh="黄心朝上，绿心朝前。" en="Yellow center up, green center in front." /></p></div>
        {hint && <div className="lbl-exercise-hint"><p>{tr(example.hint)}</p><AlgSteps step={step.id} alg={example.alg} /></div>}
        {feedback === 'wrong' && <p className="lbl-exercise-result" aria-live="polite">{tr({ zh: '对照目标图继续调整。', en: 'Keep adjusting the cube to match the target image.' })}</p>}
      </div>
    </div>
    <div className="lbl-basic-footer"><Link href={`/tutorial/lbl?step=${step.id}`} prefetch={false}><T zh="回看本节教程" en="Review this lesson" /></Link>
      {feedback === 'correct' && last ? <button className="lbl-button lbl-basic-next" type="button" onClick={reset}><T zh="再练一次" en="Try again" /></button> : <button type="button" className="lbl-button lbl-basic-next" disabled={checking} onClick={feedback === 'correct' ? onNext : () => setChecking(true)}>{checking ? tr({ zh: '等待转动完成…', en: 'Waiting for moves…' }) : feedback === 'correct' ? tr({ zh: '下一题 →', en: 'Next →' }) : tr({ zh: '检查结果', en: 'Check result' })}</button>}
      {nextStep && <Link className="lbl-exercise-next-lesson" href={`/tutorial/lbl?step=${nextStep.id}`} prefetch={false}><T zh="下一节：" en="Next: " />{nextStep.id === 'cross' ? tr({ zh: '白色十字', en: 'White cross' }) : tr(nextStep.title)} →</Link>}
    </div>
  </section>;
}

function CompletionDialog({ onClose }: { onClose: () => void }) {
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
      <Link className="lbl-completion-review" href="/tutorial/lbl" prefetch={false} onClick={onClose}><T zh="再复习一遍" en="Review the lessons" /></Link>
      <p className="lbl-completion-footnote"><T zh="不急着拼速度，先把每一步练熟。" en="Build confidence with each step before chasing speed." /></p>
    </section>
  </dialog>;
}
