'use client';

import { useState } from 'react';
import { Play } from '@app-foundation/icons/lucide';
import AlgPlayer from '@/components/AlgPlayer/AlgPlayer';
import { AlgFormulaReadRow } from '@/components/AlgFormulaRow';
import AppLink from '@/components/AppLink';
import MoreToggle from '@/components/MoreToggle';
import SettingsDialog from '@/components/SettingsDialog';
import { T, tr } from '@/i18n/tr';
import { CUBE_FRAMING_EDGE, LessonPane } from '../components/InteractiveTutorial';
import useTeachingFollow from '../components/useTeachingFollow';
import { TWO_BY_TWO_ORIENTATION } from '../lib/2x2-state';
import { BottomDiagram, EG_CORNER_VIEWS, TopDiagram } from './diagrams';
import {
  EG_BOTTOM, EG_CASES, EG_SETS, EG_SHAPES, EG_WALKTHROUGH, egCase, egCaseName, egMoves,
  type EgCase, type EgSet, type EgShape,
} from './lesson-data';

export function Overview({ onPractice, onWalkthrough }: { onPractice: () => void; onWalkthrough: () => void }) {
  return <div className="course-overview eg-reading eg-overview">
    <h2><T zh="拼好一面，再用一条公式复原" en="Build one face, then solve with one algorithm" /></h2>
    <p><T zh="把四个白格拼到底面。即使侧面的底排还没对齐，也可以停手。底层决定用哪套公式，顶层决定用其中哪一条。"
      en="Put the four white stickers on the bottom. You can stop even when the bottom side rows are mixed. The bottom picks the set, and the top picks an algorithm within it." /></p>
    <ol className="course-overview-steps eg-bottom-examples" role="list">
      {EG_SETS.map(({ id, name }, index) => <li key={id}>
        <div className="course-overview-diagram">
          <BottomDiagram setup={egCase(id, 'S+R').setup} corner={index === 1 ? 1 : 0} />
        </div>
        <div><h3>{name}</h3><p><T {...EG_BOTTOM[id]} /></p></div>
      </li>)}
    </ol>
    <div className="eg-actions">
      <button type="button" className="btn-primary eg-control" onClick={onPractice}><T zh="学看底层" en="Read the bottom" /></button>
      <button type="button" className="btn-secondary eg-control" onClick={onWalkthrough}><T zh="先看一次完整还原" en="Watch a full solve" /></button>
    </div>
    <p className="eg-note"><T zh="会用层先法还原就能开始。学过 FL 的话，拼完整第一层的做法可以直接用在 CLL。"
      en="If you can solve layer by layer, you can start here. If you learned FL, use it to build a full first layer for CLL." /></p>
    <div className="eg-links">
      <AppLink href="/tutorial/2x2-lbl"><T zh="二阶层先法" en="Layer by Layer" /></AppLink>
      <AppLink href="/tutorial/2x2-fl"><T zh="二阶 FL 教程" en="First Layer (FL)" /></AppLink>
    </div>
  </div>;
}

export function BottomGuide({ onPractice }: { onPractice: () => void }) {
  const [set, setSet] = useState<EgSet>('eg1');
  const [corner, setCorner] = useState(0);
  return <LessonPane layout="F" cube={<div className="eg-observation">
    <BottomDiagram setup={egCase(set, 'S+R').setup} size={260} corner={corner} />
    <button type="button" className="btn-secondary eg-control" onClick={() => setCorner(value => (value + 1) % 4)}>
      <T zh="换个角度" en="Change view" />
    </button>
    <span aria-live="polite"><T {...EG_CORNER_VIEWS[corner]} /></span>
  </div>}>
    <div className="course-copy eg-copy">
      <h2><T zh="在白底上方找棒" en="Find bars just above the white face" /></h2>
      <p><T zh="同一个侧面的底排，两格颜色相同，就叫一条棒。先换角度把四个侧面看全。"
        en="Two matching stickers in the bottom row of one side make a bar. Change the view to check all four sides." /></p>
      <div className="eg-actions" role="group" aria-label={tr({ zh: '对照三个底层', en: 'Compare the three bottom layers' })}>
        {EG_SETS.map(item => <button key={item.id} type="button" className="btn-secondary eg-control"
          aria-pressed={set === item.id} onClick={() => setSet(item.id)}>{item.name}</button>)}
      </div>
      <p className="eg-guide-result" aria-live="polite"><T {...EG_BOTTOM[set]} /></p>
      <details className="eg-details">
        <MoreToggle as="summary"><T zh="熟练后只看相邻两面" en="Once comfortable, read just two adjacent faces" /></MoreToggle>
        <p><T zh="看前、右两个底排。两排都同色是 CLL，两排都是对色（红橙或蓝绿）是 EG-2，其余是 EG-1。EG-1 中，棒与那条对色底排相对。"
          en="Read the bottom rows on the front and right. Two matching pairs mean CLL. Two opposite-color pairs (red–orange or blue–green) mean EG-2. The other combinations mean EG-1, whose bar is opposite the row with opposite colors." /></p>
      </details>
      <button type="button" className="btn-primary eg-control" onClick={onPractice}><T zh="自己判一次" en="Try it yourself" /></button>
    </div>
  </LessonPane>;
}

export function ShapeGuide({ onSelect }: { onSelect: (shape: EgShape) => void }) {
  return <div className="eg-reading eg-shape-guide">
    <h2><T zh="先数朝上的黄格，再看侧面的黄格" en="Count yellow on top, then check yellow on the sides" /></h2>
    <p><T zh="俯视图外圈是四个侧面的顶排，图的下方是前面。点一组看它的公式。"
      en="The rim of each overhead diagram shows the upper side stickers. The bottom of the diagram is the front. Choose a shape to see its algorithms." /></p>
    <div className="eg-shape-groups">
      {[4, 1, 2, 0].map(count => <section key={count} aria-label={tr({ zh: `${count} 格黄朝上`, en: `${count} yellow on top` })}>
        <h3><T zh={`${count} 格黄朝上`} en={`${count} yellow on top`} /></h3>
        <ul className="eg-shape-grid" role="list">
          {EG_SHAPES.filter(shape => shape.count === count).map(shape => <li key={shape.id}>
            <button type="button" className="eg-shape-card eg-control" onClick={() => onSelect(shape.id)}>
              <TopDiagram setup={egCase('cll', shape.example).setup} size={76} yellowOnly decorative />
              <span><strong><T {...shape.name} /></strong><span><T {...shape.clue} /></span></span>
            </button>
          </li>)}
        </ul>
      </section>)}
    </div>
  </div>;
}

export function SameShape() {
  const [colored, setColored] = useState(false);
  return <div className="course-overview eg-reading eg-same-shape">
    <h2><T zh="同是右鱼，怎么确定是哪一条？" en="Two Sunes. How do you pick the right algorithm?" /></h2>
    <p><T zh="先把鱼头放到和图相同的位置，再比较侧面的非黄格。把灰格打开，找前面和右面各一块非黄格。"
      en="First place the fish head where the diagram shows it. Reveal the other colors, then compare one non-yellow sticker on the front with one on the right." /></p>
    <ol className="course-overview-steps eg-shape-comparison" data-step-count="2" role="list">
      {['S+U', 'S+R'].map((id, index) => <li key={id}>
        <div className="course-overview-diagram">
          <TopDiagram setup={egCase('cll', id).setup} yellowOnly={!colored} size={176} />
        </div>
        <div>
          <h3>{id}</h3>
          <p className="eg-compare-result" aria-hidden={!colored} data-revealed={colored}>
            {index === 0
              ? <T zh="前、右的非黄格都是橙色，同色。" en="The front and right non-yellow stickers are both orange. They match." />
              : <T zh="前面是绿，右面是橙，两色相邻。" en="The front has green, the right has orange. They are neighboring colors." />}
          </p>
        </div>
      </li>)}
    </ol>
    <button type="button" className="btn-primary eg-control" aria-pressed={colored} onClick={() => setColored(value => !value)}>
      {colored ? <T zh="只看黄色" en="Show only yellow" /> : <T zh="显示侧色" en="Reveal the side colors" />}
    </button>
    <p className="eg-note"><T zh="实物的侧色可能和示意图不同。先对齐黄格，再认侧格的位置，以及哪两格同色、对色或邻色。"
      en="On your cube the side colors can all be shifted around together. Match the yellow positions, then distinguish lookalike cases by where the other stickers are and which colors match, oppose or sit next to each other." /></p>
  </div>;
}

export function EgAlgDialog({ entry, setup = entry.setup, onClose }: { entry: EgCase; setup?: string; onClose: () => void }) {
  const name = EG_SETS.find(set => set.id === entry.set)!.name;
  const label = `${name} · ${tr(egCaseName(entry.id))}`;
  return <SettingsDialog label={label} heading panelClassName="eg-demo-dialog" onClose={onClose}>
    <div className="eg-dialog-copy">
      <code>{entry.alg}</code>
      {entry.set === 'eg1' && <p><T zh="起手前把底层的棒放在后面。" en="Hold the bottom bar at the back." /></p>}
    </div>
    <div className="eg-dialog-cube">
      <AlgPlayer puzzle="2x2" set="" engine="sim" fillPane orientation={TWO_BY_TWO_ORIENTATION}
        setup={setup} alg={entry.alg} moveDurationMs={650} />
    </div>
    <details className="eg-details">
      <MoreToggle as="summary"><T zh="用实物跟练" en="Try it on your cube" /></MoreToggle>
      <p><T zh="从六面复原开始，黄上红前。做下面的打乱，再跟着播放器做公式，最后对齐顶层。"
        en="Start solved with yellow up and red in front. Apply this setup, follow the player, then align the top layer." /></p>
      <code>{setup}</code>
    </details>
  </SettingsDialog>;
}

const setIntro = {
  cll: { zh: '从熟悉的右鱼和左鱼入手。学会一组就放进平常的还原，遇到没学的盘面仍然可以用层先法。',
    en: 'Start with the familiar Sune and Anti-Sune. Use each new case in your solves. Keep using layer by layer for unfamiliar cases.' },
  eg1: { zh: '先转整颗魔方，把底层唯一的棒放到后面，再转 U 对齐顶层图。练习时先用这一种拿法。遇到没学的盘面，可以把底层补齐再用 CLL。',
    en: 'Turn the whole cube to put the only bottom bar at the back, then use U to match the top diagram. Use this grip while learning. For an unfamiliar case, finish the bottom layer and use CLL.' },
  eg2: { zh: '底层无棒时，直接按顶层认盘面。先学全黄的无棒盘面，再按已经熟悉的顶层形状补齐其他情况。',
    en: 'When the bottom has no bar, identify the case from the top. Start with the all-yellow case with no upper bar, then learn the top shapes you already know.' },
};

export function SetGuide({ set, onSelect, onPractice }: {
  set: EgSet; onSelect: (shape: EgShape) => void; onPractice: () => void;
}) {
  const entries = EG_CASES.filter(entry => entry.set === set);
  const starter = set === 'eg2' ? 'o' : 'sune';
  const name = EG_SETS.find(item => item.id === set)!.name;
  return <div className="eg-reading eg-set-guide">
    <h2>{name}</h2>
    <p><T {...EG_BOTTOM[set]} /></p>
    <p><T {...setIntro[set]} /></p>
    <div className="eg-actions">
      <button type="button" className="btn-primary eg-control" onClick={() => onSelect(starter)}>
        {set === 'eg2' ? <T zh="先学全黄组" en="Start with all yellow" /> : <T zh="先学右鱼组" en="Start with Sune" />}
      </button>
      <button type="button" className="btn-secondary eg-control" onClick={onPractice}><T zh="练习这一套" en="Practice this set" /></button>
    </div>
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
  const group = EG_SHAPES.find(item => item.id === shape)!;
  const name = EG_SETS.find(item => item.id === set)!.name;
  const cases = EG_CASES.filter(entry => entry.shape === shape && entry.set === set);
  return <div className="eg-reading eg-index">
    <h2>{name} / <T {...group.name} /></h2>
    <p><T {...group.clue} /> {set === 'eg1' && <T zh="底层的棒放在后面，然后只转顶层对图。"
      en="Put the bottom bar at the back, then turn only the top to match." />}</p>
    {set === 'cll' && shape === 'sune' && <p><T zh="先认 S+U。前、右两块非黄格同色，可以直接用层先法的右鱼公式。"
      en="Start with S+U. When the front and right non-yellow stickers match in this grip, use the Sune you already know from layer by layer." /></p>}
    {set === 'cll' && shape === 'antisune' && <p><T zh="先认 S−U。它和 S+U 左右镜像，正好接上层先法的左鱼公式。"
      en="Start with S−U, the mirror of S+U. It uses the Anti-Sune you already know from layer by layer." /></p>}
    {shape === 'o' && set === 'cll' && <p><T zh="如果顶层也有四条棒，只需要转 U 对齐上下两层。"
      en="If the top also has four bars, align the layers with U and you are done." /></p>}
    <ul className="eg-case-grid" role="list">
      {cases.map(entry => <li key={entry.id} data-site-surface="panel">
        <figure><TopDiagram setup={entry.setup} size={104} lazy /><figcaption><T {...egCaseName(entry.id)} /></figcaption></figure>
        <AlgFormulaReadRow selected actions={<button type="button" className="eg-play eg-control" aria-haspopup="dialog"
          aria-label={`${tr({ zh: '演示', en: 'Play' })} ${tr(egCaseName(entry.id))}`} onClick={() => setDemo(entry)}><Play size="1em" aria-hidden /></button>}>
          <code>{entry.alg}</code>
        </AlgFormulaReadRow>
      </li>)}
    </ul>
    <AppLink className="btn-secondary eg-practice-link" href={`/tutorial/2x2-eg?step=${set}&section=mixed&group=${shape}`}>
      <T zh="练这一组" en="Practice this group" />
    </AppLink>
    {demo && <EgAlgDialog entry={demo} onClose={() => setDemo(null)} />}
  </div>;
}

const { start, face, regrip, align, finish, entry } = EG_WALKTHROUGH;
const stages = [
  { alg: face, title: { zh: '拼白面', en: 'Build the white face' },
    note: { zh: '只差一个白角。把它插到底面，四个白格朝下就停手。', en: 'One white corner is missing. Insert it and stop when all four white stickers face down.' } },
  { alg: regrip, title: { zh: '看底排，摆好棒', en: 'Read the bottom and place the bar' },
    note: { zh: '右侧有唯一一条棒，因此用 EG-1。转整颗魔方，把棒从右边送到后面。', en: 'The only bar is on the right, so this is EG-1. Turn the whole cube to take the bar from right to back.' } },
  { alg: align, title: { zh: '认右鱼，调整顶层', en: 'Recognize Sune and align the top' },
    note: { zh: '一格黄朝上，侧面的黄格都在各自侧面的右边。转 U 对齐右鱼 S+U 的起手图，底层的棒留在后面。', en: 'One yellow faces up and the yellow side stickers sit on the right of their faces. Turn U to match S+U while keeping the bar at the back.' } },
  { alg: entry.alg, title: { zh: '做 EG-1 公式', en: 'Do the EG-1 algorithm' },
    note: { zh: '一条公式同时复原顶层角块和底层错位的角块。', en: 'One algorithm solves the top corners and fixes the swapped bottom corners.' } },
  { alg: finish, title: { zh: '最后对齐顶层（AUF）', en: 'Finish with top alignment (AUF)' },
    note: { zh: '每面上下已经各自同色。再转一次 U，让四个侧面的上下两排相接。', en: 'The rows already match within each layer. One U lines up the top colors with the bottom colors.' } },
].map((stage, index, list) => ({ ...stage, from: list.slice(0, index).reduce((sum, item) => sum + item.alg.split(' ').length, 0) }));
const solve = egMoves(...stages.map(stage => stage.alg));
const markers = stages.slice(1).map(stage => stage.from);

export function Walkthrough() {
  const [step, setStep] = useState(0);
  const current = stages.findLastIndex(stage => step >= stage.from);
  const { paneProps, playbackProps } = useTeachingFollow(step, 'eg-walkthrough');
  return <LessonPane layout="B" captionProps={{ ...paneProps, className: 'tutorial-follow-pane eg-walkthrough-caption' }}
    cube={<div className="course-cube" data-course-cube {...playbackProps}>
      <AlgPlayer puzzle="2x2" set="" engine="sim" fillPane orientation={TWO_BY_TWO_ORIENTATION} maxFramingEdge={CUBE_FRAMING_EDGE}
        setup={start} alg={solve} stepMarkers={markers} pauseAfterSteps={markers} moveDurationMs={720} onStepChange={setStep} />
    </div>}>
    <div className="course-copy eg-copy" data-course-section="eg-walkthrough">
      <h2><T zh="从打乱到六面复原" en="From scramble to solved" /></h2>
      <details className="eg-details">
      <MoreToggle as="summary"><T zh="实物打乱（黄上红前）" en="Set up your cube (yellow up, red front)" /></MoreToggle>
        <code>{start}</code>
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
