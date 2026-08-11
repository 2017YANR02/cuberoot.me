'use client';

import { useMemo } from 'react';
import { ALL_EVENT_IDS } from '@/lib/event-constants';
import type { WcaPersonProfile } from '@/lib/wca-person-api';
import { tr } from '@/i18n/tr';
import { WcaTeacherCell, useWcaTeachers } from '@/components/WcaTeacherCell';

interface Props {
  profile: WcaPersonProfile;
  isZh: boolean;
}

export default function PersonTeachers({ profile, isZh }: Props) {
  const wcaId = profile.person.wca_id;
  const studentIds = useMemo(() => [wcaId], [wcaId]);
  const eventIds = useMemo(
    () => ALL_EVENT_IDS.filter((eventId) => !!profile.personal_records[eventId]),
    [profile.personal_records],
  );
  const directory = useWcaTeachers(studentIds, eventIds);

  if (eventIds.length === 0) return null;

  return (
    <section className="wp-teachers" aria-labelledby="wp-teachers-title">
      <h2 id="wp-teachers-title">{tr({ zh: '老师', en: 'Teachers' })}</h2>
      <WcaTeacherCell
        studentWcaId={wcaId}
        eventIds={eventIds}
        directory={directory}
        isZh={isZh}
        showEventNames
        emptyLabel={directory.loading
          ? tr({ zh: '加载中…', en: 'Loading…' })
          : directory.loadFailed
            ? tr({ zh: '加载失败', en: 'Failed to load' })
            : tr({ zh: '暂无登记', en: 'Not registered' })}
      />
    </section>
  );
}
