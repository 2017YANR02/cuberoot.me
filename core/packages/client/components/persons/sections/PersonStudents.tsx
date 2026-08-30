'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLink from '@/components/AppLink';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { Flag } from '@/components/Flag';
import PersonLink from '@/components/PersonLink';
import { SortArrow } from '@/components/SortArrow';
import WcaEventSelector from '@/components/WcaEventSelector';
import {
  canAddWcaTeacherStudent,
  WcaNamedStudentCell,
  WcaStudentAdder,
  WcaTeacherCell,
  useWcaTeachers,
  wcaTeacherRelationKey,
} from '@/components/WcaTeacherCell';
import { useT } from '@/hooks/useT';
import { ALL_EVENT_IDS } from '@/lib/event-constants';
import { displayCuberName } from '@/lib/cuber-name-display';
import {
  fetchWcaPerson,
  fetchWcaPersonResults,
  type WcaPersonProfile,
} from '@/lib/wca-person-api';
import {
  listWcaNamedStudents,
  listWcaTeacherStudents,
  type WcaNamedStudent,
  type WcaTeacher,
} from '@/lib/wca-teachers-api';
import { eventDisplayName } from '@/lib/wca-events';
import { formatWcaResult, type ResultKind } from '@/lib/wca-format-result';

interface StudentSeed {
  key: string;
  wcaId?: string;
  namedStudent?: WcaNamedStudent;
  name?: string;
  eventIds: string[];
}

interface StudentMeta {
  countryIso2: string;
  competedEventIds: string[];
  personalRecords: WcaPersonProfile['personal_records'];
}

export default function PersonStudents({ teacherWcaId, teacherCountryIso2, isZh, mode = 'overview' }: {
  teacherWcaId: string;
  teacherCountryIso2: string;
  isZh: boolean;
  mode?: 'overview' | 'manage';
}) {
  const t = useT();
  const [relations, setRelations] = useState<WcaTeacher[] | null>(null);
  const [namedStudents, setNamedStudents] = useState<WcaNamedStudent[] | null>(null);
  const [studentMeta, setStudentMeta] = useState<Map<string, StudentMeta>>(() => new Map());
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [resultSort, setResultSort] = useState<{ kind: ResultKind; dir: 'asc' | 'desc' }>({
    kind: 'single',
    dir: 'asc',
  });

  useEffect(() => {
    let cancelled = false;
    setRelations(null);
    setNamedStudents(null);
    Promise.all([
      listWcaTeacherStudents(teacherWcaId).catch(() => []),
      listWcaNamedStudents(teacherWcaId).catch(() => []),
    ])
      .then(([nextRelations, nextNamedStudents]) => {
        if (cancelled) return;
        setRelations(nextRelations);
        setNamedStudents(nextNamedStudents);
      });
    return () => { cancelled = true; };
  }, [reloadKey, teacherWcaId]);

  const studentSeeds = useMemo<StudentSeed[]>(() => {
    if (!relations || !namedStudents) return [];
    const byStudent = new Map<string, StudentSeed>();
    for (const relation of relations) {
      const current = byStudent.get(relation.studentWcaId);
      if (current) {
        if (!current.eventIds.includes(relation.eventId)) current.eventIds.push(relation.eventId);
      } else {
        byStudent.set(relation.studentWcaId, {
          key: `wca:${relation.studentWcaId}`,
          wcaId: relation.studentWcaId,
          name: relation.studentName,
          eventIds: [relation.eventId],
        });
      }
    }
    for (const student of namedStudents) {
      byStudent.set(`named:${student.id}`, {
        key: `named:${student.id}`,
        namedStudent: student,
        name: student.studentName,
        eventIds: [...student.eventIds],
      });
    }
    const eventOrder = new Map(ALL_EVENT_IDS.map((eventId, index) => [eventId, index]));
    return [...byStudent.values()]
      .map((student) => ({
        ...student,
        eventIds: student.eventIds.sort((a, b) => (eventOrder.get(a) ?? 999) - (eventOrder.get(b) ?? 999)),
      }))
      .sort((a, b) => displayCuberName(a.name ?? a.wcaId ?? '', isZh).localeCompare(
        displayCuberName(b.name ?? b.wcaId ?? '', isZh),
      ));
  }, [isZh, namedStudents, relations]);

  const studentIds = useMemo(() => studentSeeds.flatMap((student) => student.wcaId ? [student.wcaId] : []), [studentSeeds]);
  const existingWcaStudentEvents = useMemo(() => new Map(studentSeeds.flatMap((student) => (
    student.wcaId ? [[student.wcaId, student.eventIds] as const] : []
  ))), [studentSeeds]);
  const studentIdsKey = studentIds.join(',');
  const teacherDirectory = useWcaTeachers(studentIds, ALL_EVENT_IDS);

  useEffect(() => {
    if (mode !== 'manage') {
      setStudentMeta(new Map());
      return;
    }
    const ids = studentIdsKey ? studentIdsKey.split(',') : [];
    let cancelled = false;
    setStudentMeta(new Map());
    if (ids.length === 0) return;
    Promise.all(ids.map(async (wcaId) => {
      try {
        const [profile, results] = await Promise.all([
          fetchWcaPerson(wcaId),
          fetchWcaPersonResults(wcaId),
        ]);
        const competedEvents = new Set(results.map((result) => result.event_id));
        return [wcaId, {
          countryIso2: profile.person.country_iso2,
          competedEventIds: ALL_EVENT_IDS.filter((eventId) => competedEvents.has(eventId)),
          personalRecords: profile.personal_records,
        }] as const;
      } catch {
        return [wcaId, null] as const;
      }
    })).then((entries) => {
      if (cancelled) return;
      setStudentMeta(new Map(entries.filter((entry): entry is readonly [string, StudentMeta] => entry[1] !== null)));
    });
    return () => { cancelled = true; };
  }, [mode, studentIdsKey]);

  const students = useMemo(() => studentSeeds.flatMap((student) => {
    const currentEventIds = student.wcaId && teacherDirectory.ready
      ? ALL_EVENT_IDS.filter((eventId) => {
        const relation = teacherDirectory.teachers.get(wcaTeacherRelationKey(student.wcaId!, eventId));
        return relation?.teacherWcaId === teacherWcaId;
      })
      : student.eventIds;
    if (currentEventIds.length === 0) return [];
    const meta = student.wcaId ? studentMeta.get(student.wcaId) : undefined;
    return [{
      ...student,
      eventIds: currentEventIds,
      competedEventIds: student.wcaId ? meta?.competedEventIds : [],
      countryIso2: student.namedStudent?.countryIso2 ?? meta?.countryIso2 ?? '',
      personalRecords: meta?.personalRecords,
    }];
  }), [studentMeta, studentSeeds, teacherDirectory.ready, teacherDirectory.teachers, teacherWcaId]);

  const availableEventIds = useMemo(() => ALL_EVENT_IDS.filter((eventId) => (
    students.some((student) => (
      student.eventIds.includes(eventId) || student.competedEventIds?.includes(eventId)
    ))
  )), [students]);

  useEffect(() => {
    setSelectedEventId((current) => (
      !current || availableEventIds.includes(current) ? current : ''
    ));
  }, [availableEventIds]);

  const visibleStudents = useMemo(() => students
    .filter((student) => !selectedEventId || (
      student.eventIds.includes(selectedEventId)
      || student.competedEventIds?.includes(selectedEventId)
    ))
    .map((student) => ({
      ...student,
      taughtSelectedEvent: selectedEventId ? student.eventIds.includes(selectedEventId) : false,
      singleValue: selectedEventId
        ? student.personalRecords?.[selectedEventId]?.single?.best ?? null
        : null,
      averageValue: selectedEventId
        ? student.personalRecords?.[selectedEventId]?.average?.best ?? null
        : null,
    }))
    .sort((a, b) => {
      const aValue = resultSort.kind === 'single' ? a.singleValue : a.averageValue;
      const bValue = resultSort.kind === 'single' ? b.singleValue : b.averageValue;
      const aMissing = aValue === null || aValue <= 0;
      const bMissing = bValue === null || bValue <= 0;
      if (aMissing !== bMissing) return aMissing ? 1 : -1;
      if (aValue !== null && bValue !== null && aValue !== bValue) {
        return (aValue - bValue) * (resultSort.dir === 'asc' ? 1 : -1);
      }
      return displayCuberName(a.name ?? a.wcaId ?? '', isZh).localeCompare(
        displayCuberName(b.name ?? b.wcaId ?? '', isZh),
      );
    }), [isZh, resultSort, selectedEventId, students]);

  const toggleResultSort = (kind: ResultKind) => setResultSort((current) => (
    current.kind === kind
      ? { kind, dir: current.dir === 'asc' ? 'desc' : 'asc' }
      : { kind, dir: 'asc' }
  ));

  const canAddStudents = canAddWcaTeacherStudent(teacherWcaId, teacherDirectory);
  const isManagement = mode === 'manage';

  if (students.length === 0 && !canAddStudents && !isManagement) return null;

  if (!isManagement) {
    return (
      <section className="wp-card wp-students-card wp-students-overview" aria-label={t('学生', 'Students')}>
        <div className="wp-student-overview-head">
          <span>{t('学生', 'Students')}</span>
          <AppLink
            href={`/wca/persons/${teacherWcaId}/students`}
            className="wp-student-manage-link"
            prefetch={false}
          >
            {students.length > 0 ? t('详情', 'Details') : t('管理', 'Manage')}
          </AppLink>
        </div>
        {students.length > 0 && (
          <ul className="wp-student-name-list">
            {students.map((student) => (
              <li key={student.key}>
                {student.wcaId ? (
                  <PersonLink
                    wcaId={student.wcaId}
                    name={student.name}
                    isZh={isZh}
                    className="wp-student-link"
                  />
                ) : (
                  <span className="wp-student-unregistered-name">{student.name}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  return (
    <section
      className={`wp-card wp-students-card${isManagement ? ' wp-students-card--manage' : ''}`}
      aria-label={isManagement ? t('学生管理', 'Student management') : t('学生', 'Students')}
    >
      {students.length > 0 && (
        <div className="wp-student-controls">
          <WcaEventSelector
            availableEvents={new Set(availableEventIds)}
            selectedEvent={selectedEventId}
            onSelect={setSelectedEventId}
            isZh={isZh}
            allowAll
            allLabel={t('总览', 'Overview')}
            onlyAvailable
            containerClassName="wca-stats-event-selector wp-student-event-filter"
          />
        </div>
      )}
      <div className="wp-table-scroll">
        <table className="wp-pr-table wp-students-table">
          <thead>
            <tr>
              <th className="wp-th-student">
                <span className="wp-student-heading">
                  {isManagement && (
                    <WcaStudentAdder
                      teacherWcaId={teacherWcaId}
                      teacherCountryIso2={teacherCountryIso2}
                      existingWcaStudentEvents={existingWcaStudentEvents}
                      existingNamedStudents={namedStudents ?? []}
                      directory={teacherDirectory}
                      isZh={isZh}
                      onSaved={() => setReloadKey((current) => current + 1)}
                    />
                  )}
                  {t('学生', 'Student')}
                </span>
              </th>
              <th className="wp-th-student-events">{t('项目', 'Events')}</th>
              {selectedEventId && (
                <>
                  <th className="wp-th-student-result">
                    <button
                      type="button"
                      className={`wp-sort-th${resultSort.kind === 'single' ? ' is-active' : ''}`}
                      onClick={() => toggleResultSort('single')}
                      aria-label={t('按单次排序', 'Sort by single')}
                    >
                      {t('单次', 'Single')}
                      <SortArrow active={resultSort.kind === 'single'} dir={resultSort.dir} />
                    </button>
                  </th>
                  <th className="wp-th-student-result">
                    <button
                      type="button"
                      className={`wp-sort-th${resultSort.kind === 'average' ? ' is-active' : ''}`}
                      onClick={() => toggleResultSort('average')}
                      aria-label={t('按平均排序', 'Sort by average')}
                    >
                      {t('平均', 'Average')}
                      <SortArrow active={resultSort.kind === 'average'} dir={resultSort.dir} />
                    </button>
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {students.length === 0 && (
              <tr>
                <td className="wp-students-empty" colSpan={selectedEventId ? 4 : 2}>{t('暂无学生', 'No students yet')}</td>
              </tr>
            )}
            {visibleStudents.map((student) => (
              <tr key={student.key}>
                <td className="wp-cell-student">
                  <span className="wp-student-identity">
                    {isManagement && student.wcaId ? (
                      <WcaTeacherCell
                        studentWcaId={student.wcaId}
                        eventIds={student.eventIds}
                        editableEventIds={ALL_EVENT_IDS}
                        directory={teacherDirectory}
                        isZh={isZh}
                        editorOnly
                        managedTeacherWcaId={teacherWcaId}
                      />
                    ) : isManagement && student.namedStudent ? (
                      <WcaNamedStudentCell
                        student={student.namedStudent}
                        teacherWcaId={teacherWcaId}
                        directory={teacherDirectory}
                        isZh={isZh}
                        onSaved={() => setReloadKey((current) => current + 1)}
                      />
                    ) : null}
                    {student.countryIso2 && (
                      <Flag
                        iso2={student.countryIso2}
                        spanClassName="country-flag"
                        imgClassName="country-flag-ct"
                      />
                    )}
                    {student.wcaId ? (
                      <PersonLink
                        wcaId={student.wcaId}
                        name={student.name}
                        isZh={isZh}
                        className="wp-student-link"
                      />
                    ) : (
                      <>
                        <span className="wp-student-unregistered-name">{student.name}</span>
                        <span className="wp-student-unregistered">{t('未参赛', 'Not competed')}</span>
                      </>
                    )}
                  </span>
                </td>
                <td className="wp-cell-student-events">
                  {selectedEventId ? (
                    <span className="wp-student-event-state">
                      <EventIcon
                        event={selectedEventId}
                        className={`wp-event-icon${student.taughtSelectedEvent && student.competedEventIds?.includes(selectedEventId) === false ? ' wp-event-icon-uncompeted' : ''}`}
                        title={student.taughtSelectedEvent
                          ? eventDisplayName(selectedEventId, isZh)
                          : t('仅显示该项目成绩，不是该老师教授', 'Result only; not taught by this teacher')}
                      />
                      {!student.taughtSelectedEvent && (
                        <span className="wp-student-result-only">{t('仅成绩', 'Result only')}</span>
                      )}
                    </span>
                  ) : (
                    <span className="wp-student-event-overview">
                      <span className="wp-student-event-list">
                        {student.eventIds.map((eventId) => (
                          <EventIcon
                            key={eventId}
                            event={eventId}
                            className={`wp-event-icon${student.competedEventIds?.includes(eventId) === false ? ' wp-event-icon-uncompeted' : ''}`}
                            title={eventDisplayName(eventId, isZh)}
                          />
                        ))}
                      </span>
                      {(student.competedEventIds ?? []).some((eventId) => !student.eventIds.includes(eventId)) && (
                        <span className="wp-student-result-only-group">
                          <span className="wp-student-result-only">{t('仅成绩', 'Result only')}</span>
                          <span className="wp-student-event-list">
                            {(student.competedEventIds ?? [])
                              .filter((eventId) => !student.eventIds.includes(eventId))
                              .map((eventId) => (
                                <EventIcon
                                  key={eventId}
                                  event={eventId}
                                  className="wp-event-icon wp-event-icon-result-only"
                                  title={t(
                                    `${eventDisplayName(eventId, true)}：仅成绩，不是该老师教授`,
                                    `${eventDisplayName(eventId, false)}: result only; not taught by this teacher`,
                                  )}
                                />
                              ))}
                          </span>
                        </span>
                      )}
                    </span>
                  )}
                </td>
                {selectedEventId && (
                  <>
                    <td className="wp-cell-student-result">
                      {student.singleValue !== null && student.singleValue > 0
                        ? formatWcaResult(student.singleValue, selectedEventId, 'single')
                        : '—'}
                    </td>
                    <td className="wp-cell-student-result">
                      {student.averageValue !== null && student.averageValue > 0
                        ? formatWcaResult(student.averageValue, selectedEventId, 'average')
                        : '—'}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
