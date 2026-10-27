'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Globe, Link as LinkIcon, Check } from '@app-foundation/icons/lucide';
import { SiX, SiReddit } from 'react-icons/si';
import { FaLinkedin } from 'react-icons/fa6';
import { ClearButton } from '@/components/ClearButton';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import { apiUrl } from '@/lib/api-base';
import { sessionFetch } from '@/lib/session-fetch';
import { authHeaders, handleApi } from '@/lib/admin-api';
import { tr } from '@/i18n/tr';
import type { AssistantTurn } from './SiteAssistantDialog';

export function AssistantShareDialog({ turn, lang, preview, text, shareId, onShareId, onClose }: {
  turn: AssistantTurn; lang: 'zh' | 'en'; preview: ReactNode; text: string; shareId: string | null;
  onShareId: (id: string | null) => void; onClose: () => void;
}) {
  const titleId = useId();
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  const backdrop = useModalDismiss(onClose);
  const [pending, setPending] = useState(false), [error, setError] = useState(''), [copied, setCopied] = useState(false);
  const createLink = async () => {
    const id = shareId ?? (await handleApi<{ id: string }>(await sessionFetch(apiUrl('/v1/site-assistant/shares'), {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ requestId: turn.requestId, question: turn.question, answer: text }),
    }))).id;
    onShareId(id);
    return new URL(`${lang === 'zh' ? '/zh' : ''}/chat/share?id=${encodeURIComponent(id)}`, window.location.origin).href;
  };
  const share = async (target: 'copy' | 'x' | 'linkedin' | 'reddit') => {
    if (pending) return;
    setPending(true); setError('');
    const tab = target === 'copy' ? null : window.open('about:blank', '_blank');
    if (tab) tab.opener = null;
    try {
      const url = await createLink();
      if (target === 'copy') { await navigator.clipboard.writeText(url); setCopied(true); }
      else {
        const link = target === 'x' ? `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`
          : target === 'linkedin' ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
          : `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(turn.question.slice(0, 200))}`;
        if (!tab) throw new Error('popup blocked');
        tab.location.href = link;
      }
    } catch { tab?.close(); setError(tr({ zh: '分享失败，请重试。', en: 'Sharing failed. Please retry.' })); }
    finally { setPending(false); }
  };
  const revoke = async () => {
    if (!shareId || pending) return;
    setPending(true); setError('');
    try { await handleApi(await sessionFetch(apiUrl(`/v1/site-assistant/shares/${shareId}`), { method: 'DELETE', headers: authHeaders() })); onShareId(null); setCopied(false); }
    catch { setError(tr({ zh: '取消分享失败，请重试。', en: 'Could not revoke this link. Please retry.' })); }
    finally { setPending(false); }
  };
  return createPortal(<div className="site-assistant-backdrop" {...backdrop}>
    <section ref={panel} className="assistant-share-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} data-site-surface="panel" onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const items = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]');
      if (!items?.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}>
      <header><h2 id={titleId}>{turn.question || tr({ zh: '分享回答', en: 'Share response' })}</h2><ClearButton variant="standalone" ariaLabel={tr({ zh: '关闭', en: 'Close' })} onClick={onClose}/></header>
      <div className="assistant-share-preview">{preview}</div>
      <div className="assistant-share-disclosure"><strong><Globe size={20}/>{tr({ zh: '分享这条消息的公开链接', en: 'Share a public link to this message' })}</strong><p>{tr({ zh: '任何拥有此链接的人都可以访问这条消息。只分享本条文字，不包含图片和其他对话。', en: 'Anyone with the link can read this message. Only this text is shared, without images or other messages.' })}</p></div>
      <div className="assistant-share-destinations">
        {([{ id: 'copy', icon: copied ? <Check/> : <LinkIcon/>, label: tr(copied ? { zh: '已复制', en: 'Copied' } : { zh: '复制链接', en: 'Copy link' }) }, { id: 'x', icon: <SiX size={22}/>, label: 'X' }, { id: 'linkedin', icon: <FaLinkedin size={22}/>, label: tr({ zh: '领英', en: 'LinkedIn' }) }, { id: 'reddit', icon: <SiReddit size={26}/>, label: 'Reddit' }] as const).map(item => <button className="assistant-share-destination" key={item.id} type="button" disabled={pending} onClick={() => void share(item.id)}><span>{item.icon}</span>{item.label}</button>)}
      </div>
      {shareId && <button type="button" className="assistant-share-revoke" disabled={pending} onClick={() => void revoke()}>{tr({ zh: '取消公开分享', en: 'Revoke public link' })}</button>}
      {error && <p className="site-assistant-voice-error" role="status">{error}</p>}
    </section>
  </div>, document.body);
}
