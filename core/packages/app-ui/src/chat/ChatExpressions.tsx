import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ImagePlus, Smile, Sticker, X, Send, Star } from 'lucide-react';
import { ChatError, CHAT_STICKER_MAX_BYTES, CHAT_STICKER_MIMES, type ChatSticker, type ChatStickerClient } from '@cuberoot/shared/chat';
import type { ChatExpressionPack } from './ChatMessageText';
import { ChatStickerImage } from './ChatStickerImage';

const ChatEmojiPicker = lazy(() => import('./ChatEmojiPicker'));
type Translate = (zh: string, en: string) => string;
export function stickerError(error: unknown, t: Translate) {
  if (error instanceof ChatError) {
    if (error.code === 'UNAUTHENTICATED') return t('登录已过期，请重新登录。', 'Your session expired. Sign in again.');
    if (error.code === 'STICKER_LIMIT') return t('表情包收藏或上传额度已满（最多收藏 100 个、每天上传 50 个、上传总计 100 MB）。', 'Sticker limit reached: 100 favorites, 50 uploads per day, or 100 MB uploaded in total.');
    if (error.code === 'BODY_TOO_LARGE' || error.code === 'INVALID_INPUT') return t('请选择 2 MB 以内的 PNG、JPG、GIF 或 WebP 图片，宽高不超过 4096 像素。', 'Choose a PNG, JPG, GIF or WebP up to 2 MB and 4096 pixels per side.');
  }
  return t('表情包加载或保存失败，请重试。', 'Could not load or save stickers. Try again.');
}

/** Inline composer drawer. Its parent keys it by account and peer to cancel stale uploads. */
export function ChatExpressions({ packs = [], onReloadExpressions, client, disabled, items, loading, error, onReload, onChange, onEmoji, onSend, t }: {
  packs?: ChatExpressionPack[]; onReloadExpressions?(): void;
  client?: ChatStickerClient; disabled: boolean; items: ChatSticker[]; loading: boolean; error: string | null;
  onReload(): void; onChange(items: ChatSticker[]): void; onEmoji(value: string): void; onSend(id: string): void; t: Translate;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [packId, setPackId] = useState('wechat');
  const pack = packs.find(item => item.id === packId) ?? packs[0];
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!host.current?.contains(event.target as Node)) setOpen(null); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(null); setSelected(null); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  async function upload(file: File | undefined) {
    if (!file || !client || busy || disabled) return;
    setFailure(null);
    if (file.size > CHAT_STICKER_MAX_BYTES || !CHAT_STICKER_MIMES.some((type) => type === file.type)) {
      setFailure(stickerError(new ChatError('INVALID_INPUT'), t)); return;
    }
    const pending = new AbortController(); request.current = pending; setBusy(true);
    try {
      const sticker = await client.upload(file, pending.signal);
      if (pending.signal.aborted) return;
      setSelected(sticker.id); onReload();
    } catch (error) { if (!pending.signal.aborted) setFailure(stickerError(error, t)); }
    finally { if (!pending.signal.aborted) setBusy(false); }
  }
  async function unsave(id: string) {
    if (!client || busy) return;
    const pending = new AbortController(); request.current = pending; setBusy(true); setFailure(null);
    try {
      const next = await client.save(id, false, pending.signal);
      if (!pending.signal.aborted) { onChange(next); setSelected(null); }
    } catch (error) { if (!pending.signal.aborted) setFailure(stickerError(error, t)); }
    finally { if (!pending.signal.aborted) setBusy(false); }
  }
  return <div ref={host} className="friend-chat-expressions">
    <div className="friend-chat-tools">
      <button type="button" className="friend-chat-action" disabled={disabled} aria-expanded={open === 'emoji'} onClick={() => setOpen(open === 'emoji' ? null : 'emoji')}><Smile size={18} />{t('表情', 'Emoji')}</button>
      {packs.length > 0 && <button type="button" className="friend-chat-action" disabled={disabled} aria-expanded={open === 'builtin'} onClick={() => { onReloadExpressions?.(); setOpen(open === 'builtin' ? null : 'builtin'); }}><Smile size={18} />{t('内置表情', 'Built-in expressions')}</button>}
      {client && <button type="button" className="friend-chat-action" disabled={disabled} aria-expanded={open === 'stickers'} onClick={() => { setOpen(open === 'stickers' ? null : 'stickers'); if (open !== 'stickers') onReload(); }}><Sticker size={18} />{t('表情包', 'Stickers')}</button>}
    </div>
    {open && <div className="friend-chat-expression-panel" data-site-surface="panel" aria-label={t('表情面板', 'Expression picker')}>
      <div className="friend-chat-expression-heading">
        <strong>{open === 'emoji' ? t('系统表情', 'Emoji') : open === 'stickers' ? t('我的表情包', 'My stickers') : t('内置表情', 'Built-in expressions')}</strong>
        <button type="button" className="friend-chat-action" aria-label={t('关闭表情面板', 'Close expression picker')} onClick={() => setOpen(null)}><X size={16} /></button>
      </div>
      {open === 'emoji' ? <Suspense fallback={<p role="status">{t('加载中…', 'Loading…')}</p>}><ChatEmojiPicker disabled={disabled} onSelect={onEmoji} t={t} /></Suspense>
        : open !== 'stickers' ? <><div className="friend-chat-emoji-controls"><select aria-label={t('表情系列', 'Expression collection')} value={pack?.id ?? ''} onChange={event => setPackId(event.target.value)}>{packs.map(item => <option key={item.id} value={item.id}>{t(item.zh, item.en)}</option>)}</select></div><div className={pack?.id.startsWith('pet:') ? 'friend-chat-sticker-grid' : 'friend-chat-emoji-grid'}>{pack?.items.map(item => <button type="button" key={item.token} className="friend-chat-action" disabled={disabled} title={t(item.zh, item.en)} aria-label={t(item.zh, item.en)} onClick={() => onEmoji(item.token)}><img src={item.src} alt="" loading="lazy" className={item.large ? "friend-chat-pet-expression" : "friend-chat-picker-image"} /></button>)}</div></>
        : <>
          <input ref={fileInput} type="file" hidden accept={CHAT_STICKER_MIMES.join(',')} onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ''; }} />
          <div className="friend-chat-tools"><button type="button" className="friend-chat-action" disabled={busy || disabled} onClick={() => fileInput.current?.click()}><ImagePlus size={16} />{busy ? t('处理中…', 'Working…') : t('添加表情包', 'Add sticker')}</button><span className="friend-chat-muted">GIF · PNG · JPG · WebP · ≤2 MB</span></div>
          {(failure || error) && <p className="friend-chat-error" role="alert">{failure || error}<button type="button" className="friend-chat-action" onClick={onReload}>{t('重试', 'Retry')}</button></p>}
          {loading && <p className="friend-chat-muted" role="status">{t('加载中…', 'Loading…')}</p>}
          {!loading && !items.length && !selected && !error && <p className="friend-chat-muted">{t('添加喜欢的图片或 GIF，下次直接从这里发送。', 'Add an image or GIF, then send it from here whenever you like.')}</p>}
          {selected && client ? <div className="friend-chat-sticker-selection">
            <ChatStickerImage client={client} id={selected} label={t('表情包预览', 'Sticker preview')} retryLabel={t('重试', 'Retry')} />
            <div className="friend-chat-selection-actions">
              <button type="button" className="friend-chat-action is-primary" disabled={busy || disabled} onClick={() => { onSend(selected); setSelected(null); setOpen(null); }}><Send size={15} />{t('发送表情包', 'Send sticker')}</button>
              <button type="button" className="friend-chat-action" disabled={busy} onClick={() => void unsave(selected)}><Star size={15} />{t('取消收藏', 'Remove favorite')}</button>
              <button type="button" className="friend-chat-action" onClick={() => setSelected(null)}>{t('取消', 'Cancel')}</button>
            </div>
          </div> : <div className="friend-chat-sticker-grid">{client && items.map((item, index) => <button type="button" className="friend-chat-action" key={item.id} disabled={disabled || busy} aria-label={`${t('预览表情包', 'Preview sticker')} ${index + 1}`} onClick={() => { setSelected(item.id); setFailure(null); }}>
            <ChatStickerImage client={client} id={item.id} label={t('表情包', 'Sticker')} retryLabel={t('重试', 'Retry')} interactive={false} />
          </button>)}</div>}
        </>}
    </div>}
  </div>;
}
