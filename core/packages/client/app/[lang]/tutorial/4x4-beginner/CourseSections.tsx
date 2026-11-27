'use client';

import { useRef, useState, type ComponentProps } from 'react';
import { ArrowRight } from '@app-foundation/icons/lucide';
import { Axis } from '@cuberoot/visualcube';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import AppLink from '@/components/AppLink';
import { VisualCube } from '@/components/VisualCube';
import { T, tr } from '@/i18n/tr';
import { CUBE_FRAMING_EDGE, LessonPane } from '../components/InteractiveTutorial';
import InteractiveQuestionCopy from '../components/InteractiveQuestionCopy';
import useTeachingFollow from '../components/useTeachingFollow';
import {
  centersDoneSetup, edgesDoneSetup, FLIP, LAST_TWO, OLL, ORIENTATION, PLL, SCHEME,
  type Demo,
} from './lesson-data';

type Text = { zh: string; en: string };
type DiagramProps = Partial<Pick<ComponentProps<typeof VisualCube>, 'setup' | 'view' | 'outlinedFacelets' | 'viewportRotations'>>;
export type CaseQuestion = DiagramProps & {
  progressLabel: Text;
  heading: Text;
  prompt: Text;
  alt: Text;
  choices: readonly Text[];
  answer: number;
  hint: Text;
  explanation: Text;
};

export const FRONT_VIEW: DiagramProps['viewportRotations'] = [[Axis.Y, 8], [Axis.X, -20]];

function Diagram({ alt, size, view = 'iso', ...props }: DiagramProps & { alt: Text; size: number }) {
  return <VisualCube puzzleSize={4} view={view} scheme={SCHEME} size={size} local alt={tr(alt)} {...props} />;
}

export function Playback({ demo, checkpointPause = false }: {
  demo: Demo;
  checkpointPause?: boolean;
}) {
  const [position, setPosition] = useState(0);
  const [ready, setReady] = useState(false);
  const player = useRef<AlgPlayerHandle>(null);
  const { paneProps, playbackProps, resume } = useTeachingFollow(position, demo.title.en);
  let from = 0;
  const phases = demo.phases.map(phase => {
    const moves = phase.moves.split(' ');
    const start = from;
    from += moves.length;
    return { ...phase, moves, start, end: from };
  });
  const markers = phases.slice(1).map(phase => phase.start);
  const playMove = (move: number) => {
    resume();
    player.current?.playMove?.(move);
  };

  return <LessonPane layout="B" captionProps={{ ...paneProps, className: 'four-reduction-caption' }} cube={
    <div className="course-cube" data-course-cube data-ready={ready} data-drag-enabled={ready} {...playbackProps}>
      <AlgPlayer ref={player} puzzle="4x4" set="" orientation={ORIENTATION} fillPane
        setup={demo.setup} startSolved={!demo.setup} alg={demo.phases.map(phase => phase.moves).join(' ')}
        maxFramingEdge={CUBE_FRAMING_EDGE} stepMarkers={markers} moveDurationMs={checkpointPause ? 520 : 720}
        pauseAfterSteps={checkpointPause ? markers : undefined}
        onStepChange={setPosition} onReady={() => setReady(true)} />
    </div>
  }>
    <div className="course-copy four-reduction-phases">
      <h2><T {...demo.title} /></h2>
      <p><T {...demo.intro} /></p>
      <ol className="four-reduction-steps" role="list">
        {phases.map(({ title, note, moves, start, end }) => <li key={start}
          aria-current={position >= start && (position < end || position === from && end === from) ? 'step' : undefined}>
          <button type="button" className="four-reduction-phase-jump" onClick={() => playMove(start)} disabled={!ready}>
            <T {...title} />
          </button>
          <div className="four-reduction-moves">
            {moves.map((move, index) => <button key={start + index} type="button" disabled={!ready}
              data-active={position === start + index + 1 || undefined} onClick={() => playMove(start + index)}
              aria-label={tr({ zh: `播放第 ${start + index + 1} 步 ${move}`, en: `Play move ${start + index + 1}, ${move}` })}>
              <code>{move}</code>
            </button>)}
          </div>
          <p><T {...note} /></p>
        </li>)}
      </ol>
      {demo.result && <p className="four-reduction-note"><T {...demo.result} /></p>}
    </div>
  </LessonPane>;
}

export function Recognition({ sectionId, questions, nextSection }: {
  sectionId: string;
  questions: readonly CaseQuestion[];
  nextSection: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [selection, setSelection] = useState<number | null>(null);
  const question = questions[index];
  const correct = selection === question.answer;
  const wrong = selection !== null && !correct;
  const final = index === questions.length - 1;
  const feedback = correct ? tr(question.explanation) : wrong ? tr(question.hint) : null;

  return <LessonPane layout="F" cube={
    <div className="course-cube four-reduction-case" data-course-cube>
      <Diagram setup={question.setup} view={question.view ?? 'iso'} alt={question.alt} size={340}
        outlinedFacelets={question.outlinedFacelets} viewportRotations={question.viewportRotations} />
    </div>
  }>
    <InteractiveQuestionCopy sectionId={sectionId} questions={questions} activeIndex={index}
      answer={correct ? 'correct' : wrong ? 'wrong' : 'pending'} heading={<T {...question.heading} />}
      prompt={tr(question.prompt)} reserveStatus status={feedback} action={
        <div className="four-reduction-quiz-actions">
          <div className="four-reduction-choices" role="group"
            aria-label={tr({ zh: '选一个判断', en: 'Choose an answer' })}>
            {question.choices.map((choice, choiceIndex) => <button key={choice.en} type="button"
              className="btn-secondary" aria-pressed={selection === choiceIndex}
              data-correct={correct && selection === choiceIndex || undefined} disabled={correct && selection !== choiceIndex}
              onClick={() => setSelection(choiceIndex)}><T {...choice} /></button>)}
          </div>
          <button type="button" className="btn-primary" disabled={!correct} onClick={() => {
            if (final) nextSection();
            else {
              setIndex(index + 1);
              setSelection(null);
            }
          }}><T zh="继续" en="Continue" /><ArrowRight size={16} aria-hidden="true" /></button>
        </div>
      } />
  </LessonPane>;
}

const overview = [
  { id: 'centers', title: { zh: '拼六个中心', en: 'Build six centers' }, setup: centersDoneSetup,
    note: { zh: '每面拼成一个 2×2 同色中心', en: 'Make a solid 2×2 center on each face.' } },
  { id: 'edges', title: { zh: '配十二条棱', en: 'Pair twelve edges' }, setup: edgesDoneSetup,
    note: { zh: '相同两色的翼棱合成一条棱', en: 'Join the two matching wings of each edge.' } },
  { id: 'finish', title: { zh: '按三阶复原', en: 'Solve as a 3×3' }, setup: '',
    note: { zh: '只转外层，遇到特殊情况再用四阶公式', en: 'Use outer turns and learn two exceptions for the last layer.' } },
];

export function Overview({ select }: { select: (chapter: string, section?: string) => void }) {
  return <div className="four-reduction-reading four-reduction-overview">
    <div className="four-reduction-intro">
      <h2><T zh="先把四阶变成三阶" en="Turn a 4×4 into a 3×3" /></h2>
      <p><T zh="会独立复原三阶，就可以开始。四阶的角和三阶一样，先把中心和棱拼成组，最后几乎全用你会的步骤"
        en="If you can solve a 3×3 on your own, you’re ready. The corners work the same way. Build the centers and edges into groups, then finish with the steps you already know." /></p>
    </div>
    <ol className="four-reduction-overview-grid" role="list">
      {overview.map(({ id, setup, note, title }) => <li key={id}>
        <button type="button" data-site-surface="panel" onClick={() => select(id)}>
          <div className="four-reduction-overview-cube"><Diagram setup={setup} alt={title} size={192} /></div>
          <span className="four-reduction-overview-copy">
            <strong><T {...title} /><ArrowRight size={16} aria-hidden="true" /></strong>
            <span><T {...note} /></span>
          </span>
        </button>
      </li>)}
    </ol>
    <div className="four-reduction-overview-actions">
      <button type="button" className="btn-primary" onClick={() => select('intro', 'notation')}>
        <T zh="从转动记号开始" en="Start with notation" /><ArrowRight size={16} aria-hidden="true" />
      </button>
      <button type="button" className="btn-secondary" onClick={() => select('practice')}>
        <T zh="看完整还原" en="Watch the full solve" />
      </button>
    </div>
  </div>;
}

export function ThreeByThree({ select }: { select: (chapter: string, section?: string) => void }) {
  return <div className="four-reduction-reading four-reduction-overview">
    <div className="four-reduction-intro">
      <h2><T zh="降阶完成，接回三阶" en="The cube is reduced. Pick up your 3×3 solve" /></h2>
      <p><T zh="核对六个中心的位置和十二条配棱。接下来把每个 2×2 中心看成一块，每条配棱看成一条，用外层走原来的三阶步骤"
        en="Check the six center colors and all twelve edge pairs. Treat each 2×2 center and each edge pair as one piece. Use outer turns to follow your usual 3×3 steps." /></p>
    </div>
    <div className="four-reduction-transfer">
      <Diagram alt={{ zh: '四阶的四个前中心块和顶前两翼各为一组', en: 'Four front center pieces and two top-front wings form two groups on a 4×4' }}
        outlinedFacelets={[13, 14, 37, 38, 41, 42]} size={198} />
      <ArrowRight size={22} aria-hidden="true" />
      <VisualCube local puzzleSize={3} scheme={SCHEME} view="iso" size={198} outlinedFacelets={[7, 22]}
        alt={tr({ zh: '三阶的一个前中心与一条顶前棱', en: 'One front center and one top-front edge on a 3×3' })} />
    </div>
    <div className="four-reduction-intro">
      <p><T zh="层先法可以照走底十字、底角、中层棱。顶层偶尔会出现翻棱或换棱特殊情况，下一节教你怎么辨认"
        en="Layer-by-layer solvers can follow the bottom cross, bottom corners and middle edges. The next section shows how to recognize the edge-flip and edge-swap exceptions on the last layer." /></p>
    </div>
    <div className="four-reduction-overview-actions">
      <button className="btn-primary" type="button" onClick={() => select('finish', 'oll')}>
        <T zh="辨认翻棱和换棱" en="Learn the two parity cases" /><ArrowRight size={16} aria-hidden="true" />
      </button>
      <AppLink className="btn-secondary" href="/tutorial/lbl" prefetch={false}><T zh="复习三阶层先法" en="Review 3×3 layer by layer" /></AppLink>
    </div>
  </div>;
}

const reference = [
  { chapter: 'edges', section: 'same-height', alg: FLIP, title: { zh: '翻右前棱位', en: 'Flip the front-right slot' } },
  { chapter: 'edges', section: 'last-two', alg: LAST_TWO, title: { zh: '最后两棱', en: 'Last two edges' } },
  { chapter: 'finish', section: 'oll', alg: OLL, title: { zh: '翻棱特殊情况', en: 'Edge-flip parity' } },
  { chapter: 'finish', section: 'pll', alg: PLL, title: { zh: '换棱特殊情况', en: 'Edge-swap parity' } },
];

export function Reference({ select }: { select: (chapter: string, section?: string) => void }) {
  return <div className="four-reduction-reading four-reduction-reference">
    <h2><T zh="复原时查公式" en="Quick reference while you solve" /></h2>
    <dl>
      {reference.map(({ chapter, section, alg, title }) => <div key={section}>
        <dt><button type="button" className="four-reduction-phase-jump" onClick={() => select(chapter, section)}>
          <T {...title} /><ArrowRight size={15} aria-hidden="true" />
        </button></dt>
        <dd><code>{alg}</code></dd>
      </div>)}
    </dl>
    <p><T zh="复原卡住时，先检查中心顺序和十二条棱是否配好，再判断顶层特殊情况"
      en="If a solve stalls, verify the center order and all twelve pairs before checking for parity." /></p>
    <footer className="four-reduction-sources">
      <span><T zh="参考资料" en="References" /></span>
      <a href="https://www.cubeskills.com/tutorials/beginners-method-for-solving-the-4x4-cube">CubeSkills</a>
      <a href="https://www.jperm.net/4x4">J Perm</a>
      <a href="https://www.youtube.com/watch?v=3U-HWJaHHwQ">Kenneth Brandon</a>
    </footer>
  </div>;
}
