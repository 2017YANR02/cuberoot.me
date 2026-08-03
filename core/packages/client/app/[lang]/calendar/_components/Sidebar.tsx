'use client';

// 左栏:迷你月历(跳日期)+ 我的日历(显示/隐藏、改名改色、删)+ 待回应的邀请。
// 迷你月历直接用站内的 MonthGrid(/wca/comp 与首页日历同一个),不另造一个月网格。

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, Pencil, Check } from 'lucide-react';
import MonthGrid from '@/components/MonthGrid';
import { tr } from '@/i18n/tr';
import { CALENDAR_COLOR_DEFS, colorHex, colorName } from '@/lib/calendar-colors';
import { useLang } from '@/i18n/tr';
import type { CalendarMeta, CalEvent } from '@cuberoot/shared/calendar';
import { dayKeyIn } from '../_lib/format';

interface Props {
  calendars: CalendarMeta[];
  hidden: number[];
  /** 迷你月历当前锚点(绝对时刻) */
  anchor: number;
  tz: string;
  weekStart: 0 | 1;
  /** 有日程的日子打点 */
  busyDays: Set<string>;
  /** 待我回应的邀请 */
  invites: CalEvent[];
  onPickDate: (ms: number) => void;
  onToggle: (id: number) => void;
  /** 新建日程(Google 那个左上角的「创建」) */
  onCreate: () => void;
  onAdd: () => void;
  onRename: (id: number, name: string) => void;
  onRecolor: (id: number, color: string) => void;
  onRemove: (id: number) => void;
  onOpenInvite: (e: CalEvent) => void;
}

const WEEKDAY_LABELS = [
  { zh: '日', en: 'S' }, { zh: '一', en: 'M' }, { zh: '二', en: 'T' }, { zh: '三', en: 'W' },
  { zh: '四', en: 'T' }, { zh: '五', en: 'F' }, { zh: '六', en: 'S' },
];

export default function Sidebar(props: Props) {
  const isZh = useLang() === 'zh';
  const [mini, setMini] = useState(() => new Date(props.anchor));
  const [editing, setEditing] = useState<number | null>(null);
  const [draftName, setDraftName] = useState('');
  const [pickingColor, setPickingColor] = useState<number | null>(null);

  const weekdays = (props.weekStart === 1
    ? [1, 2, 3, 4, 5, 6, 0]
    : [0, 1, 2, 3, 4, 5, 6]).map((i) => tr(WEEKDAY_LABELS[i]));

  const monthLabel = new Intl.DateTimeFormat(isZh ? 'zh-CN' : 'en-US', {
    year: 'numeric', month: 'long',
  }).format(mini);

  const shift = (months: number): void => {
    setMini((cur) => new Date(cur.getFullYear(), cur.getMonth() + months, 1));
  };

  return (
    <aside className="cal-sidebar">
      {/* Google 把「创建」放在左栏最上面,不是右下角的悬浮钮 —— 那个只在窄屏留着。 */}
      <button type="button" className="cal-create-btn" onClick={props.onCreate}>
        <Plus size={20} aria-hidden />
        {tr({ zh: '创建', en: 'Create' })}
      </button>

      <div className="cal-mini">
        <div className="cal-mini-head">
          <span className="cal-mini-title">{monthLabel}</span>
          <button type="button" className="cal-icon-btn" onClick={() => shift(-1)} aria-label={tr({ zh: '上个月', en: 'Previous month' })}>
            <ChevronLeft size={16} aria-hidden />
          </button>
          <button type="button" className="cal-icon-btn" onClick={() => shift(1)} aria-label={tr({ zh: '下个月', en: 'Next month' })}>
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
        <MonthGrid
          className="cal-mini-grid"
          year={mini.getFullYear()}
          month={mini.getMonth() + 1}
          weekStart={props.weekStart === 1 ? 'mon' : 'sun'}
          weekdays={weekdays}
          dayCellProps={(date) => ({
            role: 'button',
            tabIndex: 0,
            onClick: () => props.onPickDate(date.getTime()),
            onKeyDown: (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                props.onPickDate(date.getTime());
              }
            },
          })}
          renderDay={(date) => {
            const key = dayKeyIn(props.tz, date.getTime());
            return (
              <span className={`cal-mini-day${props.busyDays.has(key) ? ' has-events' : ''}`}>
                {date.getDate()}
              </span>
            );
          }}
        />
      </div>

      <div className="cal-side-block">
        <div className="cal-side-head">
          <span>{tr({ zh: '我的日历', en: 'My calendars' })}</span>
          <button type="button" className="cal-icon-btn" onClick={props.onAdd} aria-label={tr({ zh: '新建日历', en: 'New calendar' })}>
            <Plus size={16} aria-hidden />
          </button>
        </div>
        <ul className="cal-list">
          {props.calendars.map((c) => {
            const on = !props.hidden.includes(c.id);
            return (
              <li key={c.id} className="cal-list-row">
                {editing === c.id ? (
                  <>
                    <input
                      className="cal-inline-input"
                      value={draftName}
                      autoFocus
                      maxLength={80}
                      onChange={(e) => setDraftName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { props.onRename(c.id, draftName); setEditing(null); }
                        if (e.key === 'Escape') setEditing(null);
                      }}
                    />
                    <button
                      type="button"
                      className="cal-icon-btn"
                      aria-label={tr({ zh: '保存', en: 'Save' })}
                      onClick={() => { props.onRename(c.id, draftName); setEditing(null); }}
                    >
                      <Check size={15} aria-hidden />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className={`cal-tick${on ? ' is-on' : ''}`}
                      style={{ '--tick': colorHex(c.color) } as React.CSSProperties}
                      aria-pressed={on}
                      aria-label={c.name || tr({ zh: '我的日历', en: 'My calendar' })}
                      onClick={() => props.onToggle(c.id)}
                    >
                      <Check size={12} aria-hidden />
                    </button>
                    <span className={`cal-list-name${on ? '' : ' is-off'}`}>
                      {c.name || tr({ zh: '我的日历', en: 'My calendar' })}
                    </span>
                    <button
                      type="button"
                      className="cal-icon-btn cal-row-action"
                      aria-label={tr({ zh: '重命名', en: 'Rename' })}
                      onClick={() => { setEditing(c.id); setDraftName(c.name); }}
                    >
                      <Pencil size={13} aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="cal-icon-btn cal-row-action"
                      aria-label={tr({ zh: '换颜色', en: 'Change colour' })}
                      onClick={() => setPickingColor(pickingColor === c.id ? null : c.id)}
                    >
                      <span className="cal-dot" style={{ background: colorHex(c.color) }} aria-hidden />
                    </button>
                    {!c.isDefault && (
                      <button
                        type="button"
                        className="cal-icon-btn cal-row-action"
                        aria-label={tr({ zh: '删除日历', en: 'Delete calendar' })}
                        onClick={() => props.onRemove(c.id)}
                      >
                        <Trash2 size={13} aria-hidden />
                      </button>
                    )}
                  </>
                )}
                {pickingColor === c.id && (
                  <div className="cal-swatches cal-row-swatches">
                    {CALENDAR_COLOR_DEFS.map((col) => (
                      <button
                        key={col.key}
                        type="button"
                        className={`cal-swatch${c.color === col.key ? ' is-on' : ''}`}
                        style={{ background: col.hex }}
                        title={colorName(col.key, isZh)}
                        aria-label={colorName(col.key, isZh)}
                        onClick={() => { props.onRecolor(c.id, col.key); setPickingColor(null); }}
                      />
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {props.invites.length > 0 && (
        <div className="cal-side-block">
          <div className="cal-side-head">
            <span>{tr({ zh: '待回应的邀请', en: 'Invitations' })}</span>
          </div>
          <ul className="cal-list">
            {props.invites.map((e) => (
              <li key={e.id} className="cal-list-row">
                <button type="button" className="cal-invite-btn" onClick={() => props.onOpenInvite(e)}>
                  <span className="cal-dot" style={{ background: colorHex(e.color || 'graphite') }} aria-hidden />
                  <span className="cal-list-name">{e.title || tr({ zh: '(无标题)', en: '(No title)' })}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
