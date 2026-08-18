'use client';

import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ChevronDown, ChevronUp, ImagePlus, Trash2 } from 'lucide-react';
import AppLink from '@/components/AppLink';
import BoolToggle from '@/components/BoolToggle';
import { tr } from '@/i18n/tr';
import { prepareImageUpload, uploadImageBlob } from '@/lib/image-upload';
import {
  createTeacherDirectoryEntry,
  deleteTeacherDirectoryEntry,
  updateTeacherDirectoryEntry,
  type DirectoryContactKey,
  type DirectoryContacts,
  type DirectoryEntryKind,
  type DirectoryImage,
  type DirectoryImageKind,
  type DirectoryTeachingMode,
  type TeacherDirectoryDraft,
  type TeacherDirectoryEntry,
} from '@/lib/teacher-directory-api';
import {
  CONTACT_FIELDS,
  EMPTY_DIRECTORY_DRAFT,
  URL_CONTACT_KEYS,
  directoryEntryToDraft,
  directoryKindLabel,
  directoryModeLabel,
  isDirectoryHttpUrl,
  localDirectoryTags,
  localDirectoryText,
  splitDirectoryTags,
} from './directory-data';

const MAX_IMAGES = 8;
const IMAGE_KINDS: { value: DirectoryImageKind; label: { zh: string; en: string } }[] = [
  { value: 'portrait', label: { zh: '个人形象', en: 'Portrait' } },
  { value: 'organization', label: { zh: '机构环境', en: 'Organization' } },
  { value: 'teaching', label: { zh: '教学现场', en: 'Teaching' } },
  { value: 'other', label: { zh: '其他', en: 'Other' } },
];

function imageKindLabel(kind: DirectoryImageKind): string {
  return tr(IMAGE_KINDS.find((item) => item.value === kind)?.label ?? IMAGE_KINDS[3].label);
}

export default function TeacherDirectoryEditor({
  initial,
  isAdmin,
  onSaved,
  onDeleted,
}: {
  initial: TeacherDirectoryEntry | null;
  isAdmin: boolean;
  onSaved: (entry: TeacherDirectoryEntry) => void;
  onDeleted: () => void;
}) {
  const [draft, setDraft] = useState<TeacherDirectoryDraft>(() => initial
    ? directoryEntryToDraft(initial)
    : { ...EMPTY_DIRECTORY_DRAFT, contacts: {}, images: [], isCurated: isAdmin });
  const [tagsZh, setTagsZh] = useState(draft.specialtiesZh.join(', '));
  const [tagsEn, setTagsEn] = useState(draft.specialtiesEn.join(', '));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const uploadInput = useRef<HTMLInputElement>(null);

  const setField = <K extends keyof TeacherDirectoryDraft>(key: K, value: TeacherDirectoryDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };
  const setContact = (key: DirectoryContactKey, value: string) => {
    setDraft((current) => ({ ...current, contacts: { ...current.contacts, [key]: value } }));
  };
  const updateImage = (index: number, patch: Partial<DirectoryImage>) => {
    setDraft((current) => ({
      ...current,
      images: current.images.map((image, imageIndex) => imageIndex === index ? { ...image, ...patch } : image),
    }));
  };
  const moveImage = (index: number, delta: -1 | 1) => {
    setDraft((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.images.length) return current;
      const images = [...current.images];
      [images[index], images[target]] = [images[target], images[index]];
      return { ...current, images };
    });
  };

  const addImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    const slots = MAX_IMAGES - draft.images.length;
    if (files.length === 0) return;
    if (slots <= 0) return setError(tr({ zh: '最多上传 8 张照片。', en: 'You can upload up to 8 photos.' }));
    setUploading(true);
    setError('');
    try {
      const uploaded: DirectoryImage[] = [];
      for (const file of files.slice(0, slots)) {
        const prepared = await prepareImageUpload(file, 2000);
        const image = await uploadImageBlob(prepared.dataB64, prepared.mime);
        uploaded.push({
          id: image.id,
          url: image.url,
          kind: draft.images.length === 0 && uploaded.length === 0 ? 'portrait' : 'teaching',
          captionZh: '',
          captionEn: '',
        });
      }
      setDraft((current) => ({ ...current, images: [...current.images, ...uploaded].slice(0, MAX_IMAGES) }));
      if (files.length > slots) setError(tr({ zh: '只上传了剩余可用的照片，资料最多保存 8 张。', en: 'Only the remaining photo slots were uploaded; a profile can keep 8 photos.' }));
    } catch (cause) {
      setError(cause instanceof Error && cause.message === 'unsupported_image_type'
        ? tr({ zh: '仅支持 PNG、JPEG 和 WebP 图片。', en: 'Only PNG, JPEG, and WebP images are supported.' })
        : tr({ zh: '照片上传失败，请稍后重试。', en: 'The photo upload failed. Try again.' }));
    } finally {
      setUploading(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const contacts = Object.fromEntries(
      Object.entries(draft.contacts).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value),
    ) as DirectoryContacts;
    const payload = { ...draft, contacts, specialtiesZh: splitDirectoryTags(tagsZh), specialtiesEn: splitDirectoryTags(tagsEn) };
    if (!(payload.nameZh.trim() || payload.nameEn.trim())) return setError(tr({ zh: '请至少填写一个语言的名称。', en: 'Add a name in at least one language.' }));
    if (!(payload.descriptionZh.trim() || payload.descriptionEn.trim())) return setError(tr({ zh: '请至少填写一个语言的介绍。', en: 'Add a description in at least one language.' }));
    if (!(Object.keys(payload.contacts).length || payload.website.trim())) return setError(tr({ zh: '请至少填写一种公开联系方式或网站。', en: 'Add at least one public contact method or website.' }));
    if (payload.website && !isDirectoryHttpUrl(payload.website)) return setError(tr({ zh: '网站地址需以 http:// 或 https:// 开头。', en: 'The website must begin with http:// or https://.' }));
    const invalidUrlContact = CONTACT_FIELDS.find(({ key }) => URL_CONTACT_KEYS.has(key) && payload.contacts[key] && !isDirectoryHttpUrl(payload.contacts[key]));
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
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!initial || !window.confirm(tr({ zh: '确定删除这条资料吗？', en: 'Delete this entry?' }))) return;
    setSaving(true);
    setError('');
    try {
      await deleteTeacherDirectoryEntry(initial.id);
      onDeleted();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr({ zh: '删除失败。', en: 'Could not delete.' }));
      setSaving(false);
    }
  };

  const previewName = localDirectoryText(draft.nameZh, draft.nameEn) || tr({ zh: '你的名称', en: 'Your name' });
  const previewDescription = localDirectoryText(draft.descriptionZh, draft.descriptionEn) || tr({ zh: '简介会在这里形成一份清晰的教学履历。', en: 'Your introduction will become a concise teaching profile here.' });
  const previewTags = localDirectoryTags(splitDirectoryTags(tagsZh), splitDirectoryTags(tagsEn));
  const cover = draft.images.find((image) => image.kind === 'portrait') ?? draft.images[0];

  return (
    <div className="directory-editor-layout">
      <aside className="directory-profile-preview" aria-label={tr({ zh: '资料预览', en: 'Profile preview' })}>
        <p className="directory-kicker">{tr({ zh: '资料预览', en: 'Profile preview' })}</p>
        {cover ? <img src={cover.url} alt="" className="directory-preview-photo" /> : <div className="directory-preview-placeholder"><ImagePlus aria-hidden="true" /><span>{tr({ zh: '先上传一张形象照', en: 'Add a portrait first' })}</span></div>}
        <p className="directory-preview-kind">{directoryKindLabel(draft.kind)}　{directoryModeLabel(draft.teachingMode)}</p>
        <h2>{previewName}</h2>
        {(draft.locationZh || draft.locationEn) && <p className="directory-preview-location">{localDirectoryText(draft.locationZh, draft.locationEn)}</p>}
        <p className="directory-preview-description">{previewDescription}</p>
        {previewTags.length > 0 && <div className="directory-tags">{previewTags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
      </aside>

      <form onSubmit={submit} className="directory-form">
        <section className="directory-form-section" aria-labelledby="directory-identity-heading">
          <div className="directory-section-heading"><span>01</span><div><h2 id="directory-identity-heading">{tr({ zh: '身份与地点', en: 'Identity and location' })}</h2><p>{tr({ zh: '先说明你是谁，以及主要面向哪里的学员。', en: 'Start with who you are and where your students are based.' })}</p></div></div>
          <label><span>{tr({ zh: '类型', en: 'Type' })}</span><select className="directory-field-control" value={draft.kind} onChange={(event) => setField('kind', event.target.value as DirectoryEntryKind)}><option value="teacher">{tr({ zh: '魔方老师', en: 'Teacher' })}</option><option value="organization">{tr({ zh: '培训机构', en: 'School' })}</option></select></label>
          <div className="directory-form-grid">
            <label><span>{tr({ zh: '中文名称', en: 'Chinese name' })}</span><input className="directory-field-control" value={draft.nameZh} onChange={(event) => setField('nameZh', event.target.value)} maxLength={160} /></label>
            <label><span>{tr({ zh: '英文名称', en: 'English name' })}</span><input className="directory-field-control" value={draft.nameEn} onChange={(event) => setField('nameEn', event.target.value)} maxLength={160} /></label>
            <label><span>{tr({ zh: '中文地点', en: 'Location in Chinese' })}</span><input className="directory-field-control" value={draft.locationZh} onChange={(event) => setField('locationZh', event.target.value)} maxLength={160} /></label>
            <label><span>{tr({ zh: '英文地点', en: 'Location in English' })}</span><input className="directory-field-control" value={draft.locationEn} onChange={(event) => setField('locationEn', event.target.value)} maxLength={160} /></label>
          </div>
        </section>

        <section className="directory-form-section" aria-labelledby="directory-resume-heading">
          <div className="directory-section-heading"><span>02</span><div><h2 id="directory-resume-heading">{tr({ zh: '教学履历', en: 'Teaching profile' })}</h2><p>{tr({ zh: '写清擅长方向、授课方式、经历和教学特点。', en: 'Describe your specialties, format, experience, and teaching style.' })}</p></div></div>
          <label><span>{tr({ zh: '授课方式', en: 'Teaching mode' })}</span><select className="directory-field-control" value={draft.teachingMode} onChange={(event) => setField('teachingMode', event.target.value as DirectoryTeachingMode)}><option value="both">{tr({ zh: '线上及线下', en: 'Online and in person' })}</option><option value="online">{tr({ zh: '线上教学', en: 'Online' })}</option><option value="in_person">{tr({ zh: '线下教学', en: 'In person' })}</option></select></label>
          <div className="directory-form-grid">
            <label><span>{tr({ zh: '中文擅长方向', en: 'Specialties in Chinese' })}</span><input className="directory-field-control" value={tagsZh} onChange={(event) => setTagsZh(event.target.value)} placeholder={tr({ zh: '逗号分隔，最多 8 项', en: 'Comma-separated, up to 8' })} /></label>
            <label><span>{tr({ zh: '英文擅长方向', en: 'Specialties in English' })}</span><input className="directory-field-control" value={tagsEn} onChange={(event) => setTagsEn(event.target.value)} placeholder={tr({ zh: '逗号分隔，最多 8 项', en: 'Comma-separated, up to 8' })} /></label>
          </div>
          <div className="directory-form-grid">
            <label><span>{tr({ zh: '中文介绍', en: 'Chinese introduction' })}</span><textarea className="directory-field-control directory-textarea-control" value={draft.descriptionZh} onChange={(event) => setField('descriptionZh', event.target.value)} rows={9} maxLength={2000} placeholder={tr({ zh: '可写教学经历、适合人群、课程方式和代表成绩。', en: 'Include teaching experience, ideal students, lesson format, and relevant achievements.' })} /></label>
            <label><span>{tr({ zh: '英文介绍', en: 'English introduction' })}</span><textarea className="directory-field-control directory-textarea-control" value={draft.descriptionEn} onChange={(event) => setField('descriptionEn', event.target.value)} rows={9} maxLength={2000} /></label>
          </div>
        </section>

        <section className="directory-form-section" aria-labelledby="directory-photos-heading">
          <div className="directory-section-heading"><span>03</span><div><h2 id="directory-photos-heading">{tr({ zh: '照片', en: 'Photos' })}</h2><p>{tr({ zh: '最多 8 张。第一张个人形象照优先作为封面，也可补充机构环境和教学现场。', en: 'Add up to 8. The first portrait is used as the cover, followed by organization and teaching photos.' })}</p></div></div>
          <input ref={uploadInput} className="directory-file-input" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={addImages} />
          <button type="button" className="directory-upload-button" onClick={() => uploadInput.current?.click()} disabled={uploading || draft.images.length >= MAX_IMAGES}><ImagePlus size={18} />{uploading ? tr({ zh: '正在上传…', en: 'Uploading…' }) : tr({ zh: '选择照片', en: 'Choose photos' })}<span>{draft.images.length}/{MAX_IMAGES}</span></button>
          {draft.images.length > 0 && <div className="directory-photo-editor-list">
            {draft.images.map((image, index) => <div className="directory-photo-editor" key={image.id}>
              <img src={image.url} alt="" />
              <div className="directory-photo-fields">
                <label><span>{tr({ zh: '照片类型', en: 'Photo type' })}</span><select className="directory-field-control" value={image.kind} onChange={(event) => updateImage(index, { kind: event.target.value as DirectoryImageKind })}>{IMAGE_KINDS.map((option) => <option value={option.value} key={option.value}>{tr(option.label)}</option>)}</select></label>
                <label><span>{tr({ zh: '中文说明', en: 'Chinese caption' })}</span><input className="directory-field-control" value={image.captionZh} maxLength={160} onChange={(event) => updateImage(index, { captionZh: event.target.value })} placeholder={imageKindLabel(image.kind)} /></label>
                <label><span>{tr({ zh: '英文说明', en: 'English caption' })}</span><input className="directory-field-control" value={image.captionEn} maxLength={160} onChange={(event) => updateImage(index, { captionEn: event.target.value })} /></label>
              </div>
              <div className="directory-photo-actions">
                <button type="button" className="directory-photo-action-button" onClick={() => moveImage(index, -1)} disabled={index === 0} aria-label={tr({ zh: '照片前移', en: 'Move photo earlier' })}><ChevronUp size={17} /></button>
                <button type="button" className="directory-photo-action-button" onClick={() => moveImage(index, 1)} disabled={index === draft.images.length - 1} aria-label={tr({ zh: '照片后移', en: 'Move photo later' })}><ChevronDown size={17} /></button>
                <button type="button" className="directory-photo-action-button directory-photo-remove-button" onClick={() => setField('images', draft.images.filter((_, imageIndex) => imageIndex !== index))} aria-label={tr({ zh: '移除照片', en: 'Remove photo' })}><Trash2 size={17} /></button>
              </div>
            </div>)}
          </div>}
        </section>

        <section className="directory-form-section" aria-labelledby="directory-contact-heading">
          <div className="directory-section-heading"><span>04</span><div><h2 id="directory-contact-heading">{tr({ zh: '联系与公开', en: 'Contact and visibility' })}</h2><p>{tr({ zh: '只填写愿意公开的信息，空项目不会显示。', en: 'Only add information you want to publish. Empty fields stay hidden.' })}</p></div></div>
          <fieldset className="directory-contact-fields"><legend>{tr({ zh: '公开联系方式', en: 'Public contact methods' })}</legend><div className="directory-form-grid">{CONTACT_FIELDS.map((field) => <label key={field.key}><span>{tr(field.label)}</span><input className="directory-field-control" type={field.key === 'email' ? 'email' : field.key === 'phone' ? 'tel' : 'text'} value={draft.contacts[field.key] ?? ''} onChange={(event) => setContact(field.key, event.target.value)} maxLength={500} /></label>)}</div></fieldset>
          <label><span>{tr({ zh: '个人网站或机构官网', en: 'Personal or organization website' })}</span><input className="directory-field-control" type="url" value={draft.website} onChange={(event) => setField('website', event.target.value)} placeholder="https://" maxLength={2000} /></label>
          <label className="directory-wca-field"><span>WCA ID</span><input className="directory-field-control" value={draft.wcaId} onChange={(event) => setField('wcaId', event.target.value.toUpperCase())} placeholder="2017YANR02" maxLength={10} /></label>
          <BoolToggle value={draft.isVisible} onChange={(value) => setField('isVisible', value)} label={tr({ zh: '公开显示', en: 'Show publicly' })} />
          {!draft.isVisible && <p className="directory-form-note">{tr({ zh: '隐藏后，只有你登录时能看到这条资料。', en: 'When hidden, only you can see this entry while signed in.' })}</p>}
        </section>

        {error && <p className="directory-form-error" role="alert">{error}</p>}
        <div className="directory-form-actions"><button type="submit" className="directory-primary-button" disabled={saving || uploading}>{saving ? tr({ zh: '保存中…', en: 'Saving…' }) : tr({ zh: '保存资料', en: 'Save profile' })}</button><AppLink href="/teachers" className="directory-secondary-button">{tr({ zh: '取消', en: 'Cancel' })}</AppLink>{initial && <button type="button" className="directory-delete-button" onClick={remove} disabled={saving}>{tr({ zh: '删除资料', en: 'Delete profile' })}</button>}</div>
      </form>
    </div>
  );
}
