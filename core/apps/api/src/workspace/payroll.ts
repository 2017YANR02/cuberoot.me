import { z } from 'zod';
import {
  PROJECT_MAX_CENTS, WORK_CALENDAR_DEFAULT_ZONE, isPlanningDate, shiftWorkDate, workDate, workInstant,
  type PayrollAttendance, type PayrollEmployee, type PayrollMonth, type PayrollProject,
} from '@cuberoot/shared/workspace-planning';
import type { QueryRunner } from '../db/connection.js';
import { activeRecipients, eligibleRecipient } from './project-recipient.js';

const userIdInput = z.number().int().positive().safe();
const dateInput = z.string().refine(date => isPlanningDate(date) && date >= '1900-01-01' && date <= '9998-12-31');
const monthInput = z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/).refine(month => month >= '1900-01' && month <= '9998-12');
const dailyRateInput = z.number().int().min(1).max(PROJECT_MAX_CENTS);
const rateInput = z.strictObject({ userId: userIdInput, effectiveFrom: dateInput, dailyRateCents: dailyRateInput });
const attendanceInput = z.strictObject({
  userId: userIdInput, date: dateInput,
  halfDays: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  version: z.number().int().nonnegative().max(2_147_483_647).default(0),
});
const approvalInput = z.strictObject({ userId: userIdInput, month: monthInput,
  entries: z.array(z.strictObject({ date: dateInput, version: z.number().int().positive() })).min(1).max(31) });
const paymentInput = z.strictObject({ userId: userIdInput, month: monthInput, expectedTotalCents: z.number().int().positive().safe() });
const termsInput = rateInput.extend({ dailyRateCents: dailyRateInput.nullable(), endsOn: dateInput.optional() })
  .refine(({ effectiveFrom, endsOn }) => !endsOn || endsOn >= effectiveFrom);

type Rate = Pick<z.infer<typeof termsInput>, 'dailyRateCents'|'effectiveFrom'> & { endsOn: string | null };
type RawAttendance = Omit<PayrollAttendance, 'amountCents'>;
type Payment = { userId: number; paidAt: Date; totalCents: string };
const zone = WORK_CALENDAR_DEFAULT_ZONE;
const today = () => workDate(zone, Date.now());
const recipients = `FROM workspace_members m JOIN app_users u ON u.id=m.user_id WHERE ${eligibleRecipient}`;

function period(month: string) {
  const start = `${month}-01`;
  const after = shiftWorkDate(start, 32).slice(0, 7) + '-01';
  return { month, start, after, end: shiftWorkDate(after, -1), payDate: `${after.slice(0, 7)}-15`, closed: today() >= after };
}

/** Called within the workspace transaction after validating the contract owner. A null rate switches off onsite reporting. */
export async function saveWorkspaceDailyRate(q: QueryRunner, input: z.infer<typeof termsInput>) {
  const { userId, effectiveFrom, dailyRateCents, endsOn } = termsInput.parse(input);
  await q(`INSERT INTO workspace_payroll_rates(user_id,effective_from,ends_on,daily_rate_cents) VALUES (?,?,?,?)
    ON CONFLICT (user_id,effective_from) DO UPDATE SET daily_rate_cents=EXCLUDED.daily_rate_cents,ends_on=EXCLUDED.ends_on`,
  [userId, effectiveFrom, endsOn ?? null, dailyRateCents]);
  // A rate correction updates only still-pending days. Keep previously submitted
  // work visible for review when a new project-only term removes the day rate.
  await q(`WITH resolved AS (
      SELECT a.work_date,r.daily_rate_cents FROM workspace_payroll_attendance a
      CROSS JOIN LATERAL (
        SELECT rate.daily_rate_cents,rate.ends_on FROM workspace_payroll_rates rate
        WHERE rate.user_id=a.user_id AND rate.effective_from<=a.work_date
        ORDER BY rate.effective_from DESC LIMIT 1
      ) r
      WHERE a.user_id=? AND a.work_date>=? AND NOT a.approved
        AND r.daily_rate_cents IS NOT NULL AND (r.ends_on IS NULL OR a.work_date<=r.ends_on)
    )
    UPDATE workspace_payroll_attendance a SET daily_rate_cents=resolved.daily_rate_cents,version=DEFAULT
    FROM resolved WHERE a.user_id=? AND a.work_date=resolved.work_date
      AND a.daily_rate_cents IS DISTINCT FROM resolved.daily_rate_cents`, [userId, effectiveFrom, userId]);
}

function rateOn(rates: readonly Rate[], date: string) {
  const rate = rates.find(row => row.effectiveFrom <= date);
  return rate && (!rate.endsOn || date <= rate.endsOn) ? rate.dailyRateCents : null;
}

function hasRateInMonth(rates: readonly Rate[], start: string, end: string) {
  return rates.some((rate, index) => {
    if (rate.dailyRateCents === null) return false;
    const from = rate.effectiveFrom > start ? rate.effectiveFrom : start;
    const next = rates[index - 1]?.effectiveFrom;
    return from <= end && (!next || from < next) && (!rate.endsOn || from <= rate.endsOn);
  });
}

function groupByEmployee<T extends {userId: number}>(rows: readonly T[]) {
  const grouped = new Map<number, T[]>();
  for (const row of rows) {
    const records = grouped.get(row.userId);
    if (records) records.push(row);
    else grouped.set(row.userId, [row]);
  }
  return grouped;
}

export function payrollService(q: QueryRunner, access: {
  userId: number;
  canManage: boolean;
  audit: (action: string, target: string) => Promise<void>;
  fail: (message: string, status: number) => never;
}) {
  const { userId, canManage, audit, fail } = access;
  const forbidden = () => fail('无权操作该薪资记录 / Payroll access denied', 403);
  async function monthlyRows(month: string, owner?: number): Promise<PayrollMonth> {
    const { start, after, end, payDate, closed } = period(month);
    const people = await q<Pick<PayrollEmployee, 'userId'|'name'> & { active: boolean }>(
      `SELECT u.id::int AS "userId",m.name,(m.active OR m.admin_access) AS active ${recipients}
        AND (u.id=? OR ?) AND (?::bigint IS NULL OR u.id=?) ORDER BY m.name,u.id`, [userId, canManage, owner ?? null, owner ?? null],
    );
    const ids = people.map(person => person.userId);
    if (!ids.length) return { month, payDate, closed, canManage, rows: [] };
    const [attendance, projects, rates, payments] = await Promise.all([
      q<RawAttendance & {userId: number}>(`SELECT user_id::int AS "userId",work_date::text AS date,half_days AS "halfDays",
        daily_rate_cents AS "dailyRateCents",approved,version FROM workspace_payroll_attendance
        WHERE user_id=ANY(?::bigint[]) AND work_date>=? AND work_date<? ORDER BY work_date`, [ids, start, after]),
      q<PayrollProject & {userId: number}>(`SELECT user_id::int AS "userId",id,title,
        (accepted_at AT TIME ZONE ?)::date::text AS "acceptedDate",amount_cents AS "amountCents",bonus_cents AS "bonusCents"
        FROM workspace_project_tasks WHERE user_id=ANY(?::bigint[]) AND status='accepted' AND accepted_at>=? AND accepted_at<?
        ORDER BY accepted_at,id`, [zone, ids, new Date(workInstant(zone, start, 0)), new Date(workInstant(zone, after, 0))]),
      q<Rate & {userId: number}>(`SELECT user_id::int AS "userId",effective_from::text AS "effectiveFrom",
        ends_on::text AS "endsOn",daily_rate_cents AS "dailyRateCents" FROM workspace_payroll_rates
        WHERE user_id=ANY(?::bigint[]) AND effective_from<? ORDER BY effective_from DESC`, [ids, after]),
      q<Payment>(`SELECT user_id::int AS "userId",total_cents::text AS "totalCents",paid_at AS "paidAt"
        FROM workspace_payroll_payments WHERE user_id=ANY(?::bigint[]) AND work_month=?`, [ids, start]),
    ]);
    const attendanceByUser = groupByEmployee(attendance);
    const projectsByUser = groupByEmployee(projects);
    const ratesByUser = groupByEmployee(rates);
    const paymentsByUser = new Map(payments.map(row => [row.userId, row]));
    const rows = people.flatMap(({userId, name, active}) => {
      // One attendance row per day, with fractions of one fen rounded up.
      const days = (attendanceByUser.get(userId) ?? []).map(({userId: _, ...day}) => ({
        ...day, amountCents: Math.round(day.dailyRateCents * day.halfDays / 2),
      }));
      const accepted = (projectsByUser.get(userId) ?? []).map(({userId: _, ...project}) => project);
      const personRates = ratesByUser.get(userId) ?? [];
      const payment = paymentsByUser.get(userId);
      if (!active && !days.length && !accepted.length && !payment) return [];
      const onsiteCents = days.reduce((sum, day) => sum + (day.approved ? day.amountCents : 0), 0);
      const projectCents = accepted.reduce((sum, project) => sum + project.amountCents, 0);
      const bonusCents = accepted.reduce((sum, project) => sum + project.bonusCents, 0);
      return [{ userId, name, dailyRateCents: rateOn(personRates, end), canReport: active && hasRateInMonth(personRates, start, end),
        attendance: days, projects: accepted, onsiteCents, projectCents, bonusCents,
        totalCents: onsiteCents + projectCents + bonusCents, paidAt: payment?.paidAt.toISOString() ?? null }];
    });
    return { month, payDate, closed, canManage, rows };
  }
  async function requireEmployee(target: number, allowInactive = false) {
    const scope = allowInactive ? recipients : activeRecipients;
    const [member] = await q(`SELECT u.id ${scope} AND u.id=?`, [target]);
    if (!member) fail('员工不可用 / Employee unavailable', 404);
  }
  async function requireUnpaid(target: number, start: string) {
    const [paid] = await q('SELECT 1 FROM workspace_payroll_payments WHERE user_id=? AND work_month=?', [target, start]);
    if (paid) fail('该月已确认付款 / Payment for this month is already confirmed', 409);
  }
  return {
    async list(search: URLSearchParams) {
      const month = monthInput.parse(search.get('month') || today().slice(0, 7));
      const filter = search.get('userId');
      const owner = filter === null ? undefined : userIdInput.parse(Number(filter));
      if (!canManage && owner !== undefined && owner !== userId) return forbidden();
      return monthlyRows(month, owner);
    },
    async saveRate(input: unknown) {
      if (!canManage) return forbidden();
      const data = rateInput.parse(input);
      await requireEmployee(data.userId);
      await saveWorkspaceDailyRate(q, data);
      await audit('payroll.rate', `${data.userId}:${data.effectiveFrom}`);
      return { userId: data.userId };
    },
    async saveAttendance(input: unknown) {
      const { userId: target, date, halfDays, version } = attendanceInput.parse(input);
      if (!canManage && target !== userId) return forbidden();
      if (date > today()) return fail('不能登记未来的出勤 / Attendance date is in the future', 400);
      const {start} = period(date.slice(0, 7));
      await requireUnpaid(target, start);
      const [old] = await q<RawAttendance>(`SELECT half_days AS "halfDays",daily_rate_cents AS "dailyRateCents",approved,version
        FROM workspace_payroll_attendance WHERE user_id=? AND work_date=? FOR UPDATE`, [target, date]);
      await requireEmployee(target, Boolean(old) && canManage);
      if (old?.approved && !canManage) return forbidden();
      if ((old?.version ?? 0) !== version) return fail('出勤已更新，请刷新后再操作 / Attendance changed; reload and retry', 409);
      if (halfDays === 0) {
        if (old) {
          await q('DELETE FROM workspace_payroll_attendance WHERE user_id=? AND work_date=?', [target, date]);
          await audit('payroll.attendance-remove', `${target}:${date}`);
        }
        return { userId: target, date, version: 0 };
      }
      let dailyRateCents: number | undefined = old?.dailyRateCents;
      if (!old) {
        const [rate] = await q<Rate>(`SELECT effective_from::text AS "effectiveFrom",ends_on::text AS "endsOn",
          daily_rate_cents AS "dailyRateCents" FROM workspace_payroll_rates WHERE user_id=? AND effective_from<=?
          ORDER BY effective_from DESC LIMIT 1`, [target, date]);
        dailyRateCents = rateOn(rate ? [rate] : [], date) ?? undefined;
      }
      if (!dailyRateCents) return fail('当天没有生效的日薪约定 / No onsite day rate applies on this date', 409);
      const [saved] = await q<{version: number}>(`INSERT INTO workspace_payroll_attendance(user_id,work_date,half_days,daily_rate_cents,approved)
        VALUES (?,?,?,?,?) ON CONFLICT(user_id,work_date) DO UPDATE SET half_days=EXCLUDED.half_days,
        approved=EXCLUDED.approved,version=EXCLUDED.version RETURNING version`, [target, date, halfDays, dailyRateCents, canManage]);
      await audit(canManage ? 'payroll.attendance-approve' : 'payroll.attendance-submit', `${target}:${date}`);
      return { userId: target, date, version: saved.version };
    },
    async approveAttendance(input: unknown) {
      if (!canManage) return forbidden();
      const { userId: target, month, entries } = approvalInput.parse(input);
      const { start, after } = period(month);
      await requireEmployee(target, true);
      await requireUnpaid(target, start);
      const reviewed = new Map(entries.map(row => [row.date, row.version]));
      const pending = await q<Pick<RawAttendance, 'date'|'version'>>(
        `SELECT work_date::text AS date,version FROM workspace_payroll_attendance
          WHERE user_id=? AND work_date>=? AND work_date<? AND NOT approved FOR UPDATE`, [target, start, after],
      );
      if (pending.length !== entries.length || pending.some(row => reviewed.get(row.date) !== row.version)) {
        return fail('待确认出勤已变化，请刷新后再操作 / Pending attendance changed; reload and retry', 409);
      }
      await q(`UPDATE workspace_payroll_attendance SET approved=TRUE,version=DEFAULT
        WHERE user_id=? AND work_date>=? AND work_date<? AND NOT approved`, [target, start, after]);
      await audit('payroll.attendance-approve-month', `${target}:${month}`);
      return { userId: target, month, approved: pending.length };
    },
    async markPaid(input: unknown) {
      if (!canManage) return forbidden();
      const { userId: target, month, expectedTotalCents } = paymentInput.parse(input);
      const { start, closed } = period(month);
      if (!closed) return fail('请在计薪月份结束后确认付款 / Confirm payment after the work month closes', 409);
      const [existing] = await q<Payment>(`SELECT total_cents::text AS "totalCents",paid_at AS "paidAt"
        FROM workspace_payroll_payments WHERE user_id=? AND work_month=?`, [target, start]);
      if (existing && Number(existing.totalCents) === expectedTotalCents) return { paidAt: existing.paidAt.toISOString() };
      const statement = (await monthlyRows(month, target)).rows[0];
      if (!statement || statement.paidAt || statement.attendance.some(day => !day.approved) || statement.totalCents !== expectedTotalCents) {
        return fail('请处理待确认出勤并核对最新金额 / Resolve pending attendance and verify the current total', 409);
      }
      const [saved] = await q<Payment>(`INSERT INTO workspace_payroll_payments(user_id,work_month,total_cents)
        VALUES (?,?,?) RETURNING paid_at AS "paidAt"`, [target, start, expectedTotalCents]);
      await audit('payroll.paid', `${target}:${month}`);
      return { paidAt: saved.paidAt.toISOString() };
    },
  };
}
