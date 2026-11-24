import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { Check, Play } from '@app-foundation/icons/lucide';
import { tr } from '@/i18n/tr';
import './interactive-question-copy.css';

type ProgressSteps = readonly { progressLabel: { zh: string; en: string } }[];

export function InteractiveQuestionProgress({ steps, activeIndex, currentComplete }: {
  steps: ProgressSteps;
  activeIndex: number;
  currentComplete: boolean;
}) {
  return <ol className="course-question-progress" aria-label={tr({ zh: '本节进度', en: 'Section progress' })} role="list">
    {steps.map(({ progressLabel }, index) => {
      const done = index < activeIndex || (currentComplete && index === activeIndex);
      return <li key={index} data-done={done} aria-current={index === activeIndex ? 'step' : undefined}>
        <span><Check size={13} aria-hidden="true" />{tr(progressLabel)}</span>
      </li>;
    })}
  </ol>;
}

export function InteractiveQuestionHeading({ children, action }: { children: ReactNode; action?: ReactNode }) {
  if (!action) return <h2>{children}</h2>;
  return <div className="course-question-heading">
    <h2>{children}</h2>
    <div className="course-question-heading-actions">{action}</div>
  </div>;
}

export function InteractiveQuestionHelpButton({ children, video = false, ...props }:
  Pick<ComponentPropsWithoutRef<'button'>, 'children' | 'onClick' | 'disabled' | 'aria-label'> & { video?: boolean }) {
  return <button {...props} type="button" className="btn-secondary course-question-heading-action"
    aria-haspopup={video ? 'dialog' : undefined}>
    {video && <Play size={15} aria-hidden="true" />}
    <span>{children}</span>
  </button>;
}

export default function InteractiveQuestionCopy({ sectionId, questions, activeIndex, answer, heading, headingAction, prompt, action, hint, status, reserveStatus }: {
  sectionId: string;
  questions: ProgressSteps;
  activeIndex: number;
  answer: 'correct' | 'wrong' | 'pending';
  heading: ReactNode;
  headingAction?: ReactNode;
  prompt?: string;
  action?: ReactNode;
  hint?: string;
  status?: string | null;
  reserveStatus?: boolean;
}) {
  const step = Math.min(activeIndex + 1, questions.length);
  return <div className="course-copy course-question-copy" data-course-section={sectionId}
    data-course-question={step} data-course-answer={answer}>
    <InteractiveQuestionProgress steps={questions} activeIndex={activeIndex} currentComplete={answer === 'correct'} />
    <div aria-live="polite" aria-atomic="true">
      <InteractiveQuestionHeading action={headingAction}>{heading}</InteractiveQuestionHeading>
      {prompt && <p>{prompt}</p>}
    </div>
    {action}
    {hint && <p className="course-question-hint">{hint}</p>}
    <div className="course-question-status" role="status" aria-atomic="true" data-reserved={reserveStatus || undefined}>{status}</div>
  </div>;
}
