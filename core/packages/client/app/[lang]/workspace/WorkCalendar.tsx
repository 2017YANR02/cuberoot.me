'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { parseAsString, parseAsStringEnum, useQueryState } from 'nuqs';
import { ErrorNotice, Field, Form, useResource, useWorkspace } from '@app-foundation/workspace-ui';
import type { EventInput } from '@fullcalendar/core';
import { activeWorkPeriod, expandWorkCalendar, shiftWorkDate, workCalendarColor, workDate, workSlotsValid, WORK_CALENDAR_DEFAULT_ZONE, type WorkCalendarData, type WorkPeriod, type WorkSlot } from '@cuberoot/shared/workspace-planning';
import { wallPartsIn } from '@cuberoot/shared/tz';
import CalendarGrid, { type GridHandle, type GridRange } from '@/components/calendar/CalendarGrid';
import { DateInput } from '@/components/DateInput';
import { ListSelect } from '@/components/ListSelect';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { useEffectiveTheme } from '@/lib/theme';
import { colorHex, readableInk } from '@/lib/calendar-colors';
import { rangeTitle, type ViewKey } from '@/lib/calendar-format';
import { zoneLabel, zoneOptions, zoneSearchTerms } from '@/lib/tz-zones';
import { WorkspaceButton as Button, WorkspaceDialog } from './WorkspaceControls';
import './work-calendar.css';

const hours = Array.from({ length: 25 }, (_, i) => i);
const clock = (hour: number) => `${String(hour).padStart(2, '0')}:00`;
const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
function useWeekdays() {
  const t = useT();
  return [t('周日', 'Sunday'), t('周一', 'Monday'), t('周二', 'Tuesday'), t('周三', 'Wednesday'), t('周四', 'Thursday'), t('周五', 'Friday'), t('周六', 'Saturday')];
}
function ZonePicker({ value, onChange, label }: { value: string; onChange: (zone: string) => void; label: string }) {
  const lang = useLang();
  const items = useMemo(() => zoneOptions().map(z => ({ value: z.tz, label: zoneLabel(z.tz, lang === 'zh'), searchTerms: zoneSearchTerms(z) })), [lang]);
  return <div className="staff-field"><span>{label}</span><ListSelect items={items} value={value} onChange={onChange} allLabel="" clearable={false} searchable ariaLabel={label} /></div>;
}
function SlotsEditor({ slots, onChange, weekday }: { slots: WorkSlot[]; onChange: (slots: WorkSlot[]) => void; weekday?: number }) {
  const t = useT(), weekdays = useWeekdays();
  const patch = (index: number, field: keyof WorkSlot, value: number) => onChange(slots.map((s, i) => i === index ? { ...s, [field]: value } : s));
  return <div className="work-hours-editor">
    {slots.map((slot, index) => <div className="work-hours-row" key={index}>
      {weekday === undefined && <Field label={t('每周', 'Every week')}><select name={`weekday-${index}`} value={slot.weekday} onChange={e => patch(index, 'weekday', Number(e.target.value))}>{[1, 2, 3, 4, 5, 6, 0].map(day => <option key={day} value={day}>{weekdays[day]}</option>)}</select></Field>}
      <Field label={t('开始', 'Start')}><select name={`start-${index}`} value={slot.startHour} onChange={e => patch(index, 'startHour', Number(e.target.value))}>{hours.slice(0, 24).map(hour => <option key={hour} value={hour}>{clock(hour)}</option>)}</select></Field>
      <Field label={t('结束', 'End')}><select name={`end-${index}`} value={slot.endHour} onChange={e => patch(index, 'endHour', Number(e.target.value))}>{hours.slice(1).map(hour => <option key={hour} value={hour}>{clock(hour)}</option>)}</select></Field>
      <Button action="delete" variant="secondary" onClick={() => onChange(slots.filter((_, i) => i !== index))}>{t('删除时段', 'Remove time slot')}</Button>
    </div>)}
    <Button action="add" iconOnly={false} variant="secondary" onClick={() => onChange([...slots, { weekday: weekday ?? 1, startHour: 10, endHour: 19 }])}>{t('添加时段', 'Add time slot')}</Button>
    {!slots.length && <p className="staff-muted">{t('无工作时段', 'No working hours')}</p>}
  </div>;
}
function WeeklyEditor({ data, date, onSaved }: { data: WorkCalendarData; date: string; onSaved: () => void }) {
  const t = useT(), { api } = useWorkspace();
  const current = activeWorkPeriod(data.periods, data.me, date);
  const [from, setFrom] = useState(date), [tz, setTz] = useState(current?.tz ?? WORK_CALENDAR_DEFAULT_ZONE);
  const [slots, setSlots] = useState<WorkSlot[]>(current?.slots ?? []);
  const version = data.members.find(m => m.userId === data.me)!.version;
  return <Form submit={async () => {
    if (!from || !workSlotsValid(slots)) throw new Error(t('请检查日期和时段，时段不能重叠。', 'Check the date and hours. Time slots cannot overlap.'));
    await api('work-pattern', { version, from, tz, slots }); onSaved();
  }}>
    <div className="staff-form-row"><Field label={t('生效日期', 'Effective date')}><DateInput name="effectiveDate" required min="1970-01-01" max="2100-12-31" value={from} onChange={setFrom} /></Field><ZonePicker value={tz} onChange={setTz} label={t('工作时区', 'Work time zone')} /></div>
    <SlotsEditor slots={slots} onChange={setSlots} />
    <p className="staff-muted">{t('从生效日期起替换后续每周安排和临时调整，之前的安排保留。', 'Replaces weekly hours and day overrides from this date onward. Earlier schedules are kept.')}</p>
    <Button action="save" iconOnly={false} type="submit">{t('保存每周安排', 'Save weekly hours')}</Button>
  </Form>;
}
function daySlots(data: WorkCalendarData, period: WorkPeriod, date: string): WorkSlot[] {
  return data.exceptions.find(e => e.periodId === period.id && e.date === date)?.slots ?? period.slots.filter(s => s.weekday === weekdayOf(date));
}
interface DayDraft { date: string; userId: number; slots?: WorkSlot[] }
function DayEditor({ data, draft, onSaved }: { data: WorkCalendarData; draft: DayDraft; onSaved: () => void }) {
  const t = useT(), { api, formatName = name => name } = useWorkspace();
  const period = activeWorkPeriod(data.periods, draft.userId, draft.date);
  const [slots, setSlots] = useState<WorkSlot[]>(draft.slots ?? (period ? daySlots(data, period, draft.date) : []));
  const member = data.members.find(m => m.userId === draft.userId)!;
  const mine = draft.userId === data.me;
  if (!period) return <p>{t('请先设置该日期生效的每周工作时间。', 'Set weekly hours covering this date first.')}</p>;
  return <Form submit={async (_, action) => {
    if (!mine) return;
    const next = action === 'restore' ? null : action === 'cancel-day' ? [] : slots;
    if (next && !workSlotsValid(next)) throw new Error(t('时段无效或重叠。', 'Invalid or overlapping hours.'));
    await api('work-exception', { version: member.version, periodId: period.id, date: draft.date, slots: next }); onSaved();
  }}>
    <p>{formatName(member.name)} · {draft.date} · {period.tz}</p>
    {mine ? <SlotsEditor slots={slots} onChange={setSlots} weekday={weekdayOf(draft.date)} /> : <div>{slots.length ? slots.map((s, i) => <p key={i}>{clock(s.startHour)}–{clock(s.endHour)}</p>) : t('当天休息', 'Day off')}</div>}
    {mine && <div className="staff-actions"><Button action="save" iconOnly={false} type="submit">{t('仅保存当天', 'Save this day')}</Button><Button type="submit" name="action" value="cancel-day" variant="secondary">{t('当天休息', 'Day off')}</Button><Button type="submit" name="action" value="restore" variant="secondary">{t('恢复每周安排', 'Restore weekly hours')}</Button></div>}
  </Form>;
}
export default function WorkCalendar() {
  const t = useT(); const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  return now === null ? <LoadingIndicator>{t('正在加载…', 'Loading…')}</LoadingIndicator> : <WorkCalendarBoard now={now} />;
}
function WorkCalendarBoard({ now }: { now: number }) {
  const t = useT(), lang = useLang(), theme = useEffectiveTheme(), mobile = useIsMobile();
  const { formatName = name => name } = useWorkspace();
  const grid = useRef<GridHandle>(null);
  const [tz, setTz] = useState(WORK_CALENDAR_DEFAULT_ZONE);
  const [viewParam, setView] = useQueryState('workView', parseAsStringEnum(['auto', 'timeGridDay', 'timeGridWeek', 'listMonth']).withDefault('auto'));
  const [person, setPerson] = useQueryState('workPerson', parseAsString.withDefault('all'));
  const view: ViewKey = viewParam === 'auto' ? mobile ? 'timeGridDay' : 'timeGridWeek' : viewParam;
  const [range, setRange] = useState<GridRange>({ start: now, end: now + 7 * 86400000, anchor: now });
  const from = shiftWorkDate(workDate(tz, range.start), -2), to = shiftWorkDate(workDate(tz, range.end), 2);
  const resource = useResource<WorkCalendarData>(`work-calendar?${new URLSearchParams({ from, to })}`);
  const data = resource.data;
  const [editing, setEditing] = useState<{ kind: 'weekly'; date: string; data: WorkCalendarData } | { kind: 'day'; draft: DayDraft; data: WorkCalendarData } | null>(null);
  const [message, setMessage] = useState<Error>();
  const occurrences = useMemo(() => data ? expandWorkCalendar(data, range.start, range.end) : [], [data, range.start, range.end]);
  const filtered = occurrences.filter(o => person === 'all' || o.userId === (person === 'mine' ? data?.me : Number(person)));
  const events: EventInput[] = filtered.map(o => {
    const color = colorHex(workCalendarColor(o.userId), theme);
    return { id: o.id, title: formatName(data!.members.find(m => m.userId === o.userId)?.name ?? ''), start: new Date(o.start).toISOString(), end: new Date(o.end).toISOString(), backgroundColor: color, borderColor: color, textColor: readableInk(color), editable: o.userId === data?.me && !resource.loading && !resource.error, extendedProps: { location: o.adjusted ? t('临时调整', 'Adjusted') : '' } };
  });
  const ready = !!data && !resource.loading && !resource.error;
  const focusDate = workDate(tz, now >= range.start && now < range.end ? now : range.anchor);
  function openDay(date: string, slots?: WorkSlot[], userId = data?.me) {
    if (!ready || !data || userId === undefined) return;
    setMessage(undefined); setEditing({ kind: 'day', data, draft: { date, userId, slots } });
  }
  function selectHours(start: number, end: number) {
    if (!ready || !data) return;
    const date = workDate(tz, start), period = activeWorkPeriod(data.periods, data.me, date);
    if (!period) { setEditing({ kind: 'weekly', date, data }); return; }
    const ownDate = workDate(period.tz, start), a = wallPartsIn(period.tz, new Date(start)), b = wallPartsIn(period.tz, new Date(end));
    const endHour = workDate(period.tz, end) === shiftWorkDate(ownDate, 1) && b.h === 0 && b.mi === 0 ? 24 : b.h;
    if (a.mi || b.mi || endHour <= a.h || end - start > 25 * 3600000 || workDate(period.tz, end) !== ownDate && endHour !== 24) { setMessage(new Error(t('请按工作时区选择同一天的整点时段。', 'Select whole hours within one day in your work time zone.'))); return; }
    openDay(ownDate, [...daySlots(data, period, ownDate), { weekday: weekdayOf(ownDate), startHour: a.h, endHour }]);
  }
  return <section className="work-calendar workspace-controls">
    <div className="workspace-toolbar staff-actions">
      <div className="staff-actions"><Button action="previous" variant="secondary" onClick={() => grid.current?.prev()}>{t('上一页', 'Previous')}</Button><Button variant="secondary" onClick={() => grid.current?.today()}>{t('今天', 'Today')}</Button><Button action="next" variant="secondary" onClick={() => grid.current?.next()}>{t('下一页', 'Next')}</Button></div>
      <strong className="work-calendar-range">{rangeTitle(view, range.anchor, tz, lang === 'zh', range.start, range.end)}</strong>
      <Field label={t('视图', 'View')}><select value={view} onChange={e => void setView(e.target.value as typeof viewParam)}><option value="timeGridWeek">{t('周', 'Week')}</option><option value="timeGridDay">{t('日', 'Day')}</option><option value="listMonth">{t('日程', 'Agenda')}</option></select></Field>
      <Field label={t('人员', 'People')}><select value={person} onChange={e => void setPerson(e.target.value)}><option value="all">{t('全部人员', 'Everyone')}</option><option value="mine">{t('只看自己', 'Only me')}</option>{data?.members.map(m => <option key={m.userId} value={m.userId}>{formatName(m.name)}</option>)}</select></Field>
      <ZonePicker value={tz} onChange={setTz} label={t('显示时区', 'Display time zone')} />
      <div className="staff-actions"><Button action="edit" iconOnly={false} disabled={!ready} onClick={() => data && setEditing({ kind: 'weekly', date: focusDate, data })}>{t('我的工作时间', 'My working hours')}</Button><Button variant="secondary" disabled={!ready} onClick={() => openDay(focusDate)}>{t('调整当天', 'Adjust day')}</Button><Button action="reload" variant="secondary" onClick={resource.reload}>{t('重新加载', 'Reload')}</Button></div>
    </div>
    <div className="work-calendar-legend">{data?.members.map(m => <span key={m.userId}><i aria-hidden style={{ backgroundColor: colorHex(workCalendarColor(m.userId), theme) }} />{formatName(m.name)}</span>)}</div>
    <ErrorNotice error={resource.error} retry={resource.reload} /><ErrorNotice error={message} />
    {resource.loading && <p role="status"><LoadingIndicator>{t('正在加载…', 'Loading…')}</LoadingIndicator></p>}
    {!resource.loading && !resource.error && !filtered.length && <p className="staff-muted">{t('此范围暂无工作时间', 'No working hours in this range')}</p>}
    <div className="work-calendar-grid" aria-busy={resource.loading}>
      <CalendarGrid ref={grid} initialDate={now} view={view} events={events} tz={tz} tzLabel={tz} isZh={lang === 'zh'} hour24 weekStart={1} weekends mobile={mobile} editable={ready} slotMinutes={60} snapMinutes={60} allDaySlot={false} slotEventOverlap={false}
        onRangeChange={next => setRange(old => old.start === next.start && old.end === next.end && old.anchor === next.anchor ? old : next)}
        onDayLink={ms => { void setView('timeGridDay'); grid.current?.gotoDate(ms); }}
        onSelect={selectHours} onDateClick={ms => openDay(workDate(tz, ms))}
        onEventClick={id => { const o = occurrences.find(e => e.id === id); if (o) openDay(o.date, undefined, o.userId); }}
        onEventMove={(id, start, end, _allDay, revert) => {
          revert(); const o = occurrences.find(e => e.id === id); if (!o || !data || o.userId !== data.me) return;
          const p = data.periods.find(p => p.id === o.periodId)!;
          const a = wallPartsIn(p.tz, new Date(start)), b = wallPartsIn(p.tz, new Date(end));
          const endDate = workDate(p.tz, end), endHour = endDate === shiftWorkDate(o.date, 1) && b.h === 0 && b.mi === 0 ? 24 : b.h;
          if (workDate(p.tz, start) !== o.date || endDate !== o.date && endHour !== 24 || a.mi || b.mi || endHour <= a.h) { setMessage(new Error(t('拖动仅调整当天的整点时段；跨日请编辑每周安排。', 'Drag within this day using whole hours; edit weekly hours to change days.'))); return; }
          openDay(o.date, daySlots(data, p, o.date).map(s => s.startHour === o.startHour && s.endHour === o.endHour ? { ...s, startHour: a.h, endHour } : s));
        }} />
    </div>
    {editing && <WorkspaceDialog title={editing.kind === 'weekly' ? t('我的工作时间', 'My working hours') : t('当天工作时间', 'Working hours for this day')} onClose={() => setEditing(null)}>
      {editing.kind === 'weekly' ? <WeeklyEditor data={editing.data} date={editing.date} onSaved={() => { setEditing(null); resource.reload(); }} /> : <DayEditor data={editing.data} draft={editing.draft} onSaved={() => { setEditing(null); resource.reload(); }} />}
    </WorkspaceDialog>}
  </section>;
}
