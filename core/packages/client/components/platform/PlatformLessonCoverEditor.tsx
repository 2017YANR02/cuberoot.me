'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from '@/hooks/useT';
import {
  loadPlatformManagedLessonMedia,
  platformMediaBrowserUrl,
  uploadPlatformLessonCover,
  type PlatformCourseManagementScope,
  type PlatformManagedLessonMedia,
} from '@/lib/platform-gateway';

interface Props {
  scope: PlatformCourseManagementScope;
  courseId: string;
  lessonId: string;
  currentVideo?: boolean;
  videoElement?: HTMLVideoElement | null;
  onCoverUpdated?: (posterUrl: string | null) => void;
}

export function PlatformLessonCoverEditor({
  scope,
  courseId,
  lessonId,
  currentVideo = false,
  videoElement,
  onCoverUpdated,
}: Props) {
  const t = useT();
  const fileInput = useRef<HTMLInputElement>(null);
  const pickerVideo = useRef<HTMLVideoElement>(null);
  const previewObjectUrl = useRef<string | null>(null);
  const [opened, setOpened] = useState(false);
  const [media, setMedia] = useState<PlatformManagedLessonMedia | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [framePicker, setFramePicker] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => () => {
    if (previewObjectUrl.current) URL.revokeObjectURL(previewObjectUrl.current);
  }, []);

  const load = async (): Promise<PlatformManagedLessonMedia | null> => {
    setLoading(true);
    setMessage('');
    try {
      const value = await loadPlatformManagedLessonMedia(scope, courseId, lessonId);
      setMedia(value);
      return value;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('无法加载视频封面。', 'Could not load the video cover.'));
      return null;
    } finally {
      setLoading(false);
    }
  };

  const upload = async (file: File) => {
    setUploading(true);
    setMessage('');
    try {
      await uploadPlatformLessonCover(scope, courseId, lessonId, file);
      setFramePicker(false);
      if (currentVideo) {
        if (previewObjectUrl.current) URL.revokeObjectURL(previewObjectUrl.current);
        previewObjectUrl.current = URL.createObjectURL(file);
        onCoverUpdated?.(previewObjectUrl.current);
      } else {
        const updated = await load();
        if (updated) onCoverUpdated?.(updated.posterUrl);
      }
      setMessage(t('封面已更新。', 'Cover updated.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('封面上传失败。', 'Cover upload failed.'));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const captureFrame = async () => {
    const element = currentVideo ? videoElement : pickerVideo.current;
    if (!element || element.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !element.videoWidth || !element.videoHeight) {
      setMessage(t('请先播放或拖动到要使用的画面。', 'Play or seek to the frame you want first.'));
      return;
    }
    try {
      const canvas = document.createElement('canvas');
      canvas.width = element.videoWidth;
      canvas.height = element.videoHeight;
      canvas.getContext('2d')?.drawImage(element, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      if (!blob) throw new Error(t('无法读取当前画面。', 'Could not read the current frame.'));
      await upload(new File([blob], `lesson-${lessonId}-cover.jpg`, { type: 'image/jpeg' }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('无法读取当前画面。', 'Could not read the current frame.'));
    }
  };

  const frameVideoUrl = media?.accessUrl ? platformMediaBrowserUrl(media.accessUrl) : null;
  const framePosterUrl = media?.posterUrl ? platformMediaBrowserUrl(media.posterUrl) : undefined;

  return (
    <details className={`platform-video-cover-editor${currentVideo ? ' platform-classroom-cover-editor' : ''}`} onToggle={(event) => {
      const nextOpened = event.currentTarget.open;
      setOpened(nextOpened);
      if (nextOpened && !currentVideo && !media && !loading) void load();
    }}>
      <summary>{currentVideo ? t('编辑封面', 'Edit cover') : t('视频封面', 'Video cover')}</summary>
      {opened && (
        <div className="platform-video-cover-editor-content">
          {loading ? <p className="platform-domain-note">{t('正在加载…', 'Loading…')}</p> : (
            <>
              {!currentVideo && (media?.posterUrl
                ? <img className="platform-video-cover-editor-preview" src={media.posterUrl} alt={t('当前视频封面', 'Current video cover')} />
                : <p className="platform-domain-note">{t('当前没有自定义封面。', 'No custom cover yet.')}</p>)}
              <div className="platform-video-cover-editor-actions">
                <input ref={fileInput} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) void upload(file);
                }} />
                <button type="button" className="platform-button" disabled={uploading} onClick={() => fileInput.current?.click()}>
                  {t('上传图片', 'Upload image')}
                </button>
                {!currentVideo ? (
                  <button type="button" className="platform-button" disabled={uploading || !media?.accessUrl} onClick={() => setFramePicker(value => !value)}>
                    {t('从视频选择', 'Choose from video')}
                  </button>
                ) : (
                  <button type="button" className="platform-button platform-button-primary" disabled={uploading || !videoElement} onClick={() => void captureFrame()}>
                    {uploading ? t('正在保存…', 'Saving…') : t('使用当前画面', 'Use current frame')}
                  </button>
                )}
              </div>
              {!currentVideo && framePicker && frameVideoUrl && (
                <div className="platform-lesson-frame-picker">
                  <video ref={pickerVideo} src={frameVideoUrl} poster={framePosterUrl} controls playsInline preload="metadata" />
                  <button type="button" className="platform-button platform-button-primary" disabled={uploading} onClick={() => void captureFrame()}>
                    {uploading ? t('正在保存…', 'Saving…') : t('使用当前画面', 'Use current frame')}
                  </button>
                </div>
              )}
              {message && <p className="platform-domain-note" role="status">{message}</p>}
            </>
          )}
        </div>
      )}
    </details>
  );
}
