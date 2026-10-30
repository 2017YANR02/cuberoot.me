'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { parseAsBoolean, parseAsString, useQueryState } from 'nuqs';
import FullCalendar from '@fullcalendar/react';
import type { EventApi } from '@fullcalendar/core';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import luxonPlugin from '@fullcalendar/luxon3';
import zhCn from '@fullcalendar/core/locales/zh-cn';
import { ArrowRight, Check, ChevronLeft, ChevronRight, Copy, X } from '@app-foundation/icons/lucide';
import { dateKey, isValidZone, timeKey, wallPartsIn } from '@cuberoot/shared/tz';
import { DateInput } from '@/components/DateInput';
import { ListSelect, type ListSelectItem } from '@/components/ListSelect';
import { useCopy } from '@/hooks/useCopy';
import { tr, useLang } from '@/i18n/tr';
import { zoneLabel } from '@/lib/tz-zones';
import { mergeRanges, readRanges, resolveRange, shiftDate, wallAt, weekMinute, weekOf, writeRanges, type AvailabilityRange } from '../_lib/availability';

const BEIJING = 'Asia/Shanghai';
const PLUGINS = [timeGridPlugin, interactionPlugin, luxonPlugin];
const CLOCK = { hour: '2-digit', minute: '2-digit', hour12: false } as const;

function AvailabilityBlock({ time, label, deleting, onEdit, onDelete }: {
  time: string; label: string; deleting: boolean; onEdit: () => void; onDelete: () => void;
}) {
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const cancelHold = () => { if (hold.current !== null) clearTimeout(hold.current); hold.current = null; };
  useEffect(() => cancelHold, []);

  return <div className="tz-availability-block" onContextMenu={(event) => event.preventDefault()}>
    <button type="button" className="tz-availability-body"
      aria-label={tr({ zh: `${label}，长按删除`, en: `${label}, hold to delete` })}
      onPointerDown={(event) => {
        cancelHold();
        if (!event.isPrimary || event.button !== 0 || deleting) return;
        origin.current = { x: event.clientX, y: event.clientY };
        hold.current = setTimeout(() => { hold.current = null; onEdit(); }, 550);
      }}
      onPointerMove={(event) => { if (Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > 6) cancelHold(); }}
      onPointerUp={cancelHold} onPointerCancel={cancelHold} onPointerLeave={cancelHold} onBlur={cancelHold}
      onClick={(event) => { if (event.detail === 0) onEdit(); }}>
      {time}
    </button>
    {deleting && <button type="button" className="tz-availability-delete"
      aria-label={tr({ zh: `删除时段 ${label}`, en: `Delete range ${label}` })}
      onMouseDown={(event) => event.stopPropagation()} onTouchStart={(event) => event.stopPropagation()}
      onClick={(event) => { event.stopPropagation(); onDelete(); }}><X size={14} aria-hidden="true" /></button>}
  </div>;
}

/** Local availability is a weekly pattern; changing the week recalculates its UTC instants. */
function AvailabilityPlanner({ today, zoneItems }: { today: string; zoneItems: ListSelectItem[] }) {
  const isZh = useLang() === 'zh';
  const [sourceRaw, setSource] = useQueryState('from', parseAsString.withDefault('Europe/Berlin'));
  const [weekRaw, setWeek] = useQueryState('week', parseAsString.withDefault(''));
  const [rangesRaw, setRanges] = useQueryState('slots', parseAsString.withDefault(''));
  const [converted, setConverted] = useQueryState('cn', parseAsBoolean.withDefault(false));
  const [manualDay, setManualDay] = useState(6);
  const [manualStart, setManualStart] = useState('09:00');
  const [manualEnd, setManualEnd] = useState('12:00');
  const [error, setError] = useState('');
  const [deleteMode, setDeleteMode] = useState(false);
  const calendar = useRef<FullCalendar>(null);
  const { copied, copy } = useCopy();
  const source = isValidZone(sourceRaw) ? sourceRaw : 'Europe/Berlin';
  const week = weekOf(weekRaw) || weekOf(today)!;
  const zone = converted ? BEIJING : source;
  const ranges = useMemo(() => readRanges(rangesRaw), [rangesRaw]);
  const deleting = deleteMode && ranges.length > 0;
  useEffect(() => { setDeleteMode(false); }, [week, source, converted]);
  useEffect(() => {
    if (!deleting) return;
    const dismiss = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('.tz-availability-block, .tz-delete-done')) setDeleteMode(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setDeleteMode(false); };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [deleting]);
  // The clock section's offsets describe its own date, not necessarily this selected week.
  const sourceItems = useMemo(() => zoneItems.map((item) => ({ ...item, hint: undefined })), [zoneItems]);
  const resolved = useMemo(() => ranges.map((range) => ({ range, instant: resolveRange(week, source, range) })), [ranges, week, source]);
  const invalid = resolved.some((r) => !r.instant);
  const zoneName = (tz: string) => tz === BEIJING ? tr({ zh: '北京时间', en: 'Beijing time' }) : zoneLabel(tz, isZh);
  const dateLabel = (date: string) => new Intl.DateTimeFormat(tr({ zh: 'zh-CN', en: 'en-GB' }), {
    timeZone: 'UTC', month: 'numeric', day: 'numeric', weekday: 'short',
  }).format(new Date(`${date}T12:00:00Z`));
  const instantLabel = (at: Date, tz: string) => {
    const p = wallPartsIn(tz, at);
    return `${dateLabel(dateKey(p))} ${timeKey(p)}`;
  };
  const rangeLabel = (start: Date, end: Date, tz: string) => {
    const a = wallPartsIn(tz, start);
    const b = wallPartsIn(tz, end);
    return `${instantLabel(start, tz)} – ${dateKey(a) === dateKey(b) ? timeKey(b) : instantLabel(end, tz)}`;
  };
  const sourceLabel = (range: AvailabilityRange) => {
    const a = wallAt(week, range.start);
    const b = wallAt(week, range.end);
    return `${dateLabel(dateKey(a))} ${timeKey(a)} – ${dateKey(a) === dateKey(b) ? timeKey(b) : `${dateLabel(dateKey(b))} ${timeKey(b)}`}`;
  };
  const dstError = tr({ zh: '该时段的起止时间遇到夏令时跳时或重复，请调整边界时间。', en: 'A boundary falls in a skipped or repeated DST hour. Adjust that boundary.' });
  const rangeError = tr({ zh: '请选择本周开始的时段，最晚可延续到下周一午夜。', en: 'Start within this week; a range can extend through the following Monday.' });

  function save(next: AvailabilityRange[]) {
    void setWeek(week); // Freeze the date so shared selections never drift with “today”.
    void setRanges(writeRanges(next) || null);
    setError('');
    if (!next.length) setDeleteMode(false);
  }
  function add(range: AvailabilityRange) {
    const valid = mergeRanges([range]);
    if (!valid.length) { setError(rangeError); return; }
    if (!resolveRange(week, source, range)) { setError(dstError); return; }
    save([...ranges, range]);
    calendar.current?.getApi().unselect();
  }
  function move({ event, revert }: { event: EventApi; revert: () => void }) {
    if (deleting) { revert(); return; }
    if (!event.start || !event.end) { revert(); return; }
    const range = { start: weekMinute(week, source, event.start), end: weekMinute(week, source, event.end) };
    if (!mergeRanges([range]).length) { revert(); setError(rangeError); return; }
    if (!resolveRange(week, source, range)) { revert(); setError(dstError); return; }
    save(ranges.map((old, i) => i === Number(event.id) ? range : old));
  }
  const events = useMemo(() => resolved.flatMap(({ range, instant }, index) => instant ? [{
    id: String(index), start: instant.start, end: instant.end,
    title: '', extendedProps: { range },
  }] : []), [resolved]);
  // Keep any converted Sunday→Monday (or Monday→Sunday) spill visible.
  const visibleDates = resolved.flatMap(({ instant }) => instant ? [
    dateKey(wallPartsIn(zone, instant.start)), dateKey(wallPartsIn(zone, new Date(+instant.end - 1))),
  ] : []);
  const first = [week, ...visibleDates].sort()[0];
  const last = [shiftDate(week, 6), ...visibleDates].sort().at(-1)!;
  const scrollHour = converted && events.length
    ? Math.max(0, wallPartsIn(zone, events[0].start).h - 1) : 7;
  const summary = resolved.map(({ range, instant }) => `${zoneName(source)} ${sourceLabel(range)}\n${zoneName(BEIJING)} ${instant ? rangeLabel(instant.start, instant.end, BEIJING) : dstError}`).join('\n\n');

  return (
    <section className="tz-planner" aria-labelledby="tz-planner-title">
      <div className="tz-planner-heading">
        <h2 id="tz-planner-title">{tr({ zh: '画出可用时段', en: 'Draw your availability' })}</h2>
        <span className="tz-planner-step">{tr({ zh: '当地时间 → 北京时间', en: 'Local time → Beijing time' })}</span>
      </div>
      <div className="tz-planner-controls">
        <div className="tz-field">
          <span className="tz-field-label">{tr({ zh: '对方所在时区', en: 'Their time zone' })}</span>
          <ListSelect items={sourceItems} value={source} searchable clearable={false} maxVisible={60}
            allLabel={tr({ zh: '选择时区', en: 'Choose time zone' })}
            searchPlaceholder={tr({ zh: '搜索国家 / 城市', en: 'Search country / city' })}
            onChange={(value) => { if (value) { void setSource(value); void setConverted(false); setError(''); } }} />
        </div>
        <div className="tz-field">
          <span className="tz-field-label">{tr({ zh: '查看哪一周', en: 'Week to compare' })}</span>
          <div className="tz-week-nav">
            <button type="button" className="tz-now-btn" aria-label={tr({ zh: '上一周', en: 'Previous week' })} onClick={() => { void setWeek(shiftDate(week, -7)); setError(''); }}><ChevronLeft size={16} /></button>
            <DateInput value={week} onChange={(value) => { const next = weekOf(value); if (next) { void setWeek(next); setError(''); } }} />
            <button type="button" className="tz-now-btn" aria-label={tr({ zh: '下一周', en: 'Next week' })} onClick={() => { void setWeek(shiftDate(week, 7)); setError(''); }}><ChevronRight size={16} /></button>
          </div>
        </div>
        <button type="button" className="tz-convert-btn" disabled={!converted && (!ranges.length || invalid)} onClick={() => void setConverted(!converted)}>
          <ArrowRight size={16} aria-hidden="true" />
          {converted ? tr({ zh: '回到当地时间编辑', en: 'Edit in local time' }) : tr({ zh: '换算为北京时间', en: 'Convert to Beijing time' })}
        </button>
      </div>
      <div className="tz-planner-caption">
        <strong>{zoneName(zone)}</strong>
        <span>{dateLabel(first)} – {dateLabel(last)}</span>
        {deleting && <button type="button" className="tz-window-pick tz-delete-done" onClick={() => setDeleteMode(false)}>{tr({ zh: '完成', en: 'Done' })}</button>}
        <button type="button" className="tz-window-pick" disabled={!ranges.length} onClick={() => save([])}>{tr({ zh: '清空', en: 'Clear' })}</button>
      </div>
      <div className={`tz-planner-scroll${converted ? ' is-converted' : ''}`}>
        <div className={`tz-planner-calendar${deleting ? ' is-deleting' : ''}`}>
          <FullCalendar ref={calendar} key={`${week}:${zone}:${converted}`} plugins={PLUGINS}
            initialView="timeGrid" initialDate={week} visibleRange={{ start: first, end: shiftDate(last, 1) }}
            timeZone={zone} locale={isZh ? zhCn : 'en'} headerToolbar={false} height={460}
            allDaySlot={false} nowIndicator={false} dayHeaderFormat={{ weekday: 'short', month: 'numeric', day: 'numeric' }}
            slotDuration="00:30:00" snapDuration="00:15:00" slotLabelInterval="01:00:00"
            slotLabelFormat={CLOCK} eventTimeFormat={CLOCK} scrollTime={`${String(scrollHour).padStart(2, '0')}:00:00`}
            selectable={!converted && !deleting} selectMirror selectMinDistance={3} selectLongPressDelay={250}
            editable={!converted && !deleting} eventLongPressDelay={750} eventResizableFromStart events={events}
            eventContent={(arg) => arg.isMirror ? <span className="fc-event-time">{arg.timeText}</span> : <AvailabilityBlock time={arg.timeText}
              label={sourceLabel(arg.event.extendedProps.range as AvailabilityRange)} deleting={deleting}
              onEdit={() => setDeleteMode(true)}
              onDelete={() => save(ranges.filter((_, index) => index !== Number(arg.event.id)))} />}
            select={(arg) => add({ start: weekMinute(week, source, arg.start), end: weekMinute(week, source, arg.end) })}
            eventDrop={move} eventResize={move}
          />
        </div>
      </div>
      {(error || invalid) && <p role="alert" className="tz-planner-error">{error || dstError}</p>}
      <div className="tz-planner-tools">
        <details>
          <summary>{tr({ zh: '精确添加 / 操作说明', en: 'Exact times / help' })}</summary>
          <p className="tz-note">{tr({ zh: '在空白处拖出时段，可连续添加；拖动色块或边缘可调整。长按色块进入删除模式，点空白处或按 Esc 退出；键盘聚焦色块后按 Enter 也可进入。每格半小时，拖选精确到 15 分钟。换周保留当地时段，按新日期重新换算；结束早于开始表示跨夜。', en: 'Drag empty space to add ranges; drag blocks or edges to adjust. Hold a block, or focus it and press Enter, to show delete buttons. Click outside or press Esc to finish. Half-hour grid with 15-minute snapping. Changing weeks preserves local hours and recalculates the conversion. An earlier end means overnight.' })}</p>
          <form className="tz-manual-range" onSubmit={(event) => {
            event.preventDefault();
            if (converted) return;
            const minutes = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
            const a = minutes(manualStart); const b = minutes(manualEnd);
            if (a === b) { setError(tr({ zh: '开始和结束时间不能相同。', en: 'Start and end must differ.' })); return; }
            const range = { start: manualDay * 1440 + a, end: manualDay * 1440 + b + (b < a ? 1440 : 0) };
            add(range);
          }}>
            <label className="tz-field"><span className="tz-field-label">{tr({ zh: '日期', en: 'Day' })}</span>
              <select className="tz-input" value={manualDay} onChange={(e) => setManualDay(Number(e.target.value))}>{Array.from({ length: 7 }, (_, i) => <option key={i} value={i}>{dateLabel(shiftDate(week, i))}</option>)}</select>
            </label>
            <label className="tz-field"><span className="tz-field-label">{tr({ zh: '开始', en: 'Start' })}</span><input className="tz-input" type="time" required value={manualStart} onChange={(e) => setManualStart(e.target.value)} /></label>
            <label className="tz-field"><span className="tz-field-label">{tr({ zh: '结束', en: 'End' })}</span><input className="tz-input" type="time" required value={manualEnd} onChange={(e) => setManualEnd(e.target.value)} /></label>
            <button className="tz-now-btn" disabled={converted} type="submit">{tr({ zh: '添加时段', en: 'Add range' })}</button>
          </form>
        </details>
        {ranges.length > 0 && <button type="button" className="tz-copy-btn" disabled={invalid} onClick={() => copy(summary)}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? tr({ zh: '已复制', en: 'Copied' }) : tr({ zh: '复制两地时段', en: 'Copy both time zones' })}</button>}
      </div>
      <ul className="tz-planner-results" aria-live="polite">
        {resolved.map(({ range, instant }, index) => <li key={`${range.start}-${range.end}`}>
          <div><span>{zoneName(source)}</span><strong>{sourceLabel(range)}</strong></div>
          <ArrowRight size={16} aria-hidden="true" />
          <div className="tz-planner-result-cn"><span>{zoneName(BEIJING)}</span><strong>{instant ? rangeLabel(instant.start, instant.end, BEIJING) : dstError}</strong></div>
          <button type="button" className="tz-now-btn" aria-label={tr({ zh: `删除时段 ${sourceLabel(range)}`, en: `Remove ${sourceLabel(range)}` })} onClick={() => save(ranges.filter((_, i) => i !== index))}><X size={14} /></button>
        </li>)}
      </ul>
    </section>
  );
}

export default memo(AvailabilityPlanner);
