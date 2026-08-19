'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { parseAsInteger, useQueryState } from 'nuqs';
import {
  hasTeachingPermission,
  type TeachingOrganizationRole,
  type TeachingWeeklyReport,
} from '@cuberoot/shared/teaching';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import {
  generateTeachingWeeklyReport,
  listTeachingStudents,
  listTeachingWeeklyReports,
  type TeachingStudent,
} from '@/lib/teaching-saas-api';
import OrgWorkspace from '../../_components/OrgWorkspace';
import {
  entityStatusLabel,
  MutationMessage,
  TeachingPagination,
  teachingErrorMessage,
  useOperationKey,
  useTeachingPage,
} from '../../_components/OrgUi';

const PAGE_SIZE = 25;
const STUDENT_OPTION_LIMIT = 100;

function isIsoMonday(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf())
    && date.toISOString().slice(0, 10) === value
    && date.getUTCDay() === 1;
}

export default function OrganizationReportsPage() {
  const params = useParams<{ orgSlug: string }>();
  const [rawPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const page = Math.max(1, rawPage);
  return (
    <OrgWorkspace orgSlug={params.orgSlug}>
      {(organization) => <ReportsContent orgSlug={params.orgSlug} page={page} role={organization.role} />}
    </OrgWorkspace>
  );
}

function ReportsContent({ orgSlug, page, role }: { orgSlug: string; page: number; role: TeachingOrganizationRole }) {
  const t = useT();
  const operationKey = useOperationKey();
  const loader = useCallback(() => listTeachingWeeklyReports(orgSlug, page, PAGE_SIZE), [orgSlug, page]);
  const reports = useTeachingPage(loader);
  const [students, setStudents] = useState<TeachingStudent[]>([]);
  const [studentTotal, setStudentTotal] = useState(0);
  const [studentPage, setStudentPage] = useState(1);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [generated, setGenerated] = useState<TeachingWeeklyReport | null>(null);
  const [message, setMessage] = useState('');
  const [mutationError, setMutationError] = useState('');
  const canManage = hasTeachingPermission(role, 'report:manage');

  useEffect(() => {
    if (!canManage) return;
    let cancelled = false;
    setStudentsLoading(true);
    setStudentsError('');
    void listTeachingStudents(orgSlug, studentPage, STUDENT_OPTION_LIMIT).then((result) => {
      if (cancelled) return;
      setStudents(result.items);
      setStudentTotal(result.total);
    }).catch((reason: unknown) => {
      if (!cancelled) setStudentsError(teachingErrorMessage(reason, t));
    }).finally(() => {
      if (!cancelled) setStudentsLoading(false);
    });
    return () => { cancelled = true; };
  }, [canManage, orgSlug, studentPage, t]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const studentId = String(data.get('studentId') ?? '').trim();
    const weekStart = String(data.get('weekStart') ?? '').trim();
    if (!studentId) {
      setMutationError(t('请选择学员。', 'Select a student.'));
      return;
    }
    if (!isIsoMonday(weekStart)) {
      setMutationError(t('周开始日期必须是有效的周一日期。', 'The week start must be a valid Monday date.'));
      return;
    }
    setSubmitting(true);
    setGenerated(null);
    setMessage('');
    setMutationError('');
    try {
      const report = await generateTeachingWeeklyReport(orgSlug, { studentId, weekStart }, operationKey.get());
      setGenerated(report);
      operationKey.reset();
      reports.reload();
      setMessage(t('每周报告已生成。', 'Weekly report generated.'));
    } catch (reason) {
      setMutationError(teachingErrorMessage(reason, t));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h2>{t('每周教学报告', 'Weekly teaching reports')}</h2>
      <p className="org-lead">{t('按学员和自然周汇总主站内的课次、出勤、反馈与训练证据。当前只供机构教职员工查看。', 'Summarize main-site sessions, attendance, feedback, and training evidence by student and week. Reports are currently visible only to organization staff.')}</p>

      {reports.loading ? <p aria-busy="true">{t('正在加载…', 'Loading…')}</p> : reports.error ? (
        <MutationMessage message={reports.error} error />
      ) : !reports.result?.items.length ? (
        <p className="org-empty">{t('还没有每周报告。', 'No weekly reports yet.')}</p>
      ) : (
        <div className="org-list">
          {reports.result.items.map((report) => (
            <AppLink
              className="org-row org-row-link"
              href={`/org/${orgSlug}/reports/${report.id}`}
              prefetch={false}
              key={report.id}
            >
              <div className="org-row-main">
                <div className="org-row-title">{report.studentDisplayNameSnapshot}</div>
                <div className="org-row-meta">
                  {report.weekStart} – {report.weekEnd} / {t(`第 ${report.revision} 版`, `Revision ${report.revision}`)}
                </div>
              </div>
              <span className="org-status">{entityStatusLabel(report.status, t)}</span>
            </AppLink>
          ))}
        </div>
      )}
      {reports.result && (
        <TeachingPagination
          page={reports.result.page}
          pageSize={reports.result.pageSize}
          total={reports.result.total}
          baseHref={`/org/${orgSlug}/reports`}
        />
      )}

      {canManage && (
        <section className="org-section">
          <h2>{t('生成报告', 'Generate report')}</h2>
          <p className="org-lead">{t('若提交失败，可不修改表单直接重试；重试会复用同一请求标识。', 'If submission fails, retry without changing the form; the retry reuses the same request identifier.')}</p>
          {studentsError && <MutationMessage message={studentsError} error />}
          <form className="org-form" onSubmit={submit} onChange={() => { operationKey.reset(); setGenerated(null); setMessage(''); }}>
            <fieldset disabled={submitting || studentsLoading || students.length === 0}>
              <label>{t('学员', 'Student')}
                <select className="org-form-control" name="studentId" defaultValue="" required key={studentPage}>
                  <option value="" disabled>{studentsLoading ? t('正在加载学员…', 'Loading students…') : t('请选择学员', 'Select a student')}</option>
                  {students.map((student) => <option value={student.id} key={student.id}>{student.displayName}</option>)}
                </select>
              </label>
              <label>{t('周开始日期', 'Week start date')}<input className="org-form-control" name="weekStart" type="date" required /></label>
              <div className="org-form-actions">
                <button className="org-form-button" type="submit">{submitting ? t('生成中…', 'Generating…') : t('生成报告', 'Generate report')}</button>
              </div>
            </fieldset>
            {studentTotal > STUDENT_OPTION_LIMIT && (
              <div className="org-form-actions">
                <button
                  className="org-secondary-button"
                  type="button"
                  disabled={studentsLoading || studentPage <= 1}
                  onClick={() => { setStudentPage((value) => value - 1); operationKey.reset(); }}
                >
                  {t('上一组学员', 'Previous students')}
                </button>
                <span className="org-help">
                  {t(
                    `第 ${studentPage} / ${Math.ceil(studentTotal / STUDENT_OPTION_LIMIT)} 页`,
                    `Page ${studentPage} of ${Math.ceil(studentTotal / STUDENT_OPTION_LIMIT)}`,
                  )}
                </span>
                <button
                  className="org-secondary-button"
                  type="button"
                  disabled={studentsLoading || studentPage >= Math.ceil(studentTotal / STUDENT_OPTION_LIMIT)}
                  onClick={() => { setStudentPage((value) => value + 1); operationKey.reset(); }}
                >
                  {t('下一组学员', 'Next students')}
                </button>
              </div>
            )}
            <MutationMessage message={mutationError || message} error={!!mutationError} />
            {generated && (
              <AppLink href={`/org/${orgSlug}/reports/${generated.id}`} prefetch={false}>
                {t('打开刚生成的报告', 'Open the generated report')}
              </AppLink>
            )}
          </form>
        </section>
      )}
    </>
  );
}
