'use client';

// 对外展示设置。两个要点:
//   1. 开关默认关着 —— 日历是私人东西,链接必须是用户主动打开的;
//   2. 「仅显示忙碌时段」不是前端不渲染,而是服务端根本不发标题 / 说明 / 地点 / 参与者
//      (routes/calendar.ts 的 redactBusy),所以链接拿去抓也抓不到内容。
//
// 链接是 22 位随机 token(不可枚举);发错人了可以「换一条链接」立刻作废旧的。
// 同一个 token 还提供 .ics 订阅源,Google / Apple 日历能直接订上。

import { useState } from 'react';
import { Check, Copy, Link2, RefreshCw, X, ExternalLink } from 'lucide-react';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import BoolToggle from '@/components/BoolToggle';
import PillToggle from '@/components/PillToggle/PillToggle';
import { useCopy } from '@/hooks/useCopy';
import { tr } from '@/i18n/tr';
import { icsFeedUrl } from '@/lib/calendar-api';
import type { CalendarMeta, ShareSettings } from '@cuberoot/shared/calendar';

interface Props {
  share: ShareSettings;
  calendars: CalendarMeta[];
  lang: 'zh' | 'en';
  onSave: (patch: {
    enabled?: boolean; detail?: 'full' | 'busy'; title?: string; calendarIds?: number[];
  }) => Promise<void>;
  onRotate: () => Promise<void>;
  onClose: () => void;
}

export default function ShareDialog({ share, calendars, lang, onSave, onRotate, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  // 标题受控 + 关闭时兜底提交:只挂 onBlur 的话,输入框还聚焦着按 Esc / 点背景关掉,
  // React 先卸载组件、blur 不再触发,刚打的字就无声丢了。
  const [title, setTitle] = useState(share.title);
  // 两个复制按钮各挂一份 useCopy —— 共用一个 copied 会两个都打勾。
  const link = useCopy();
  const feed = useCopy();

  const saveTitle = (): void => {
    if (title !== share.title) void onSave({ title });
  };
  const close = (): void => {
    saveTitle();
    onClose();
  };
  useModalDismiss(close, busy);

  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const prefix = lang === 'zh' ? '/zh' : '';
  const pageUrl = `${origin}${prefix}/calendar/s/${share.token}`;
  const feedUrl = icsFeedUrl(share.token);

  const run = async (fn: () => Promise<void>): Promise<void> => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  const included = (id: number): boolean => share.calendarIds.length === 0 || share.calendarIds.includes(id);

  return (
    <div
      className="cal-modal-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) close(); }}
    >
      <div className="cal-modal is-narrow" role="dialog" aria-modal="true" aria-label={tr({ zh: '对外展示', en: 'Share' })}>
        <div className="cal-modal-head">
          <h2>{tr({ zh: '对外展示我的日历', en: 'Share my calendar' })}</h2>
          <button type="button" className="cal-icon-btn" onClick={close} aria-label={tr({ zh: '关闭', en: 'Close' })}>
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="cal-modal-body">
          <BoolToggle
            value={share.enabled}
            label={tr({ zh: '开启公开链接', en: 'Enable public link' })}
            onChange={(v) => void run(() => onSave({ enabled: v }))}
          />

          <div className="cal-share-field">
            <span className="cal-field-label">{tr({ zh: '显示内容', en: 'Detail level' })}</span>
            <PillToggle
              value={share.detail === 'busy'}
              onChange={(v) => void run(() => onSave({ detail: v ? 'busy' : 'full' }))}
              onLabel={tr({ zh: '仅忙碌时段', en: 'Busy only' })}
              offLabel={tr({ zh: '完整内容', en: 'Full details' })}
              ariaLabel={tr({ zh: '显示内容', en: 'Detail level' })}
            />
            <p className="cal-hint">
              {share.detail === 'busy'
                ? tr({
                  zh: '别人只看到你哪些时段被占用,标题、说明、地点、参与者都不会离开服务器。',
                  en: 'Visitors see only which slots are taken — titles, notes, location and guests never leave the server.',
                })
                : tr({
                  zh: '别人能看到日程的标题、时间、地点与说明。',
                  en: 'Visitors can see event titles, times, locations and descriptions.',
                })}
            </p>
          </div>

          <div className="cal-share-field">
            <span className="cal-field-label">{tr({ zh: '页面标题', en: 'Page title' })}</span>
            <input
              className="cal-text-input"
              type="text"
              value={title}
              maxLength={80}
              placeholder={tr({ zh: '如「我的空闲时间」', en: 'e.g. “My availability”' })}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => { if (title !== share.title) void run(() => onSave({ title })); }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            />
          </div>

          <div className="cal-share-field">
            <span className="cal-field-label">{tr({ zh: '展示哪些日历', en: 'Calendars to include' })}</span>
            <ul className="cal-share-cals">
              {calendars.map((c) => (
                <li key={c.id}>
                  <BoolToggle
                    value={included(c.id)}
                    label={c.name || tr({ zh: '我的日历', en: 'My calendar' })}
                    onChange={(v) => {
                      const cur = share.calendarIds.length === 0 ? calendars.map((x) => x.id) : share.calendarIds;
                      const next = v ? [...new Set([...cur, c.id])] : cur.filter((x) => x !== c.id);
                      void run(() => onSave({ calendarIds: next }));
                    }}
                  />
                </li>
              ))}
            </ul>
          </div>

          <div className="cal-share-field">
            <span className="cal-field-label">{tr({ zh: '公开链接', en: 'Public link' })}</span>
            <div className="cal-share-link">
              <Link2 size={14} aria-hidden />
              <code>{pageUrl}</code>
              <button type="button" className="cal-icon-btn" onClick={() => link.copy(pageUrl)} aria-label={tr({ zh: '复制', en: 'Copy' })}>
                {link.copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
              </button>
              <a className="cal-icon-btn" href={pageUrl} target="_blank" rel="noopener noreferrer" aria-label={tr({ zh: '打开', en: 'Open' })}>
                <ExternalLink size={15} aria-hidden />
              </a>
            </div>
          </div>

          <div className="cal-share-field">
            <span className="cal-field-label">{tr({ zh: '订阅地址(.ics)', en: 'Subscription URL (.ics)' })}</span>
            <div className="cal-share-link">
              <code>{feedUrl}</code>
              <button
                type="button"
                className="cal-icon-btn"
                aria-label={tr({ zh: '复制', en: 'Copy' })}
                onClick={() => feed.copy(feedUrl)}
              >
                {feed.copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
              </button>
            </div>
            <p className="cal-hint">
              {tr({
                zh: '在 Google / Apple 日历里选「通过网址订阅」粘贴即可,之后会自动同步。',
                en: 'Paste it into Google or Apple Calendar via “Subscribe from URL” — it keeps syncing.',
              })}
            </p>
          </div>
        </div>

        <div className="cal-modal-foot">
          <button type="button" className="cal-btn" disabled={busy} onClick={() => void run(onRotate)}>
            <RefreshCw size={15} aria-hidden />
            {tr({ zh: '换一条链接', en: 'Reset link' })}
          </button>
          <span className="cal-foot-gap" />
          <button type="button" className="cal-btn is-primary" onClick={close}>
            {tr({ zh: '完成', en: 'Done' })}
          </button>
        </div>
      </div>
    </div>
  );
}
