'use client';

import { Fragment, useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Dice5, Shuffle } from '@app-foundation/icons/lucide';
import SettingsDialog from '@/components/SettingsDialog';
import { T, tr } from '@/i18n/tr';
import { LessonPane } from './InteractiveTutorial';
import useTeachingFollow from './useTeachingFollow';
import './walkthrough-pane.css';

type Text = { zh: string; en: string };
type Step = { id: number; title: Text };
export type WalkthroughStage = { title: Text; steps: readonly Step[] };
export type WalkthroughAlgGroup = { turns: readonly string[]; bracketed?: boolean };

type Props = {
  cube: ReactNode;
  scramble: string;
  onRandomCase: () => void;
  loading?: boolean;
  failed?: boolean;
  stages: readonly WalkthroughStage[];
  currentStep: number;
  title: Text;
  note?: Text;
  algGroups?: readonly WalkthroughAlgGroup[];
  activeTurn: number;
  position: number;
  onSeek: (id: number) => void;
  seekDisabled?: boolean;
};

function AlgNotation({ groups, activeTurn }: { groups: readonly WalkthroughAlgGroup[]; activeTurn: number }) {
  let offset = 0;
  return <code>{groups.map(({ turns, bracketed }, group) => {
    const start = offset;
    offset += turns.length;
    const tokens = turns.map((turn, index) => <Fragment key={index}>
      {index > 0 && ' '}<span aria-current={start + index === activeTurn ? 'step' : undefined}>{turn}</span>
    </Fragment>);
    return <Fragment key={group}>
      {group > 0 && ' '}{bracketed ? <span className="walkthrough-alg-group">({tokens})</span> : tokens}
    </Fragment>;
  })}</code>;
}

export default function WalkthroughPane({
  cube, scramble, onRandomCase, loading, failed, stages, currentStep, title, note, algGroups, activeTurn, position, onSeek, seekDisabled,
}: Props) {
  const titleId = useId();
  const [stepsOpen, setStepsOpen] = useState(false);
  const readingPane = useRef<HTMLElement>(null);
  const { paneProps, playbackProps, resume } = useTeachingFollow(`${currentStep}:${position}`, scramble);
  const { ref: followRef, ...readingProps } = paneProps;
  const bindReadingPane = useCallback((node: HTMLElement | null) => {
    readingPane.current = node;
    followRef(node);
  }, [followRef]);
  useEffect(() => {
    if (position === 0) readingPane.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [position]);
  const stage = stages.find(item => item.steps.some(step => step.id === currentStep));
  const index = stage?.steps.findIndex(step => step.id === currentStep) ?? -1;

  return <LessonPane layout="B" captionProps={{ className: 'walkthrough-caption' }}
    cube={<div className="course-cube" data-course-cube {...playbackProps}>{cube}</div>}>
    <div className="course-copy walkthrough-copy" data-course-section="walkthrough">
      <div className="walkthrough-scramble">
        <div className="walkthrough-scramble-copy">
          <span className="walkthrough-scramble-label">
            {failed ? <span role="status"><T zh="换例失败，请重试" en="Couldn’t load another case" /></span>
              : <T zh="白顶绿前" en="White up, green front" />}
          </span>
          <div className="walkthrough-scramble-line">
            <Shuffle size={16} role="img" aria-label={tr({ zh: '打乱', en: 'Scramble' })} />
            <code key={scramble} tabIndex={0}>{scramble}</code>
          </div>
        </div>
        <button type="button" className="btn-secondary walkthrough-random-case" disabled={loading} aria-busy={loading} onClick={onRandomCase}>
          <Dice5 size={16} aria-hidden="true" />
          {loading ? <T zh="生成中…" en="Generating…" /> : <T zh="随机换例" en="Random case" />}
        </button>
      </div>
      <section className="walkthrough-current-step" {...readingProps} ref={bindReadingPane} aria-labelledby={titleId}>
        {stage && <p className="walkthrough-current-phase"><T {...stage.title} /> · {index + 1}/{stage.steps.length}</p>}
        <h2 id={titleId} data-current-step={activeTurn < 0 ? 'true' : undefined}><T {...title} /></h2>
        {!!algGroups?.length && <AlgNotation groups={algGroups} activeTurn={activeTurn} />}
        {note && <p className="walkthrough-current-note"><T {...note} /></p>}
      </section>
      <button type="button" className="walkthrough-all-steps" disabled={seekDisabled}
        aria-haspopup="dialog" aria-expanded={stepsOpen} onClick={() => setStepsOpen(true)}>
        <T zh="查看全部步骤" en="View all steps" /><ChevronDown size={17} aria-hidden="true" />
      </button>
      {stepsOpen && <SettingsDialog label={tr({ zh: '全部步骤', en: 'All steps' })} heading surface="dialog"
        panelClassName="walkthrough-step-dialog" onClose={() => setStepsOpen(false)}>
        {close => <div className="walkthrough-step-index">
          {stages.map(stage => <section key={stage.title.en}>
            <h3><T {...stage.title} /></h3>
            <ol role="list">
              {stage.steps.map(step => <li key={step.id}>
                <button type="button" className="walkthrough-step-button" aria-current={currentStep === step.id ? 'step' : undefined} onClick={() => {
                  resume();
                  readingPane.current?.scrollTo({ top: 0, behavior: 'instant' });
                  onSeek(step.id);
                  close();
                }}><T {...step.title} /></button>
              </li>)}
            </ol>
          </section>)}
        </div>}
      </SettingsDialog>}
    </div>
  </LessonPane>;
}
