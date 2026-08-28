'use client';

import { useEffect, useMemo, useState } from 'react';
import { tr } from '@/i18n/tr';
import { useIsAdmin } from '@/lib/auth-store';
import {
  getCreatorGalleryCaptions,
  saveCreatorGalleryCaptions,
  type CreatorGalleryCaption,
} from '@/lib/creator-gallery-api';

const PHOTOS = [
  { imageKey: 'photo-01', src: '/images/ruimin/gallery/photo-01.webp', width: 2974, height: 2230 },
  { imageKey: 'photo-02', src: '/images/ruimin/gallery/photo-02.webp', width: 3200, height: 2400 },
  { imageKey: 'photo-03', src: '/images/ruimin/gallery/photo-03.webp', width: 3200, height: 2400 },
  { imageKey: 'photo-04', src: '/images/ruimin/gallery/photo-04.webp', width: 3200, height: 2400 },
  { imageKey: 'photo-05', src: '/images/ruimin/gallery/photo-05.webp', width: 3200, height: 2187 },
  { imageKey: 'photo-06', src: '/images/ruimin/gallery/photo-06.webp', width: 2398, height: 2398 },
  { imageKey: 'photo-07', src: '/images/ruimin/gallery/photo-07.webp', width: 3200, height: 2400 },
  { imageKey: 'photo-08', src: '/images/ruimin/gallery/photo-08.webp', width: 3200, height: 2400 },
] as const;

function blankCaptions(): CreatorGalleryCaption[] {
  return PHOTOS.map(({ imageKey }) => ({ imageKey, captionZh: '', captionEn: '' }));
}

function mergeCaptions(saved: CreatorGalleryCaption[]): CreatorGalleryCaption[] {
  const byKey = new Map(saved.map((caption) => [caption.imageKey, caption]));
  return PHOTOS.map(({ imageKey }) => byKey.get(imageKey) ?? { imageKey, captionZh: '', captionEn: '' });
}

export default function CreatorGallery() {
  const isAdmin = useIsAdmin();
  const [captions, setCaptions] = useState<CreatorGalleryCaption[]>(blankCaptions);
  const [draft, setDraft] = useState<CreatorGalleryCaption[]>(blankCaptions);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    let active = true;
    getCreatorGalleryCaptions()
      .then((saved) => {
        if (!active) return;
        const merged = mergeCaptions(saved);
        setCaptions(merged);
        setDraft(merged);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const draftByKey = useMemo(() => new Map(draft.map((caption) => [caption.imageKey, caption])), [draft]);
  const captionByKey = useMemo(
    () => new Map(captions.map((caption) => [caption.imageKey, caption])),
    [captions],
  );

  const updateDraft = (imageKey: string, field: 'captionZh' | 'captionEn', value: string) => {
    setDraft((current) => current.map((caption) => (
      caption.imageKey === imageKey ? { ...caption, [field]: value } : caption
    )));
  };

  const beginEditing = () => {
    setDraft(captions.map((caption) => ({ ...caption })));
    setSaveError('');
    setEditing(true);
  };

  const cancelEditing = () => {
    setDraft(captions.map((caption) => ({ ...caption })));
    setSaveError('');
    setEditing(false);
  };

  const save = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const saved = mergeCaptions(await saveCreatorGalleryCaptions(draft));
      setCaptions(saved);
      setDraft(saved);
      setEditing(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="ruimin-gallery" aria-labelledby="ruimin-gallery-heading">
      <div className="ruimin-gallery-heading">
        <div className="ruimin-section-label">
          <p>04</p>
          <h2 id="ruimin-gallery-heading">{tr({ zh: '照片', en: 'Photographs' })}</h2>
        </div>
        {isAdmin && !editing && (
          <button className="ruimin-gallery-edit" type="button" onClick={beginEditing}>
            {tr({ zh: '编辑说明', en: 'Edit captions' })}
          </button>
        )}
      </div>

      <div className="ruimin-gallery-grid">
        {PHOTOS.map((photo, index) => {
          const caption = captionByKey.get(photo.imageKey);
          const draftCaption = draftByKey.get(photo.imageKey);
          const visibleCaption = tr({
            zh: caption?.captionZh || caption?.captionEn || '',
            en: caption?.captionEn || caption?.captionZh || '',
          });
          const number = String(index + 1).padStart(2, '0');

          return (
            <figure className="ruimin-gallery-item" key={photo.imageKey}>
              <a
                className="ruimin-gallery-image-link"
                href={photo.src}
                target="_blank"
                rel="noreferrer"
                aria-label={tr({ zh: `查看第 ${index + 1} 张照片大图`, en: `Open photograph ${index + 1}` })}
              >
                <img
                  src={photo.src}
                  alt={tr({ zh: `颜瑞民个人照片 ${number}`, en: `Ruimin Yan personal photograph ${number}` })}
                  width={photo.width}
                  height={photo.height}
                  loading="lazy"
                  decoding="async"
                />
              </a>

              {editing && isAdmin ? (
                <div className="ruimin-gallery-caption-editor">
                  <p className="ruimin-gallery-photo-number">{number}</p>
                  <label>
                    <span>{tr({ zh: '中文说明', en: 'Chinese caption' })}</span>
                    <textarea
                      className="ruimin-gallery-caption-input"
                      value={draftCaption?.captionZh ?? ''}
                      maxLength={800}
                      rows={3}
                      onChange={(event) => updateDraft(photo.imageKey, 'captionZh', event.target.value)}
                    />
                  </label>
                  <label>
                    <span>{tr({ zh: '英文说明', en: 'English caption' })}</span>
                    <textarea
                      className="ruimin-gallery-caption-input"
                      value={draftCaption?.captionEn ?? ''}
                      maxLength={800}
                      rows={3}
                      onChange={(event) => updateDraft(photo.imageKey, 'captionEn', event.target.value)}
                    />
                  </label>
                </div>
              ) : (
                <figcaption>
                  <span className="ruimin-gallery-photo-number">{number}</span>
                  {visibleCaption && <span>{visibleCaption}</span>}
                </figcaption>
              )}
            </figure>
          );
        })}
      </div>

      {editing && isAdmin && (
        <div className="ruimin-gallery-actions">
          <button
            className="ruimin-gallery-action ruimin-gallery-action-primary"
            type="button"
            onClick={save}
            disabled={saving}
          >
            {saving
              ? tr({ zh: '保存中…', en: 'Saving…' })
              : tr({ zh: '保存说明', en: 'Save captions' })}
          </button>
          <button
            className="ruimin-gallery-action"
            type="button"
            onClick={cancelEditing}
            disabled={saving}
          >
            {tr({ zh: '取消', en: 'Cancel' })}
          </button>
          {saveError && (
            <p role="alert">{tr({ zh: `保存失败：${saveError}`, en: `Save failed: ${saveError}` })}</p>
          )}
        </div>
      )}
    </section>
  );
}
