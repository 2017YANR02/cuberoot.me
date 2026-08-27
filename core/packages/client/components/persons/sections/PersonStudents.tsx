'use client';

import { useEffect, useMemo, useState } from 'react';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { Flag } from '@/components/Flag';
import PersonLink from '@/components/PersonLink';
import PillToggle from '@/components/PillToggle/PillToggle';
import { SortArrow } from '@/components/SortArrow';
import WcaEventSelector from '@/components/WcaEventSelector';
import {
  canAddWcaTeacherStudent,
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
import { listWcaTeacherStudents, type WcaTeacher } from '@/lib/wca-teachers-api';
import { eventDisplayName } from '@/lib/wca-events';
import { formatWcaResult, type ResultKind } from '@/lib/wca-format-result';

const EVENTS_WITHOUT_AVERAGE = new Set(['333mbf', '333mbo']);

interface StudentSeed {
  wcaId: string;
  name?: string;
  eventIds: string[];
}

interface StudentMeta {
  countryIso2: string;
  competedEventIds: string[];
  personalRecords: WcaPersonProfile['personal_records'];
}

export default function PersonStudents({ teacherWcaId, isZh }: { teacherWcaId: string; isZh: boolean }) {
  const t = useT();
  const [relations, setRelations] = useState<WcaTeacher[] | null>(null);
  const [studentMeta, setStudentMeta] = useState<Map<string, StudentMeta>>(() => new Map());
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [resultKind, setResultKind] = useState<ResultKind>('single');
  const [resultSortDir, setResultSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    let cancelled = false;
    setRelations(null);
    listWcaTeacherStudents(teacherWcaId)
      .then((next) => { if (!cancelled) setRelations(next); })
      .catch(() => { if (!cancelled) setRelations([]); });
    return () => { cancelled = true; };
  }, [reloadKey, teacherWcaId]);

  const studentSeeds = useMemo<StudentSeed[]>(() => {
    if (!relations) return [];
    const byStudent = new Map<string, StudentSeed>();
    for (const relation of relations) {
      const current = byStudent.get(relation.studentWcaId);
      if (current) {
        if (!current.eventIds.includes(relation.eventId)) current.eventIds.push(relation.eventId);
      } else {
        byStudent.set(relation.studentWcaId, {
          wcaId: relation.studentWcaId,
          name: relation.studentName,
          eventIds: [relation.eventId],
        });
      }
    }
    const eventOrder = new Map(ALL_EVENT_IDS.map((eventId, index) => [eventId, index]));
    return [...byStudent.values()]
      .map((student) => ({
        ...student,
        eventIds: student.eventIds.sort((a, b) => (eventOrder.get(a) ?? 999) - (eventOrder.get(b) ?? 999)),
      }))
      .sort((a, b) => displayCuberName(a.name ?? a.wcaId, isZh).localeCompare(
        displayCuberName(b.name ?? b.wcaId, isZh),
      ));
  }, [isZh, relations]);

  const studentIds = useMemo(() => studentSeeds.map((student) => student.wcaId), [studentSeeds]);
  const studentIdsKey = studentIds.join(',');
  const teacherDirectory = useWcaTeachers(studentIds, ALL_EVENT_IDS);

  useEffect(() => {
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
  }, [studentIdsKey]);

  const students = useMemo(() => studentSeeds.flatMap((student) => {
    const currentEventIds = teacherDirectory.ready
      ? ALL_EVENT_IDS.filter((eventId) => {
        const relation = teacherDirectory.teachers.get(wcaTeacherRelationKey(student.wcaId, eventId));
        return relation?.teacherWcaId === teacherWcaId;
      })
      : student.eventIds;
    if (currentEventIds.length === 0) return [];
    const meta = studentMeta.get(student.wcaId);
    return [{
      ...student,
      eventIds: currentEventIds,
      competedEventIds: meta?.competedEventIds,
      countryIso2: meta?.countryIso2 ?? '',
      personalRecords: meta?.personalRecords,
    }];
  }), [studentMeta, studentSeeds, teacherDirectory.ready, teacherDirectory.teachers, teacherWcaId]);

  const taughtEventIds = useMemo(() => ALL_EVENT_IDS.filter((eventId) => (
    students.some((student) => student.eventIds.includes(eventId))
  )), [students]);

  useEffect(() => {
    setSelectedEventId((current) => (
      taughtEventIds.includes(current) ? current : (taughtEventIds[0] ?? '')
    ));
  }, [taughtEventIds]);

  const eventHasAverage = !EVENTS_WITHOUT_AVERAGE.has(selectedEventId);
  useEffect(() => {
    if (!eventHasAverage) setResultKind('single');
  }, [eventHasAverage]);

  const visibleStudents = useMemo(() => students
    .filter((student) => !selectedEventId || student.eventIds.includes(selectedEventId))
    .map((student) => ({
      ...student,
      resultValue: selectedEventId
        ? student.personalRecords?.[selectedEventId]?.[resultKind]?.best ?? null
        : null,
    }))
    .sort((a, b) => {
      const aMissing = a.resultValue === null || a.resultValue <= 0;
      const bMissing = b.resultValue === null || b.resultValue <= 0;
      if (aMissing !== bMissing) return aMissing ? 1 : -1;
      if (a.resultValue !== null && b.resultValue !== null && a.resultValue !== b.resultValue) {
        return (a.resultValue - b.resultValue) * (resultSortDir === 'asc' ? 1 : -1);
      }
      return displayCuberName(a.name ?? a.wcaId, isZh).localeCompare(
        displayCuberName(b.name ?? b.wcaId, isZh),
      );
    }), [isZh, resultKind, resultSortDir, selectedEventId, students]);

  const canAddStudents = canAddWcaTeacherStudent(teacherWcaId, teacherDirectory);

  if (students.length === 0 && !canAddStudents) return null;

  return (
    <section className="wp-card wp-students-card" aria-label={t('学生', 'Students')}>
      {students.length > 0 && (
        <div className="wp-student-controls">
          <WcaEventSelector
            availableEvents={new Set(taughtEventIds)}
            selectedEvent={selectedEventId}
            onSelect={setSelectedEventId}
            isZh={isZh}
            onlyAvailable
            containerClassName="wca-stats-event-selector wp-student-event-filter"
          />
          <PillToggle
            value={resultKind === 'average'}
            onChange={(average) => setResultKind(average ? 'average' : 'single')}
            offLabel={t('单次', 'Single')}
            onLabel={t('平均', 'Average')}
            ariaLabel={t('成绩类型', 'Result type')}
            disabled={!eventHasAverage}
          />
        </div>
      )}
      <div className="wp-table-scroll">
        <table className="wp-pr-table wp-students-table">
          <thead>
            <tr>
              <th className="wp-th-student">
                <span className="wp-student-heading">
                  <WcaStudentAdder
                    teacherWcaId={teacherWcaId}
                    directory={teacherDirectory}
                    isZh={isZh}
                    onSaved={() => setReloadKey((current) => current + 1)}
                  />
                  {t('学生', 'Student')}
                </span>
              </th>
              <th className="wp-th-student-events">{t('项目', 'Events')}</th>
              <th className="wp-th-student-result">
                <button
                  type="button"
                  className="wp-sort-th is-active"
                  onClick={() => setResultSortDir((current) => current === 'asc' ? 'desc' : 'asc')}
                  aria-label={t('按成绩排序', 'Sort by result')}
                >
                  {resultKind === 'single' ? t('单次', 'Single') : t('平均', 'Average')}
                  <SortArrow active dir={resultSortDir} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 && (
              <tr>
                <td className="wp-students-empty" colSpan={3}>{t('暂无学生', 'No students yet')}</td>
              </tr>
            )}
            {visibleStudents.map((student) => (
              <tr key={student.wcaId}>
                <td className="wp-cell-student">
                  <span className="wp-student-identity">
                    <WcaTeacherCell
                      studentWcaId={student.wcaId}
                      eventIds={student.eventIds}
                      editableEventIds={ALL_EVENT_IDS}
                      directory={teacherDirectory}
                      isZh={isZh}
                      editorOnly
                      managedTeacherWcaId={teacherWcaId}
                    />
                    {student.countryIso2 && (
                      <Flag
                        iso2={student.countryIso2}
                        spanClassName="country-flag"
                        imgClassName="country-flag-ct"
                      />
                    )}
                    <PersonLink
                      wcaId={student.wcaId}
                      name={student.name}
                      isZh={isZh}
                      className="wp-student-link"
                    />
                  </span>
                </td>
                <td className="wp-cell-student-events">
                  <span className="wp-student-event-list">
                    {selectedEventId && (
                      <EventIcon
                        event={selectedEventId}
                        className={`wp-event-icon${student.competedEventIds?.includes(selectedEventId) === false ? ' wp-event-icon-uncompeted' : ''}`}
                        title={eventDisplayName(selectedEventId, isZh)}
                      />
                    )}
                  </span>
                </td>
                <td className="wp-cell-student-result">
                  {student.resultValue !== null && student.resultValue > 0 && selectedEventId
                    ? formatWcaResult(student.resultValue, selectedEventId, resultKind)
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
