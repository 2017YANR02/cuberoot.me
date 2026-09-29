import { useEffect, useRef, useState } from 'react';
import type { ChatStickerClient } from '@cuberoot/shared/chat';

/** Authenticated images stay in memory and are revoked when the account or tile changes. */
export function ChatStickerImage({ client, id, label, retryLabel, interactive = true }: {
  client: ChatStickerClient; id: string; label: string; retryLabel: string; interactive?: boolean;
}) {
  const host = useRef<HTMLSpanElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ client: ChatStickerClient; id: string; url?: string; failed?: boolean } | null>(null);
  useEffect(() => {
    const request = new AbortController();
    let url: string | undefined;
    setResult(null);
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      void client.image(id, request.signal).then((blob) => {
        if (request.signal.aborted) return;
        url = URL.createObjectURL(blob);
        setResult({ client, id, url });
      }).catch(() => { if (!request.signal.aborted) setResult({ client, id, failed: true }); });
    }, { rootMargin: '200px' });
    if (host.current) observer.observe(host.current);
    return () => { observer.disconnect(); request.abort(); if (url) URL.revokeObjectURL(url); };
  }, [client, id, attempt]);
  const current = result?.client === client && result.id === id ? result : null;
  return <span ref={host} className="friend-chat-sticker-image">
    {current?.url ? <img src={current.url} alt={label} onError={() => setResult({ client, id, failed: true })} />
      : current?.failed ? <span role="status">{label} · {retryLabel}</span> : <span aria-label={label}>…</span>}
    {current?.failed && interactive && <button type="button" className="friend-chat-action" onClick={(event) => { event.stopPropagation(); setAttempt((n) => n + 1); }}>{retryLabel}</button>}
  </span>;
}
