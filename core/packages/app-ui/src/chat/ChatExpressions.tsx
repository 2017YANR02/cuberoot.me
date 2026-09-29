import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { ImagePlus, Smile, Heart, X, Send, Star, Plus, Keyboard, Search, Delete, Camera, Globe } from 'lucide-react';
import { ChatError, CHAT_STICKER_MAX_BYTES, CHAT_STICKER_MIMES, type ChatSticker, type ChatStickerClient } from '@cuberoot/shared/chat';
import { ClearButton } from '@cuberoot/timer-ui/clear-button';
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
export function ChatExpressions({ input, sendButton, voiceControl, recentKey, onKeyboard, onBackspace, onOpenPanel, renderMore, packs = [], onReloadExpressions, client, disabled, items, loading, error, onReload, onChange, onEmoji, onSend, t }: {
  input: ReactNode; sendButton: ReactNode; voiceControl?: ReactNode; recentKey: string;
  onKeyboard(): void; onBackspace(): void; onOpenPanel(): void;
  renderMore?(insert: (value: string) => void, close: () => void): ReactNode;
  packs?: ChatExpressionPack[]; onReloadExpressions?(): void;
  client?: ChatStickerClient; disabled: boolean; items: ChatSticker[]; loading: boolean; error: string | null;
  onReload(): void; onChange(items: ChatSticker[]): void; onEmoji(value: string): void; onSend(id: string): void; t: Translate;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [packId, setPackId] = useState(packs[0]?.id ?? 'native');
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    try { const saved: unknown = JSON.parse(localStorage.getItem(recentKey) ?? '[]'); setRecent(Array.isArray(saved) ? saved.filter((v): v is string => typeof v === 'string' && v.length < 200).slice(0, 24) : []); } catch { setRecent([]); }
  }, [recentKey]);
  const choose = (value: string) => {
    onEmoji(value);
    const next = [value, ...recent.filter(item => item !== value)].slice(0, 24);
    setRecent(next); try { localStorage.setItem(recentKey, JSON.stringify(next)); } catch { /* Storage is optional. */ }
  };
  const show = (value: string | null) => { setOpen(value); setSelected(null); if (value) onOpenPanel(); };
  const selectPack = (id: string) => { setPackId(id); setSearch(''); setSelected(null); if (id === 'stickers') onReload(); };

  useEffect(() => { if (packId !== 'native' && packId !== 'stickers' && !packs.some(pack => pack.id === packId)) setPackId(packs[0]?.id ?? 'native'); }, [packs, packId]);
  const pack = packs.find(item => item.id === packId) ?? packs[0];
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
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
  const query = search.trim().toLocaleLowerCase();
  const visibleItems = (query ? packs.flatMap(p => p.items) : pack?.items ?? []).filter(item => !query || (item.zh + item.en).toLocaleLowerCase().includes(query));
  const recentItems = recent.flatMap(token => { const item = pack?.items.find(item => item.token === token); return item ? [item] : []; });
  const grid = (entries: typeof visibleItems) => <div className={entries.some(item => item.large) ? 'friend-chat-sticker-grid' : 'friend-chat-emoji-grid'}>{entries.map(item => <button type="button" key={item.token} className="friend-chat-action" disabled={disabled} title={t(item.zh, item.en)} aria-label={t(item.zh, item.en)} onClick={() => choose(item.token)}><img src={item.src} alt="" loading="lazy" className={item.large ? 'friend-chat-pet-expression' : 'friend-chat-picker-image'} /></button>)}</div>;
  return <div ref={host} className="friend-chat-expressions">
    <input ref={fileInput} type="file" hidden accept={CHAT_STICKER_MIMES.join(',')} onChange={(event) => { show('expressions'); selectPack('stickers'); void upload(event.target.files?.[0]); event.target.value = ''; }} />
    <input ref={cameraInput} type="file" hidden accept="image/*" capture="environment" onChange={(event) => { show('expressions'); selectPack('stickers'); void upload(event.target.files?.[0]); event.target.value = ''; }} />
    <div className="friend-chat-input-row" onFocusCapture={event => { if (event.target instanceof HTMLTextAreaElement) setOpen(null); }}>
      {voiceControl}
      {input}
      <button type="button" className="friend-chat-action friend-chat-icon" disabled={disabled} aria-label={open === 'expressions' ? t('键盘', 'Keyboard') : t('表情', 'Expressions')} aria-expanded={open === 'expressions'} onClick={() => { if (open === 'expressions') { show(null); onKeyboard(); } else { show('expressions'); onReloadExpressions?.(); if (packId === 'stickers') onReload(); } }}>{open === 'expressions' ? <Keyboard size={26} /> : <Smile size={28} />}</button>
      <button type="button" className="friend-chat-action friend-chat-icon" disabled={disabled} aria-label={t('更多功能', 'More actions')} aria-expanded={open === 'more'} onClick={() => show(open === 'more' ? null : 'more')}><Plus size={28} /></button>
      {sendButton}
    </div>
    {open === 'more' && <div className="friend-chat-more-panel" data-site-surface="panel" aria-label={t('更多功能', 'More actions')}>
      <div className="friend-chat-more-grid">
        {client && <>
          <button type="button" disabled={busy || disabled} onClick={() => fileInput.current?.click()}><span><ImagePlus /></span>{t('照片', 'Photos')}</button>
          <button type="button" disabled={busy || disabled} onClick={() => cameraInput.current?.click()}><span><Camera /></span>{t('拍摄', 'Camera')}</button>
          <button type="button" onClick={() => { show('expressions'); selectPack('stickers'); }}><span><Heart /></span>{t('收藏表情', 'Saved stickers')}</button>
        </>}
      </div>
      {renderMore?.(value => { onEmoji(value); show(null); }, () => show(null))}
    </div>}
    {open === 'expressions' && <div className="friend-chat-expression-panel" data-site-surface="panel" aria-label={t('表情面板', 'Expression picker')}>
      <div className="friend-chat-pack-strip" role="tablist" aria-label={t('表情系列', 'Expression collections')}>
        <button type="button" className="friend-chat-action" aria-label={t('搜索表情', 'Search expressions')} aria-pressed={searching} onClick={() => setSearching(!searching)}><Search size={23} /></button>
        {packs.filter(p => p.id === 'wechat').map(p => <button type="button" role="tab" aria-selected={packId === p.id} aria-label={t(p.zh, p.en)} key={p.id} className="friend-chat-action" onClick={() => selectPack(p.id)}><Smile size={28} /></button>)}
        {client && <button type="button" role="tab" className="friend-chat-action" aria-selected={packId === 'stickers'} aria-label={t('收藏表情', 'Saved stickers')} onClick={() => selectPack('stickers')}><Heart size={27} /></button>}
        <button type="button" role="tab" className="friend-chat-action" aria-selected={packId === 'native'} aria-label={t('系统表情', 'System emoji')} onClick={() => selectPack('native')}><Globe size={26} /></button>
        {packs.filter(p => p.id !== 'wechat').map(p => <button type="button" role="tab" className="friend-chat-action" aria-selected={packId === p.id} aria-label={t(p.zh, p.en)} key={p.id} onClick={() => selectPack(p.id)}><img src={p.items[0]?.src} alt="" /></button>)}
      </div>
      {searching && <div className="friend-chat-search"><Search size={16} /><input aria-label={t('搜索表情', 'Search expressions')} value={search} onChange={event => setSearch(event.target.value)} />{search && <ClearButton onClick={() => setSearch('')} ariaLabel={t('清除', 'Clear')} />}</div>}
      <div className="friend-chat-expression-content">
        {packId === 'native' ? <Suspense fallback={<p role="status">{t('加载中…', 'Loading…')}</p>}><ChatEmojiPicker disabled={disabled} onSelect={choose} search={search} recent={recent.filter(value => !value.startsWith('['))} t={t} /></Suspense>
          : packId !== 'stickers' ? <>
            {!query && recentItems.length > 0 && <><p className="friend-chat-expression-label">{t('最近使用', 'Recently used')}</p>{grid(recentItems)}</>}
            <p className="friend-chat-expression-label">{query ? t('搜索结果', 'Search results') : t('所有表情', 'All expressions')}</p>{grid(visibleItems)}
            {query && !visibleItems.length && <p className="friend-chat-muted">{t('没有匹配的表情', 'No matching expressions')}</p>}
          </> : <>
            <div className="friend-chat-tools"><button type="button" className="friend-chat-action" disabled={busy || disabled} onClick={() => fileInput.current?.click()}><Plus size={18} />{busy ? t('处理中…', 'Working…') : t('添加表情包', 'Add sticker')}</button><span className="friend-chat-muted">GIF · PNG · JPG · WebP · ≤2 MB</span></div>
            {(failure || error) && <p className="friend-chat-error" role="alert">{failure || error}<button type="button" className="friend-chat-action" onClick={onReload}>{t('重试', 'Retry')}</button></p>}
            {loading && <p className="friend-chat-muted" role="status">{t('加载中…', 'Loading…')}</p>}
            {!loading && !items.length && !selected && !error && <p className="friend-chat-muted">{t('添加喜欢的图片或 GIF，下次直接从这里发送。', 'Add an image or GIF, then send it from here whenever you like.')}</p>}
            {selected && client ? <div className="friend-chat-sticker-selection">
              <ChatStickerImage client={client} id={selected} label={t('表情包预览', 'Sticker preview')} retryLabel={t('重试', 'Retry')} />
              <div className="friend-chat-selection-actions">
                <button type="button" className="friend-chat-action is-primary" disabled={busy || disabled} onClick={() => { onSend(selected); show(null); }}><Send size={15} />{t('发送表情包', 'Send sticker')}</button>
                <button type="button" className="friend-chat-action" disabled={busy} onClick={() => void unsave(selected)}><Star size={15} />{t('取消收藏', 'Remove favorite')}</button>
                <button type="button" className="friend-chat-action" onClick={() => setSelected(null)}>{t('取消', 'Cancel')}</button>
              </div>
            </div> : <div className="friend-chat-sticker-grid">{client && items.map((item, index) => <button type="button" className="friend-chat-action" key={item.id} disabled={disabled || busy} aria-label={t('预览表情包', 'Preview sticker') + ' ' + (index + 1)} onClick={() => { setSelected(item.id); setFailure(null); }}>
              <ChatStickerImage client={client} id={item.id} label={t('表情包', 'Sticker')} retryLabel={t('重试', 'Retry')} interactive={false} />
            </button>)}</div>}
          </>}
      </div>
      <div className="friend-chat-expression-footer"><button type="button" className="friend-chat-action" aria-label={t('删除上一个表情或字符', 'Delete previous expression or character')} onClick={onBackspace}><Delete size={22} /></button><button type="button" className="friend-chat-action" aria-label={t('关闭表情面板', 'Close expression picker')} onClick={() => show(null)}><X size={20} /></button></div>
    </div>}
  </div>;
}
