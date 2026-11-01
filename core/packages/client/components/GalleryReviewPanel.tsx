'use client';

import { useCallback, useEffect, useState } from 'react';
import { listGalleryRequests, reviewGalleryPhoto, type GalleryPhoto } from '@/lib/gallery-api';
import GalleryImage from './GalleryImage';
import { tr, useLang } from '@/i18n/tr';
import { displayCuberName } from '@/lib/cuber-name-display';

export default function GalleryReviewPanel({ onReviewed }: { onReviewed: () => void }) {
  const lang = useLang();
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setFailed(false);
    try {
      const requests = await listGalleryRequests(signal);
      if (!signal?.aborted) setPhotos(requests);
    } catch { if (!signal?.aborted) setFailed(true); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  async function review(id: number, decision: 'public' | 'rejected') {
    setBusy(id);
    setFailed(false);
    try {
      await reviewGalleryPhoto(id, decision);
      onReviewed();
      await load();
    } catch { setFailed(true); }
    finally { setBusy(null); }
  }
  return <section className="gallery-collection">
    <h2>{tr({ zh: '公开申请', en: 'Publication requests' })}</h2>
    {failed && <div className="gallery-state" role="alert">
      <p>{tr({ zh: '操作失败，请刷新申请列表后重试。', en: 'Could not complete the request. Refresh the list and try again.' })}</p>
      <button className="gallery-retry" type="button" disabled={busy !== null} onClick={() => void load()}>{tr({ zh: '刷新', en: 'Refresh' })}</button>
    </div>}
    {loading ? <p className="gallery-state">{tr({ zh: '正在加载…', en: 'Loading…' })}</p>
      : photos.length === 0 ? <p className="gallery-state">{tr({ zh: '暂无待审核申请', en: 'No pending requests' })}</p>
      : <div className="gallery-grid">{photos.map(photo => <figure className="gallery-photo" key={photo.id}>
        <GalleryImage id={photo.id} alt={displayCuberName(photo.memberName, lang === 'zh')} />
        <figcaption>{displayCuberName(photo.memberName, lang === 'zh')}</figcaption>
        <div className="gallery-review-actions">
          <button className="gallery-retry" type="button" disabled={busy !== null} onClick={() => void review(photo.id, 'public')}>{tr({ zh: '通过', en: 'Approve' })}</button>
          <button className="gallery-retry" type="button" disabled={busy !== null} onClick={() => void review(photo.id, 'rejected')}>{tr({ zh: '不通过', en: 'Decline' })}</button>
        </div>
      </figure>)}</div>}
  </section>;
}
