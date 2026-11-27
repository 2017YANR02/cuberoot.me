'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, Dice5, Play, Shuffle } from '@app-foundation/icons/lucide';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import { AlgFormulaReadRow } from '@/components/AlgFormulaRow';
import MoreToggle from '@/components/MoreToggle';
import { Tooltip } from '@/components/Tooltip';
import { T, tr } from '@/i18n/tr';
import { syncPlayerToMoveCount } from '@/lib/recon-alg-utils';
import { CUBE_FRAMING_EDGE, LessonPane, TutorialAlgDemo } from '../components/InteractiveTutorial';
import useTeachingFollow from '../components/useTeachingFollow';
import { TWO_BY_TWO_ORIENTATION } from '../lib/2x2-state';
import { BottomDiagram, BottomRecognitionDiagram, TopDiagram } from './diagrams';
import CaseComparisonDialog from './CaseComparisonDialog';
import GroupRecognitionDialog, { groupRecognition, type GroupObservation } from './GroupRecognitionDialog';
import SolveComparison from './SolveComparison';
import {
  EG_BOTTOM, EG_BOTTOM_ROW_LABELS, EG_CASES, EG_SETS, EG_SHAPES, egCase, egCaseName, egMoves,
  type EgCase, type EgSet, type EgShape,
} from './lesson-data';
import { egPalette, useEgOrientation } from './orientation';
import {
  EG_SCRAMBLE_ORIENTATION, EG_WALKTHROUGH, inTeachingColors, loadEgWalkthrough, planEgWalkthrough,
  randomEgWalkthrough, type EgWalkthrough,
} from './walkthrough-data';

export function Overview() {
  return <figure className="eg-reading eg-overview">
    <figcaption className="sr-only"><T zh="拼好一面后，按侧面同色底排的数量选公式组，再用其中一条公式复原。"
      en="Build one face, count the matching bottom rows on its sides, then solve with an algorithm from the corresponding set." /></figcaption>
    <ol className="eg-overview-stages" role="list">
      <li>
        <div className="eg-overview-node eg-overview-panel" data-site-surface="panel">
          <h2><T zh="打乱" en="Scrambled" /></h2>
          <div className="eg-overview-node eg-overview-stage-body">
            <BottomDiagram setup={inTeachingColors(EG_WALKTHROUGH.start, TWO_BY_TWO_ORIENTATION)} size={112} decorative />
          </div>
        </div>
        <div className="eg-overview-link" aria-hidden="true"><ArrowDown /></div>
      </li>
      <li className="eg-overview-options-stage">
        <div className="eg-overview-node eg-overview-panel" data-site-surface="panel">
          <h2><T zh="拼好一面" en="Build one face" /></h2>
          <ul className="eg-overview-branches" role="list">
            {EG_SETS.map(({ id, name }) => <li key={id} className="eg-overview-node">
              <BottomDiagram setup={egCase(id, 'S+R').setup} corner={id === 'eg1' ? 1 : 0} size={112} decorative />
              <span className="eg-overview-detail"><T {...EG_BOTTOM_ROW_LABELS[id]} /></span>
              <strong>{name}</strong>
              <span className="eg-overview-branch-link" aria-hidden="true"><ArrowDown /></span>
            </li>)}
          </ul>
        </div>
      </li>
      <li className="eg-overview-node eg-overview-panel" data-site-surface="panel">
        <h2><T zh="六面复原" en="Solved" /></h2>
        <div className="eg-overview-node eg-overview-stage-body">
          <BottomDiagram setup="" size={112} decorative />
        </div>
      </li>
    </ol>
  </figure>;
}

export function WhyEg() {
  return <div className="eg-reading eg-why">
    <h2><T zh="为什么用 EG" en="Why use EG" /></h2>
    <SolveComparison />
    <p><T zh={<><strong>第一面有更多拼法。</strong> 层先法和 CLL 都要求第一层的侧色对齐。EG 只要拼出一个同色面，侧面暂时没对齐也能接公式，因此有时可以选更短的拼面路线。</>}
      en={<><strong>You have more ways to build the first face.</strong> Layer by Layer and CLL require the first layer’s side colors to match. EG only needs one solid-colored face, so you can sometimes build it in fewer moves.</>} />
    </p>
    <p><T zh={<><strong>拼好一面后，一条公式就能处理上下两层。</strong> Ortega 先翻好顶面，再调整上下两层的角块位置。EG 把这两步合在一起，最后视情况转一转顶层对齐。</>}
      en={<><strong>One algorithm handles both layers.</strong> Ortega orients the top face and then moves the corners of both layers into place. EG combines those steps, with a final top turn when needed.</>} />
    </p>
    <p><T zh={<><strong>可以在观察时就想好整把。</strong> 熟练后，可以在计时开始前规划第一面、预判接哪条公式，以及最后怎样对齐。这样从拼面接到公式时，就可以省去一次停顿。</>}
      en={<><strong>You can plan the entire solve during inspection.</strong> With practice, you can work out the first face, the algorithm that follows, and the final alignment before the timer starts. That can remove the pause after building the face.</>} />
    </p>
    <p><T zh={`完整 EG 共有 ${EG_CASES.length} 条公式。除了记公式，还要看底层选对公式组，再看顶层认出具体的 case。实际能省多少时间，要看这把打乱，以及你识别和做公式有多熟练。`}
      en={`Full EG has ${EG_CASES.length} algorithms. Alongside learning the algorithms, you need to recognize the bottom set and the specific top case. Any time saved depends on the scramble and how fluently you recognize and execute the algorithm.`} />
    </p>
  </div>;
}

const egAlgView = { x: Math.PI / 6, y: Math.PI / 6, z: 0 };

function EgAlgDialog({ entry, onClose }: { entry: EgCase; onClose: () => void }) {
  const { setup } = entry;
  const orientation = useEgOrientation();
  const palette = egPalette(orientation);
  const top = palette.name('U');
  const front = palette.name('F');
  const name = EG_SETS.find(set => set.id === entry.set)!.name;
  const caseName = egCaseName(entry.id);
  const title = { zh: `${name} · ${caseName.zh}`, en: `${name} · ${caseName.en}` };
  return <TutorialAlgDemo puzzle="2x2" orientation={orientation} view={egAlgView} handToggle onClose={onClose}
    insertion={{ progressLabel: title, demoTitle: title, demoSetup: setup, hideDemoDetail: true,
      steps: entry.alg.split(/\s+/).map(notation => ({ notation })) }}>
    <div className="eg-dialog-copy">
      {entry.set === 'eg1' && <p><T zh="起手前把底层的棒放在后面。" en="Hold the bottom bar at the back." /></p>}
      <details className="eg-details">
        <MoreToggle as="summary"><T zh="用实物跟练" en="Try it on your cube" /></MoreToggle>
        <p><T zh={`从六面复原开始，${top.zh}上${front.zh}前。做下面的打乱，再跟着播放器做公式，最后对齐顶层。`}
          en={`Start solved with ${top.en} up and ${front.en} in front. Apply this setup, follow the player, then align the top layer.`} /></p>
        <code>{setup}</code>
      </details>
    </div>
  </TutorialAlgDemo>;
}

const setIntro = {
  cll: { zh: '从熟悉的右鱼和左鱼入手。学会一组就放进平常的还原，遇到没学过的 case仍然可以用层先法。',
    en: 'Start with the familiar Sune and Anti-Sune. Use each new case in your solves. Keep using layer by layer for unfamiliar cases.' },
  eg1: { zh: '转 U 对齐顶层图，再做公式。遇到没学过的 case，可以把底层补齐再用 CLL。',
    en: 'Use U to match the top diagram before starting the algorithm. For an unfamiliar case, finish the bottom layer and use CLL.' },
  eg2: { zh: '按顶层图找公式。可以先学顶面齐色、顶层无棒的 case，再学熟悉的顶层形状对应的 case。',
    en: 'Use the top diagram to identify the case. Start with the solid top and no upper bar, then learn the top shapes you already know.' },
};

export function SetGuide({ set, onSelect }: {
  set: EgSet; onSelect: (shape: EgShape) => void;
}) {
  const entries = EG_CASES.filter(entry => entry.set === set);
  const name = EG_SETS.find(item => item.id === set)!.name;
  return <div className="eg-reading eg-set-guide">
    <h2>{name}</h2>
    <figure className="eg-set-bottom-guide">
      <BottomRecognitionDiagram setup={egCase(set, 'S+R').setup} />
      <figcaption>
        <h3><T {...EG_BOTTOM_ROW_LABELS[set]} /></h3>
        <p><T {...EG_BOTTOM[set]} /></p>
      </figcaption>
    </figure>
    <p><T {...setIntro[set]} /></p>
    <ul className="eg-case-groups" role="list">
      {EG_SHAPES.map(shape => <li key={shape.id}>
        <button type="button" className="eg-shape-card eg-control" onClick={() => onSelect(shape.id)}>
          <TopDiagram setup={egCase(set, shape.example).setup} size={72} topOnly decorative />
          <span><strong><T {...shape.name} /></strong>
            <T zh={`${entries.filter(entry => entry.shape === shape.id).length} 条公式`}
              en={`${entries.filter(entry => entry.shape === shape.id).length} algorithms`} /></span>
        </button>
      </li>)}
    </ul>
  </div>;
}

const compareCaseLabels = [
  { zh: '选两张图', en: 'Pick 2 cubes' },
  { zh: '再选一张', en: 'Pick 1 more' },
  { zh: '查看对比', en: 'Compare' },
];

export function CaseIndex({ set, shape }: { set: EgSet; shape: EgShape }) {
  const top = egPalette(useEgOrientation()).name('U');
  const [demo, setDemo] = useState<EgCase | null>(null);
  const [selected, setSelected] = useState<EgCase[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [showRecognition, setShowRecognition] = useState(false);
  const [observations, setObservations] = useState<GroupObservation[]>([]);
  const recognition = showRecognition ? groupRecognition(set, shape, observations) : null;
  const candidates = recognition && observations.length > 0 ? new Set(recognition.entries.map(entry => entry.id)) : null;
  const group = EG_SHAPES.find(item => item.id === shape)!;
  const name = EG_SETS.find(item => item.id === set)!.name;
  const cases = EG_CASES.filter(entry => entry.shape === shape && entry.set === set);
  const selectCase = (entry: EgCase) => setSelected(previous => previous.includes(entry)
    ? previous.filter(item => item !== entry) : [...previous.slice(-1), entry]);
  function closeRecognition() {
    setShowRecognition(false);
    setObservations([]);
  }
  return <div className="eg-reading eg-index">
    <header className="eg-index-header">
      <h2>{name} / <T {...group.name} /></h2>
      <p><T {...group.clue(top)} /> {set === 'eg1' && <T zh="底层的棒放在后面，然后只转顶层对图。"
        en="Put the bottom bar at the back, then turn only the top to match." />}</p>
      <div className="eg-case-compare-controls">
        <button type="button" className="btn-primary eg-control" aria-haspopup="dialog"
          onClick={() => setShowRecognition(true)}><T zh="辨识这一组" en="Recognize this group" /></button>
        <button type="button" className="btn-secondary eg-control eg-compare-button" aria-haspopup="dialog"
          disabled={selected.length !== 2} onClick={() => setShowComparison(true)}>
          <T {...compareCaseLabels[selected.length]} /> ({selected.length}/2)
        </button>
      </div>
    </header>
    <ul className="eg-case-grid" role="list">
      {cases.map(entry => <li key={entry.id} data-site-surface="panel" data-recognition-match={candidates?.has(entry.id)}>
        <button type="button" className="eg-case-select" aria-pressed={selected.includes(entry)} onClick={() => selectCase(entry)}>
          <TopDiagram setup={entry.setup} size={104} lazy decorative /><span><T {...egCaseName(entry.id)} /></span>
        </button>
        <AlgFormulaReadRow selected actions={<button type="button" className="eg-play eg-control" aria-haspopup="dialog"
          aria-label={`${tr({ zh: '演示', en: 'Play' })} ${tr(egCaseName(entry.id))}`} onClick={() => setDemo(entry)}><Play size="1em" aria-hidden /></button>}>
          <code>{entry.alg}</code>
        </AlgFormulaReadRow>
      </li>)}
    </ul>
    {recognition && <GroupRecognitionDialog set={set} recognition={recognition} observations={observations} paused={!!demo}
      onObserve={observation => setObservations(previous => [...previous, observation])}
      onBack={() => setObservations(previous => previous.slice(0, -1))}
      onReset={() => setObservations([])} onClose={closeRecognition} onLearn={setDemo} />}
    {demo && <EgAlgDialog entry={demo} onClose={() => setDemo(null)} />}
    {showComparison && selected.length === 2 && <CaseComparisonDialog first={selected[0]} second={selected[1]} onClose={() => setShowComparison(false)} />}
  </div>;
}

function walkthroughStages(example: EgWalkthrough | null, orientation: string) {
  if (!example) return { stages: [], solve: '', markers: [] };
  const { face, hold, regrip, align, entry, finish } = example;
  const bottom = egPalette(orientation).name('D');
  const set = EG_SETS.find(item => item.id === entry.set)!.name;
  const caseName = egCaseName(entry.id);
  const sections = [
    { alg: face, title: { zh: `拼${bottom.zh}面`, en: `Build the ${bottom.en} face` } },
    { alg: egMoves(hold, regrip, align), title: { zh: '摆好公式起手位', en: 'Set up the algorithm starting position' } },
    { alg: entry.alg, title: { zh: `选 ${set} 的 ${caseName.zh} 公式`, en: `Use the ${set} algorithm for ${caseName.en}` } },
    { alg: finish, title: { zh: '对齐顶层（AUF）', en: 'AUF' } },
  ].filter(section => section.alg);
  let moves = 0;
  const stages = sections.map(section => {
    const from = moves;
    moves += section.alg.split(' ').length;
    return { ...section, from };
  });
  return { stages, solve: egMoves(...stages.map(stage => stage.alg)), markers: stages.slice(1).map(stage => stage.from) };
}

export function Walkthrough() {
  const orientation = useEgOrientation();
  const player = useRef<AlgPlayerHandle>(null);
  const [scramble, setScramble] = useState(EG_WALKTHROUGH);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const example = useMemo(() => planEgWalkthrough(scramble, orientation), [scramble, orientation]);
  const { stages, solve, markers } = useMemo(() => walkthroughStages(example, orientation), [example, orientation]);
  const current = stages.findLastIndex(stage => step >= stage.from);
  const lessonKey = `${scramble.start}:${orientation}`;
  const randomCaseLabel = tr({ zh: '随机换例', en: 'Random case' });
  const { paneProps, playbackProps } = useTeachingFollow(step, lessonKey);

  useEffect(() => {
    if (example) return;
    let cancelled = false;
    void loadEgWalkthrough(scramble.start).then(prepared => {
      if (!cancelled) setScramble(current => current === scramble ? prepared : current);
    }, () => {
      if (!cancelled) setFailed(true);
    });
    return () => { cancelled = true; };
  }, [example, scramble]);

  async function shuffle() {
    setLoading(true);
    setFailed(false);
    try {
      setScramble(await randomEgWalkthrough(scramble.start));
      setStep(0);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return <LessonPane layout="B" captionProps={{ className: 'eg-walkthrough-caption' }}
    cube={<div className="course-cube" data-course-cube {...playbackProps}>
      <AlgPlayer ref={player} key={lessonKey} puzzle="2x2" set="" engine="sim" fillPane maxFramingEdge={CUBE_FRAMING_EDGE}
        orientation={EG_SCRAMBLE_ORIENTATION} setup={scramble.start} alg={solve} stepMarkers={markers}
        pauseAfterSteps={markers} sectionPauseMs={600} moveDurationMs={720} onStepChange={setStep} />
    </div>}>
    <div className="course-copy eg-copy" data-course-section="eg-walkthrough">
      <p className="eg-walkthrough-scramble">
        <Tooltip content={tr({ zh: '白顶绿前', en: 'White up, green front' })}>{tip =>
          <span {...tip} tabIndex={0} role="img" aria-label={tr({ zh: '打乱，白顶绿前', en: 'Scramble, white up and green front' })}>
            <Shuffle size="1em" aria-hidden="true" />
          </span>}
        </Tooltip>
        <code key={scramble.start} tabIndex={0}>{scramble.start}</code>
        <Tooltip content={randomCaseLabel} disabled={loading}>{tip =>
          <button {...tip} type="button" className="btn-secondary eg-random-case" aria-label={randomCaseLabel}
            disabled={loading} aria-busy={loading} onClick={shuffle}>
            <Dice5 size={16} aria-hidden="true" />
          </button>
        }</Tooltip>
      </p>
      <div className="eg-walkthrough-stages" {...paneProps}>
        <ol className="eg-demo-stages">
          {stages.map((stage, index) => <li key={stage.from}>
            <button type="button" className="eg-demo-stage-button" aria-current={index === current ? 'step' : undefined}
              onClick={() => syncPlayerToMoveCount(player.current?.getPlayer(), stage.from)}>
              <span className="eg-demo-stage-title"><T {...stage.title} /></span>
              <code>{stage.alg}</code>
            </button>
          </li>)}
        </ol>
      </div>
      {failed && <p role="status">{example
        ? <T zh="换例失败，请重试。" en="Couldn’t load another case. Try again." />
        : <T zh="示范加载失败，请随机换例。" en="Couldn’t load the walkthrough. Try another case." />}</p>}
    </div>
  </LessonPane>;
}

export function Beyond() {
  const top = egPalette(useEgOrientation()).name('U');
  return <div className="eg-reading eg-beyond">
    <h2><T zh="把识别提到观察阶段" en="Move recognition into inspection" /></h2>
    <ol>
      <li><T zh="先追踪拼底面时会落下去的角，预判底层是 CLL、EG-1 还是 EG-2。"
        en="Trace the corners that will go down and predict whether you will get CLL, EG-1 or EG-2." /></li>
      <li><T zh={`然后在转动之前预判顶层的${top.zh}格形状。练熟后再加侧色，尝试预判到具体公式。`}
        en={`Next, predict the pattern of ${top.en} stickers before turning. Once that is comfortable, track the side colors and predict the exact algorithm.`} /></li>
      <li><T zh="最后练 AUF。选一个显眼的顶角侧色，记住它做完公式会去哪一面，再和底排对齐。"
        en="Add AUF last. Follow one distinctive top-corner side sticker through the algorithm and use its destination to align with the bottom." /></li>
    </ol>
    <h3><T zh="补充演示" en="More demonstrations" /></h3>
    <ul>
      <li><a href="https://jperm.net/2x2/faster" target="_blank" rel="noreferrer"><T zh="J Perm 二阶进阶系列（含底面规划与 EG-1）" en="J Perm’s advanced 2×2 series, including first-face planning and EG-1" /></a></li>
      <li><a href="https://www.youtube.com/watch?v=FGffhaPiryE" target="_blank" rel="noreferrer"><T zh="J Perm 的 EG-2 与 Anti-CLL 示范" en="J Perm’s EG-2 and Anti-CLL demonstration" /></a></li>
      <li><a href="https://www.youtube.com/watch?v=6-7YaX1Lcs0" target="_blank" rel="noreferrer"><T zh="J Perm 的一观预判示范" en="J Perm’s one-looking demonstration" /></a></li>
    </ul>
    <p className="eg-note"><T zh="公式沿用 CubeRoot《2×2 EG》讲义的分组与编号，部分 case 的公式来自站内公式库。"
      en="The case groups and labels come from CubeRoot’s 2×2 EG handout. Some algorithms come from the site’s catalog." /></p>
  </div>;
}
