'use client';

import { useEffect, useRef, useState } from 'react';
import { FM_IGNORED, FM_REGULAR } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { engineHomeSid } from '@cuberoot/puzzle-render-core/engine/nxn/netIndex';
import { buildSimpleOptions, renderCubeSVG } from '@cuberoot/visualcube';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import PlaybackBar from '@/components/PlaybackBar';
import { RotateCcw } from '@app-foundation/icons/lucide';
import { tr, T } from '@/i18n/tr';
import { CORNER_POSITION, J_LESSON_MASK, LBL_BASICS, LBL_INITIAL_VIEW, LEFT, RIGHT } from './content';
import { resolvePlayerSetup } from '@/components/AlgPlayer/player-setup';
import { rightTopCornerStickers } from './complete-demo-state';
import { ALG_LESSONS } from './alg-lessons';
import { useCubeOrbit } from './use-cube-orbit';
import { usePlayerVisible } from './use-player-visible';
import { getLblAlgGroups } from './alg-cues';

const faceletMask = () => (piece: number, face: number) => engineHomeSid(piece, face, 3) === 'F2' ? FM_REGULAR : FM_IGNORED;

export function PieceLesson({ id }: { id: string }) {
  const player = useRef<AlgPlayerHandle>(null);
  const stopOrbit = useCubeOrbit(player, id);
  const visible = usePlayerVisible(player, id);
  const card = LBL_BASICS.find(item => item.id === id);
  return <div className="lbl2-content">
    <section className="lbl2-demonstration lbl2-piece-player" data-visible={visible} onPointerDownCapture={stopOrbit} aria-label={tr({ zh: '观察魔方', en: 'Explore the cube' })}>
      <AlgPlayer ref={player} puzzle="3x3" engine="sim" set={card?.mask ?? ''} alg="" startSolved orientation="z2" sceneRot={LBL_INITIAL_VIEW}
        stickeringAtStep={id === 'facelet' ? faceletMask : undefined}
        controlMode="none" hideResetView fillPane />
    </section>
    <section className="lbl2-explanation">
      <p className="lbl2-lead">{card ? tr(card.headline) : <T zh="表面一个彩色小方格，就是“一格”。" en="Each colored square on the surface is a facelet." />}</p>
      <p>{card ? tr(card.hint) : <T zh="图中亮着的绿色小方格，叫“绿格”。" en="The highlighted green square is a green facelet." />}</p>
    </section>
  </div>;
}

const notationMoves = ['R', 'L', 'U', 'F', "R'", "L'", "U'", "F'", 'R2', 'L2', 'U2', 'F2'];
const triggerMoves = [LEFT, RIGHT];
const jMoves = [CORNER_POSITION];
const jStartCorners = rightTopCornerStickers(resolvePlayerSetup('3x3', CORNER_POSITION, undefined, false));
const jEndCorners = rightTopCornerStickers('');
const jSwapDiagram = renderCubeSVG({
  ...buildSimpleOptions({ view: 'plan', mask: 'coll', sch: 'yogwrb', size: 144, alg: CORNER_POSITION }),
  arrows: 'U2U8-s8,U8U2-s8',
});
const faces = [
  { zh: '右层', en: 'Right face' }, { zh: '左层', en: 'Left face' },
  { zh: '顶层', en: 'Top face' }, { zh: '前层', en: 'Front face' },
];
const variants = [
  { zh: '顺时针转一下', en: 'One clockwise quarter-turn' },
  { zh: '逆时针转一下', en: 'One counterclockwise quarter-turn' },
  { zh: '转两下', en: 'A half-turn' },
];

export function NotationLesson() { return <CyclingLesson mode="notation" />; }
export function TriggerOverview() { return <CyclingLesson mode="triggers" />; }
export function JOverview() { return <CyclingLesson mode="j" />; }

function CyclingLesson({ mode }: { mode: 'notation' | 'triggers' | 'j' }) {
  const triggers = mode === 'triggers';
  const j = mode === 'j';
  const moves = j ? jMoves : triggers ? triggerMoves : notationMoves;
  const finalStep = j ? getLblAlgGroups('corner-position', CORNER_POSITION).flat().length : triggers ? 4 : 1;
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const [playRequest, setPlayRequest] = useState(0);
  const [step, setStep] = useState(0);
  const [settled, setSettled] = useState(false);
  const [running, setRunning] = useState(true);
  const [revision, setRevision] = useState(0);
  const player = useRef<AlgPlayerHandle>(null);
  const identity = `${index}:${revision}`;
  const visible = usePlayerVisible(player, identity);
  function select(next: number) {
    setRunning(false);
    setFading(false);
    setStep(0);
    setPlayRequest(0);
    setIndex(Math.max(0, Math.min(moves.length - 1, next)));
    setRevision(value => value + 1);
  }
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setRunning(false);
  }, []);
  const notation = moves[index];
  const base = notation[0];
  const cue = getLblAlgGroups('structure', notation.endsWith('2') && base !== 'U' ? base : notation)[0][0].cue;
  const operation = notation === 'U' ? { zh: '勾', en: 'Hook' }
    : notation === "U'" ? { zh: '回', en: 'Back' }
      : notation.endsWith('2') && base !== 'U' ? { zh: `${cue.zh}${cue.zh}`, en: `${cue.en} twice` } : cue;
  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => setPlayRequest(value => value + 1), 1000);
    return () => clearTimeout(timer);
  }, [visible, identity]);
  useEffect(() => {
    if (step < finalStep || (!running && !j)) return;
    let frame = 0;
    let timer = 0;
    const waitForTurn = () => {
      if (document.hidden || player.current?.isUserMovePending?.()) {
        frame = requestAnimationFrame(waitForTurn);
        return;
      }
      if (j) setSettled(true);
      if (running) timer = window.setTimeout(() => setFading(true), j ? 1800 : 1100);
    };
    frame = requestAnimationFrame(waitForTurn);
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
  }, [step, running, finalStep, j]);
  useEffect(() => {
    if (!fading || !running) return;
    const timer = window.setTimeout(() => {
      setStep(0);
      setSettled(false);
      setPlayRequest(0);
      setIndex(value => (value + 1) % moves.length);
      if (j) setRevision(value => value + 1);
      setFading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [fading, running, moves.length, j]);
  return <div className="lbl2-content">
    <section className="lbl2-demonstration lbl2-notation-demonstration" aria-label={tr(j ? { zh: 'J公式轮播演示', en: 'J algorithm demonstration' } : triggers ? { zh: '左右公式轮播演示', en: 'Left and right trigger demonstration' } : { zh: '转动记号轮播演示', en: 'Move notation demonstration' })}>
      <div className="lbl2-notation-player" data-visible={visible && !fading}>
      <AlgPlayer ref={player} key={identity} puzzle="3x3" engine="sim" set={j ? J_LESSON_MASK : ''} alg={moves[index]} startSolved={!j} orientation="z2"
        highlightedStickers={j ? step === 0 ? jStartCorners : settled ? jEndCorners : undefined : undefined}
        sceneRot={LBL_INITIAL_VIEW}
        controlMode="none" hideResetView interactionMode="none" fillPane playRequest={playRequest} onStepChange={setStep} moveDurationMs={1300} />
      </div>
      {mode === 'notation' && <div className="lbl2-notation-controls">
        <PlaybackBar step={index} total={moves.length - 1} playing={running}
          onScrub={select} onSkipStart={() => select(0)} onStepBack={() => select(index - 1)}
          onStepForward={() => select(index + 1)} onSkipEnd={() => select(moves.length - 1)}
          onTogglePlay={() => { setFading(false); setRunning(value => !value); }}
          trailing={<button type="button" className="playback-bar-btn playback-bar-reset-view" aria-label={tr({ zh: '重播当前转法', en: 'Replay this turn' })} onClick={() => select(index)}><RotateCcw size={14} /></button>}
          labels={{ skipStart: tr({ zh: '第一个转法', en: 'First turn' }), stepBack: tr({ zh: '上一个转法', en: 'Previous turn' }),
            play: tr({ zh: '继续轮播', en: 'Resume slideshow' }), pause: tr({ zh: '暂停轮播', en: 'Pause slideshow' }),
            stepForward: tr({ zh: '下一个转法', en: 'Next turn' }), skipEnd: tr({ zh: '最后一个转法', en: 'Last turn' }),
            scrub: tr({ zh: '选择转法', en: 'Choose a turn' }) }} />
      </div>}
    </section>
    <section className={`lbl2-explanation lbl2-notation-copy${j ? ' lbl2-j-overview-copy' : ''}`} aria-live="polite">
      {j ? <>
        <span className="puzzle-art lbl2-j-swap-diagram" aria-hidden="true" dangerouslySetInnerHTML={{ __html: jSwapDiagram }} />
        <p><T zh="一条较长公式，可分三段记忆" en="A longer algorithm you can learn in three parts" /></p>
        <p>{tr(ALG_LESSONS.find(item => item.id === 'l-alg-learning')!.algs[0].naming)}</p>
      </> : triggers ? <>
        <p className="lbl2-lead"><T zh="左公式和右公式是简短的手法。" en="The left and right triggers are short move sequences." /></p>
        <p><T zh="在后面章节会反复出现，组合成其他长公式。" en="They appear throughout later chapters as parts of longer algorithms." /></p>
        <p><T zh="反复练习，形成肌肉记忆。" en="Practise until the moves become muscle memory." /></p>
      </> : <>
        <div className="lbl2-notation-label"><code>{notation.replaceAll("'", '′')}</code><span>{'\u3000\u3000'}{tr(operation)}</span></div>
        <p className="lbl2-lead">{tr(faces[index % 4])} · {tr(variants[Math.floor(index / 4)])}</p>
      </>}
    </section>
  </div>;
}
