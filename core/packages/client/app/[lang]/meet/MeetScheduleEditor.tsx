'use client';
import { useEffect, useRef, useState } from 'react';
import { isValidIsoDate } from '@cuberoot/shared/iso-date';
import { wallPartsIn, wallToUtc } from '@cuberoot/shared/tz';
import { validateMeetingDraft, type MeetingPlan } from '@cuberoot/shared/meeting';
import { DateInput } from '@/components/DateInput';
import { ClearButton } from '@/components/ClearButton';
import { saveMeetingPlan } from '@/lib/meeting-api';
import { tr } from '@/i18n/tr';
import RepeatEditor from '../calendar/_components/RepeatEditor';

export default function MeetScheduleEditor({ plan, onClose, onSaved }: {
  plan: MeetingPlan | null; onClose: () => void; onSaved: (plan: MeetingPlan) => void;
}) {
  const [title, setTitle] = useState(plan?.title ?? '');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [tz, setTz] = useState(plan?.tz ?? 'UTC');
  const [minutes, setMinutes] = useState(plan ? (plan.end - plan.start) / 60000 : 30);
  const [rrule, setRrule] = useState(plan?.rrule ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  useEffect(() => {
    const zone = plan?.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    const wall = wallPartsIn(zone, new Date(plan?.start ?? Math.ceil((Date.now() + 900000) / 900000) * 900000));
    setTz(zone);
    setDate(`${wall.y}-${String(wall.mo).padStart(2, '0')}-${String(wall.d).padStart(2, '0')}`);
    setTime(`${String(wall.h).padStart(2, '0')}:${String(wall.mi).padStart(2, '0')}`);
  }, [plan]);
  const validTime = /^\d{2}:\d{2}$/.test(time) && Number(time.slice(0, 2)) < 24 && Number(time.slice(3)) < 60;
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const start = isValidIsoDate(date) && validTime ? wallToUtc(tz, { y, mo, d, h, mi, s: 0 }).getTime() : NaN;
  return <section className="meet-schedule-panel" aria-labelledby="meet-schedule-title" data-site-surface="panel">
      <header className="meet-section-heading">
        <h2 id="meet-schedule-title">{plan ? tr({ zh: '编辑预约', en: 'Edit meeting' }) : tr({ zh: '预约会议', en: 'Schedule meeting' })}</h2>
        {!saving && <ClearButton variant="standalone" onClick={onClose} ariaLabel={tr({ zh: '关闭', en: 'Close' })} />}
      </header>
      <form className="meet-schedule-form" onSubmit={async event => {
        event.preventDefault();
        if (pending.current) return;
        const draft = validateMeetingDraft({ title, start, end: start + minutes * 60000, tz, rrule });
        if (!draft || (!plan && start < Date.now())) { setError(tr({ zh: '请填写标题、有效的开始时间和时长。', en: 'Enter a title, valid start time and duration.' })); return; }
        const wall = wallPartsIn(tz, new Date(start));
        if (wall.y !== y || wall.mo !== mo || wall.d !== d || wall.h !== h || wall.mi !== mi) {
          setError(tr({ zh: '该时间在夏令时切换时不存在，请选择另一个时间。', en: 'This time does not exist during the daylight-saving transition. Choose another time.' })); return;
        }
        pending.current = true; setSaving(true); setError('');
        try { onSaved(await saveMeetingPlan(draft, plan?.id)); }
        catch (cause) {
          const message = cause instanceof Error ? cause.message : '';
          setError(message === 'schedule limit reached'
            ? tr({ zh: '预约数量或会议码已达上限，请联系站点管理员。', en: 'The schedule or meeting-code limit has been reached. Contact the site administrator.' })
            : message === 'invalid schedule'
              ? tr({ zh: '请检查预约时间；新预约须在未来一年内。', en: 'Check the schedule. New meetings must start within the next year.' })
              : message === 'not found'
                ? tr({ zh: '这场预约已取消或不存在，请刷新列表。', en: 'This meeting was cancelled or no longer exists. Refresh the list.' })
                : tr({ zh: '预约未保存，请稍后重试。', en: 'Meeting was not saved. Please retry shortly.' }));
        }
        finally { pending.current = false; setSaving(false); }
      }}>
        <fieldset disabled={saving}>
          <label>{tr({ zh: '会议主题', en: 'Meeting title' })}<input className="meet-schedule-input" autoFocus required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} /></label>
          <div className="meet-form-row">
            <label>{tr({ zh: '开始日期', en: 'Start date' })}<DateInput value={date} onChange={setDate} required /></label>
            <label>{tr({ zh: '开始时间', en: 'Start time' })}<input className="meet-schedule-input" type="time" required value={time} onChange={event => setTime(event.target.value)} /></label>
          </div>
          <label>{tr({ zh: '时长（分钟）', en: 'Duration (minutes)' })}<input className="meet-schedule-input" type="number" min={5} max={1440} step={5} value={minutes} onChange={event => setMinutes(Number(event.target.value))} required /></label>
          <p className="meet-sub">{tr({ zh: '时区', en: 'Time zone' })}：{tz}</p>
          {Number.isFinite(start) && <RepeatEditor value={rrule} onChange={setRrule} start={start} tz={tz} />}
          {plan?.rrule && <p className="meet-sub">{tr({ zh: '修改将应用于整个周期会议。', en: 'Changes apply to the entire series.' })}</p>}
          {error && <p className="vc-err" role="alert">{error}</p>}
          <button type="submit" className="meet-go">{saving ? tr({ zh: '保存中…', en: 'Saving…' }) : tr({ zh: '保存预约', en: 'Save meeting' })}</button>
        </fieldset>
      </form>
  </section>;
}
