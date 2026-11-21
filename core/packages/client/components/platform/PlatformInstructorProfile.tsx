'use client';

import { useEffect, useRef, useState } from 'react';
import AppLink from '@/components/AppLink';
import MoreToggle from '@/components/MoreToggle';
import TeacherDirectoryEditor from '@/components/teacher-directory/TeacherDirectoryEditor';
import { useT } from '@/hooks/useT';
import { useAuthUser } from '@/lib/auth-store';
import { fetchMyTeacherDirectory, type TeacherDirectoryEntry } from '@/lib/teacher-directory-api';
import { CONTACT_FIELDS, directoryModeLabel, localDirectoryTags, localDirectoryText } from '@/lib/teacher-directory-presentation';
import type { PlatformEntity } from '@/lib/platform-types';
import { InstructorApplicationDetails } from './PlatformInstructorApplication';
import type { RunAction } from './PlatformActionTypes';
import { PlatformState } from './PlatformState';
import '@/components/teacher-directory/teacher-directory.css';

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

function DirectoryProfile({ entry, linked }: { entry: TeacherDirectoryEntry; linked: boolean | null }) {
  const t = useT();
  const name = localDirectoryText(entry.nameZh, entry.nameEn);
  const cover = entry.images.find(image => image.kind === 'portrait') ?? entry.images[0];
  const fields = [
    ['WCA ID', entry.wcaId],
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

export function PlatformInstructorProfile({ entity, busy, runAction }: { entity?: PlatformEntity; busy: string | null; runAction: RunAction }) {
  const t = useT();
  if (entity?.data?.instructorStatus !== 'active') return <PlatformState kind="permission" message={t('当前账号没有可用的讲师权限。', 'This account does not have active instructor access.')} />;
  return <ActiveInstructorProfile entity={entity} busy={busy} runAction={runAction} />;
}

function ActiveInstructorProfile({ entity, busy, runAction }: { entity: PlatformEntity; busy: string | null; runAction: RunAction }) {
  const t = useT();
  const user = useAuthUser();
  const [loadedEntries, setEntries] = useState<TeacherDirectoryEntry[] | null>(null);
  const [entriesOwner, setEntriesOwner] = useState<string | number | undefined>(undefined);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [saved, setSaved] = useState(false);
  const [repairRevision, setRepairRevision] = useState(0);
  const [repairFailed, setRepairFailed] = useState(false);
  const lastRepair = useRef<string | null>(null);
  const owner = user?.uid ?? user?.wcaId;
  const entries = entriesOwner === owner ? loadedEntries : null;
  const data = entity.data ?? {};
  const linkedId = data.teacherEntryId;
  useEffect(() => {
    const controller = new AbortController();
    setEntries(null); setError(false); setSaved(false);
    void fetchMyTeacherDirectory(controller.signal).then(result => {
      if (!controller.signal.aborted) { setEntries(result.filter(entry => entry.kind === 'teacher')); setEntriesOwner(owner); }
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [owner, retry, linkedId]);
  const profileKnown = data.instructorProfileKnown !== false;
  const canonicalProfile = entries?.find(entry => linkedId != null && String(entry.id) === String(linkedId));
  // Older APIs verify active access without reporting the canonical profile ID.
  // Only a single owned teacher entry can be edited in that compatibility case.
  const editableProfile = canonicalProfile ?? (!profileKnown && entries?.length === 1 ? entries[0] : undefined);
  const profiles = editableProfile ? [] : entries ?? [];
  const candidates = Array.isArray(data.directoryProfiles) ? data.directoryProfiles : [];
  const candidate = candidates.length === 1 && candidates[0] && typeof candidates[0] === 'object'
    ? Number((candidates[0] as Record<string, unknown>).id) : 0;
  const canLink = Number.isSafeInteger(candidate) && candidate > 0 && entries?.some(entry => entry.id === candidate);
  const canInitialize = linkedId == null && entries?.length === 0 && candidates.length === 0;
  const repairAction = canInitialize ? 'initialize-instructor-profile' as const
    : profileKnown && linkedId == null && canLink ? 'link-instructor-profile' as const : null;
  const repairKey = repairAction && owner != null ? `${owner}:${repairAction}:${candidate}:${repairRevision}` : null;
  useEffect(() => {
    if (!repairAction || !repairKey || busy || lastRepair.current === repairKey) return;
    lastRepair.current = repairKey;
    setRepairFailed(false);
    void runAction(repairAction, undefined, repairAction === 'link-instructor-profile' ? { teacherEntryId: candidate } : {})
      .then(response => { if (!response && lastRepair.current === repairKey) setRepairFailed(true); });
  }, [repairAction, repairKey, busy, candidate, runAction]);
  const name = text(data.instructorDisplayName) || user?.name || t('讲师', 'Instructor');
  const bio = localDirectoryText(text(data.instructorBioZh), text(data.instructorBioEn));
  const hasApplication = data.application != null;
  return <div className="platform-domain-stack platform-application-flow">
    {!editableProfile && <section className="platform-domain-content platform-application-details">
      <div className="platform-application-detail-head"><h2>{name}</h2><span className="platform-status platform-application-status" data-application-state="approved">{t('讲师', 'Instructor')}</span></div>
      {user?.wcaId && <p className="platform-application-meta">WCA ID: {user.wcaId}</p>}
      {bio && <section className="platform-application-detail-group"><h3>{t('讲师简介', 'Instructor biography')}</h3><p className="platform-application-feedback">{bio}</p></section>}
    </section>}
    <section className="platform-application-profile-section">
      <h2>{t('个人主页', 'Personal profile')}</h2>
      {editableProfile && <p>{editableProfile.isVisible ? t('公开展示', 'Public') : t('仅自己可见', 'Only visible to you')}</p>}
      {editableProfile && <div className="platform-write-actions">{editableProfile.isVisible && <AppLink href={`/platform/teachers/${editableProfile.id}`} className="platform-button" prefetch={false}>{t('查看公开主页', 'View public profile')}</AppLink>}<AppLink href={`/teachers/scripts/manage?teacher=${encodeURIComponent(String(editableProfile.id))}`} className="platform-button" prefetch={false}>{t('管理直播话术', 'Manage livestream scripts')}</AppLink></div>}
      {repairAction ? repairFailed ? <PlatformState kind="error" title={t('个人主页暂时无法同步', 'Personal profile could not be synchronized')} message="" onRetry={() => setRepairRevision(value => value + 1)} />
        : <PlatformState kind="loading" message={t('正在同步个人主页…', 'Synchronizing your personal profile…')} />
        : profileKnown && linkedId == null && entries !== null && <p>{t('历史讲师资料尚未关联，请联系管理员处理。', 'A legacy teaching profile needs administrator assistance.')}</p>}
      {error ? <PlatformState kind="error" message={t('讲师资料暂时无法加载。', 'Could not load your teaching profile.')} onRetry={() => setRetry(value => value + 1)} /> : entries === null ? <PlatformState kind="loading" /> : <>
        {profileKnown && linkedId != null && !canonicalProfile && <p>{t('已关联讲师名录，但当前无法读取该资料。', 'A teaching profile is linked, but its details could not be loaded.')}</p>}
        {!profileKnown && !editableProfile && !canInitialize && <p>{t('暂时无法确认唯一的个人主页，请联系管理员处理。', 'A unique personal profile could not be confirmed; contact an administrator.')}</p>}
        {profiles.map(entry => <DirectoryProfile key={entry.id} entry={entry} linked={profileKnown ? linkedId != null && String(entry.id) === String(linkedId) : null} />)}
      </>}
    </section>
    {editableProfile && <div><TeacherDirectoryEditor key={editableProfile.id} initial={editableProfile} isAdmin={false} onSaved={entry => { setEntries(previous => previous?.map(old => old.id === entry.id ? entry : old) ?? [entry]); setSaved(true); }} />
      {saved && <p className="directory-save-success" role="status">{t('个人主页已保存。', 'Personal profile saved.')}</p>}
    </div>}
    {hasApplication && (editableProfile || profiles.length > 0 ? <details className="platform-application-history"><MoreToggle as="summary">{t('查看原申请资料', 'View original application')}</MoreToggle><InstructorApplicationDetails entity={entity} embedded /></details> : <InstructorApplicationDetails entity={entity} />)}
  </div>;
}
