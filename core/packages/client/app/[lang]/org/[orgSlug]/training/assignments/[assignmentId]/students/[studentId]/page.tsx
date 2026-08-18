'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { parseAsInteger, useQueryState } from 'nuqs';
import {
  TRAINING_REVIEW_STATUSES,
  hasTeachingPermission,
  type TeachingOrganizationRole,
  type TeachingTrainingAssignmentDetail,
  type TrainingReviewStatus,
} from '@cuberoot/shared/teaching';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import {
  createTeachingTrainingTargetReview,
  getTeachingTrainingAssignment,
  listTeachingTrainingTargetEvidence,
  listTeachingTrainingTargetReviews,
} from '@/lib/teaching-saas-api';
import OrgWorkspace from '../../../../../../_components/OrgWorkspace';
import { entityStatusLabel, MutationMessage, TeachingPagination, teachingErrorMessage, useOperationKey, useTeachingPage } from '../../../../../../_components/OrgUi';

const PAGE_SIZE = 25;

export default function TrainingStudentReviewPage() {
  const params = useParams<{ orgSlug: string; assignmentId: string; studentId: string }>();
  const [rawPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const page = Math.max(1, rawPage);
  return (
    <OrgWorkspace orgSlug={params.orgSlug}>
      {(organization) => (
        <ReviewContent
          orgSlug={params.orgSlug}
          assignmentId={params.assignmentId}
          studentId={params.studentId}
          page={page}
          role={organization.role}
        />
      )}
    </OrgWorkspace>
  );
}

function ReviewContent({ orgSlug, assignmentId, studentId, page, role }: {
  orgSlug: string;
  assignmentId: string;
  studentId: string;
  page: number;
  role: TeachingOrganizationRole;
}) {
  const t = useT();
  const [detail, setDetail] = useState<TeachingTrainingAssignmentDetail | null>(null);
  const [detailError, setDetailError] = useState('');
  const evidenceLoader = useCallback(
    () => listTeachingTrainingTargetEvidence(orgSlug, assignmentId, studentId, page, PAGE_SIZE),
    [assignmentId, orgSlug, page, studentId],
  );
  const reviewLoader = useCallback(
    () => listTeachingTrainingTargetReviews(orgSlug, assignmentId, studentId, 1, 100),
    [assignmentId, orgSlug, studentId],
  );
  const evidence = useTeachingPage(evidenceLoader);
  const reviews = useTeachingPage(reviewLoader);
  const canReview = hasTeachingPermission(role, 'training:review');

  useEffect(() => {
    let cancelled = false;
    void getTeachingTrainingAssignment(orgSlug, assignmentId).then((value) => {
      if (!cancelled) { setDetail(value); setDetailError(''); }
    }).catch((reason: unknown) => {
      if (!cancelled) setDetailError(teachingErrorMessage(reason, t));
    });
    return () => { cancelled = true; };
  }, [assignmentId, orgSlug, t]);

  return (
    <>
      <AppLink href={`/org/${orgSlug}/training/assignments/${assignmentId}`} prefetch={false}>{t('任务详情', 'Assignment details')}</AppLink>
      <h2>{detail?.assignment.title ?? t('学员训练证据', 'Student training evidence')}</h2>
      {detailError && <MutationMessage message={detailError} error />}

      <section className="org-section">
        <h2>{t('训练证据', 'Training evidence')}</h2>
        {evidence.loading ? <p aria-busy="true">{t('正在加载…', 'Loading…')}</p> : evidence.error ? <MutationMessage message={evidence.error} error /> : !evidence.result?.items.length ? (
          <p className="org-empty">{t('该学员尚未提交与此任务关联的训练证据。', 'This student has not submitted evidence linked to this assignment.')}</p>
        ) : (
          <div className="org-list">
            {evidence.result.items.map((item) => (
              <div className="org-row" key={item.id}>
                <div className="org-row-main">
                  <div className="org-row-title">{item.localDate} {item.activity}</div>
                  <div className="org-row-meta">
                    {new Date(item.occurredAt).toLocaleString()} / {item.trustLevel}
                    {item.durationMs === null ? '' : ` / ${(item.durationMs / 1000).toFixed(2)}s`}
                    {item.resultMs === null ? '' : ` / ${t('成绩', 'Result')} ${(item.resultMs / 1000).toFixed(2)}s`}
                  </div>
                </div>
                {item.success !== null && <span className="org-status">{item.success ? t('成功', 'Success') : t('未完成', 'Incomplete')}</span>}
              </div>
            ))}
          </div>
        )}
        {evidence.result && <TeachingPagination page={evidence.result.page} pageSize={evidence.result.pageSize} total={evidence.result.total} baseHref={`/org/${orgSlug}/training/assignments/${assignmentId}/students/${studentId}`} />}
      </section>

      <section className="org-section">
        <h2>{t('批改记录', 'Reviews')}</h2>
        {reviews.loading ? <p aria-busy="true">{t('正在加载…', 'Loading…')}</p> : reviews.error ? <MutationMessage message={reviews.error} error /> : !reviews.result?.items.length ? (
          <p className="org-empty">{t('还没有批改记录。', 'No reviews yet.')}</p>
        ) : (
          <div className="org-list">
            {reviews.result.items.map((review) => (
              <div className="org-row" key={review.id}>
                <div className="org-row-main">
                  <div className="org-row-title">#{review.revision} {review.reviewerDisplayNameSnapshot}</div>
                  <div className="org-row-meta">{new Date(review.createdAt).toLocaleString()}{review.rating === null ? '' : ` / ${t(`${review.rating} 分`, `${review.rating}/5`)}`}</div>
                  <p>{review.feedback}</p>
                </div>
                <span className="org-status">{entityStatusLabel(review.status, t)}</span>
              </div>
            ))}
          </div>
        )}
        {canReview && <ReviewForm orgSlug={orgSlug} assignmentId={assignmentId} studentId={studentId} onCreated={reviews.reload} />}
      </section>
    </>
  );
}

function ReviewForm({ orgSlug, assignmentId, studentId, onCreated }: { orgSlug: string; assignmentId: string; studentId: string; onCreated: () => void }) {
  const t = useT();
  const operationKey = useOperationKey();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const status = String(data.get('status') ?? '') as TrainingReviewStatus;
    const feedback = String(data.get('feedback') ?? '').trim();
    const ratingRaw = String(data.get('rating') ?? '');
    const rating = ratingRaw ? Number(ratingRaw) : null;
    if (!TRAINING_REVIEW_STATUSES.includes(status) || !feedback || (rating !== null && (!Number.isSafeInteger(rating) || rating < 1 || rating > 5))) {
      setError(t('请完整填写合法的批改内容。', 'Enter a valid review.'));
      return;
    }
    setSubmitting(true); setMessage(''); setError('');
    try {
      await createTeachingTrainingTargetReview(orgSlug, assignmentId, studentId, { status, rating, feedback }, operationKey.get());
      form.reset(); operationKey.reset(); onCreated(); setMessage(t('批改已保存。', 'Review saved.'));
    } catch (reason) {
      setError(teachingErrorMessage(reason, t));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="org-form org-subsection" onSubmit={submit} onChange={() => { operationKey.reset(); setMessage(''); }}>
      <fieldset disabled={submitting}>
        <label>{t('结论', 'Outcome')}
          <select name="status" defaultValue="commented">
            {TRAINING_REVIEW_STATUSES.map((status) => <option key={status} value={status}>{entityStatusLabel(status, t)}</option>)}
          </select>
        </label>
        <label>{t('评分（可留空）', 'Rating (optional)')}<input name="rating" type="number" min={1} max={5} step={1} /></label>
        <label className="org-field-wide">{t('反馈', 'Feedback')}<textarea name="feedback" required maxLength={8_000} /></label>
        <div className="org-form-actions"><button type="submit">{submitting ? t('保存中…', 'Saving…') : t('保存批改', 'Save review')}</button></div>
      </fieldset>
      <MutationMessage message={error || message} error={!!error} />
    </form>
  );
}
