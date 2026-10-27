'use client';
import { useEffect, useState } from 'react';
import { apiUrl } from '@/lib/api-base';
import { SiteAssistantAnswerText } from '@/components/SiteAssistantDialog';
import { tr } from '@/i18n/tr';

export default function SharedMessagePage() {
  const [message, setMessage] = useState<{ question: string; answer: string } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const id = new URLSearchParams(window.location.search).get('id') ?? '';
    if (!/^[A-Za-z0-9_-]{24}$/.test(id)) { setFailed(true); return; }
    void fetch(apiUrl(`/v1/site-assistant/shares/${id}`), { credentials: 'omit', cache: 'no-store', signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error('unavailable'); const data = await response.json(); if (typeof data.question !== 'string' || typeof data.answer !== 'string') throw new Error('invalid'); return data; })
      .then(data => setMessage(data)).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, []);
  return <main className="assistant-shared-page">{message ? <><h1>{message.question || tr({ zh: '分享的回答', en: 'Shared response' })}</h1><SiteAssistantAnswerText shared result={{ answer: message.answer, sources: [] }}/></> : <p role="status">{tr(failed ? { zh: '链接已失效或已取消分享。', en: 'This link is unavailable or has been revoked.' } : { zh: '正在打开分享…', en: 'Opening shared message…' })}</p>}</main>;
}
