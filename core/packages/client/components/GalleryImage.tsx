'use client';

import { useEffect, useState } from 'react';
import { uploadedImageUrl } from '@/lib/image-upload';
import { sessionFetch } from '@/lib/session-fetch';
import { authHeaders } from '@/lib/admin-api';
import { useAuthUser } from '@/lib/auth-store';
import { tr } from '@/i18n/tr';

/** Private previews use authenticated fetch; never put a token in an image URL. */
export default function GalleryImage({ id, alt = '' }: { id: number; alt?: string }) {
  const user = useAuthUser();
  const account = user ? `${user.uid ?? ''}:${user.wcaId}` : '';
  const [image, setImage] = useState<{ key: string; url: string } | null>(null);
  const [failed, setFailed] = useState('');
  const key = `${account}:${id}`;
  useEffect(() => {
    if (!account) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    void sessionFetch(`${uploadedImageUrl(id)}?v=2`, { headers: authHeaders(false), cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Image unavailable');
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setImage({ key, url: objectUrl });
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(key); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [account, id, key]);
  if (failed === key) return <span role="alert">{tr({ zh: '图片加载失败', en: 'Image unavailable' })}</span>;
  return <img src={account && image?.key === key ? image.url : undefined} alt={alt} />;
}
