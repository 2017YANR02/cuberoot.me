'use client';

import { useEffect, useMemo, useState } from 'react';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { Flag } from '@/components/Flag';
import PersonLink from '@/components/PersonLink';
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
import { fetchWcaPerson } from '@/lib/wca-person-api';
import { listWcaTeacherStudents, type WcaTeacher } from '@/lib/wca-teachers-api';
import { eventDisplayName } from '@/lib/wca-events';

interface StudentSeed {
  wcaId: string;
  name?: string;
  eventIds: string[];
}

interface StudentMeta {
  countryIso2: string;
  eventIds: string[];
}

export default function PersonStudents({ teacherWcaId, isZh }: { teacherWcaId: string; isZh: boolean }) {
  const t = useT();
  const [relations, setRelations] = useState<WcaTeacher[] | null>(null);
  const [studentMeta, setStudentMeta] = useState<Map<string, StudentMeta>>(() => new Map());
  const [reloadKey, setReloadKey] = useState(0);

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
        const profile = await fetchWcaPerson(wcaId);
        const available = new Set(Object.keys(profile.personal_records));
        return [wcaId, {
          countryIso2: profile.person.country_iso2,
          eventIds: ALL_EVENT_IDS.filter((eventId) => available.has(eventId)),
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
      editableEventIds: meta?.eventIds.length ? meta.eventIds : student.eventIds,
      countryIso2: meta?.countryIso2 ?? '',
    }];
  }), [studentMeta, studentSeeds, teacherDirectory.ready, teacherDirectory.teachers, teacherWcaId]);

  const canAddStudents = canAddWcaTeacherStudent(teacherWcaId, teacherDirectory);

  if (students.length === 0 && !canAddStudents) return null;

  return (
    <section className="wp-card wp-students-card" aria-label={t('学生', 'Students')}>
      <div className="wp-table-scroll">
        <table className="wp-pr-table wp-students-table">
          <thead>
            <tr>
              <th className="wp-th-student">
                <span className="wp-student-heading">
                  {t('学生', 'Student')}
                  <WcaStudentAdder
                    teacherWcaId={teacherWcaId}
                    directory={teacherDirectory}
                    isZh={isZh}
                    onSaved={() => setReloadKey((current) => current + 1)}
                  />
                </span>
              </th>
              <th className="wp-th-student-events">{t('项目', 'Events')}</th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 && (
              <tr>
                <td className="wp-students-empty" colSpan={2}>{t('暂无学生', 'No students yet')}</td>
              </tr>
            )}
            {students.map((student) => (
              <tr key={student.wcaId}>
                <td className="wp-cell-student">
                  <span className="wp-student-identity">
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
                    <WcaTeacherCell
                      studentWcaId={student.wcaId}
                      eventIds={student.eventIds}
                      editableEventIds={student.editableEventIds}
                      directory={teacherDirectory}
                      isZh={isZh}
                      editorOnly
                    />
                  </span>
                </td>
                <td className="wp-cell-student-events">
                  <span className="wp-student-event-list">
                    {student.eventIds.map((eventId) => (
                      <EventIcon
                        key={eventId}
                        event={eventId}
                        className="wp-event-icon"
                        title={eventDisplayName(eventId, isZh)}
                      />
                    ))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
