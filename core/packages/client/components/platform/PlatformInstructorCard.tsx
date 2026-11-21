'use client';

import { UserRound } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import type { TeacherDirectoryEntry } from '@/lib/teacher-directory-api';

export function PlatformInstructorCard({ teacher, heading: Heading = 'h3' }: { teacher: TeacherDirectoryEntry; heading?: 'h2' | 'h3' }) {
  const t = useT();
  const photo = teacher.images.find(item => item.kind === 'teaching')
    ?? teacher.images.find(item => item.kind === 'portrait') ?? teacher.images[0];
  const specialties = t(
    teacher.specialtiesZh.join(' · ') || teacher.specialtiesEn.join(' · '),
    teacher.specialtiesEn.join(' · ') || teacher.specialtiesZh.join(' · '),
  );
  return <AppLink className="platform-instructor-card" href={`/platform/teachers/${teacher.id}`} prefetch={false}>
    <div className="platform-instructor-cover">
      <UserRound aria-hidden />
      {photo && <img src={photo.url} alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true; }} />}
    </div>
    <div className="platform-instructor-info">
      <Heading>{t(teacher.nameZh || teacher.nameEn, teacher.nameEn || teacher.nameZh)}</Heading>
      <p>{specialties || t(teacher.descriptionZh || teacher.descriptionEn, teacher.descriptionEn || teacher.descriptionZh)}</p>
    </div>
  </AppLink>;
}
