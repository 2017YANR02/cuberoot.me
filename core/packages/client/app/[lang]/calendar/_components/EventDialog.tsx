'use client';

// 新建 / 编辑日程的弹窗。字段顺序照 Google:标题 → 时间 → 重复 → 日历+颜色 →
// 地点 → 提醒 → 参与者 → 说明。
//
// 时间输入用原生 date/time 控件:手机上直接出系统滚轮,桌面端也能键盘输入,自己搓一个
// 只会更差。墙上时间 ↔ 绝对时刻的换算全走事件自己的时区(@cuberoot/shared/tz),
// 所以「北京时间 21:00 的会」在洛杉矶的人改起来也不会漂。

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Clock, MapPin, Palette, Repeat, Text, Trash2, Users, X, Globe } from 'lucide-react';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import { ListSelect } from '@/components/ListSelect';
import BoolToggle from '@/components/BoolToggle';
import { tr, useLang } from '@/i18n/tr';
import { wallPartsIn, wallToUtc, localZone, formatOffset, zoneOffsetMinutes } from '@cuberoot/shared/tz';
import { REMINDER_CHOICES, type CalendarMeta, type EventGuest } from '@cuberoot/shared/calendar';
import { CALENDAR_COLOR_DEFS, colorName } from '@/lib/calendar-colors';
import { zoneLabel, zoneOptions, zoneSearchTerms } from '@/lib/tz-zones';
import RepeatEditor from './RepeatEditor';
import GuestPicker from './GuestPicker';

export interface DialogDraft {
  /** 已存在的事件 id;新建为 0 */
  id: number;
  calendarId: number;
  title: string;
  description: string;
  location: string;
  allDay: boolean;
  start: number;
  end: number;
  tz: string;
  rrule: string;
  color: string;
  reminders: number[];
  guests: EventGuest[];
  /** 编辑重复事件时,当前点的是哪一次 */
  occurrenceMs?: number;
  /** 这条是别人邀请我的:只读 + 显示接受/拒绝 */
  readOnly?: boolean;
  /** 我在这条邀请里的状态 */
  myRsvp?: EventGuest['status'];
}

interface Props {
  draft: DialogDraft;
  calendars: CalendarMeta[];
  meKey: string;
  saving: boolean;
  onSave: (draft: DialogDraft) => void;
  onDelete?: (draft: DialogDraft) => void;
  onRespond?: (status: 'accepted' | 'declined') => void;
  onClose: () => void;
}

/** 绝对时刻 → `YYYY-MM-DD` / `HH:mm`(按事件时区),喂给原生输入控件。 */
function toInputs(ms: number, tz: string): { date: string; time: string } {
  const w = wallPartsIn(tz, new Date(ms));
  const p = (n: number): string => String(n).padStart(2, '0');
  return { date: `${w.y}-${p(w.mo)}-${p(w.d)}`, time: `${p(w.h)}:${p(w.mi)}` };
}

/** `YYYY-MM-DD` + `HH:mm` + 时区 → 绝对时刻;任一非法就返回原值。 */
function fromInputs(date: string, time: string, tz: string, fallback: number): number {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{1,2}):(\d{2})$/.exec(time || '00:00');
  if (!d || !t) return fallback;
  return wallToUtc(tz, {
    y: Number(d[1]), mo: Number(d[2]), d: Number(d[3]), h: Number(t[1]), mi: Number(t[2]), s: 0,
  }).getTime();
}

function reminderLabel(min: number): string {
  if (min === 0) return tr({ zh: '开始时', en: 'At start' });
  if (min < 60) return tr({ zh: `提前 ${min} 分钟`, en: `${min} minutes before` });
  if (min < 1440) return tr({ zh: `提前 ${min / 60} 小时`, en: `${min / 60} hours before` });
  if (min < 10080) return tr({ zh: `提前 ${min / 1440} 天`, en: `${min / 1440} days before` });
  return tr({ zh: `提前 ${min / 10080} 周`, en: `${min / 10080} weeks before` });
}

export default function EventDialog(props: Props) {
  const { calendars, meKey } = props;
  const isZh = useLang() === 'zh';
  const [d, setD] = useState<DialogDraft>(props.draft);
  const titleRef = useRef<HTMLInputElement>(null);
  const [showTz, setShowTz] = useState(false);
  useModalDismiss(props.onClose, props.saving);

  useEffect(() => { setD(props.draft); }, [props.draft]);
  useEffect(() => { titleRef.current?.focus(); }, []);

  const readOnly = !!d.readOnly;
  const startIn = toInputs(d.start, d.tz);
  const endIn = toInputs(d.allDay ? d.end - 1 : d.end, d.tz);   // 全天的 end 是次日 0 点,显示要减一天

  const patch = (p: Partial<DialogDraft>): void => setD((cur) => ({ ...cur, ...p }));

  /** 改开始时间:保持时长不变往后拖尾巴(和 Google 一致)。 */
  const setStart = (ms: number): void => {
    const dur = Math.max(60_000, d.end - d.start);
    patch({ start: ms, end: ms + dur });
  };

  const setEnd = (ms: number): void => {
    patch({ end: Math.max(ms, d.start + 60_000) });
  };

  const zoneItems = useMemo(() => zoneOptions().map((z) => ({
    value: z.tz,
    label: `${zoneLabel(z.tz, isZh)} ${formatOffset(zoneOffsetMinutes(z.tz, new Date(d.start)))}`,
    searchTerms: zoneSearchTerms(z),
  })), [d.start, isZh]);

  const calItems = calendars.map((c) => ({
    value: String(c.id),
    label: c.name || tr({ zh: '我的日历', en: 'My calendar' }),
  }));

  const canSave = !readOnly && d.calendarId > 0 && d.end > d.start;

  return (
    <div
      className="cal-modal-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !props.saving) props.onClose(); }}
    >
      <div className="cal-modal" role="dialog" aria-modal="true" aria-label={tr({ zh: '日程', en: 'Event' })}>
        <div className="cal-modal-head">
          <h2>
            {d.id
              ? (readOnly ? tr({ zh: '日程详情', en: 'Event' }) : tr({ zh: '编辑日程', en: 'Edit event' }))
              : tr({ zh: '新建日程', en: 'New event' })}
          </h2>
          <button type="button" className="cal-icon-btn" onClick={props.onClose} aria-label={tr({ zh: '关闭', en: 'Close' })}>
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="cal-modal-body">
          <input
            ref={titleRef}
            className="cal-title-input"
            type="text"
            value={d.title}
            readOnly={readOnly}
            maxLength={300}
            placeholder={tr({ zh: '添加标题', en: 'Add title' })}
            onChange={(e) => patch({ title: e.target.value })}
          />

          <div className="cal-field">
            <Clock size={16} className="cal-field-icon" aria-hidden />
            <div className="cal-field-main">
              <div className="cal-time-row">
                <input
                  type="date"
                  className="cal-date"
                  value={startIn.date}
                  readOnly={readOnly}
                  onChange={(e) => setStart(fromInputs(e.target.value, d.allDay ? '00:00' : startIn.time, d.tz, d.start))}
                />
                {!d.allDay && (
                  <input
                    type="time"
                    className="cal-time"
                    value={startIn.time}
                    readOnly={readOnly}
                    onChange={(e) => setStart(fromInputs(startIn.date, e.target.value, d.tz, d.start))}
                  />
                )}
                <span className="cal-time-dash">–</span>
                {!d.allDay && (
                  <input
                    type="time"
                    className="cal-time"
                    value={endIn.time}
                    readOnly={readOnly}
                    onChange={(e) => setEnd(fromInputs(endIn.date, e.target.value, d.tz, d.end))}
                  />
                )}
                <input
                  type="date"
                  className="cal-date"
                  value={endIn.date}
                  readOnly={readOnly}
                  onChange={(e) => {
                    const base = fromInputs(e.target.value, d.allDay ? '00:00' : endIn.time, d.tz, d.end);
                    setEnd(d.allDay ? base + 86_400_000 : base);
                  }}
                />
              </div>
              <div className="cal-time-opts">
                <BoolToggle
                  value={d.allDay}
                  disabled={readOnly}
                  label={tr({ zh: '全天', en: 'All day' })}
                  onChange={(v) => {
                    if (v) {
                      // 转全天:起点归到当天 0 点,终点是次日 0 点(半开区间)。
                      const w = wallPartsIn(d.tz, new Date(d.start));
                      const s = wallToUtc(d.tz, { ...w, h: 0, mi: 0, s: 0 }).getTime();
                      patch({ allDay: true, start: s, end: s + 86_400_000 });
                    } else {
                      const w = wallPartsIn(d.tz, new Date(d.start));
                      const s = wallToUtc(d.tz, { ...w, h: 9, mi: 0, s: 0 }).getTime();
                      patch({ allDay: false, start: s, end: s + 3_600_000 });
                    }
                  }}
                />
                <button type="button" className="cal-link-btn" onClick={() => setShowTz((v) => !v)}>
                  <Globe size={13} aria-hidden />
                  {zoneLabel(d.tz, isZh)}
                </button>
              </div>
              {showTz && (
                <div className="cal-field-row">
                  <ListSelect
                    items={zoneItems}
                    value={d.tz}
                    allLabel={tr({ zh: '时区', en: 'Time zone' })}
                    clearable={false}
                    searchable
                    maxVisible={80}
                    searchPlaceholder={tr({ zh: '搜城市 / 时区', en: 'Search city or zone' })}
                    onChange={(tzNext) => {
                      // 换时区保持**墙上时间**:21:00 的会改成东京时区,就是东京 21:00。
                      const sw = wallPartsIn(d.tz, new Date(d.start));
                      const ew = wallPartsIn(d.tz, new Date(d.end));
                      patch({
                        tz: tzNext,
                        start: wallToUtc(tzNext, sw).getTime(),
                        end: wallToUtc(tzNext, ew).getTime(),
                      });
                    }}
                  />
                  {d.tz !== localZone() && (
                    <span className="cal-hint">
                      {tr({ zh: '本机时区不同,格子里按显示时区摆放', en: 'Differs from your device zone; the grid places it in the display zone' })}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {!readOnly && (
            <div className="cal-field">
              <Repeat size={16} className="cal-field-icon" aria-hidden />
              <div className="cal-field-main">
                <RepeatEditor value={d.rrule} start={d.start} tz={d.tz} onChange={(rrule) => patch({ rrule })} />
              </div>
            </div>
          )}

          <div className="cal-field">
            <Palette size={16} className="cal-field-icon" aria-hidden />
            <div className="cal-field-main cal-field-inline">
              <ListSelect
                items={calItems}
                value={String(d.calendarId)}
                allLabel={tr({ zh: '日历', en: 'Calendar' })}
                clearable={false}
                onChange={(v) => patch({ calendarId: Number(v) })}
              />
              <div className="cal-swatches">
                <button
                  type="button"
                  className={`cal-swatch is-auto${d.color ? '' : ' is-on'}`}
                  title={tr({ zh: '跟随日历', en: 'Calendar default' })}
                  aria-label={tr({ zh: '跟随日历颜色', en: 'Use calendar colour' })}
                  aria-pressed={!d.color}
                  onClick={() => patch({ color: '' })}
                />
                {CALENDAR_COLOR_DEFS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className={`cal-swatch${d.color === c.key ? ' is-on' : ''}`}
                    style={{ background: c.hex }}
                    title={colorName(c.key, isZh)}
                    aria-label={colorName(c.key, isZh)}
                    aria-pressed={d.color === c.key}
                    onClick={() => patch({ color: c.key })}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="cal-field">
            <MapPin size={16} className="cal-field-icon" aria-hidden />
            <input
              className="cal-text-input"
              type="text"
              value={d.location}
              readOnly={readOnly}
              maxLength={300}
              placeholder={tr({ zh: '添加地点', en: 'Add location' })}
              onChange={(e) => patch({ location: e.target.value })}
            />
          </div>

          <div className="cal-field">
            <Bell size={16} className="cal-field-icon" aria-hidden />
            <div className="cal-field-main">
              {d.reminders.length === 0 && (
                <button
                  type="button"
                  className="cal-link-btn"
                  disabled={readOnly}
                  onClick={() => patch({ reminders: [30] })}
                >
                  {tr({ zh: '添加提醒', en: 'Add reminder' })}
                </button>
              )}
              {d.reminders.map((m, i) => (
                <div className="cal-field-row" key={`${m}-${i}`}>
                  <ListSelect
                    items={REMINDER_CHOICES.map((x) => ({ value: String(x), label: reminderLabel(x) }))}
                    value={String(m)}
                    allLabel=""
                    clearable={false}
                    onChange={(v) => {
                      const next = [...d.reminders];
                      next[i] = Number(v);
                      patch({ reminders: [...new Set(next)].sort((a, b) => a - b) });
                    }}
                  />
                  <button
                    type="button"
                    className="cal-icon-btn"
                    disabled={readOnly}
                    aria-label={tr({ zh: '删除提醒', en: 'Remove reminder' })}
                    onClick={() => patch({ reminders: d.reminders.filter((_, j) => j !== i) })}
                  >
                    <X size={14} aria-hidden />
                  </button>
                  {i === d.reminders.length - 1 && d.reminders.length < 5 && (
                    <button
                      type="button"
                      className="cal-link-btn"
                      disabled={readOnly}
                      onClick={() => patch({ reminders: [...d.reminders, 1440].filter((x, j, a) => a.indexOf(x) === j) })}
                    >
                      {tr({ zh: '再加一条', en: 'Add another' })}
                    </button>
                  )}
                </div>
              ))}
              <p className="cal-hint">
                {tr({ zh: '提醒发到站内消息(以及你设置的通知邮箱)', en: 'Reminders arrive as site notifications (and email, if enabled)' })}
              </p>
            </div>
          </div>

          <div className="cal-field">
            <Users size={16} className="cal-field-icon" aria-hidden />
            <div className="cal-field-main">
              <GuestPicker
                guests={d.guests}
                meKey={meKey}
                disabled={readOnly}
                onChange={(guests) => patch({ guests })}
              />
            </div>
          </div>

          <div className="cal-field">
            <Text size={16} className="cal-field-icon" aria-hidden />
            <textarea
              className="cal-textarea"
              value={d.description}
              readOnly={readOnly}
              maxLength={5000}
              rows={3}
              placeholder={tr({ zh: '添加说明', en: 'Add description' })}
              onChange={(e) => patch({ description: e.target.value })}
            />
          </div>
        </div>

        <div className="cal-modal-foot">
          {d.id > 0 && !readOnly && props.onDelete && (
            <button
              type="button"
              className="cal-btn is-danger"
              disabled={props.saving}
              onClick={() => props.onDelete?.(d)}
            >
              <Trash2 size={15} aria-hidden />
              {tr({ zh: '删除', en: 'Delete' })}
            </button>
          )}
          {readOnly && props.onRespond && (
            <div className="cal-rsvp">
              <span className="cal-hint">{tr({ zh: '参加吗?', en: 'Going?' })}</span>
              <button
                type="button"
                className={`cal-btn${d.myRsvp === 'accepted' ? ' is-primary' : ''}`}
                onClick={() => props.onRespond?.('accepted')}
              >
                {tr({ zh: '接受', en: 'Yes' })}
              </button>
              <button
                type="button"
                className={`cal-btn${d.myRsvp === 'declined' ? ' is-primary' : ''}`}
                onClick={() => props.onRespond?.('declined')}
              >
                {tr({ zh: '拒绝', en: 'No' })}
              </button>
            </div>
          )}
          <span className="cal-foot-gap" />
          <button type="button" className="cal-btn" onClick={props.onClose} disabled={props.saving}>
            {tr({ zh: '取消', en: 'Cancel' })}
          </button>
          {!readOnly && (
            <button
              type="button"
              className="cal-btn is-primary"
              disabled={!canSave || props.saving}
              onClick={() => props.onSave(d)}
            >
              {props.saving ? tr({ zh: '保存中…', en: 'Saving…' }) : tr({ zh: '保存', en: 'Save' })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
