'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, Film } from '@app-foundation/icons/lucide';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { useAuthUser } from '@/lib/auth-store';
import { useEntryRouter } from '@/hooks/useEntryRouter';
import { readEntryNavigationBack } from '@/lib/entry-navigation';
import { isInstructorCourseListEntry } from '@/lib/platform-navigation';
import { persistItem } from '@/lib/safe-storage';
import { cancelDriveUpload, courseLessonUploadTransport, createDriveUpload, uploadDriveChunk } from '@/lib/drive-api';
import type { CommonProps } from './PlatformActionTypes';

const MAX_BYTES = 1024 ** 3;
const VIDEO_TYPES: Record<string, string> = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' };
type VideoDraft = { name: string; size: number; lastModified: number; mime: string; storedName: string; offset: number; uploadId?: string; nodeId?: string };
type Draft = { slug: string; titleZh: string; titleEn: string; bodyZh: string; bodyEn: string; mode: 'video' | 'text'; video?: VideoDraft; durationSeconds?: number };

function readDraft(key: string): Draft {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null') as Draft | null;
    if (value?.slug && typeof value.titleZh === 'string' && typeof value.titleEn === 'string') return value;
  } catch { /* Storage may be unavailable. */ }
  return { slug: `lesson-${crypto.randomUUID()}`, titleZh: '', titleEn: '', bodyZh: '', bodyEn: '', mode: 'video' };
}

function sameFile(video: VideoDraft | undefined, file: File) {
  return video?.name === file.name && video.size === file.size && video.lastModified === file.lastModified;
}

function LessonCreator({ courseId, draftKey, nextOrdinal, ...props }: CommonProps & { courseId: string; draftKey: string; nextOrdinal: number }) {
  const { entity, busy, runAction } = props;
  const t = useT();
  const lang = useLang();
  const router = useEntryRouter();
  const [draft, setDraft] = useState(() => readDraft(draftKey));
  const latest = useRef(draft);
  const [saved, setSaved] = useState(true);
  const [draftMessage, setDraftMessage] = useState('');
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(draft.video?.offset ?? 0);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const submitting = useRef(false);
  const alive = useRef(true);
  const transport = courseLessonUploadTransport(courseId);

  function update(patch: Partial<Draft>) {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setDraft(next);
    setDraftMessage('');
    setSaved(persistItem(draftKey, JSON.stringify(next)));
  }

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; controller.current?.abort(); };
  }, []);
  useEffect(() => {
    if (!file || typeof URL.createObjectURL !== 'function') { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function upload(selected: File, selectedVideo: VideoDraft) {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setUploading(true);
    setError('');
    let video = selectedVideo;
    const active = () => alive.current && controller.current === current && !current.signal.aborted;
    try {
      const session = await createDriveUpload(new File([selected], video.storedName, { type: video.mime, lastModified: video.lastModified }), null, current.signal, transport);
      if (!active()) return;
      video = { ...video, uploadId: session.id, offset: session.receivedBytes };
      if (session.receivedBytes === selected.size) video.nodeId = session.nodeId;
      update({ video });
      setProgress(video.offset);
      while (video.offset < selected.size) {
        const start = video.offset;
        const result = await uploadDriveChunk(session.id, start, selected.slice(start, start + session.chunkBytes), current.signal, bytes => {
          if (active()) setProgress(start + bytes);
        }, transport);
        if (!active()) return;
        if (result.offset <= start || result.offset > selected.size || (result.complete && !result.nodeId)) throw new Error(t('上传进度异常，请重试。', 'Invalid upload progress. Please retry.'));
        video = { ...video, offset: result.offset, nodeId: result.complete ? result.nodeId : undefined };
        update({ video });
        setProgress(video.offset);
      }
      if (!video.nodeId) throw new Error(t('未收到文件确认，请重试。', 'File confirmation was not received. Please retry.'));
    } catch (reason) {
      if (active()) { setError(reason instanceof Error ? reason.message : String(reason)); setProgress(latest.current.video?.offset ?? 0); }
    } finally {
      if (alive.current && controller.current === current) { controller.current = null; setUploading(false); }
    }
  }

  function pause() {
    controller.current?.abort();
    controller.current = null;
    setUploading(false);
    setProgress(latest.current.video?.offset ?? 0);
  }

  function choose(selected?: File) {
    if (!selected || submitting.current) return;
    const mime = VIDEO_TYPES[selected.name.split('.').pop()?.toLowerCase() ?? ''];
    if (!mime || selected.size < 1 || selected.size > MAX_BYTES) { setError(t('请选择不超过 1 GB 的 MP4、WebM 或 MOV 视频。', 'Choose an MP4, WebM or MOV video up to 1 GB.')); return; }
    const old = latest.current.video;
    const matches = sameFile(old, selected);
    if (!matches) {
      pause();
      if (old?.uploadId && !old.nodeId) void cancelDriveUpload(old.uploadId, transport).catch(() => {});
    }
    const video = matches && old ? old : { name: selected.name, size: selected.size, lastModified: selected.lastModified, mime, storedName: `${crypto.randomUUID()}-${selected.name.replace(/[\\/]/g, '_').slice(-120)}`, offset: 0 };
    setFile(selected);
    setError('');
    setProgress(video.offset);
    update({ video, mode: 'video', durationSeconds: matches ? latest.current.durationSeconds : undefined });
    if (!video.nodeId) void upload(selected, video);
  }

  async function save(status: 'draft' | 'published') {
    const persisted = persistItem(draftKey, JSON.stringify(latest.current));
    setSaved(persisted);
    const value = latest.current;
    if (status === 'draft' && ((!value.titleZh.trim() && !value.titleEn.trim()) || (value.mode === 'video' && !value.video?.nodeId))) {
      if (persisted) setDraftMessage(t('已保存到此设备，稍后可继续编辑。', 'Saved on this device. You can resume later.'));
      else setError(t('当前设备无法保存本地草稿。', 'Local draft storage is unavailable.'));
      return;
    }
    if (!value.titleZh.trim() && !value.titleEn.trim()) { setError(t('请填写至少一种语言的标题。', 'Enter a title in at least one language.')); return; }
    if (value.mode === 'video' && !value.video?.nodeId) { setError(t('请先完成视频上传。', 'Complete the video upload first.')); return; }
    if (submitting.current) return;
    submitting.current = true;
    setError('');
    try {
      const result = await runAction('save-course-lesson', courseId, {
        slug: value.slug, ordinal: nextOrdinal, appendToCourse: true, titleZh: value.titleZh.trim() || value.titleEn.trim(), titleEn: value.titleEn.trim() || value.titleZh.trim(),
        bodyZh: { markdown: value.bodyZh }, bodyEn: { markdown: value.bodyEn },
        driveVideo: value.mode === 'video' ? value.video?.nodeId : undefined,
        durationSeconds: value.mode === 'video' ? value.durationSeconds : undefined,
        status,
      });
      if (result && alive.current) {
        try { localStorage.removeItem(draftKey); } catch { /* Storage may be unavailable. */ }
        const entry = readEntryNavigationBack();
        const target = entry && isInstructorCourseListEntry(entry) ? entry.replace(/^\/(en|zh)(?=\/|$)/, '') : '/platform/instructor/courses';
        router.replace(`${lang === 'zh' ? '/zh' : ''}${target}`);
      }
    } finally { submitting.current = false; }
  }

  const video = draft.video;
  const percent = video ? Math.min(100, Math.floor(progress * 100 / video.size)) : 0;
  const saving = busy === `save-course-lesson:${courseId}`;
  return <section className="platform-lesson-create">
    <div className="platform-lesson-create-heading">
      <div><h1>{t('新增课时', 'Add lesson')}</h1><p>{entity?.title}</p></div>
      <span className="platform-lesson-draft-status" role="status">{draftMessage || (saved ? t('草稿自动保存在此设备', 'Draft autosaved on this device') : t('无法保存本地草稿', 'Local draft unavailable'))}</span>
    </div>
    <div className="platform-lesson-create-modes" aria-label={t('课时类型', 'Lesson type')}>
      <button type="button" className={`platform-button${draft.mode === 'video' ? ' platform-button-primary' : ''}`} aria-pressed={draft.mode === 'video'} disabled={saving} onClick={() => update({ mode: 'video' })}>{t('视频课时', 'Video lesson')}</button>
      <button type="button" className={`platform-button${draft.mode === 'text' ? ' platform-button-primary' : ''}`} aria-pressed={draft.mode === 'text'} disabled={saving} onClick={() => { pause(); update({ mode: 'text' }); }}>{t('图文课时', 'Text lesson')}</button>
    </div>
    {draft.mode === 'video' && <section className="platform-lesson-upload">
      <input ref={picker} type="file" accept=".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime" hidden disabled={saving} onChange={event => { choose(event.currentTarget.files?.[0]); event.currentTarget.value = ''; }} />
      {!video ? <div className="platform-lesson-dropzone" data-dragging={dragging}
        onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); if (!saving) choose(event.dataTransfer.files[0]); }}>
        <Upload aria-hidden />
        <strong>{t('拖放视频到这里', 'Drag and drop your video here')}</strong>
        <p>{t('视频将上传到课程私有网盘，可在上传时填写标题。', 'Your video is uploaded to private course storage. Enter its title while it uploads.')}</p>
        <button type="button" className="platform-button platform-button-primary" onClick={() => picker.current?.click()}>{t('选择视频', 'Select video')}</button>
        <small>{t('MP4、WebM、MOV · 最大 1 GB', 'MP4, WebM, MOV · Up to 1 GB')}</small>
      </div> : <div className="platform-lesson-upload-selected">
        {preview ? <video controls preload="metadata" src={preview} onLoadedMetadata={event => { const duration = event.currentTarget.duration; if (Number.isFinite(duration) && duration <= 86400) update({ durationSeconds: Math.round(duration) }); }} /> : <div className="platform-lesson-upload-placeholder"><Film aria-hidden /></div>}
        <div className="platform-lesson-upload-detail">
          <strong>{video.name}</strong><small>{(video.size / 1024 ** 2).toFixed(1)} MB · {video.nodeId ? t('上传完成', 'Upload complete') : uploading ? t('正在上传至网盘', 'Uploading to Drive') : t('已暂停，可断点续传', 'Paused · resumable')}</small>
          <div className="platform-lesson-upload-progress"><progress max={100} value={percent} aria-label={t('视频上传进度', 'Video upload progress')} /><span>{percent}%</span></div>
          <div className="platform-lesson-upload-actions">
            {uploading ? <button className="platform-button" type="button" onClick={pause}>{t('暂停', 'Pause')}</button> : !video.nodeId && <button className="platform-button platform-button-primary" type="button" disabled={saving} onClick={() => file && sameFile(video, file) ? void upload(file, video) : picker.current?.click()}>{t('继续上传', 'Resume upload')}</button>}
            <button type="button" className="platform-button" disabled={saving || uploading} onClick={() => picker.current?.click()}>{t('重新选择视频', 'Choose another video')}</button>
          </div>
        </div>
      </div>}
    </section>}
    <section className="platform-lesson-create-details">
      <h2>{t('课时标题', 'Lesson title')}</h2>
      <div className="platform-form-grid">
        <label><span>{t('中文标题', 'Chinese title')}</span><input autoComplete="off" className="platform-field-control" value={draft.titleZh} disabled={saving} maxLength={240} onChange={event => update({ titleZh: event.target.value })} /></label>
        <label><span>{t('英文标题', 'English title')}</span><input autoComplete="off" className="platform-field-control" value={draft.titleEn} disabled={saving} maxLength={240} onChange={event => update({ titleEn: event.target.value })} /></label>
        {draft.mode === 'text' && <>
          <label><span>{t('中文课时内容', 'Chinese lesson content')}</span><textarea autoComplete="off" className="platform-field-control platform-field-textarea" rows={4} value={draft.bodyZh} disabled={saving} onChange={event => update({ bodyZh: event.target.value })} /></label>
          <label><span>{t('英文课时内容', 'English lesson content')}</span><textarea autoComplete="off" className="platform-field-control platform-field-textarea" rows={4} value={draft.bodyEn} disabled={saving} onChange={event => update({ bodyEn: event.target.value })} /></label>
        </>}
      </div>
    </section>
    {error && <p className="platform-form-error" role="alert">{error}</p>}
    <footer className="platform-lesson-create-footer">
      <p>{draft.mode === 'video' && !video?.nodeId ? t('上传完成后即可提交审核，离开页面会暂停上传。', 'Submit for review after uploading. Leaving this page pauses the upload.') : t('图文和视频课时均须经过管理员审核后才会发布。你也可以先保存草稿。', 'Text and video lessons require administrator approval before publication. You can also save a draft.')}</p>
      <div><button type="button" className="platform-button" disabled={saving} onClick={() => void save('draft')}>{t('保存草稿', 'Save draft')}</button><button type="button" className="platform-button platform-button-primary" disabled={saving || (draft.mode === 'video' && !video?.nodeId)} onClick={() => void save('published')}>{t('提交审核', 'Submit for review')}</button></div>
    </footer>
  </section>;
}

export function PlatformInstructorLessonCreate(props: CommonProps) {
  const user = useAuthUser();
  const owner = user?.uid ?? user?.wcaId;
  const courseId = props.entity?.id ?? props.params.id;
  if (owner == null || !courseId) return null;
  const lessons = Array.isArray(props.entity?.data?.lessons) ? props.entity.data.lessons : [];
  const nextOrdinal = Math.max(0, ...lessons.map(item => Number((item as { ordinal?: number })?.ordinal) || 0)) + 1;
  const key = `cuberoot:platform:lesson-create:v1:${owner}:${courseId}`;
  return <LessonCreator key={key} draftKey={key} courseId={courseId} nextOrdinal={nextOrdinal} {...props} />;
}
