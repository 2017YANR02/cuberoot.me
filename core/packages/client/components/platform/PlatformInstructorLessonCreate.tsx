'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, Film } from '@app-foundation/icons/lucide';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { useAuthUser } from '@/lib/auth-store';
import { useEntryRouter } from '@/hooks/useEntryRouter';
import { uploadPlatformLessonCover } from '@/lib/platform-gateway';
import { PlatformLessonCoverEditor } from './PlatformLessonCoverEditor';
import { persistItem } from '@/lib/safe-storage';
import { cancelDriveUpload, courseLessonUploadTransport, createDriveUpload, uploadDriveChunk } from '@/lib/drive-api';
import type { CommonProps } from './PlatformActionTypes';

const MAX_BYTES = 1024 ** 3;
const VIDEO_TYPES: Record<string, string> = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' };
type VideoDraft = { name: string; size: number; lastModified: number; mime: string; storedName: string; offset: number; uploadId?: string; nodeId?: string };
type Draft = { slug: string; titleZh: string; titleEn: string; bodyZh: string; bodyEn: string; mode: 'video' | 'text'; lessonId?: string; lessonType?: 'introduction' | 'core'; trial?: boolean; trialTouched?: boolean; video?: VideoDraft; durationSeconds?: number };

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

export function PlatformLessonVideoUpload({ courseId, video, disabled, onVideoChange, onDuration, onVideoElement }: {
  courseId: string;
  video?: VideoDraft;
  disabled?: boolean;
  onVideoChange: (video: VideoDraft, sameFile: boolean) => void;
  onDuration: (duration: number) => void;
  onVideoElement?: (video: HTMLVideoElement | null) => void;
}) {
  const t = useT();
  const latest = useRef(video);
  latest.current = video;
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(video?.offset ?? 0);
  const [error, setError] = useState('');
  const [compatibility, setCompatibility] = useState(false);
  const [dragging, setDragging] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const transport = courseLessonUploadTransport(courseId);

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
      onVideoChange(video, true);
      setProgress(video.offset);
      while (video.offset < selected.size) {
        const start = video.offset;
        const result = await uploadDriveChunk(session.id, start, selected.slice(start, start + session.chunkBytes), current.signal, bytes => {
          if (active()) setProgress(start + bytes);
        }, transport);
        if (!active()) return;
        if (result.offset <= start || result.offset > selected.size || (result.complete && !result.nodeId)) throw new Error(t('上传进度异常，请重试。', 'Invalid upload progress. Please retry.'));
        video = { ...video, offset: result.offset, nodeId: result.complete ? result.nodeId : undefined };
        onVideoChange(video, true);
        setProgress(video.offset);
      }
      if (!video.nodeId) throw new Error(t('未收到文件确认，请重试。', 'File confirmation was not received. Please retry.'));
    } catch (reason) {
      if (active()) { setError(reason instanceof Error ? reason.message : String(reason)); setProgress(latest.current?.offset ?? 0); }
    } finally {
      if (alive.current && controller.current === current) { controller.current = null; setUploading(false); }
    }
  }

  function pause() {
    controller.current?.abort();
    controller.current = null;
    setUploading(false);
    setProgress(latest.current?.offset ?? 0);
  }

  function choose(selected?: File) {
    if (!selected || disabled) return;
    const mime = VIDEO_TYPES[selected.name.split('.').pop()?.toLowerCase() ?? ''];
    if (!mime || selected.size < 1 || selected.size > MAX_BYTES) { setError(t('请选择不超过 1 GB 的 MP4、WebM 或 MOV 视频。', 'Choose an MP4, WebM or MOV video up to 1 GB.')); return; }
    const old = latest.current;
    const matches = sameFile(old, selected);
    if (!matches) {
      pause();
      if (old?.uploadId && !old.nodeId) void cancelDriveUpload(old.uploadId, transport).catch(() => {});
    }
    const video = matches && old ? old : { name: selected.name, size: selected.size, lastModified: selected.lastModified, mime, storedName: `${crypto.randomUUID()}-${selected.name.replace(/[\\/]/g, '_').slice(-120)}`, offset: 0 };
    setFile(selected);
    setError('');
    setProgress(video.offset);
    setCompatibility(mime === 'video/quicktime');
    onVideoChange(video, matches);
    if (!video.nodeId) void upload(selected, video);
  }

  const percent = video ? Math.min(100, Math.floor(progress * 100 / video.size)) : 0;
  return <section className="platform-lesson-upload">
      <input ref={picker} type="file" accept=".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime" hidden disabled={disabled} onChange={event => { choose(event.currentTarget.files?.[0]); event.currentTarget.value = ''; }} />
      {!video ? <div className="platform-lesson-dropzone" data-dragging={dragging}
        onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); if (!disabled) choose(event.dataTransfer.files[0]); }}>
        <Upload aria-hidden />
        <strong>{t('拖放视频到这里', 'Drag and drop your video here')}</strong>
        <p>{t('视频将上传到课程私有网盘，可在上传时填写标题。', 'Your video is uploaded to private course storage. Enter its title while it uploads.')}</p>
        <button type="button" className="platform-button platform-button-primary" onClick={() => picker.current?.click()}>{t('选择视频', 'Select video')}</button>
        <small>{t('最大 1 GB，推荐 H.264 MP4', 'Up to 1 GB. H.264 MP4 recommended.')}</small>
      </div> : <div className="platform-lesson-upload-selected">
        {preview ? <video ref={onVideoElement} controls preload="metadata" src={preview} onError={() => setCompatibility(true)} onLoadedMetadata={event => { const player = event.currentTarget; if (!player.videoWidth) setCompatibility(true); if (Number.isFinite(player.duration) && player.duration <= 86400) onDuration(Math.round(player.duration)); }} /> : <div className="platform-lesson-upload-placeholder"><Film aria-hidden /></div>}
        <div className="platform-lesson-upload-detail">
          <strong>{video.name}</strong><small>{(video.size / 1024 ** 2).toFixed(1)} MB · {video.nodeId ? t('上传完成', 'Upload complete') : uploading ? t('正在上传至网盘', 'Uploading to Drive') : t('已暂停，可断点续传', 'Paused · resumable')}</small>
          <div className="platform-lesson-upload-progress"><progress max={100} value={percent} aria-label={t('视频上传进度', 'Video upload progress')} /><span>{percent}%</span></div>
          <div className="platform-lesson-upload-actions">
            {uploading ? <button className="platform-button" type="button" onClick={pause}>{t('暂停', 'Pause')}</button> : !video.nodeId && <button className="platform-button platform-button-primary" type="button" disabled={disabled} onClick={() => file && sameFile(video, file) ? void upload(file, video) : picker.current?.click()}>{t('继续上传', 'Resume upload')}</button>}
            <button type="button" className="platform-button" disabled={disabled || uploading} onClick={() => picker.current?.click()}>{t('重新选择视频', 'Choose another video')}</button>
          </div>
        </div>
      </div>}
      {compatibility && <p role="status">{t('当前视频可能无法在部分浏览器播放。建议导出为 H.264 视频、AAC 音频的 MP4。', 'This video may not play in some browsers. Export an MP4 with H.264 video and AAC audio for compatibility.')}</p>}
      {error && <p className="platform-form-error" role="alert">{error}</p>}
    </section>;
}

function LessonCreator({ courseId, draftKey, nextOrdinal, entity, busy, runAction }: CommonProps & { courseId: string; draftKey: string; nextOrdinal: number }) {
  const t = useT();
  const lang = useLang();
  const router = useEntryRouter();
  const [draft, setDraft] = useState(() => readDraft(draftKey));
  const latest = useRef(draft);
  const [saved, setSaved] = useState(true);
  const [draftMessage, setDraftMessage] = useState('');
  const [error, setError] = useState('');
  const [cover, setCover] = useState<File>();
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  function update(patch: Partial<Draft>) {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setDraft(next);
    setDraftMessage('');
    setSaved(persistItem(draftKey, JSON.stringify(next)));
  }

  async function save(status: 'draft' | 'published', addAnother = false) {
    const value = latest.current;
    const hasTitle = value.titleZh.trim() || value.titleEn.trim();
    if (!hasTitle || (value.mode === 'video' && !value.video?.nodeId)) {
      if (status === 'draft' && !addAnother && persistItem(draftKey, JSON.stringify(value))) {
        setDraftMessage(t('已保存到此设备，稍后可继续编辑。', 'Saved on this device. You can resume later.'));
      } else {
        setError(hasTitle ? t('请先完成视频上传。', 'Complete the video upload first.') : t('请填写至少一种语言的标题。', 'Enter a title in at least one language.'));
      }
      return;
    }
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setError('');
    let lessonId = value.lessonId;
    const selectedCover = value.mode === 'video' ? cover : undefined;
    const payload = {
      titleZh: value.titleZh.trim() || value.titleEn.trim(), titleEn: value.titleEn.trim() || value.titleZh.trim(),
      bodyZh: { markdown: value.bodyZh }, bodyEn: { markdown: value.bodyEn },
      lessonType: value.lessonType ?? 'core', accessScope: (value.trial ?? value.lessonType === 'introduction') ? 'public' : 'entitled',
      driveVideo: value.mode === 'video' ? value.video?.nodeId : undefined,
      durationSeconds: value.mode === 'video' ? value.durationSeconds : undefined,
    };
    try {
      if (selectedCover) {
        const draftResult = await runAction('save-course-lesson', courseId, {
          ...payload, ...(lessonId ? { lessonId } : { slug: value.slug, ordinal: nextOrdinal, appendToCourse: true }), status: 'draft',
        });
        lessonId = draftResult?.lesson?.id;
        if (!lessonId || !alive.current) return;
        update({ lessonId });
        await uploadPlatformLessonCover('instructor', courseId, lessonId, selectedCover);
        if (!alive.current) return;
        setCover(undefined);
      }
      if (!selectedCover || status === 'published') {
        const result = await runAction('save-course-lesson', courseId, {
          ...payload, ...(lessonId ? { lessonId } : { slug: value.slug, ordinal: nextOrdinal, appendToCourse: true }), status,
        });
        if (!result || !alive.current) return;
      }
      try { localStorage.removeItem(draftKey); } catch { /* Storage may be unavailable. */ }
      if (addAnother) {
        const next = readDraft(draftKey);
        latest.current = next;
        setDraft(next);
        setDraftMessage(t('课时已保存，可以添加下一节。', 'Lesson saved. Add the next lesson.'));
      } else {
        router.replace(`${lang === 'zh' ? '/zh' : ''}/platform/instructor/courses/${encodeURIComponent(courseId)}`);
      }
    } catch (reason) {
      if (alive.current) setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      submitting.current = false;
      if (alive.current) setSaving(false);
    }
  }

  const video = draft.video;
  return <section className="platform-lesson-create">
    <div className="platform-lesson-create-heading">
      <div><h1>{t('新增课时', 'Add lesson')}</h1><p>{entity?.title}</p></div>
      <span className="platform-lesson-draft-status" role="status">{draftMessage || (saved ? t('草稿自动保存在此设备', 'Draft autosaved on this device') : t('无法保存本地草稿', 'Local draft unavailable'))}</span>
    </div>
    <div className="platform-lesson-create-modes" aria-label={t('课时类型', 'Lesson type')}>
      <button type="button" className={`platform-button${draft.mode === 'video' ? ' platform-button-primary' : ''}`} aria-pressed={draft.mode === 'video'} disabled={saving} onClick={() => update({ mode: 'video' })}>{t('视频课时', 'Video lesson')}</button>
      <button type="button" className={`platform-button${draft.mode === 'text' ? ' platform-button-primary' : ''}`} aria-pressed={draft.mode === 'text'} disabled={saving} onClick={() => update({ mode: 'text' })}>{t('图文课时', 'Text lesson')}</button>
    </div>
    {draft.mode === 'video' && <>
      <PlatformLessonVideoUpload key={draft.slug} courseId={courseId} video={video} disabled={saving || !!busy}
        onVideoChange={(next, same) => { if (!same) setCover(undefined); update({ video: next, durationSeconds: same ? latest.current.durationSeconds : undefined }); }}
        onDuration={durationSeconds => update({ durationSeconds })} onVideoElement={setVideoElement} />
      {video && <PlatformLessonCoverEditor scope="instructor" courseId={courseId} lessonId={draft.slug} currentVideo
        videoElement={videoElement} onDraftCover={setCover} />}
    </>}
    {cover && draft.mode === 'video' ? <p role="status">{t('已选择封面', 'Cover selected')} · {cover.name}</p> : null}

    <section className="platform-lesson-create-details">
      <h2>{t('课时标题', 'Lesson title')}</h2>
      <div className="platform-form-grid">
        <label><span>{t('中文标题', 'Chinese title')}</span><input autoComplete="off" className="platform-field-control" value={draft.titleZh} disabled={saving} maxLength={240} onChange={event => update({ titleZh: event.target.value })} /></label>
        <label><span>{t('英文标题', 'English title')}</span><input autoComplete="off" className="platform-field-control" value={draft.titleEn} disabled={saving} maxLength={240} onChange={event => update({ titleEn: event.target.value })} /></label>
        <>
          <label><span>{t('中文课时内容', 'Chinese lesson content')}</span><textarea autoComplete="off" className="platform-field-control platform-field-textarea" rows={4} value={draft.bodyZh} disabled={saving} onChange={event => update({ bodyZh: event.target.value })} /></label>
          <label><span>{t('英文课时内容', 'English lesson content')}</span><textarea autoComplete="off" className="platform-field-control platform-field-textarea" rows={4} value={draft.bodyEn} disabled={saving} onChange={event => update({ bodyEn: event.target.value })} /></label>
        </>
        <label><span>{t('目录分组', 'Lesson section')}</span><select className="platform-field-control" value={draft.lessonType ?? 'core'} disabled={saving} onChange={event => {
          const lessonType = event.target.value === 'introduction' ? 'introduction' : 'core';
          const trialTouched = draft.trialTouched ?? typeof draft.trial === 'boolean';
          update({ lessonType, trialTouched, trial: trialTouched ? draft.trial : lessonType === 'introduction' });
        }}><option value="core">{t('正式课', 'Core lesson')}</option><option value="introduction">{t('引言', 'Introduction')}</option></select></label>
        <label><input type="checkbox" checked={draft.trial ?? draft.lessonType === 'introduction'} disabled={saving} onChange={event => update({ trial: event.target.checked, trialTouched: true })} /> {t('免费试听（发布后任何人可查看）', 'Free preview (public after publication)')}</label>
        <small>{t('引言课默认公开可看，可手动更改。', 'Introductions are public by default. You can change access.')}</small>
      </div>
    </section>
    {error && <p className="platform-form-error" role="alert">{error}</p>}
    <footer className="platform-lesson-create-footer">
      <p>{draft.mode === 'video' && !video?.nodeId ? t('上传完成后即可提交审核，离开页面会暂停上传。', 'Submit for review after uploading. Leaving this page pauses the upload.') : t('图文和视频课时均须经过管理员审核后才会发布。你也可以先保存草稿。', 'Text and video lessons require administrator approval before publication. You can also save a draft.')}</p>
      <div><button type="button" className="platform-button" disabled={saving} onClick={() => void save('draft')}>{t('保存草稿', 'Save draft')}</button><button type="button" className="platform-button" disabled={saving} onClick={() => void save('draft', true)}>{t('保存并继续添加', 'Save and add another')}</button><button type="button" className="platform-button platform-button-primary" disabled={saving || (draft.mode === 'video' && !video?.nodeId)} onClick={() => void save('published')}>{t('提交审核', 'Submit for review')}</button></div>
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
