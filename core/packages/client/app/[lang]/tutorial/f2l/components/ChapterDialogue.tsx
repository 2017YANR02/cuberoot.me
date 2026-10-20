'use client';

import { T, tr } from '@/i18n/tr';
import { F2L_CHAPTERS, type ChapterId } from '../data/chapters';

export default function ChapterDialogue({ stepId }: { stepId: ChapterId }) {
  const dialogue = F2L_CHAPTERS.find(chapter => chapter.id === stepId)!;
  const paragraphs = dialogue.answer.map(paragraph => tr(paragraph));
  return <dl className="f2l-chapter-dialogue">
    <div className="f2l-dialogue-question"><dt className="sr-only"><T zh="学生" en="Student" /></dt><dd>{tr(dialogue.question)}</dd></div>
    <div className="f2l-dialogue-answer"><dt className="sr-only"><T zh="老师" en="Teacher" /></dt><dd data-site-surface="panel">
      {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    </dd></div>
  </dl>;
}
