'use client';

import { Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import { usePathname } from 'next/navigation';
import { parseAsString, parseAsStringEnum, useQueryState } from 'nuqs';
import { BadgeCheck, ExternalLink, EyeOff, GraduationCap, MapPin, Pencil, Plus } from 'lucide-react';
import AppLink from '@/components/AppLink';
import BackHome from '@/components/BackHome';
import BoolToggle from '@/components/BoolToggle';
import { ClearButton } from '@/components/ClearButton';
import PersonLink from '@/components/PersonLink';
import SearchInput from '@/components/SearchInput';
import { nextQuery, useAuthUser, useIsAdmin, useOwnerKey } from '@/lib/auth-store';
import { tr } from '@/i18n/tr';
import {
  createTeacherDirectoryEntry,
  deleteTeacherDirectoryEntry,
  fetchMyTeacherDirectory,
  fetchTeacherDirectory,
  mergeTeacherDirectoryEntries,
  updateTeacherDirectoryEntry,
  type DirectoryContactKey,
  type DirectoryContacts,
  type DirectoryEntryKind,
  type DirectoryTeachingMode,
  type TeacherDirectoryDraft,
  type TeacherDirectoryEntry,
} from '@/lib/teacher-directory-api';
import './teachers.css';

const KINDS = ['all', 'teacher', 'organization'] as const;
const URL_CONTACT_KEYS = new Set<DirectoryContactKey>([
  'youtube', 'bilibili', 'douyin', 'kuaishou', 'xiaohongshu', 'facebook',
]);
const CONTACT_FIELDS: { key: DirectoryContactKey; label: { zh: string; en: string } }[] = [
  { key: 'wechat', label: { zh: '微信', en: 'WeChat' } },
  { key: 'qq', label: { zh: 'QQ', en: 'QQ' } },
  { key: 'email', label: { zh: '邮箱', en: 'Email' } },
  { key: 'phone', label: { zh: '手机号', en: 'Phone' } },
  { key: 'youtube', label: { zh: 'YouTube', en: 'YouTube' } },
  { key: 'bilibili', label: { zh: 'B站主页', en: 'Bilibili' } },
  { key: 'douyin', label: { zh: '抖音主页', en: 'Douyin' } },
  { key: 'kuaishou', label: { zh: '快手主页', en: 'Kuaishou' } },
  { key: 'xiaohongshu', label: { zh: '小红书主页', en: 'Xiaohongshu' } },
  { key: 'wechatChannels', label: { zh: '视频号', en: 'WeChat Channels' } },
  { key: 'facebook', label: { zh: 'Facebook', en: 'Facebook' } },
  { key: 'other', label: { zh: '其他联系方式', en: 'Other contact' } },
];

const EMPTY_DRAFT: TeacherDirectoryDraft = {
  kind: 'teacher', nameZh: '', nameEn: '', locationZh: '', locationEn: '',
  specialtiesZh: [], specialtiesEn: [], teachingMode: 'both',
  descriptionZh: '', descriptionEn: '', contacts: {}, website: '', wcaId: '',
  isCurated: false, isVisible: true,
};

function localText(zh: string, en: string): string {
  return tr({ zh: zh || en, en: en || zh });
}

function localTags(zh: string[], en: string[]): string[] {
  return tr({ zh: zh.length ? zh : en, en: en.length ? en : zh });
}

function entryToDraft(entry: TeacherDirectoryEntry): TeacherDirectoryDraft {
  return {
    kind: entry.kind, nameZh: entry.nameZh, nameEn: entry.nameEn,
    locationZh: entry.locationZh, locationEn: entry.locationEn,
    specialtiesZh: entry.specialtiesZh, specialtiesEn: entry.specialtiesEn,
    teachingMode: entry.teachingMode, descriptionZh: entry.descriptionZh,
    descriptionEn: entry.descriptionEn, contacts: { ...entry.contacts }, website: entry.website,
    wcaId: entry.wcaId, isCurated: entry.isCurated, isVisible: entry.isVisible,
  };
}

function splitTags(value: string): string[] {
  return value.split(/[,，\n]/).map((tag) => tag.trim()).filter(Boolean).slice(0, 8);
}

function websiteLabel(value: string): string {
  try { return new URL(value).hostname.replace(/^www\./, ''); } catch { return value; }
}

function contactHref(key: DirectoryContactKey, value: string): string | undefined {
  if (URL_CONTACT_KEYS.has(key)) return value;
  if (key === 'email') return `mailto:${value}`;
  if (key === 'phone') return `tel:${value.replace(/[^\d+*#]/g, '')}`;
  return undefined;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function modeLabel(mode: DirectoryTeachingMode): string {
  if (mode === 'online') return tr({ zh: '线上教学', en: 'Online' });
  if (mode === 'in_person') return tr({ zh: '线下教学', en: 'In person' });
  return tr({ zh: '线上及线下', en: 'Online and in person' });
}

function kindLabel(kind: DirectoryEntryKind): string {
  return kind === 'teacher'
    ? tr({ zh: '魔方老师', en: 'Teacher' })
    : tr({ zh: '培训机构', en: 'School' });
}

function DirectoryEntry({ entry, canEdit, onEdit }: {
  entry: TeacherDirectoryEntry; canEdit: boolean; onEdit: () => void;
}) {
  const name = localText(entry.nameZh, entry.nameEn);
  const alternateName = [entry.nameZh, entry.nameEn].find((candidate) => candidate && candidate !== name);
  const location = localText(entry.locationZh, entry.locationEn);
  const tags = localTags(entry.specialtiesZh, entry.specialtiesEn);
  const contacts = CONTACT_FIELDS.flatMap((field) => {
    const value = entry.contacts[field.key];
    return value ? [{ ...field, value, href: contactHref(field.key, value) }] : [];
  });
  return (
    <article className="directory-entry">
      <div className="directory-entry-heading">
        <div className="directory-entry-labels">
          <span>{kindLabel(entry.kind)}</span>
          {entry.isCurated && <span className="directory-curated"><BadgeCheck size={14} />{tr({ zh: '站方录入', en: 'Curated' })}</span>}
          {!entry.isVisible && <span className="directory-curated"><EyeOff size={14} />{tr({ zh: '仅自己可见', en: 'Only visible to you' })}</span>}
        </div>
        <h2>{name}</h2>
        {alternateName && <p className="directory-alt-name">{alternateName}</p>}
        {location && <p className="directory-location"><MapPin size={15} />{location}</p>}
        {canEdit && <button type="button" className="directory-edit-button" onClick={onEdit}><Pencil size={15} />{tr({ zh: '编辑', en: 'Edit' })}</button>}
      </div>
      <div className="directory-entry-body">
        <p className="directory-description">{localText(entry.descriptionZh, entry.descriptionEn)}</p>
        {tags.length > 0 && <div className="directory-tags" aria-label={tr({ zh: '擅长方向', en: 'Specialties' })}>{tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
        <div className="directory-facts">
          <span><GraduationCap size={16} />{modeLabel(entry.teachingMode)}</span>
          {entry.wcaId && <PersonLink wcaId={entry.wcaId} className="directory-link">WCA {entry.wcaId}</PersonLink>}
          {entry.website && <a className="directory-link" href={entry.website} target="_blank" rel="noreferrer">{websiteLabel(entry.website)}<ExternalLink size={14} /></a>}
        </div>
        {contacts.length > 0 && (
          <div className="directory-contacts">
            <strong>{tr({ zh: '联系方式', en: 'Contact' })}</strong>
            <div className="directory-contact-list">
              {contacts.map(({ key, label, value, href }) => href ? (
                <a key={key} className="directory-contact-item directory-link" href={href} target={URL_CONTACT_KEYS.has(key) ? '_blank' : undefined} rel={URL_CONTACT_KEYS.has(key) ? 'noreferrer' : undefined}>
                  <span className="directory-contact-label">{tr(label)}</span><span>{value}</span>{URL_CONTACT_KEYS.has(key) && <ExternalLink size={13} />}
                </a>
              ) : (
                <span key={key} className="directory-contact-item"><span className="directory-contact-label">{tr(label)}</span><span>{value}</span></span>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

function DirectoryEditor({ initial, isAdmin, onClose, onSaved, onDeleted }: {
  initial: TeacherDirectoryEntry | null; isAdmin: boolean; onClose: () => void;
  onSaved: (entry: TeacherDirectoryEntry) => void; onDeleted: (id: number) => void;
}) {
  const [draft, setDraft] = useState<TeacherDirectoryDraft>(() => initial ? entryToDraft(initial) : { ...EMPTY_DRAFT, isCurated: isAdmin });
  const [tagsZh, setTagsZh] = useState(draft.specialtiesZh.join(', '));
  const [tagsEn, setTagsEn] = useState(draft.specialtiesEn.join(', '));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose, saving]);

  const setField = <K extends keyof TeacherDirectoryDraft>(key: K, value: TeacherDirectoryDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const setContact = (key: DirectoryContactKey, value: string) => {
    setDraft((current) => ({
      ...current,
      contacts: { ...current.contacts, [key]: value },
    }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const contacts = Object.fromEntries(
      Object.entries(draft.contacts).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value),
    ) as DirectoryContacts;
    const payload = { ...draft, contacts, specialtiesZh: splitTags(tagsZh), specialtiesEn: splitTags(tagsEn) };
    if (!(payload.nameZh.trim() || payload.nameEn.trim())) return setError(tr({ zh: '请至少填写一个语言的名称。', en: 'Add a name in at least one language.' }));
    if (!(payload.descriptionZh.trim() || payload.descriptionEn.trim())) return setError(tr({ zh: '请至少填写一个语言的介绍。', en: 'Add a description in at least one language.' }));
    if (!(Object.keys(payload.contacts).length || payload.website.trim())) return setError(tr({ zh: '请至少填写一种公开联系方式或网站。', en: 'Add at least one public contact method or website.' }));
    if (payload.website && !isHttpUrl(payload.website)) return setError(tr({ zh: '网站地址需以 http:// 或 https:// 开头。', en: 'The website must begin with http:// or https://.' }));
    const invalidUrlContact = CONTACT_FIELDS.find(({ key }) => URL_CONTACT_KEYS.has(key) && payload.contacts[key] && !isHttpUrl(payload.contacts[key]));
    if (invalidUrlContact) return setError(tr({ zh: `${invalidUrlContact.label.zh}需填写以 http:// 或 https:// 开头的主页链接。`, en: `${invalidUrlContact.label.en} must be a profile URL beginning with http:// or https://.` }));
    if (payload.contacts.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.contacts.email)) return setError(tr({ zh: '邮箱格式不正确。', en: 'The email address is invalid.' }));
    if (payload.wcaId && !/^\d{4}[A-Z]{4}\d{2}$/.test(payload.wcaId.trim().toUpperCase())) return setError(tr({ zh: 'WCA ID 格式不正确。', en: 'The WCA ID format is invalid.' }));
    payload.wcaId = payload.wcaId.trim().toUpperCase();
    setSaving(true);
    try {
      const saved = initial ? await updateTeacherDirectoryEntry(initial.id, payload) : await createTeacherDirectoryEntry(payload);
      onSaved(saved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr({ zh: '保存失败。', en: 'Could not save.' }));
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!initial || !window.confirm(tr({ zh: '确定删除这条资料吗？', en: 'Delete this entry?' }))) return;
    setSaving(true); setError('');
    try { await deleteTeacherDirectoryEntry(initial.id); onDeleted(initial.id); }
    catch (cause) { setError(cause instanceof Error ? cause.message : tr({ zh: '删除失败。', en: 'Could not delete.' })); setSaving(false); }
  };

  return (
    <div className="directory-modal-backdrop">
      <section className="directory-modal" role="dialog" aria-modal="true" aria-labelledby="directory-editor-title">
        <div className="directory-modal-heading">
          <div>
            <p className="directory-kicker">{initial ? tr({ zh: '修改资料', en: 'Edit entry' }) : tr({ zh: '加入名录', en: 'Join the directory' })}</p>
            <h2 id="directory-editor-title">{initial ? localText(initial.nameZh, initial.nameEn) : tr({ zh: '老师或机构资料', en: 'Teacher or school profile' })}</h2>
          </div>
          <ClearButton variant="standalone" ariaLabel={tr({ zh: '关闭', en: 'Close' })} onClick={saving ? () => undefined : onClose} />
        </div>
        <form onSubmit={submit} className="directory-form">
          <label><span>{tr({ zh: '类型', en: 'Type' })}</span><select className="directory-field-control" value={draft.kind} onChange={(event) => setField('kind', event.target.value as DirectoryEntryKind)}><option value="teacher">{tr({ zh: '魔方老师', en: 'Teacher' })}</option><option value="organization">{tr({ zh: '培训机构', en: 'School' })}</option></select></label>
          <div className="directory-form-grid">
            <label><span>{tr({ zh: '中文名称', en: 'Chinese name' })}</span><input className="directory-field-control" value={draft.nameZh} onChange={(event) => setField('nameZh', event.target.value)} maxLength={120} /></label>
            <label><span>{tr({ zh: '英文名称', en: 'English name' })}</span><input className="directory-field-control" value={draft.nameEn} onChange={(event) => setField('nameEn', event.target.value)} maxLength={120} /></label>
            <label><span>{tr({ zh: '中文地点', en: 'Location in Chinese' })}</span><input className="directory-field-control" value={draft.locationZh} onChange={(event) => setField('locationZh', event.target.value)} maxLength={160} /></label>
            <label><span>{tr({ zh: '英文地点', en: 'Location in English' })}</span><input className="directory-field-control" value={draft.locationEn} onChange={(event) => setField('locationEn', event.target.value)} maxLength={160} /></label>
          </div>
          <label><span>{tr({ zh: '授课方式', en: 'Teaching mode' })}</span><select className="directory-field-control" value={draft.teachingMode} onChange={(event) => setField('teachingMode', event.target.value as DirectoryTeachingMode)}><option value="both">{tr({ zh: '线上及线下', en: 'Online and in person' })}</option><option value="online">{tr({ zh: '线上教学', en: 'Online' })}</option><option value="in_person">{tr({ zh: '线下教学', en: 'In person' })}</option></select></label>
          <div className="directory-form-grid">
            <label><span>{tr({ zh: '中文擅长方向', en: 'Specialties in Chinese' })}</span><input className="directory-field-control" value={tagsZh} onChange={(event) => setTagsZh(event.target.value)} placeholder={tr({ zh: '逗号分隔，最多 8 项', en: 'Comma-separated, up to 8' })} /></label>
            <label><span>{tr({ zh: '英文擅长方向', en: 'Specialties in English' })}</span><input className="directory-field-control" value={tagsEn} onChange={(event) => setTagsEn(event.target.value)} placeholder={tr({ zh: '逗号分隔，最多 8 项', en: 'Comma-separated, up to 8' })} /></label>
          </div>
          <div className="directory-form-grid">
            <label><span>{tr({ zh: '中文介绍', en: 'Chinese introduction' })}</span><textarea className="directory-field-control directory-textarea-control" value={draft.descriptionZh} onChange={(event) => setField('descriptionZh', event.target.value)} rows={7} maxLength={4000} /></label>
            <label><span>{tr({ zh: '英文介绍', en: 'English introduction' })}</span><textarea className="directory-field-control directory-textarea-control" value={draft.descriptionEn} onChange={(event) => setField('descriptionEn', event.target.value)} rows={7} maxLength={4000} /></label>
          </div>
          <fieldset className="directory-contact-fields">
            <legend>{tr({ zh: '公开联系方式', en: 'Public contact methods' })}</legend>
            <p>{tr({ zh: '按需填写，空着的项目不会公开显示。', en: 'Fill in only what you use. Empty fields will not be shown.' })}</p>
            <div className="directory-form-grid">
              {CONTACT_FIELDS.map((field) => (
                <label key={field.key}>
                  <span>{tr(field.label)}</span>
                  <input
                    className="directory-field-control"
                    type={field.key === 'email' ? 'email' : field.key === 'phone' ? 'tel' : 'text'}
                    value={draft.contacts[field.key] ?? ''}
                    onChange={(event) => setContact(field.key, event.target.value)}
                    maxLength={500}
                  />
                </label>
              ))}
            </div>
          </fieldset>
          <label><span>{tr({ zh: '个人网站或机构官网', en: 'Personal or organization website' })}</span><input className="directory-field-control" type="url" value={draft.website} onChange={(event) => setField('website', event.target.value)} placeholder="https://" maxLength={500} /></label>
          <label className="directory-wca-field"><span>WCA ID</span><input className="directory-field-control" value={draft.wcaId} onChange={(event) => setField('wcaId', event.target.value.toUpperCase())} placeholder="2017YANR02" maxLength={10} /></label>
          <BoolToggle value={draft.isVisible} onChange={(value) => setField('isVisible', value)} label={tr({ zh: '公开显示', en: 'Show publicly' })} />
          {!draft.isVisible && <p className="directory-form-note">{tr({ zh: '隐藏后，只有你登录时能看到这条资料。', en: 'When hidden, only you can see this entry while signed in.' })}</p>}
          <p className="directory-form-note">{tr({ zh: '名称和介绍至少填写一种语言。联系方式会公开显示，请勿填写不希望公开的信息。', en: 'A name and introduction are required in at least one language. Contact details are public, so only add information you want to share.' })}</p>
          {error && <p className="directory-form-error" role="alert">{error}</p>}
          <div className="directory-form-actions"><button type="submit" className="directory-primary-button" disabled={saving}>{saving ? tr({ zh: '保存中…', en: 'Saving…' }) : tr({ zh: '保存', en: 'Save' })}</button><button type="button" className="directory-secondary-button" onClick={onClose} disabled={saving}>{tr({ zh: '取消', en: 'Cancel' })}</button>{initial && <button type="button" className="directory-delete-button" onClick={remove} disabled={saving}>{tr({ zh: '删除', en: 'Delete' })}</button>}</div>
        </form>
      </section>
    </div>
  );
}

function TeachersDirectoryClient() {
  const pathname = usePathname();
  const user = useAuthUser();
  const ownerKey = useOwnerKey();
  const isAdmin = useIsAdmin();
  const [query, setQuery] = useQueryState('q', parseAsString.withDefault(''));
  const [kind, setKind] = useQueryState('type', parseAsStringEnum([...KINDS]).withDefault('all'));
  const [publicEntries, setPublicEntries] = useState<TeacherDirectoryEntry[]>([]);
  const [myEntries, setMyEntries] = useState<TeacherDirectoryEntry[]>([]);
  const [loadedOwnerKey, setLoadedOwnerKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [myLoadError, setMyLoadError] = useState('');
  const [editing, setEditing] = useState<TeacherDirectoryEntry | null | undefined>();

  useEffect(() => {
    let active = true;
    fetchTeacherDirectory().then((data) => { if (active) setPublicEntries(data); })
      .catch(() => { if (active) setLoadError(tr({ zh: '名录暂时无法加载。', en: 'The directory could not be loaded.' })); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ownerKey) {
      setMyEntries([]);
      setLoadedOwnerKey('');
      setMyLoadError('');
      return;
    }
    let active = true;
    setMyLoadError('');
    fetchMyTeacherDirectory()
      .then((data) => { if (active) setMyEntries(data); })
      .catch(() => { if (active) { setMyEntries([]); setMyLoadError(tr({ zh: '你的资料暂时无法加载。', en: 'Your entries could not be loaded.' })); } })
      .finally(() => { if (active) setLoadedOwnerKey(ownerKey); });
    return () => { active = false; };
  }, [ownerKey]);

  const ownedEntries = loadedOwnerKey === ownerKey ? myEntries : [];
  const entries = useMemo(
    () => mergeTeacherDirectoryEntries(publicEntries, ownedEntries),
    [ownedEntries, publicEntries],
  );
  const myIds = useMemo(() => new Set(ownedEntries.map((entry) => entry.id)), [ownedEntries]);
  const directoryLoading = loading || (!!ownerKey && loadedOwnerKey !== ownerKey);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return entries.filter((entry) => {
      if (kind !== 'all' && entry.kind !== kind) return false;
      if (!needle) return true;
      return [entry.nameZh, entry.nameEn, entry.locationZh, entry.locationEn, entry.descriptionZh, entry.descriptionEn, entry.wcaId, ...Object.values(entry.contacts), ...entry.specialtiesZh, ...entry.specialtiesEn].join('\n').toLocaleLowerCase().includes(needle);
    });
  }, [entries, kind, query]);

  const saveEntry = (saved: TeacherDirectoryEntry) => {
    setPublicEntries((current) => {
      const withoutSaved = current.filter((entry) => entry.id !== saved.id);
      return saved.isVisible ? [saved, ...withoutSaved] : withoutSaved;
    });
    if (saved.ownerKey === ownerKey) {
      setMyEntries((current) => current.some((entry) => entry.id === saved.id)
        ? current.map((entry) => entry.id === saved.id ? saved : entry)
        : [saved, ...current]);
    }
    setEditing(undefined);
  };
  const deleteEntry = (id: number) => {
    setPublicEntries((current) => current.filter((entry) => entry.id !== id));
    setMyEntries((current) => current.filter((entry) => entry.id !== id));
    setEditing(undefined);
  };

  return (
    <main className="teachers-page">
      <BackHome />
      <header className="teachers-hero">
        <p className="directory-kicker">{tr({ zh: '学习资源', en: 'Learn from people' })}</p>
        <h1>{tr({ zh: '魔方老师与机构', en: 'Cube Teachers & Schools' })}</h1>
        <p className="teachers-intro">{tr({ zh: '寻找适合自己的魔方老师、线上课程或本地培训机构，也可以把自己的教学服务加入名录。', en: 'Find a cube teacher, online lesson, or local training school—or add your own teaching service.' })}</p>
        <p className="teachers-trust">{tr({ zh: '资料由站方或用户提交。联系、付费或报名之前，请自行核实教学内容与身份。', en: 'Entries are submitted by CubeRoot or its users. Verify identity and course details before contacting, paying, or enrolling.' })}</p>
        {user ? <button type="button" className="directory-primary-button teachers-add-button" onClick={() => setEditing(null)}><Plus size={17} />{tr({ zh: '添加资料', en: 'Add an entry' })}</button> : <AppLink href={`/account${nextQuery(pathname)}`} prefetch={false} className="directory-primary-button teachers-add-button"><Plus size={17} />{tr({ zh: '登录后添加', en: 'Sign in to add' })}</AppLink>}
      </header>
      <div className="directory-toolbar">
        <SearchInput value={query} onChange={(value) => { void setQuery(value || null); }} className="directory-search" inputClassName="directory-search-input" placeholder={tr({ zh: '搜索姓名、地点或擅长方向', en: 'Search names, places, or specialties' })} />
        <label className="directory-kind-filter"><span>{tr({ zh: '类型', en: 'Type' })}</span><select className="directory-kind-control" value={kind} onChange={(event) => { void setKind(event.target.value as typeof kind); }}><option value="all">{tr({ zh: '全部', en: 'All' })}</option><option value="teacher">{tr({ zh: '魔方老师', en: 'Teachers' })}</option><option value="organization">{tr({ zh: '培训机构', en: 'Schools' })}</option></select></label>
      </div>
      <section className="directory-list" aria-label={tr({ zh: '老师与机构名录', en: 'Teacher and school directory' })}>
        {directoryLoading && <p className="directory-state">{tr({ zh: '正在加载名录…', en: 'Loading the directory…' })}</p>}
        {!directoryLoading && loadError && <p className="directory-state directory-load-error">{loadError}</p>}
        {!directoryLoading && !loadError && myLoadError && <p className="directory-state directory-load-error">{myLoadError}</p>}
        {!directoryLoading && !loadError && filtered.length === 0 && <p className="directory-state">{tr({ zh: '没有找到符合条件的资料。', en: 'No matching entries.' })}</p>}
        {filtered.map((entry) => <DirectoryEntry key={entry.id} entry={entry} canEdit={isAdmin || myIds.has(entry.id)} onEdit={() => setEditing(entry)} />)}
      </section>
      {editing !== undefined && <DirectoryEditor initial={editing} isAdmin={isAdmin} onClose={() => setEditing(undefined)} onSaved={saveEntry} onDeleted={deleteEntry} />}
    </main>
  );
}

export default function TeachersPage() {
  return <Suspense><TeachersDirectoryClient /></Suspense>;
}
