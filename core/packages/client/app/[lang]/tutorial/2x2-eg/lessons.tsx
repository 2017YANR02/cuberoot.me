'use client';

import { useMemo, useState } from 'react';
import { Face } from '@cuberoot/visualcube';
import { ArrowDown, Play } from '@app-foundation/icons/lucide';
import AlgPlayer from '@/components/AlgPlayer/AlgPlayer';
import { AlgFormulaReadRow } from '@/components/AlgFormulaRow';
import BoolToggle from '@/components/BoolToggle';
import MoreToggle from '@/components/MoreToggle';
import { T, tr } from '@/i18n/tr';
import { CUBE_FRAMING_EDGE, LessonPane, TutorialAlgDemo } from '../components/InteractiveTutorial';
import useTeachingFollow from '../components/useTeachingFollow';
import { TWO_BY_TWO_ORIENTATION, twoByTwoState } from '../lib/2x2-state';
import { BottomDiagram, EG_DIRECTIONS, TopDiagram } from './diagrams';
import CaseComparisonDialog from './CaseComparisonDialog';
import GroupRecognitionDialog from './GroupRecognitionDialog';
import SolveComparison from './SolveComparison';
import {
  EG_BOTTOM, EG_CASES, EG_SETS, EG_SHAPES, EG_WALKTHROUGH, egBottomRows, egCase, egCaseName, egMoves, randomEgWalkthrough,
  type EgCase, type EgSet, type EgShape, type EgWalkthrough,
} from './lesson-data';

const overviewRows = {
  cll: { zh: '4 个同色底排', en: '4 matching bottom rows' },
  eg1: { zh: '1 个同色底排', en: '1 matching bottom row' },
  eg2: { zh: '0 个同色底排', en: '0 matching bottom rows' },
} satisfies Record<EgSet, { zh: string; en: string }>;

export function Overview() {
  return <figure className="eg-reading eg-overview">
    <figcaption className="sr-only"><T zh="拼好一面后，按侧面同色底排的数量选公式组，再用其中一条公式复原。"
      en="Build one face, count the matching bottom rows on its sides, then solve with an algorithm from the corresponding set." /></figcaption>
    <ol className="eg-overview-stages" role="list">
      <li>
        <div className="eg-overview-node eg-overview-panel" data-site-surface="panel">
          <h2><T zh="打乱" en="Scrambled" /></h2>
          <div className="eg-overview-node eg-overview-stage-body">
            <BottomDiagram setup={EG_WALKTHROUGH.start} size={112} decorative />
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
              <span className="eg-overview-detail"><T {...overviewRows[id]} /></span>
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
    <p><T zh={`完整 EG 有 ${EG_CASES.length} 个公式案例。除了记公式，还要认出底层属于哪一套、顶层是哪一例。实际能省多少时间，取决于打乱、识别和公式执行的熟练度。`}
      en={`Full EG covers ${EG_CASES.length} algorithm cases. Alongside learning the algorithms, you need to recognize the bottom set and the specific top case. Any time saved depends on the scramble and how fluently you recognize and execute the algorithm.`} />
    </p>
  </div>;
}

const egAlgView = { x: Math.PI / 6, y: Math.PI / 6, z: 0 };

export function EgAlgDialog({ entry, setup = entry.setup, onClose }: { entry: EgCase; setup?: string; onClose: () => void }) {
  const name = EG_SETS.find(set => set.id === entry.set)!.name;
  const caseName = egCaseName(entry.id);
  const title = { zh: `${name} · ${caseName.zh}`, en: `${name} · ${caseName.en}` };
  return <TutorialAlgDemo puzzle="2x2" orientation={TWO_BY_TWO_ORIENTATION} view={egAlgView} handToggle onClose={onClose}
    insertion={{ progressLabel: title, demoTitle: title, demoSetup: setup, hideDemoDetail: true,
      steps: entry.alg.split(/\s+/).map(notation => ({ notation })) }}>
    <div className="eg-dialog-copy">
      {entry.set === 'eg1' && <p><T zh="起手前把底层的棒放在后面。" en="Hold the bottom bar at the back." /></p>}
      <details className="eg-details">
        <MoreToggle as="summary"><T zh="用实物跟练" en="Try it on your cube" /></MoreToggle>
        <p><T zh="从六面复原开始，黄上红前。做下面的打乱，再跟着播放器做公式，最后对齐顶层。"
          en="Start solved with yellow up and red in front. Apply this setup, follow the player, then align the top layer." /></p>
        <code>{setup}</code>
      </details>
    </div>
  </TutorialAlgDemo>;
}

const setIntro = {
  cll: { zh: '从熟悉的右鱼和左鱼入手。学会一组就放进平常的还原，遇到没学的盘面仍然可以用层先法。',
    en: 'Start with the familiar Sune and Anti-Sune. Use each new case in your solves. Keep using layer by layer for unfamiliar cases.' },
  eg1: { zh: '先转整颗魔方，把底层唯一的棒放到后面，再转 U 对齐顶层图。练习时先用这一种拿法。遇到没学的盘面，可以把底层补齐再用 CLL。',
    en: 'Turn the whole cube to put the only bottom bar at the back, then use U to match the top diagram. Use this grip while learning. For an unfamiliar case, finish the bottom layer and use CLL.' },
  eg2: { zh: '底层无棒时，直接按顶层认盘面。先学全黄的无棒盘面，再按已经熟悉的顶层形状补齐其他情况。',
    en: 'When the bottom has no bar, identify the case from the top. Start with the all-yellow case with no upper bar, then learn the top shapes you already know.' },
};

export function SetGuide({ set, onSelect }: {
  set: EgSet; onSelect: (shape: EgShape) => void;
}) {
  const entries = EG_CASES.filter(entry => entry.set === set);
  const name = EG_SETS.find(item => item.id === set)!.name;
  return <div className="eg-reading eg-set-guide">
    <h2>{name}</h2>
    <p><T {...EG_BOTTOM[set]} /></p>
    <p><T {...setIntro[set]} /></p>
    <ul className="eg-case-groups" role="list">
      {EG_SHAPES.map(shape => <li key={shape.id}>
        <button type="button" className="eg-shape-card eg-control" onClick={() => onSelect(shape.id)}>
          <TopDiagram setup={egCase(set, shape.example).setup} size={72} yellowOnly decorative />
          <span><strong><T {...shape.name} /></strong>
            <T zh={`${entries.filter(entry => entry.shape === shape.id).length} 条公式`}
              en={`${entries.filter(entry => entry.shape === shape.id).length} algorithms`} /></span>
        </button>
      </li>)}
    </ul>
  </div>;
}

export function CaseIndex({ set, shape }: { set: EgSet; shape: EgShape }) {
  const [demo, setDemo] = useState<EgCase | null>(null);
  const [compare, setCompare] = useState(false);
  const [selected, setSelected] = useState<EgCase[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [showRecognition, setShowRecognition] = useState(false);
  const group = EG_SHAPES.find(item => item.id === shape)!;
  const name = EG_SETS.find(item => item.id === set)!.name;
  const cases = EG_CASES.filter(entry => entry.shape === shape && entry.set === set);
  const selectCase = (entry: EgCase) => setSelected(previous => previous.includes(entry)
    ? previous.filter(item => item !== entry) : [...previous.slice(-1), entry]);
  return <div className="eg-reading eg-index">
    <h2>{name} / <T {...group.name} /></h2>
    <p><T {...group.clue} /> {set === 'eg1' && <T zh="底层的棒放在后面，然后只转顶层对图。"
      en="Put the bottom bar at the back, then turn only the top to match." />}</p>
    <div className="eg-case-compare-controls">
      <button type="button" className="btn-primary eg-control" aria-haspopup="dialog"
        onClick={() => setShowRecognition(true)}><T zh="辨识这一组" en="Recognize this group" /></button>
      <BoolToggle label={tr({ zh: '对比案例', en: 'Compare cases' })} value={compare} onChange={value => {
        setCompare(value);
        if (!value) setSelected([]);
      }} />
      {compare && <button type="button" className="btn-secondary eg-control" aria-haspopup="dialog" disabled={selected.length !== 2}
        onClick={() => setShowComparison(true)}><T zh={`查看对比 (${selected.length}/2)`} en={`Compare (${selected.length}/2)`} /></button>}
    </div>
    <ul className="eg-case-grid" role="list">
      {cases.map(entry => <li key={entry.id} data-site-surface="panel">
        {compare ? <button type="button" className="eg-case-select" aria-pressed={selected.includes(entry)} onClick={() => selectCase(entry)}>
          <TopDiagram setup={entry.setup} size={104} lazy decorative /><span><T {...egCaseName(entry.id)} /></span>
        </button> : <figure><TopDiagram setup={entry.setup} size={104} lazy /><figcaption><T {...egCaseName(entry.id)} /></figcaption></figure>}
        <AlgFormulaReadRow selected actions={<button type="button" className="eg-play eg-control" aria-haspopup="dialog"
          aria-label={`${tr({ zh: '演示', en: 'Play' })} ${tr(egCaseName(entry.id))}`} onClick={() => setDemo(entry)}><Play size="1em" aria-hidden /></button>}>
          <code>{entry.alg}</code>
        </AlgFormulaReadRow>
      </li>)}
    </ul>
    {demo && <EgAlgDialog entry={demo} onClose={() => setDemo(null)} />}
    {showRecognition && <GroupRecognitionDialog set={set} shape={shape} onClose={() => setShowRecognition(false)}
      onLearn={entry => { setShowRecognition(false); setDemo(entry); }} />}
    {showComparison && selected.length === 2 && <CaseComparisonDialog first={selected[0]} second={selected[1]} onClose={() => setShowComparison(false)} />}
  </div>;
}

function walkthroughStages({ start, face, regrip, align, entry, finish }: EgWalkthrough) {
  const shape = EG_SHAPES.find(item => item.id === entry.shape)!;
  const set = EG_SETS.find(item => item.id === entry.set)!.name;
  const caseName = egCaseName(entry.id);
  const white = twoByTwoState(start)[Face.D].filter(sticker => sticker === 'W').length;
  const bar = EG_DIRECTIONS[egBottomRows(egMoves(start, face)).findIndex(row => row[0] === row[1])];
  const bottomNote = entry.set === 'cll'
    ? { zh: '侧面的底排各自同色，选 CLL。', en: 'All four bottom rows match, so use CLL.' }
    : { zh: '侧面没有同色底排，选 EG-2。', en: 'None of the bottom rows match, so use EG-2.' };
  const sections = [
    { alg: face, title: { zh: '拼白面', en: 'Build the white face' },
      note: { zh: `打乱后有 ${white} 个白格朝下。做完这段，四个白格都朝下。`,
        en: `The scramble leaves ${white} of the four white stickers facing down. This sequence brings all four down.` } },
    ...(regrip && bar ? [{ alg: regrip, title: { zh: '把同色底排转到后面', en: 'Turn the matching bottom row to the back' },
      note: { zh: `${bar.zh}面有唯一的同色底排，选 EG-1。转整颗魔方，把它放到后面。`,
        en: `The only matching bottom row is on the ${bar.en.toLowerCase()}, so use EG-1. Turn the whole cube to put that row at the back.` } }] : []),
    { alg: align, title: { zh: '识别并对齐顶层', en: 'Recognize and align the top' },
      note: { zh: `${regrip ? '' : bottomNote.zh}${shape.clue.zh}转顶层，对齐 ${caseName.zh} 的起手位置。`,
        en: `${regrip ? '' : bottomNote.en + ' '}${shape.clue.en} Turn the top to match the starting orientation for ${caseName.en}.` } },
    { alg: entry.alg, title: { zh: `做 ${set} 公式`, en: `Apply the ${set} algorithm` },
      note: finish ? { zh: `执行 ${caseName.zh} 的公式。做完后，只差最后一次顶层对齐。`,
        en: `Apply the algorithm for ${caseName.en}. Only the final top alignment remains.` }
        : { zh: `执行 ${caseName.zh} 的公式，完成六面复原。`, en: `Apply the algorithm for ${caseName.en} to solve all six faces.` } },
    ...(finish ? [{ alg: finish, title: { zh: '最后对齐顶层（AUF）', en: 'Finish with top alignment (AUF)' },
      note: { zh: '上下两层已经各自齐色。按这里的记号转顶层，让四个侧面的上下两排对齐。',
        en: 'Each layer now matches on its own. Turn the top as shown to line up the rows on all four sides.' } }] : []),
  ];
  let moves = 0;
  const stages = sections.map(section => {
    const from = moves;
    moves += section.alg.split(' ').length;
    return { ...section, from };
  });
  return { stages, solve: egMoves(...stages.map(stage => stage.alg)), markers: stages.slice(1).map(stage => stage.from) };
}

export function Walkthrough() {
  const [example, setExample] = useState(EG_WALKTHROUGH);
  const [step, setStep] = useState(0);
  const { stages, solve, markers } = useMemo(() => walkthroughStages(example), [example]);
  const current = stages.findLastIndex(stage => step >= stage.from);
  const exampleKey = `${example.entry.set}/${example.entry.id}:${example.start}`;
  const { paneProps, playbackProps } = useTeachingFollow(step, exampleKey);

  function shuffle() {
    setExample(randomEgWalkthrough(example.entry));
    setStep(0);
  }

  return <LessonPane layout="B" captionProps={{ ...paneProps, className: 'tutorial-follow-pane eg-walkthrough-caption' }}
    cube={<div className="course-cube" data-course-cube {...playbackProps}>
      <AlgPlayer key={exampleKey} puzzle="2x2" set="" engine="sim" fillPane orientation={TWO_BY_TWO_ORIENTATION} maxFramingEdge={CUBE_FRAMING_EDGE}
        setup={example.start} alg={solve} stepMarkers={markers} pauseAfterSteps={markers} moveDurationMs={720} onStepChange={setStep} />
    </div>}>
    <div className="course-copy eg-copy" data-course-section="eg-walkthrough">
      <h2><T zh="从打乱到六面复原" en="From scramble to solved" /></h2>
      <div className="eg-actions">
        <button type="button" className="btn-secondary eg-control" onClick={shuffle}><T zh="随机换例" en="Random case" /></button>
      </div>
      <details className="eg-details">
        <MoreToggle as="summary"><T zh="实物打乱（黄上红前）" en="Set up your cube (yellow up, red front)" /></MoreToggle>
        <code>{example.start}</code>
      </details>
      <ol className="eg-demo-stages">
        {stages.map((stage, index) => <li key={stage.from} aria-current={index === current ? 'step' : undefined}>
          <h3><T {...stage.title} /></h3><code>{stage.alg}</code><p><T {...stage.note} /></p>
        </li>)}
      </ol>
    </div>
  </LessonPane>;
}

export function Beyond() {
  return <div className="eg-reading eg-beyond">
    <h2><T zh="把识别提到观察阶段" en="Move recognition into inspection" /></h2>
    <ol>
      <li><T zh="先追踪拼底面时会落下去的角，预判底层是 CLL、EG-1 还是 EG-2。"
        en="Trace the corners that will go down and predict whether you will get CLL, EG-1 or EG-2." /></li>
      <li><T zh="然后在转动之前预判顶层的黄格形状。练熟后再加侧色，尝试预判到具体公式。"
        en="Next, predict the top yellow shape before turning. Once that is comfortable, track the side colors and predict the exact algorithm." /></li>
      <li><T zh="最后练 AUF。选一个显眼的顶角侧色，记住它做完公式会去哪一面，再和底排对齐。"
        en="Add AUF last. Follow one distinctive top-corner side sticker through the algorithm and use its destination to align with the bottom." /></li>
    </ol>
    <h3><T zh="补充演示" en="More demonstrations" /></h3>
    <ul>
      <li><a href="https://jperm.net/2x2/faster" target="_blank" rel="noreferrer"><T zh="J Perm 二阶进阶系列（含底面规划与 EG-1）" en="J Perm’s advanced 2×2 series, including first-face planning and EG-1" /></a></li>
      <li><a href="https://www.youtube.com/watch?v=FGffhaPiryE" target="_blank" rel="noreferrer"><T zh="J Perm 的 EG-2 与 Anti-CLL 示范" en="J Perm’s EG-2 and Anti-CLL demonstration" /></a></li>
      <li><a href="https://www.youtube.com/watch?v=6-7YaX1Lcs0" target="_blank" rel="noreferrer"><T zh="J Perm 的一观预判示范" en="J Perm’s one-looking demonstration" /></a></li>
    </ul>
    <p className="eg-note"><T zh="公式沿用 CubeRoot《2×2 EG》讲义的分组与编号，部分盘面采用站内公式库的选法。"
      en="The case groups and labels come from CubeRoot’s 2×2 EG handout. Some algorithms come from the site’s catalog." /></p>
  </div>;
}
