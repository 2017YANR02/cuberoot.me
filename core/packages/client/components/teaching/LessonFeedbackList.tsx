'use client';

import type { TeachingLearnerLessonFeedback } from '@cuberoot/shared/teaching';
import { useT } from '@/hooks/useT';
import { entityStatusLabel, teachingRoleLabel } from './TeachingUi';
import { teachingVisibilityLabel } from './WeeklyReportSections';

export default function LessonFeedbackList({ feedback }: { feedback: TeachingLearnerLessonFeedback[] }) {
  const t = useT();
  if (!feedback.length) return <p className="teaching-empty">{t('还没有向当前账号发布的课后反馈。', 'No lesson feedback has been published to this account yet.')}</p>;
  return (
    <div className="teaching-list">
      {feedback.map((item) => (
        <article className="teaching-row" key={item.id}>
          <div className="teaching-row-main">
            <div className="teaching-row-title">{item.summary}</div>
            {item.strengths && <p className="teaching-rich-text"><strong>{t('表现：', 'Strengths:')}</strong> {item.strengths}</p>}
            {item.challenges && <p className="teaching-rich-text"><strong>{t('改进：', 'Challenges:')}</strong> {item.challenges}</p>}
            {item.nextGoals && <p className="teaching-rich-text"><strong>{t('目标：', 'Goals:')}</strong> {item.nextGoals}</p>}
            <div className="teaching-row-meta">
              {new Date(item.publishedAt).toLocaleString()} / {item.authorDisplayNameSnapshot} / {teachingRoleLabel(item.authorRoleSnapshot, t)} / {teachingVisibilityLabel(item.visibility, t)}
            </div>
          </div>
          <span className="teaching-status">{entityStatusLabel(item.attendanceStatusSnapshot, t)}</span>
        </article>
      ))}
    </div>
  );
}
