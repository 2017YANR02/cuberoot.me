'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { parseAsString, parseAsStringEnum, useQueryState } from 'nuqs';
import { BadgeCheck, ExternalLink, EyeOff, GraduationCap, MapPin, Mic2, Pencil, Plus, UserRound } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import { PlatformTeacherCourses } from '@/components/platform/PlatformTeacherCourses';
import { PlatformInstructorCard } from '@/components/platform/PlatformInstructorCard';
import BackHome from '@/components/BackHome';
import PersonLink from '@/components/PersonLink';
import SearchInput from '@/components/SearchInput';
import { useIsAdmin, useOwnerKey } from '@/lib/auth-store';
import { tr } from '@/i18n/tr';
import { fetchMyTeacherDirectory, fetchTeacherDirectory, mergeTeacherDirectoryEntries, type TeacherDirectoryEntry } from '@/lib/teacher-directory-api';
import { fetchTeacherLiveScripts, type TeacherLiveScript } from '@/lib/teacher-live-scripts-api';
import { creatorProfileHrefForWcaId } from '@/lib/creator-profile';
import { CONTACT_FIELDS, DIRECTORY_KINDS, URL_CONTACT_KEYS, directoryContactHref, directoryKindLabel, directoryModeLabel, directoryWebsiteLabel, localDirectoryTags, localDirectoryText } from '@/lib/teacher-directory-presentation';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { usePlatformSearchBinding } from '@/lib/platform-navigation-context';
import './teacher-directory.css';

function DirectoryEntry({ entry, canEdit, isAdmin, scripts }: { entry: TeacherDirectoryEntry; canEdit: boolean; isAdmin: boolean; scripts: TeacherLiveScript[] }) {
  const name = localDirectoryText(entry.nameZh, entry.nameEn);
  const alternateName = [entry.nameZh, entry.nameEn].find((candidate) => candidate && candidate !== name);
  const location = localDirectoryText(entry.locationZh, entry.locationEn);
  const tags = localDirectoryTags(entry.specialtiesZh, entry.specialtiesEn);
  const contacts = CONTACT_FIELDS.flatMap((field) => {
    const value = entry.contacts[field.key];
    return value ? [{ ...field, value, href: directoryContactHref(field.key, value) }] : [];
  });
  const cover = entry.images.find((image) => image.kind === 'portrait') ?? entry.images[0];
  const gallery = entry.images.filter((image) => image.id !== cover?.id);
  const profileHref = creatorProfileHrefForWcaId(entry.wcaId);

  return (
    <article className="directory-entry">
      <div className="directory-entry-heading">
        <div className="directory-entry-labels">
          <span>{directoryKindLabel(entry.kind)}</span>
          {entry.kind === 'teacher' && entry.instructorStatus === 'active' && <span className="directory-curated"><BadgeCheck size={14} />{tr({ zh: '认证讲师', en: 'Verified instructor' })}</span>}
          {entry.kind === 'teacher' && entry.instructorStatus && entry.instructorStatus !== 'active' && <span className="directory-curated"><EyeOff size={14} />{tr({ zh: '未公开：讲师权限尚未生效', en: 'Not public: instructor access is inactive' })}</span>}
          {entry.isCurated && <span className="directory-curated"><BadgeCheck size={14} />{tr({ zh: '站方录入', en: 'Curated' })}</span>}
          {!entry.isVisible && <span className="directory-curated"><EyeOff size={14} />{tr({ zh: '仅自己可见', en: 'Only visible to you' })}</span>}
        </div>
        <h2>{profileHref ? <AppLink className="directory-profile-name" href={profileHref}>{name}</AppLink> : name}</h2>
        {alternateName && <p className="directory-alt-name">{alternateName}</p>}
        {location && <p className="directory-location"><MapPin size={15} />{location}</p>}
        {canEdit && <div className="directory-owner-actions">{entry.kind === 'teacher' && !isAdmin
          ? <AppLink href={entry.instructorStatus === 'active' ? '/platform/instructor/profile' : '/platform/teachers/apply'} prefetch={false} className="directory-edit-button"><Pencil size={15} />{tr({ zh: '讲师资料', en: 'Instructor profile' })}</AppLink>
          : <><AppLink href={`/teachers/edit?id=${entry.id}`} prefetch={false} className="directory-edit-button"><Pencil size={15} />{tr({ zh: '编辑资料', en: 'Edit profile' })}</AppLink><AppLink href={`/teachers/scripts/manage?teacher=${entry.id}`} prefetch={false} className="directory-edit-button"><Mic2 size={15} />{tr({ zh: '管理话术', en: 'Manage scripts' })}</AppLink></>}</div>}
      </div>
      <div className="directory-entry-body">
        {cover && <figure className="directory-cover"><img src={cover.url} alt={localDirectoryText(cover.captionZh, cover.captionEn) || name} />{localDirectoryText(cover.captionZh, cover.captionEn) && <figcaption>{localDirectoryText(cover.captionZh, cover.captionEn)}</figcaption>}</figure>}
        <p className="directory-description">{localDirectoryText(entry.descriptionZh, entry.descriptionEn)}</p>
        {tags.length > 0 && <div className="directory-tags" aria-label={tr({ zh: '擅长方向', en: 'Specialties' })}>{tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
        {scripts.length > 0 && <div className="directory-scripts"><p>{tr({ zh: '直播话术', en: 'Livestream scripts' })}</p>{scripts.slice(0, 2).map((script) => <AppLink key={script.id} href={`/teachers/scripts/${script.id}`} prefetch={false}><Mic2 size={14} /><span>{localDirectoryText(script.titleZh, script.titleEn)}</span></AppLink>)}</div>}
        <div className="directory-facts"><span><GraduationCap size={16} />{directoryModeLabel(entry.teachingMode)}</span>{profileHref && <AppLink href={profileHref} className="directory-link"><UserRound size={15} />{tr({ zh: '完整个人介绍', en: 'Full profile' })}</AppLink>}{entry.wcaId && <PersonLink wcaId={entry.wcaId} className="directory-link">WCA {entry.wcaId}</PersonLink>}{entry.website && <a className="directory-link" href={entry.website} target="_blank" rel="noreferrer">{directoryWebsiteLabel(entry.website)}<ExternalLink size={14} /></a>}</div>
        {contacts.length > 0 && <div className="directory-contacts"><div className="directory-contact-list">{contacts.map(({ key, label, value, href }) => href ? <a key={key} className="directory-contact-item directory-link" href={href} target={URL_CONTACT_KEYS.has(key) ? '_blank' : undefined} rel={URL_CONTACT_KEYS.has(key) ? 'noreferrer' : undefined}><span className="directory-contact-label">{tr(label)}</span><span>{value}</span>{URL_CONTACT_KEYS.has(key) && <ExternalLink size={13} />}</a> : <span key={key} className="directory-contact-item"><span className="directory-contact-label">{tr(label)}</span><span>{value}</span></span>)}</div></div>}
        <PlatformTeacherCourses teacherId={entry.id} />
        {gallery.length > 0 && <div className="directory-gallery">{gallery.map((image) => <figure key={image.id}><img src={image.url} alt={localDirectoryText(image.captionZh, image.captionEn) || name} />{localDirectoryText(image.captionZh, image.captionEn) && <figcaption>{localDirectoryText(image.captionZh, image.captionEn)}</figcaption>}</figure>)}</div>}
      </div>
    </article>
  );
}

type DirectoryProps = { platform?: boolean; teacherId?: string };

function TeachersDirectoryClient({ platform: inPlatformShell = false, teacherId }: DirectoryProps) {
  const ownerKey = useOwnerKey();
  const isAdmin = useIsAdmin();
  const [teacherQuery, setTeacher] = useQueryState('teacher', parseAsString.withDefault(''));
  const teacher = teacherId ?? teacherQuery;
  const [query, setQuery] = useQueryState('q', parseAsString.withDefault(''));
  const [kind, setKind] = useQueryState('type', parseAsStringEnum([...DIRECTORY_KINDS]).withDefault('all'));
  usePlatformSearchBinding('teachers', query, value => { void setQuery(value || null); void setTeacher(null); }, inPlatformShell, { routeId: 'teachers' });
  const [publicEntries, setPublicEntries] = useState<TeacherDirectoryEntry[]>([]);
  const [myEntries, setMyEntries] = useState<TeacherDirectoryEntry[]>([]);
  const [scripts, setScripts] = useState<TeacherLiveScript[]>([]);
  const [loadedOwnerKey, setLoadedOwnerKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [myLoadError, setMyLoadError] = useState('');

  useEffect(() => {
    let active = true;
    fetchTeacherDirectory().then((data) => { if (active) setPublicEntries(data); }).catch(() => { if (active) setLoadError(tr({ zh: '名录暂时无法加载。', en: 'The directory could not be loaded.' })); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const showDetails = !inPlatformShell || Boolean(teacher);
  useEffect(() => {
    if (!showDetails) return;
    let active = true;
    fetchTeacherLiveScripts().then(data => { if (active) setScripts(data); }).catch(() => {});
    return () => { active = false; };
  }, [showDetails]);

  useEffect(() => {
    if (inPlatformShell || !ownerKey) { setMyEntries([]); setLoadedOwnerKey(''); setMyLoadError(''); return; }
    let active = true;
    setMyLoadError('');
    fetchMyTeacherDirectory().then((data) => { if (active) setMyEntries(data); }).catch(() => { if (active) { setMyEntries([]); setMyLoadError(tr({ zh: '你的资料暂时无法加载。', en: 'Your entries could not be loaded.' })); } }).finally(() => { if (active) setLoadedOwnerKey(ownerKey); });
    return () => { active = false; };
  }, [ownerKey, inPlatformShell]);

  const ownedEntries = loadedOwnerKey === ownerKey ? myEntries : [];
  const entries = useMemo(() => inPlatformShell ? publicEntries : mergeTeacherDirectoryEntries(publicEntries, ownedEntries), [inPlatformShell, ownedEntries, publicEntries]);
  const myIds = useMemo(() => new Set(ownedEntries.map((entry) => entry.id)), [ownedEntries]);
  const scriptsByEntry = useMemo(() => {
    const map = new Map<number, TeacherLiveScript[]>();
    for (const script of scripts) map.set(script.teacherEntryId, [...(map.get(script.teacherEntryId) ?? []), script]);
    return map;
  }, [scripts]);
  const directoryLoading = loading || (!inPlatformShell && !!ownerKey && loadedOwnerKey !== ownerKey);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return entries.filter((entry) => {
      if (teacher && String(entry.id) !== teacher) return false;
      if (inPlatformShell) {
        // Explicit organization detail links still work, but the instructor catalog is teachers only.
        if (!teacher && entry.kind !== 'teacher') return false;
        if (!entry.isVisible || (entry.kind === 'teacher' && entry.instructorStatus != null && entry.instructorStatus !== 'active')) return false;
      } else if (kind !== 'all' && entry.kind !== kind) return false;
      if (!needle) return true;
      return [entry.nameZh, entry.nameEn, entry.locationZh, entry.locationEn, entry.descriptionZh, entry.descriptionEn, entry.wcaId, ...Object.values(entry.contacts), ...entry.specialtiesZh, ...entry.specialtiesEn].join('\n').toLocaleLowerCase().includes(needle);
    });
  }, [entries, inPlatformShell, kind, query, teacher]);

  const Container = inPlatformShell ? 'div' : 'main';
  return (
    <Container className={`teachers-page${inPlatformShell ? ' teachers-page--platform' : ''}`}>
      {!inPlatformShell && <div className="teachers-back-row"><BackHome /></div>}
      {inPlatformShell ? <h1 className="sr-only">{tr({ zh: '全部讲师', en: 'All instructors' })}</h1> : <header className="teachers-hero">

        <h1>{tr({ zh: '魔方老师与机构', en: 'Cube Teachers & Schools' })}</h1>
        <p className="teachers-intro">{tr({ zh: '寻找认证讲师、线上课程或本地培训机构。讲师入驻审核通过后即可完善并公开资料。', en: 'Find verified instructors, online courses or local schools. Approved instructors can complete and publish their profiles.' })}</p>
        <div className="teachers-hero-actions"><AppLink href="/platform/teachers/apply" prefetch={false} className="directory-primary-button teachers-add-button"><Plus size={17} />{tr({ zh: '讲师入驻', en: 'Teach with us' })}</AppLink><AppLink href="/teachers/edit?kind=organization" prefetch={false} className="directory-edit-button">{tr({ zh: '添加培训机构', en: 'Add a school' })}</AppLink><AppLink href="/teachers/scripts" className="directory-edit-button teachers-script-library"><Mic2 size={15} />{tr({ zh: '浏览直播话术', en: 'Browse scripts' })}</AppLink></div>
      </header>}
      {teacher && (inPlatformShell ? <AppLink href="/platform/teachers" prefetch={false} className="directory-edit-button">{tr({ zh: '查看全部讲师', en: 'View all instructors' })}</AppLink> : <button type="button" className="directory-edit-button" onClick={() => { void setTeacher(null); }}>{tr({ zh: '查看全部老师与机构', en: 'Show all teachers and schools' })}</button>)}
      {inPlatformShell && !teacher && <div className="directory-toolbar"><SearchInput value={query} onChange={value => { void setQuery(value || null); }} className="directory-search" inputClassName="directory-search-input" placeholder={tr({ zh: '筛选讲师姓名或擅长方向', en: 'Filter instructors' })} /></div>}
      {!inPlatformShell && <div className="directory-toolbar"><SearchInput value={query} onChange={(value) => { void setQuery(value || null); }} className="directory-search" inputClassName="directory-search-input" placeholder={tr({ zh: '搜索姓名、地点或擅长方向', en: 'Search names, places, or specialties' })} /><label className="directory-kind-filter"><span>{tr({ zh: '类型', en: 'Type' })}</span><select className="directory-kind-control" value={kind} onChange={(event) => { void setKind(event.target.value as typeof kind); }}><option value="all">{tr({ zh: '全部', en: 'All' })}</option><option value="teacher">{tr({ zh: '魔方老师', en: 'Teachers' })}</option><option value="organization">{tr({ zh: '培训机构', en: 'Schools' })}</option></select></label></div>}
      <section className="directory-list" aria-label={inPlatformShell ? tr({ zh: '全部讲师', en: 'All instructors' }) : tr({ zh: '老师与机构名录', en: 'Teacher and school directory' })}>
        {directoryLoading && <p className="directory-state"><LoadingIndicator>{tr({ zh: '正在加载名录…', en: 'Loading the directory…' })}</LoadingIndicator></p>}
        {!directoryLoading && loadError && <p className="directory-state directory-load-error">{loadError}</p>}
        {!inPlatformShell && !directoryLoading && !loadError && myLoadError && <p className="directory-state directory-load-error">{myLoadError}</p>}
        {!directoryLoading && !loadError && filtered.length === 0 && <div className="directory-state">
          {inPlatformShell && !query && !teacher ? <div className="platform-teacher-empty"><h2>{tr({ zh: '讲师陆续入驻中', en: 'More instructors are joining' })}</h2><p>{tr({ zh: '欢迎关注魔方根的站点公告。', en: 'Check CubeRoot announcements for updates.' })}</p><AppLink className="platform-button" href="/platform/community/circles/site-announcements" prefetch={false}>{tr({ zh: '查看上新公告', en: 'View announcements' })}</AppLink></div> : <p>{tr({ zh: '没有找到符合条件的资料。', en: 'No matching entries.' })}</p>}
        </div>}
        {!showDetails && filtered.length > 0 ? <div className="platform-instructor-grid">{filtered.map(entry => <PlatformInstructorCard key={entry.id} teacher={entry} heading="h2" />)}</div>
          : filtered.map((entry) => <DirectoryEntry key={entry.id} entry={entry} isAdmin={isAdmin} canEdit={!inPlatformShell && (isAdmin || myIds.has(entry.id))} scripts={scriptsByEntry.get(entry.id) ?? []} />)}
      </section>
    </Container>
  );
}

export function TeacherDirectory(props: DirectoryProps) {
  return <Suspense><TeachersDirectoryClient {...props} /></Suspense>;
}
