'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { parseAsString, parseAsStringEnum, useQueryState } from 'nuqs';
import { BadgeCheck, ExternalLink, EyeOff, GraduationCap, MapPin, Mic2, Pencil, Plus, UserRound } from 'lucide-react';
import AppLink from '@/components/AppLink';
import BackHome from '@/components/BackHome';
import PersonLink from '@/components/PersonLink';
import SearchInput from '@/components/SearchInput';
import { nextQuery, useAuthUser, useIsAdmin, useOwnerKey } from '@/lib/auth-store';
import { tr } from '@/i18n/tr';
import { fetchMyTeacherDirectory, fetchTeacherDirectory, mergeTeacherDirectoryEntries, type TeacherDirectoryEntry } from '@/lib/teacher-directory-api';
import { fetchTeacherLiveScripts, type TeacherLiveScript } from '@/lib/teacher-live-scripts-api';
import { creatorProfileHrefForWcaId } from '@/lib/creator-profile';
import { CONTACT_FIELDS, DIRECTORY_KINDS, URL_CONTACT_KEYS, directoryContactHref, directoryKindLabel, directoryModeLabel, directoryWebsiteLabel, localDirectoryTags, localDirectoryText } from './directory-data';

function DirectoryEntry({ entry, canEdit, scripts }: { entry: TeacherDirectoryEntry; canEdit: boolean; scripts: TeacherLiveScript[] }) {
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
          {entry.isCurated && <span className="directory-curated"><BadgeCheck size={14} />{tr({ zh: '站方录入', en: 'Curated' })}</span>}
          {!entry.isVisible && <span className="directory-curated"><EyeOff size={14} />{tr({ zh: '仅自己可见', en: 'Only visible to you' })}</span>}
        </div>
        <h2>{profileHref ? <AppLink className="directory-profile-name" href={profileHref}>{name}</AppLink> : name}</h2>
        {alternateName && <p className="directory-alt-name">{alternateName}</p>}
        {location && <p className="directory-location"><MapPin size={15} />{location}</p>}
        {canEdit && <div className="directory-owner-actions"><AppLink href={`/teachers/edit?id=${entry.id}`} prefetch={false} className="directory-edit-button"><Pencil size={15} />{tr({ zh: '编辑资料', en: 'Edit profile' })}</AppLink><AppLink href={`/teachers/scripts/manage?teacher=${entry.id}`} prefetch={false} className="directory-edit-button"><Mic2 size={15} />{tr({ zh: '管理话术', en: 'Manage scripts' })}</AppLink></div>}
      </div>
      <div className="directory-entry-body">
        {cover && <figure className="directory-cover"><img src={cover.url} alt={localDirectoryText(cover.captionZh, cover.captionEn) || name} />{localDirectoryText(cover.captionZh, cover.captionEn) && <figcaption>{localDirectoryText(cover.captionZh, cover.captionEn)}</figcaption>}</figure>}
        <p className="directory-description">{localDirectoryText(entry.descriptionZh, entry.descriptionEn)}</p>
        {tags.length > 0 && <div className="directory-tags" aria-label={tr({ zh: '擅长方向', en: 'Specialties' })}>{tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
        {scripts.length > 0 && <div className="directory-scripts"><p>{tr({ zh: '直播话术', en: 'Livestream scripts' })}</p>{scripts.slice(0, 2).map((script) => <AppLink key={script.id} href={`/teachers/scripts/${script.id}`} prefetch={false}><Mic2 size={14} /><span>{localDirectoryText(script.titleZh, script.titleEn)}</span></AppLink>)}</div>}
        <div className="directory-facts"><span><GraduationCap size={16} />{directoryModeLabel(entry.teachingMode)}</span>{profileHref && <AppLink href={profileHref} className="directory-link"><UserRound size={15} />{tr({ zh: '完整个人介绍', en: 'Full profile' })}</AppLink>}{entry.wcaId && <PersonLink wcaId={entry.wcaId} className="directory-link">WCA {entry.wcaId}</PersonLink>}{entry.website && <a className="directory-link" href={entry.website} target="_blank" rel="noreferrer">{directoryWebsiteLabel(entry.website)}<ExternalLink size={14} /></a>}</div>
        {contacts.length > 0 && <div className="directory-contacts"><div className="directory-contact-list">{contacts.map(({ key, label, value, href }) => href ? <a key={key} className="directory-contact-item directory-link" href={href} target={URL_CONTACT_KEYS.has(key) ? '_blank' : undefined} rel={URL_CONTACT_KEYS.has(key) ? 'noreferrer' : undefined}><span className="directory-contact-label">{tr(label)}</span><span>{value}</span>{URL_CONTACT_KEYS.has(key) && <ExternalLink size={13} />}</a> : <span key={key} className="directory-contact-item"><span className="directory-contact-label">{tr(label)}</span><span>{value}</span></span>)}</div></div>}
        {gallery.length > 0 && <div className="directory-gallery">{gallery.map((image) => <figure key={image.id}><img src={image.url} alt={localDirectoryText(image.captionZh, image.captionEn) || name} />{localDirectoryText(image.captionZh, image.captionEn) && <figcaption>{localDirectoryText(image.captionZh, image.captionEn)}</figcaption>}</figure>)}</div>}
      </div>
    </article>
  );
}

function TeachersDirectoryClient() {
  const pathname = usePathname();
  const user = useAuthUser();
  const ownerKey = useOwnerKey();
  const isAdmin = useIsAdmin();
  const [query, setQuery] = useQueryState('q', parseAsString.withDefault(''));
  const [kind, setKind] = useQueryState('type', parseAsStringEnum([...DIRECTORY_KINDS]).withDefault('all'));
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
    fetchTeacherLiveScripts().then((data) => { if (active) setScripts(data); }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ownerKey) { setMyEntries([]); setLoadedOwnerKey(''); setMyLoadError(''); return; }
    let active = true;
    setMyLoadError('');
    fetchMyTeacherDirectory().then((data) => { if (active) setMyEntries(data); }).catch(() => { if (active) { setMyEntries([]); setMyLoadError(tr({ zh: '你的资料暂时无法加载。', en: 'Your entries could not be loaded.' })); } }).finally(() => { if (active) setLoadedOwnerKey(ownerKey); });
    return () => { active = false; };
  }, [ownerKey]);

  const ownedEntries = loadedOwnerKey === ownerKey ? myEntries : [];
  const entries = useMemo(() => mergeTeacherDirectoryEntries(publicEntries, ownedEntries), [ownedEntries, publicEntries]);
  const myIds = useMemo(() => new Set(ownedEntries.map((entry) => entry.id)), [ownedEntries]);
  const scriptsByEntry = useMemo(() => {
    const map = new Map<number, TeacherLiveScript[]>();
    for (const script of scripts) map.set(script.teacherEntryId, [...(map.get(script.teacherEntryId) ?? []), script]);
    return map;
  }, [scripts]);
  const directoryLoading = loading || (!!ownerKey && loadedOwnerKey !== ownerKey);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return entries.filter((entry) => {
      if (kind !== 'all' && entry.kind !== kind) return false;
      if (!needle) return true;
      return [entry.nameZh, entry.nameEn, entry.locationZh, entry.locationEn, entry.descriptionZh, entry.descriptionEn, entry.wcaId, ...Object.values(entry.contacts), ...entry.specialtiesZh, ...entry.specialtiesEn].join('\n').toLocaleLowerCase().includes(needle);
    });
  }, [entries, kind, query]);

  return (
    <main className="teachers-page">
      <div className="teachers-back-row"><BackHome /></div>
      <header className="teachers-hero">
        <p className="directory-kicker">{tr({ zh: '学习资源', en: 'Learn from people' })}</p>
        <h1>{tr({ zh: '魔方老师与机构', en: 'Cube Teachers & Schools' })}</h1>
        <p className="teachers-intro">{tr({ zh: '寻找适合自己的魔方老师、线上课程或本地培训机构，也可以把自己的教学服务加入名录。', en: 'Find a cube teacher, online lesson, or local training school—or add your own teaching service.' })}</p>
        <p className="teachers-trust">{tr({ zh: '资料由站方或用户提交。联系、付费或报名之前，请自行核实教学内容与身份。', en: 'Entries are submitted by CubeRoot or its users. Verify identity and course details before contacting, paying, or enrolling.' })}</p>
        <div className="teachers-hero-actions">{user ? <AppLink href="/teachers/edit" prefetch={false} className="directory-primary-button teachers-add-button"><Plus size={17} />{tr({ zh: '建立教学主页', en: 'Build a profile' })}</AppLink> : <AppLink href={`/account${nextQuery(pathname)}`} prefetch={false} className="directory-primary-button teachers-add-button"><Plus size={17} />{tr({ zh: '登录后添加', en: 'Sign in to add' })}</AppLink>}<AppLink href="/teachers/scripts" className="directory-edit-button teachers-script-library"><Mic2 size={15} />{tr({ zh: '浏览直播话术', en: 'Browse scripts' })}</AppLink></div>
      </header>
      <div className="directory-toolbar"><SearchInput value={query} onChange={(value) => { void setQuery(value || null); }} className="directory-search" inputClassName="directory-search-input" placeholder={tr({ zh: '搜索姓名、地点或擅长方向', en: 'Search names, places, or specialties' })} /><label className="directory-kind-filter"><span>{tr({ zh: '类型', en: 'Type' })}</span><select className="directory-kind-control" value={kind} onChange={(event) => { void setKind(event.target.value as typeof kind); }}><option value="all">{tr({ zh: '全部', en: 'All' })}</option><option value="teacher">{tr({ zh: '魔方老师', en: 'Teachers' })}</option><option value="organization">{tr({ zh: '培训机构', en: 'Schools' })}</option></select></label></div>
      <section className="directory-list" aria-label={tr({ zh: '老师与机构名录', en: 'Teacher and school directory' })}>
        {directoryLoading && <p className="directory-state">{tr({ zh: '正在加载名录…', en: 'Loading the directory…' })}</p>}
        {!directoryLoading && loadError && <p className="directory-state directory-load-error">{loadError}</p>}
        {!directoryLoading && !loadError && myLoadError && <p className="directory-state directory-load-error">{myLoadError}</p>}
        {!directoryLoading && !loadError && filtered.length === 0 && <p className="directory-state">{tr({ zh: '没有找到符合条件的资料。', en: 'No matching entries.' })}</p>}
        {filtered.map((entry) => <DirectoryEntry key={entry.id} entry={entry} canEdit={isAdmin || myIds.has(entry.id)} scripts={scriptsByEntry.get(entry.id) ?? []} />)}
      </section>
    </main>
  );
}

export default function TeachersPage() {
  return <Suspense><TeachersDirectoryClient /></Suspense>;
}
