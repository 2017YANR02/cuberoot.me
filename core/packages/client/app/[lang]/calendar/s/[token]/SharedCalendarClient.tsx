'use client';

// 别人分享出来的日历(只读)。
//
// 两档信息量由**服务端**决定:full 发完整内容,busy 只发时间段(标题等字段根本不在
// 响应里)。所以这一页不需要、也没法「小心不要渲染标题」—— 拿到什么就画什么。
//
// token 从 window.location 读(哨兵壳,服务端拿不到路由参数)。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Link2, Check, Copy } from 'lucide-react';
import BackHome from '@/components/BackHome';
import HeaderToggles from '@/components/HeaderToggles';
import { ListSelect } from '@/components/ListSelect';
import { useCopy } from '@/hooks/useCopy';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr, useLang } from '@/i18n/tr';
import { localZone, isValidZone } from '@cuberoot/shared/tz';
import { colorHex, readableInk } from '@/lib/calendar-colors';
import { expandRange } from '@/lib/calendar-store';
import { fetchPublicCalendar, icsFeedUrl, type PublicCalendar } from '@/lib/calendar-api';
import CalendarGrid, { type GridHandle, type GridRange } from '../../_components/CalendarGrid';
import {
  rangeTitle, toFcEvents, VIEW_KEYS, VIEW_LABELS, isViewKey, type ViewKey,
} from '../../_lib/format';
import '../../calendar.css';

const DAY = 86_400_000;

/** 从 /calendar/s/<token>(可能带 /zh 前缀)里取 token。 */
function tokenFromPath(): string {
  if (typeof window === 'undefined') return '';
  const m = /\/calendar\/s\/([^/?#]+)/.exec(window.location.pathname);
  const raw = m ? decodeURIComponent(m[1]) : '';
  return /^[A-Za-z0-9_-]{8,32}$/.test(raw) ? raw : '';
}

export default function SharedCalendarClient() {
  const isZh = useLang() === 'zh';
  const gridRef = useRef<GridHandle>(null);
  const { copied, copy } = useCopy();

  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState('');
  const [data, setData] = useState<PublicCalendar | null>(null);
  const [error, setError] = useState('');
  const [view, setView] = useState<ViewKey>('dayGridMonth');
  const [range, setRange] = useState<GridRange>(() => ({
    start: Date.now() - 30 * DAY, end: Date.now() + 30 * DAY, anchor: Date.now(),
  }));

  useEffect(() => {
    setMounted(true);
    setToken(tokenFromPath());
  }, []);

  useEffect(() => {
    if (!token) return;
    const now = Date.now();
    fetchPublicCalendar(token, now - 200 * DAY, now + 400 * DAY)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [token]);

  const displayTz = useMemo(() => {
    if (!mounted) return 'UTC';
    return localZone();
  }, [mounted]);

  const eventTz = data && isValidZone(data.tz) ? data.tz : displayTz;

  // 分享页的标题只有客户端知道(服务端拿不到 token),所以这里保留 useDocumentTitle。
  const pageTitle = data?.title
    || (data?.ownerName ? tr({ zh: `${data.ownerName} 的日历`, en: `${data.ownerName}’s calendar` }) : '');
  useDocumentTitle(
    pageTitle || tr({ zh: '共享日历', en: 'Shared calendar' }),
    pageTitle || 'Shared calendar',
  );

  const calColor = useCallback((id: number) => {
    const c = data?.calendars.find((x) => x.id === id);
    return colorHex(c?.color ?? 'graphite');
  }, [data]);

  const busyLabel = tr({ zh: '忙碌', en: 'Busy' });

  const fcEvents = useMemo(() => {
    if (!data) return [];
    const occurrences = expandRange({
      events: data.events, hidden: [], from: range.start, to: range.end,
    });
    return toFcEvents({
      occurrences,
      calendarColor: calColor,
      colorHex,
      readableInk,
      meKey: '',
      readOnly: true,
      busyLabel: data.detail === 'busy' ? busyLabel : undefined,
    });
  }, [data, range.start, range.end, calColor, busyLabel]);

  const shareUrl = typeof window === 'undefined' ? '' : window.location.href;

  if (mounted && !token) {
    return (
      <div className="cal-page">
        <div className="cal-topbar">
          <BackHome />
          <h1 className="cal-brand"><CalendarDays size={20} aria-hidden />{tr({ zh: '共享日历', en: 'Shared calendar' })}</h1>
          <span className="cal-foot-gap" />
          <HeaderToggles />
        </div>
        <div className="cal-empty">{tr({ zh: '链接不完整。', en: 'That link looks incomplete.' })}</div>
      </div>
    );
  }

  return (
    <div className="cal-page">
      <div className="cal-topbar">
        <BackHome />
        <h1 className="cal-brand">
          <CalendarDays size={20} aria-hidden />
          {pageTitle || tr({ zh: '共享日历', en: 'Shared calendar' })}
        </h1>
        {data?.detail === 'busy' && (
          <span className="cal-badge">{tr({ zh: '仅显示忙碌时段', en: 'Busy times only' })}</span>
        )}

        <button type="button" className="cal-btn" onClick={() => gridRef.current?.today()}>
          {tr({ zh: '今天', en: 'Today' })}
        </button>
        <button type="button" className="cal-icon-btn" onClick={() => gridRef.current?.prev()} aria-label={tr({ zh: '上一页', en: 'Previous' })}>
          <ChevronLeft size={18} aria-hidden />
        </button>
        <button type="button" className="cal-icon-btn" onClick={() => gridRef.current?.next()} aria-label={tr({ zh: '下一页', en: 'Next' })}>
          <ChevronRight size={18} aria-hidden />
        </button>
        <span className="cal-range-title">
          {mounted ? rangeTitle(view, range.anchor, displayTz, isZh, range.start, range.end) : ''}
        </span>

        <ListSelect
          className="cal-view-select"
          items={VIEW_KEYS.map((v) => ({ value: v, label: tr(VIEW_LABELS[v]) }))}
          value={view}
          allLabel=""
          clearable={false}
          onChange={(v) => { if (isViewKey(v)) setView(v); }}
        />
        <button
          type="button"
          className="cal-icon-btn"
          aria-label={tr({ zh: '复制链接', en: 'Copy link' })}
          onClick={() => copy(shareUrl)}
        >
          {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
        </button>
        <HeaderToggles />
      </div>

      <div className="cal-body">
        <main className="cal-main">
          {error && <div className="cal-empty">{tr({ zh: '这个分享链接无效或已关闭。', en: 'This share link is invalid or has been turned off.' })}</div>}
          {!error && mounted && (
            <CalendarGrid
              ref={gridRef}
              view={view}
              initialDate={Date.now()}
              events={fcEvents}
              tz={displayTz}
              isZh={isZh}
              hour24
              weekStart={1}
              weekends
              editable={false}
              onEventClick={() => { /* 只读:点击不展开详情 */ }}
              onRangeChange={setRange}
            />
          )}
        </main>
      </div>

      {data && (
        <div className="cal-share-foot">
          <Link2 size={13} aria-hidden />
          <span>{tr({ zh: '按你所在时区显示', en: 'Shown in your time zone' })}:{displayTz}</span>
          <a href={icsFeedUrl(token)} className="cal-link-btn">
            {tr({ zh: '订阅这个日历(.ics)', en: 'Subscribe (.ics)' })}
          </a>
          {eventTz !== displayTz && (
            <span>{tr({ zh: `原始时区 ${eventTz}`, en: `Source zone ${eventTz}` })}</span>
          )}
        </div>
      )}
    </div>
  );
}
