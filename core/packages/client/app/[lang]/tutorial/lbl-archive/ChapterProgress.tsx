import { tr } from '@/i18n/tr';
import { LBL_NUMBERED_CHAPTERS } from './alg-lessons';

export default function ChapterProgress({ current }: { current: string }) {
  const active = LBL_NUMBERED_CHAPTERS.findIndex(step => step.id === current);
  return <ol className="lbl-chapter-progress" aria-label={tr({ zh: '章节进度', en: 'Chapter progress' })}>
    {LBL_NUMBERED_CHAPTERS.map((step, index) => <li key={step.id}
      data-state={index < active ? 'complete' : index === active ? 'current' : 'upcoming'}
      aria-current={index === active ? 'step' : undefined}>
      <span className="lbl-chapter-progress-bar" aria-hidden="true" />
      <span>{tr(step.title)}</span>
    </li>)}
  </ol>;
}
