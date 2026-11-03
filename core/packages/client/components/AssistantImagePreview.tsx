'use client';
import { useEffect, useState } from 'react';
import type { AssistantImage } from '@cuberoot/shared/site-assistant';
import { readAssistantImage } from '@/lib/site-assistant-images';
import { tr } from '@/i18n/tr';

/** Authenticated bytes never become a public attachment URL. */
export default function AssistantImagePreview({ image, index }: { image: AssistantImage; index: number }) {
  const [loaded, setLoaded] = useState<{ image: AssistantImage; src?: string; failed?: boolean } | null>(null);
  useEffect(() => {
    if (image.data) return;
    const controller = new AbortController();
    void readAssistantImage(image, controller.signal).then(value => {
      if (!controller.signal.aborted) setLoaded({ image, src: `data:${value.mediaType};base64,${value.data}` });
    }).catch(() => { if (!controller.signal.aborted) setLoaded({ image, failed: true }); });
    return () => controller.abort();
  }, [image]);
  const current = loaded?.image === image ? loaded : null;
  const src = image.data ? `data:${image.mediaType};base64,${image.data}` : current?.src;
  return src ? <img src={src} alt={tr({ zh: `附图 ${index + 1}`, en: `Attachment ${index + 1}` })} />
    : <span role="status">{current?.failed ? tr({ zh: '图片暂时无法读取', en: 'Image unavailable' }) : tr({ zh: '加载图片…', en: 'Loading image…' })}</span>;
}
