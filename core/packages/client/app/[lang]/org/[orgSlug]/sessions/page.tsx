'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { parseAsInteger, useQueryState } from 'nuqs';
import { hasTeachingPermission, type TeachingOrganizationRole } from '@cuberoot/shared/teaching';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import {
  createTeachingSession,
  listTeachingMembers,
  listTeachingSessions,
  listTeachingStudentPackages,
  listTeachingStudents,
  type TeachingMember,
  type TeachingStudent,
  type TeachingStudentPackage,
} from '@/lib/teaching-saas-api';
import OrgWorkspace from '../../_components/OrgWorkspace';
import {
  entityStatusLabel,
  MutationMessage,
  TeachingPagination,
  teachingErrorMessage,
  teachingRoleLabel,
  useOperationKey,
  useTeachingPage,
} from '../../_components/OrgUi';

const PAGE_SIZE = 25;
const OPTION_LIMIT = 100;

interface StagedAttendee {
  studentId: string;
  studentName: string;
  studentPackageId: string;
  packageName: string;
  creditCost: number;
}

export default function OrganizationSessionsPage() {
  const params = useParams<{ orgSlug: string }>();
  const [rawPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const page = Math.max(1, rawPage);
  return (
    <OrgWorkspace orgSlug={params.orgSlug}>
      {(organization) => <SessionsContent orgSlug={params.orgSlug} page={page} role={organization.role} timezone={organization.timezone} />}
    </OrgWorkspace>
  );
}

function SessionsContent({ orgSlug, page, role, timezone }: { orgSlug: string; page: number; role: TeachingOrganizationRole; timezone: string }) {
  const t = useT();
  const loader = useCallback(() => listTeachingSessions(orgSlug, page, PAGE_SIZE), [orgSlug, page]);
  const sessions = useTeachingPage(loader);
  const operationKey = useOperationKey();
  const [members, setMembers] = useState<TeachingMember[]>([]);
  const [students, setStudents] = useState<TeachingStudent[]>([]);
  const [memberTotal, setMemberTotal] = useState(0);
  const [studentTotal, setStudentTotal] = useState(0);
  const [optionError, setOptionError] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentPackages, setStudentPackages] = useState<TeachingStudentPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [creditCost, setCreditCost] = useState(1);
  const [attendees, setAttendees] = useState<StagedAttendee[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [mutationError, setMutationError] = useState('');
  const canCreate = hasTeachingPermission(role, 'session:create');

  useEffect(() => {
    if (!canCreate) return;
    let cancelled = false;
    void Promise.all([
      listTeachingMembers(orgSlug, 1, OPTION_LIMIT),
      listTeachingStudents(orgSlug, 1, OPTION_LIMIT),
    ]).then(([memberPage, studentPage]) => {
      if (!cancelled) {
        setMembers(memberPage.items);
        setMemberTotal(memberPage.total);
        setStudents(studentPage.items);
        setStudentTotal(studentPage.total);
      }
    }).catch((reason: unknown) => {
      if (!cancelled) setOptionError(teachingErrorMessage(reason, t));
    });
    return () => { cancelled = true; };
  }, [canCreate, orgSlug, t]);

  useEffect(() => {
    if (!selectedStudentId) {
      setStudentPackages([]);
      setSelectedPackageId('');
      return;
    }
    let cancelled = false;
    setPackagesLoading(true);
    setSelectedPackageId('');
    void listTeachingStudentPackages(orgSlug, selectedStudentId, 1, OPTION_LIMIT).then((result) => {
      if (!cancelled) setStudentPackages(result.items);
    }).catch((reason: unknown) => {
      if (!cancelled) setOptionError(teachingErrorMessage(reason, t));
    }).finally(() => {
      if (!cancelled) setPackagesLoading(false);
    });
    return () => { cancelled = true; };
  }, [orgSlug, selectedStudentId, t]);

  const availableStudents = useMemo(
    () => students.filter((student) => student.status === 'active' && !attendees.some((attendee) => attendee.studentId === student.id)),
    [attendees, students],
  );
  const usablePackages = studentPackages.filter((item) => item.status === 'active' && item.remainingCredits >= creditCost);

  function addAttendee() {
    const student = students.find((item) => item.id === selectedStudentId);
    const studentPackage = studentPackages.find((item) => item.id === selectedPackageId);
    if (!student || student.status !== 'active' || !studentPackage || studentPackage.status !== 'active' || studentPackage.remainingCredits < creditCost || !Number.isInteger(creditCost) || creditCost < 1 || creditCost > 1_000_000) {
      setMutationError(t('请选择学员和可用课包，并填写有效扣课数。', 'Select a student and usable package, then enter a valid credit cost.'));
      return;
    }
    setAttendees((items) => [...items, {
      studentId: student.id,
      studentName: student.displayName,
      studentPackageId: studentPackage.id,
      packageName: studentPackage.productName,
      creditCost,
    }]);
    setSelectedStudentId('');
    setSelectedPackageId('');
    setCreditCost(1);
    setMutationError('');
    setMessage('');
    operationKey.reset();
  }

  function removeAttendee(studentId: string) {
    setAttendees((items) => items.filter((item) => item.studentId !== studentId));
    setMessage('');
    operationKey.reset();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const startsAtValue = new Date(String(data.get('startsAt') ?? ''));
    const endsAtValue = new Date(String(data.get('endsAt') ?? ''));
    if (Number.isNaN(startsAtValue.getTime()) || Number.isNaN(endsAtValue.getTime())) {
      setMutationError(t('请填写有效的开始和结束时间。', 'Enter valid start and end times.'));
      return;
    }
    const startsAt = startsAtValue.toISOString();
    const endsAt = endsAtValue.toISOString();
    if (endsAtValue <= startsAtValue) {
      setMutationError(t('结束时间必须晚于开始时间。', 'End time must be after start time.'));
      return;
    }
    if (!attendees.length) {
      setMutationError(t('至少添加一名学员。当前接口不支持创建后再补学员。', 'Add at least one student. The current API cannot add attendees after creation.'));
      return;
    }
    const title = String(data.get('title') ?? '').trim();
    const teacherUserIds = [...new Set(data.getAll('teacherUserIds').map(Number))];
    if (!title || title.length > 160 || teacherUserIds.length > 20 || teacherUserIds.some((id) => !Number.isSafeInteger(id) || id < 1)) {
      setMutationError(t('请检查课次标题和授课老师。', 'Check the session title and assigned teachers.'));
      return;
    }
    if (attendees.length > 500 || new Set(attendees.map((item) => item.studentId)).size !== attendees.length) {
      setMutationError(t('学员列表无效或超过 500 人。', 'The attendee list is invalid or exceeds 500 students.'));
      return;
    }
    setSubmitting(true);
    setMessage('');
    setMutationError('');
    try {
      await createTeachingSession(orgSlug, {
        title,
        startsAt,
        endsAt,
        timezone,
        teacherUserIds,
        attendees: attendees.map(({ studentId, studentPackageId, creditCost: cost }) => ({ studentId, studentPackageId, creditCost: cost })),
      }, operationKey.get());
      form.reset();
      setAttendees([]);
      operationKey.reset();
      sessions.reload();
      setMessage(t('课次已创建。', 'Session created.'));
    } catch (reason) {
      setMutationError(teachingErrorMessage(reason, t));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h2>{t('课次', 'Sessions')}</h2>
      <p className="org-lead">{t('老师和助教只会看到自己被安排的课次。完课后由服务端一次性扣减课时。', 'Teachers and assistants only see assigned sessions. Credits are consumed atomically by the server on completion.')}</p>

      {sessions.loading ? <p aria-busy="true">{t('正在加载…', 'Loading…')}</p> : sessions.error ? (
        <MutationMessage message={sessions.error} error />
      ) : !sessions.result?.items.length ? (
        <p className="org-empty">{t('还没有可见课次。', 'No sessions are visible yet.')}</p>
      ) : (
        <div className="org-list">
          {sessions.result.items.map((session) => (
            <AppLink className="org-row org-row-link" href={`/org/${orgSlug}/sessions/${session.id}`} prefetch={false} key={session.id}>
              <div className="org-row-main">
                <div className="org-row-title">{session.title}</div>
                <div className="org-row-meta">
                  {new Date(session.startsAt).toLocaleString()} / {t(`${session.attendanceCount} 名学员`, `${session.attendanceCount} students`)}
                  {session.teachers.length ? ` / ${session.teachers.map((teacher) => teacher.displayName).join(', ')}` : ''}
                </div>
              </div>
              <span className="org-status">{entityStatusLabel(session.status, t)}</span>
            </AppLink>
          ))}
        </div>
      )}
      {sessions.result && <TeachingPagination page={sessions.result.page} pageSize={sessions.result.pageSize} total={sessions.result.total} baseHref={`/org/${orgSlug}/sessions`} />}

      {canCreate && (
        <section className="org-section">
          <h2>{t('安排课次', 'Schedule session')}</h2>
          <form className="org-form" onSubmit={submit} onChange={() => { operationKey.reset(); setMessage(''); }}>
            <fieldset disabled={submitting}>
              <label className="org-field-wide">{t('课次标题', 'Session title')}<input name="title" required maxLength={160} /></label>
              <label>{t('开始时间', 'Starts at')}<input name="startsAt" type="datetime-local" required /></label>
              <label>{t('结束时间', 'Ends at')}<input name="endsAt" type="datetime-local" required /></label>
              <p className="org-help org-field-wide">
                {t(
                  `输入会按当前设备时区转换，课次记录使用机构时区：${timezone}`,
                  `Times are converted from this device's timezone. The session records the organization timezone: ${timezone}`,
                )}
              </p>
              <label className="org-field-wide">{t('授课老师（可多选）', 'Teachers (multiple)')}
                <select name="teacherUserIds" multiple size={Math.min(6, Math.max(2, members.length))}>
                  {members.filter((member) => member.status === 'active' && (member.role === 'teacher' || member.role === 'assistant')).map((member) => (
                    <option value={member.userId} key={member.userId}>{member.displayName} ({teachingRoleLabel(member.role, t)})</option>
                  ))}
                </select>
              </label>
              {memberTotal > members.length && <p className="org-help org-field-wide">{t('这里只显示前 100 名成员。', 'Only the first 100 members are shown.')}</p>}

              <div className="org-field-wide org-stack">
                <strong>{t('本次学员与扣课', 'Attendees and credits')}</strong>
                <div className="org-compact-row">
                  <select aria-label={t('选择学员', 'Select student')} value={selectedStudentId} onChange={(event) => { setSelectedStudentId(event.target.value); operationKey.reset(); }}>
                    <option value="">{t('选择学员', 'Select student')}</option>
                    {availableStudents.map((student) => <option value={student.id} key={student.id}>{student.displayName}</option>)}
                  </select>
                  <select aria-label={t('选择学员课包', 'Select student package')} value={selectedPackageId} disabled={!selectedStudentId || packagesLoading} onChange={(event) => { setSelectedPackageId(event.target.value); operationKey.reset(); }}>
                    <option value="">{packagesLoading ? t('正在加载课包…', 'Loading packages…') : t('选择可用课包', 'Select usable package')}</option>
                    {usablePackages.map((item) => <option value={item.id} key={item.id}>{item.productName} ({t(`余 ${item.remainingCredits}`, `${item.remainingCredits} left`)})</option>)}
                  </select>
                  <input aria-label={t('扣课数', 'Credit cost')} type="number" min={1} max={1_000_000} step={1} value={creditCost} onChange={(event) => { setCreditCost(Number(event.target.value)); operationKey.reset(); }} />
                  <button type="button" onClick={addAttendee}>{t('添加学员', 'Add student')}</button>
                </div>
                {studentTotal > students.length && <p className="org-help">{t('这里只显示前 100 名学员。', 'Only the first 100 students are shown.')}</p>}
                {!!selectedStudentId && !packagesLoading && !usablePackages.length && <p className="org-help">{t('该学员没有余额足够的有效课包。', 'This student has no active package with enough credits.')}</p>}
                {!!attendees.length && (
                  <ul className="org-compact-list">
                    {attendees.map((attendee) => (
                      <li className="org-compact-row" key={attendee.studentId}>
                        <span>{attendee.studentName}: {attendee.packageName}, {t(`${attendee.creditCost} 课时`, `${attendee.creditCost} credits`)}</span>
                        <button type="button" className="org-text-button" onClick={() => removeAttendee(attendee.studentId)}>{t('移除', 'Remove')}</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {optionError && <MutationMessage message={optionError} error />}
              <div className="org-form-actions"><button type="submit">{submitting ? t('创建中…', 'Creating…') : t('创建课次', 'Create session')}</button></div>
            </fieldset>
            <MutationMessage message={mutationError || message} error={!!mutationError} />
          </form>
        </section>
      )}
    </>
  );
}
