'use client';

import { useEffect, useState } from 'react';
import MoreToggle from '@/components/MoreToggle';
import { useT } from '@/hooks/useT';
import { useAuthUser } from '@/lib/auth-store';
import { fetchMyTeacherDirectory, type TeacherDirectoryEntry } from '@/lib/teacher-directory-api';
import { CONTACT_FIELDS, directoryModeLabel, localDirectoryTags, localDirectoryText } from '@/lib/teacher-directory-presentation';
import type { PlatformEntity } from '@/lib/platform-types';
import { InstructorApplicationDetails } from './PlatformInstructorApplication';
import { PlatformState } from './PlatformState';

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

function DirectoryProfile({ entry, linked }: { entry: TeacherDirectoryEntry; linked: boolean | null }) {
  const t = useT();
  const name = localDirectoryText(entry.nameZh, entry.nameEn);
  const cover = entry.images.find(image => image.kind === 'portrait') ?? entry.images[0];
  const fields = [
    [t('所在城市', 'City'), localDirectoryText(entry.locationZh, entry.locationEn)],
    [t('授课方式', 'Teaching mode'), directoryModeLabel(entry.teachingMode)],
    [t('擅长方向', 'Specialties'), localDirectoryTags(entry.specialtiesZh, entry.specialtiesEn).join(t('、', ', '))],
    [t('个人网站', 'Website'), entry.website],
    ...CONTACT_FIELDS.map(field => [t(field.label.zh, field.label.en), entry.contacts[field.key]]),
  ].filter(([, value]) => value);
  const description = localDirectoryText(entry.descriptionZh, entry.descriptionEn);
  return <section className="platform-domain-content platform-application-details platform-instructor-profile-entry">
    <div className="platform-instructor-profile-heading">
      {cover && <img src={cover.url} alt={name} width={80} height={80} loading="lazy" />}
      <div><h2>{name}</h2><div className="platform-application-meta">
        <span>{entry.isVisible ? t('公开展示', 'Public') : t('仅自己可见', 'Only visible to you')}</span>
        {linked !== null && <span>{linked ? t('已关联讲师名录', 'Linked teaching profile') : t('尚未关联', 'Not linked')}</span>}
      </div></div>
    </div>
    {description && <section className="platform-application-detail-group"><h3>{t('教学简介', 'Teaching biography')}</h3><p className="platform-application-feedback">{description}</p></section>}
    {fields.length > 0 && <dl className="platform-application-fields" data-layout="paired">{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
  </section>;
}

export function PlatformInstructorProfile({ entity }: { entity?: PlatformEntity }) {
  const t = useT();
  if (entity?.data?.instructorStatus !== 'active') return <PlatformState kind="permission" message={t('当前账号没有可用的讲师权限。', 'This account does not have active instructor access.')} />;
  return <ActiveInstructorProfile entity={entity} />;
}

function ActiveInstructorProfile({ entity }: { entity: PlatformEntity }) {
  const t = useT();
  const user = useAuthUser();
  const [entries, setEntries] = useState<TeacherDirectoryEntry[] | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const owner = user?.uid ?? user?.wcaId;
  useEffect(() => {
    const controller = new AbortController();
    setEntries(null); setError(false);
    void fetchMyTeacherDirectory(controller.signal).then(result => {
      if (!controller.signal.aborted) setEntries(result.filter(entry => entry.kind === 'teacher'));
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [owner, retry]);
  const data = entity.data ?? {};
  const linkedId = data.teacherEntryId;
  const profileKnown = data.instructorProfileKnown !== false;
  const visible = entries?.find(entry => linkedId != null && String(entry.id) === String(linkedId));
  const profiles = visible ? [visible] : entries ?? [];
  const name = text(data.instructorDisplayName) || user?.name || t('讲师', 'Instructor');
  const bio = localDirectoryText(text(data.instructorBioZh), text(data.instructorBioEn));
  const hasApplication = data.application != null;
  return <div className="platform-domain-stack platform-application-flow">
    <section className="platform-domain-content platform-application-details">
      <div className="platform-application-detail-head"><h2>{name}</h2><span className="platform-status platform-application-status" data-application-state="approved">{t('讲师', 'Instructor')}</span></div>
      {user?.wcaId && <p className="platform-application-meta">WCA ID: {user.wcaId}</p>}
      {bio && <section className="platform-application-detail-group"><h3>{t('讲师简介', 'Instructor biography')}</h3><p className="platform-application-feedback">{bio}</p></section>}
    </section>
    <section className="platform-application-profile-section">
      <h2>{t('讲师名录资料', 'Teaching directory profile')}</h2>
      {error ? <PlatformState kind="error" message={t('讲师资料暂时无法加载。', 'Could not load your teaching profile.')} onRetry={() => setRetry(value => value + 1)} /> : entries === null ? <PlatformState kind="loading" /> : <>
        {profileKnown && linkedId != null && !visible && <p>{t('已关联讲师名录，但当前无法读取该资料。', 'A teaching profile is linked, but its details could not be loaded.')}</p>}
        {!profiles.length && linkedId == null && <p>{t('暂无讲师名录资料。', 'No teaching directory profile yet.')}</p>}
        {profiles.map(entry => <DirectoryProfile key={entry.id} entry={entry} linked={profileKnown ? linkedId != null && String(entry.id) === String(linkedId) : null} />)}
      </>}
    </section>
    {hasApplication && (profiles.length > 0 ? <details className="platform-application-history"><MoreToggle as="summary">{t('查看原申请资料', 'View original application')}</MoreToggle><InstructorApplicationDetails entity={entity} embedded /></details> : <InstructorApplicationDetails entity={entity} />)}
  </div>;
}
