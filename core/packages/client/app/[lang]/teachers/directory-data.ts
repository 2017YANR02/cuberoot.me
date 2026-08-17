import { tr } from '@/i18n/tr';
import type {
  DirectoryContactKey,
  DirectoryEntryKind,
  DirectoryTeachingMode,
  TeacherDirectoryDraft,
  TeacherDirectoryEntry,
} from '@/lib/teacher-directory-api';

export const DIRECTORY_KINDS = ['all', 'teacher', 'organization'] as const;
export const URL_CONTACT_KEYS = new Set<DirectoryContactKey>([
  'youtube', 'bilibili', 'douyin', 'kuaishou', 'xiaohongshu', 'facebook',
]);
export const CONTACT_FIELDS: { key: DirectoryContactKey; label: { zh: string; en: string } }[] = [
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

export const EMPTY_DIRECTORY_DRAFT: TeacherDirectoryDraft = {
  kind: 'teacher', nameZh: '', nameEn: '', locationZh: '', locationEn: '',
  specialtiesZh: [], specialtiesEn: [], teachingMode: 'both',
  descriptionZh: '', descriptionEn: '', contacts: {}, website: '', wcaId: '',
  isCurated: false, isVisible: true, images: [],
};

export function localDirectoryText(zh: string, en: string): string {
  return tr({ zh: zh || en, en: en || zh });
}

export function localDirectoryTags(zh: string[], en: string[]): string[] {
  return tr({ zh: zh.length ? zh : en, en: en.length ? en : zh });
}

export function directoryEntryToDraft(entry: TeacherDirectoryEntry): TeacherDirectoryDraft {
  return {
    kind: entry.kind, nameZh: entry.nameZh, nameEn: entry.nameEn,
    locationZh: entry.locationZh, locationEn: entry.locationEn,
    specialtiesZh: entry.specialtiesZh, specialtiesEn: entry.specialtiesEn,
    teachingMode: entry.teachingMode, descriptionZh: entry.descriptionZh,
    descriptionEn: entry.descriptionEn, contacts: { ...entry.contacts }, website: entry.website,
    wcaId: entry.wcaId, isCurated: entry.isCurated, isVisible: entry.isVisible,
    images: entry.images.map((image) => ({ ...image })),
  };
}

export function splitDirectoryTags(value: string): string[] {
  return value.split(/[,，\n]/).map((tag) => tag.trim()).filter(Boolean).slice(0, 8);
}

export function directoryWebsiteLabel(value: string): string {
  try { return new URL(value).hostname.replace(/^www\./, ''); } catch { return value; }
}

export function directoryContactHref(key: DirectoryContactKey, value: string): string | undefined {
  if (URL_CONTACT_KEYS.has(key)) return value;
  if (key === 'email') return `mailto:${value}`;
  if (key === 'phone') return `tel:${value.replace(/[^\d+*#]/g, '')}`;
  return undefined;
}

export function isDirectoryHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function directoryModeLabel(mode: DirectoryTeachingMode): string {
  if (mode === 'online') return tr({ zh: '线上教学', en: 'Online' });
  if (mode === 'in_person') return tr({ zh: '线下教学', en: 'In person' });
  return tr({ zh: '线上及线下', en: 'Online and in person' });
}

export function directoryKindLabel(kind: DirectoryEntryKind): string {
  return kind === 'teacher' ? tr({ zh: '魔方老师', en: 'Teacher' }) : tr({ zh: '培训机构', en: 'School' });
}
