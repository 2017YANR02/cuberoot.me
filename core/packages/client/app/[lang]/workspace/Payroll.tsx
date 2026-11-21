'use client';

import { useEffect, useId, useState } from 'react';
import { ErrorNotice, Field, Form, useResource, useWorkspace, value } from '@app-foundation/workspace-ui';
import { PROJECT_MAX_CENTS, type PayrollAttendance, type PayrollEmployee, type PayrollMonth } from '@cuberoot/shared/workspace-planning';
import { toLocalIsoDate } from '@cuberoot/shared/iso-date';
import { DateInput } from '@/components/DateInput';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { WorkspaceButton as Button, WorkspaceDialog } from './WorkspaceControls';
import { formatCnyCents, parseCnyCents } from './workspace-money';

type PayrollEdit = { kind: 'rate' } | { kind: 'pay' } | { kind: 'attendance'; record?: PayrollAttendance };

function monthDate(month: string, day = 1, offset = 0) {
  const [year, index] = month.split('-').map(Number);
  return new Date(year, index - 1 + offset, day);
}

function adjacentMonth(month: string, offset: number) {
  return toLocalIsoDate(monthDate(month, 1, offset)).slice(0, 7);
}

export default function Payroll({ projectRevision = 0 }: { projectRevision?: number }) {
  const t = useT();
  const lang = useLang();
  const heading = useId();
  const today = toLocalIsoDate();
  const currentMonth = today.slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [employeeId, setEmployeeId] = useState<number>();
  const { formatName = name => name } = useWorkspace();
  const { data, loading, error, reload } = useResource<PayrollMonth>(`payroll?month=${month}`);
  useEffect(() => { if (projectRevision) reload(); }, [projectRevision, reload]);
  const employee = data?.rows.find(row => row.userId === employeeId)
    ?? data?.rows.find(row => row.totalCents > 0 || row.attendance.length > 0 || row.canReport)
    ?? data?.rows[0];
  const monthLabel = new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en', { year: 'numeric', month: 'long' }).format(monthDate(month));
  return <section className="staff-panel" aria-labelledby={heading}>
    <h2 id={heading}>{t('月度报酬', 'Monthly pay')}</h2>
    <div className="staff-actions">
      <Button action="previous" variant="secondary" disabled={month <= '1900-01'} onClick={() => setMonth(adjacentMonth(month, -1))}>
        {t('上个月', 'Previous month')}
      </Button>
      <span aria-live="polite">{monthLabel}</span>
      <Button action="next" variant="secondary" disabled={month >= currentMonth} onClick={() => setMonth(adjacentMonth(month, 1))}>
        {t('下个月', 'Next month')}
      </Button>
      {data?.canManage && !error && employee && <Field label={t('员工', 'Employee')} width="medium">
        <select value={employee.userId} onChange={event => setEmployeeId(Number(event.target.value))}>
          {data.rows.map(row => <option key={row.userId} value={row.userId}>{formatName(row.name)}</option>)}
        </select>
      </Field>}
    </div>
    <ErrorNotice error={error} retry={reload} />
    {loading && <p role="status">{t('正在加载…', 'Loading…')}</p>}
    {!loading && !error && !employee && <p className="staff-empty">{t('暂无员工报酬记录', 'No employee pay records')}</p>}
    {data && employee && !error && <PayrollStatement
      key={`${month}:${employee.userId}`} employee={employee} month={data} today={today} loading={loading} reload={reload} />}
  </section>;
}

function PayrollStatement({ employee, month, today, loading, reload }: {
  employee: PayrollEmployee;
  month: PayrollMonth;
  today: string;
  loading: boolean;
  reload: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const { api } = useWorkspace();
  const [editing, setEditing] = useState<PayrollEdit | null>(null);
  const money = (cents: number) => formatCnyCents(cents, lang);
  const pending = employee.attendance.filter(row => !row.approved);
  const canEditAttendance = !employee.paidAt && (month.canManage || employee.canReport);
  const canRecordPayment = month.canManage && month.closed && !employee.paidAt && employee.totalCents > 0 && pending.length === 0;
  const hasActivity = employee.attendance.length > 0 || employee.projects.length > 0;
  const saved = () => { setEditing(null); reload(); };
  return <>
    <div className="staff-actions">
      <p>{t('发放日', 'Pay date')} <time dateTime={month.payDate}>{month.payDate}</time></p>
      <p>{t('应发金额', 'Amount due')} <strong>{money(employee.totalCents)}</strong></p>
      {employee.paidAt && <p>{t('已登记付款', 'Payment recorded')} <time dateTime={employee.paidAt}>
        {new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en', { dateStyle: 'medium' }).format(new Date(employee.paidAt))}
      </time></p>}
    </div>
    <div className="staff-actions">
      {employee.dailyRateCents !== null && <span className="staff-muted">{t('月末日薪', 'Daily rate at month end')} {money(employee.dailyRateCents)}</span>}
      {month.canManage && <Button variant="secondary" disabled={loading} onClick={() => setEditing({kind:'rate'})}>
        {t('设置线下日薪', 'Set on-site daily rate')}
      </Button>}
      {canEditAttendance && employee.canReport && <Button variant="secondary" disabled={loading} onClick={() => setEditing({kind:'attendance'})}>
        {month.canManage ? t('录入出勤', 'Record attendance') : t('提交出勤', 'Report attendance')}
      </Button>}
      {canRecordPayment && <Button disabled={loading} onClick={() => setEditing({kind:'pay'})}>{t('登记付款', 'Record payment')}</Button>}
    </div>
    {!hasActivity && <p className="staff-empty">{t('本月暂无出勤或已验收项目', 'No attendance or accepted projects this month')}</p>}
    {employee.attendance.length > 0 && <section className="staff-panel">
      <div className="staff-actions">
        <h3>{t('线下出勤', 'On-site attendance')}</h3><strong>{money(employee.onsiteCents)}</strong>
      </div>
      {pending.length > 0 && <p className="staff-muted">{t('待确认的出勤会在确认后计入应发金额。', 'Pending attendance is included in the amount due once approved.')}</p>}
      {canEditAttendance && month.canManage && pending.length > 1 && <Form submit={async () => {
        await api('payroll-attendance-approve', {
          userId:employee.userId, month:month.month, entries:pending.map(({date, version}) => ({date, version})),
        });
        reload();
      }}>
        <Button type="submit" variant="secondary" disabled={loading}>{t('批量确认出勤', 'Approve all pending attendance')}</Button>
      </Form>}
      <ul className="staff-feed">
        {employee.attendance.map(row => <li key={row.date} className="staff-actions">
          <time dateTime={row.date}>{row.date}</time>
          <span>{row.halfDays === 1 ? t('半天', 'Half day') : t('全天', 'Full day')}</span>
          <span>{money(row.amountCents)}</span>
          {!row.approved && <span className="staff-muted">{t('待确认', 'Pending approval')}</span>}
          {canEditAttendance && (month.canManage || !row.approved) && <Button
            action="edit" variant="secondary" disabled={loading} onClick={() => setEditing({kind:'attendance',record:row})}>
              {t('编辑出勤', 'Edit attendance')}
            </Button>}
          {canEditAttendance && month.canManage && !row.approved && <Form key={row.version} submit={async () => {
            await api('payroll-attendance', { userId:employee.userId, date:row.date, halfDays:row.halfDays, version:row.version });
            reload();
          }}>
            <Button type="submit" variant="secondary" disabled={loading}>{t('确认出勤', 'Approve attendance')}</Button>
          </Form>}
        </li>)}
      </ul>
    </section>}
    {employee.projects.length > 0 && <section className="staff-panel">
      <div className="staff-actions">
        <h3>{t('已验收项目', 'Accepted projects')}</h3>
        <strong>{money(employee.projectCents)}</strong>
        {employee.bonusCents > 0 && <span>{t('奖金合计', 'Total bonus')} {money(employee.bonusCents)}</span>}
      </div>
      <ul className="staff-feed">
        {employee.projects.map(project => <li key={project.id} className="staff-actions">
          <strong>{project.title}</strong>
          <time dateTime={project.acceptedDate}>{project.acceptedDate}</time>
          <span>{money(project.amountCents)}</span>
          {project.bonusCents > 0 && <span>{t('奖金', 'Bonus')} {money(project.bonusCents)}</span>}
        </li>)}
      </ul>
    </section>}
    {editing && <PayrollEditor
      edit={editing} employee={employee} month={month} today={today} money={money}
      onClose={() => setEditing(null)} onSaved={saved} />}
  </>;
}

function PayrollEditor({ edit, employee, month, today, money, onClose, onSaved }: {
  edit: PayrollEdit;
  employee: PayrollEmployee;
  month: PayrollMonth;
  today: string;
  money: (cents: number) => string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const { api, formatName = name => name } = useWorkspace();
  const from = `${month.month}-01`;
  const lastDay = toLocalIsoDate(monthDate(month.month, 0, 1));
  const defaultDate = today.slice(0, 7) === month.month ? today : from;
  const title = edit.kind === 'pay' ? t('登记付款', 'Record payment')
    : edit.kind === 'rate' ? t('设置线下日薪', 'Set on-site daily rate')
    : edit.record ? t('编辑出勤', 'Edit attendance')
    : month.canManage ? t('录入出勤', 'Record attendance') : t('提交出勤', 'Report attendance');
  return <WorkspaceDialog title={title} onClose={onClose}>
    <Form submit={async (data, action) => {
      if (edit.kind === 'pay') {
        await api('payroll-paid', { userId:employee.userId, month:month.month, expectedTotalCents:employee.totalCents });
      } else if (edit.kind === 'rate') {
        const dailyRateCents = parseCnyCents(value(data, 'rate').trim());
        if (!Number.isInteger(dailyRateCents) || dailyRateCents <= 0 || dailyRateCents > PROJECT_MAX_CENTS) {
          throw new Error(t('请输入有效日薪，最多两位小数。', 'Enter a valid daily rate with up to two decimal places.'));
        }
        await api('payroll-rate', { userId:employee.userId, effectiveFrom:value(data,'date'), dailyRateCents });
      } else {
        const date = edit.record?.date ?? value(data, 'date');
        if (!edit.record && employee.attendance.some(row => row.date === date)) {
          throw new Error(t('当天已有出勤记录，请直接编辑原记录。', 'Attendance already exists for this date. Edit the existing record.'));
        }
        await api('payroll-attendance', {
          userId:employee.userId, date, halfDays:action === 'remove' ? 0 : Number(value(data,'halfDays')), version:edit.record?.version ?? 0,
        });
      }
      onSaved();
    }}>
      {edit.kind === 'pay' && <p>{t('已支付后，请核对本次登记的员工、月份和金额。', 'Once payment is made, verify the employee, month and amount for this record.')} <strong>
        {formatName(employee.name)} · {month.month} · {money(employee.totalCents)}
      </strong></p>}
      {edit.kind === 'rate' && <>
        <Field label={t('日薪（元）', 'Daily rate (CNY)')} width="medium">
          <input autoComplete="off" name="rate" inputMode="decimal" pattern="[0-9]+(?:[.][0-9]{1,2})?" required maxLength={10}
            defaultValue={employee.dailyRateCents === null ? '' : String(employee.dailyRateCents / 100)} />
        </Field>
        <Field label={t('生效日期', 'Effective date')} width="date">
          <DateInput name="date" required defaultValue={employee.paidAt ? today : defaultDate} />
        </Field>
      </>}
      {edit.kind === 'attendance' && <>
        <Field label={t('出勤日期', 'Work date')} width="date"><DateInput name="date" required readOnly={Boolean(edit.record)}
          min={from} max={today < lastDay ? today : lastDay} defaultValue={edit.record?.date ?? defaultDate} /></Field>
        <Field label={t('实际出勤', 'Time worked')} width="medium"><select name="halfDays" defaultValue={edit.record?.halfDays ?? 2}>
          <option value={2}>{t('全天', 'Full day')}</option><option value={1}>{t('半天', 'Half day')}</option>
        </select></Field>
      </>}
      <div className="staff-actions staff-form-actions">
        <Button type="submit">{edit.kind === 'pay' ? t('确认已付款', 'Confirm payment made') : t('保存', 'Save')}</Button>
        {edit.kind === 'attendance' && edit.record && <Button type="submit" value="remove" variant="secondary">
          {t('移除出勤记录', 'Remove attendance record')}
        </Button>}
      </div>
    </Form>
  </WorkspaceDialog>;
}
