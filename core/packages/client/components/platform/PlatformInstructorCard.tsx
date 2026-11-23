'use client';

import { UserRound } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import type { TeacherDirectoryEntry } from '@/lib/teacher-directory-api';

export function PlatformInstructorCard({ teacher, heading: Heading = 'h3', catalog = false }: { teacher: TeacherDirectoryEntry; heading?: 'h2' | 'h3'; catalog?: boolean }) {
  const t = useT();
  const photo = teacher.images.find(item => item.kind === 'teaching')
    ?? teacher.images.find(item => item.kind === 'portrait') ?? teacher.images[0];
  const specialties = t(
    teacher.specialtiesZh.join(' · ') || teacher.specialtiesEn.join(' · '),
    teacher.specialtiesEn.join(' · ') || teacher.specialtiesZh.join(' · '),
  );
  const name = t(teacher.nameZh || teacher.nameEn, teacher.nameEn || teacher.nameZh);
  const summary = specialties || t(teacher.descriptionZh || teacher.descriptionEn, teacher.descriptionEn || teacher.descriptionZh);
  const link = <AppLink className={catalog ? 'platform-course-card-link' : 'platform-instructor-card'} href={`/platform/teachers/${teacher.id}`} prefetch={false}>
    <div className={catalog ? 'platform-course-card-cover' : 'platform-instructor-cover'}>
      <UserRound aria-hidden />
      {photo && <img src={photo.url} alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true; }} />}
    </div>
    <div className={catalog ? 'platform-course-card-body' : 'platform-instructor-info'}>
      <div className={catalog ? 'platform-course-card-title' : undefined}><Heading>{name}</Heading></div>
      {summary && <p className={catalog ? 'platform-course-card-summary' : undefined}>{summary}</p>}
    </div>
  </AppLink>;
  return catalog ? <article className="platform-course-card" data-site-surface="panel">{link}</article> : link;
}
