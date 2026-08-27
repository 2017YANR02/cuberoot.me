'use client';

import { useEffect, useMemo, useState } from 'react';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import PersonLink from '@/components/PersonLink';
import { useT } from '@/hooks/useT';
import { ALL_EVENT_IDS } from '@/lib/event-constants';
import { displayCuberName } from '@/lib/cuber-name-display';
import { listWcaTeacherStudents, type WcaTeacher } from '@/lib/wca-teachers-api';
import { eventDisplayName } from '@/lib/wca-events';

interface StudentRow {
  wcaId: string;
  name?: string;
  eventIds: string[];
}

export default function PersonStudents({ teacherWcaId, isZh }: { teacherWcaId: string; isZh: boolean }) {
  const t = useT();
  const [relations, setRelations] = useState<WcaTeacher[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRelations(null);
    listWcaTeacherStudents(teacherWcaId)
      .then((next) => { if (!cancelled) setRelations(next); })
      .catch(() => { if (!cancelled) setRelations([]); });
    return () => { cancelled = true; };
  }, [teacherWcaId]);

  const students = useMemo<StudentRow[]>(() => {
    if (!relations) return [];
    const byStudent = new Map<string, StudentRow>();
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

  if (students.length === 0) return null;

  return (
    <section className="wp-card wp-students-card" aria-label={t('学生', 'Students')}>
      <div className="wp-table-scroll">
        <table className="wp-pr-table wp-students-table">
          <thead>
            <tr>
              <th className="wp-th-student">{t('学生', 'Student')}</th>
              <th className="wp-th-student-events">{t('项目', 'Events')}</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.wcaId}>
                <td className="wp-cell-student">
                  <PersonLink
                    wcaId={student.wcaId}
                    name={student.name}
                    isZh={isZh}
                    className="wp-student-link"
                  />
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
