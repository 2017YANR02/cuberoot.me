import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ADMIN_WCA_IDS } from '@cuberoot/shared/admin';
import { isValidZone } from '@cuberoot/shared/tz';
import { isPlanningDate, workSlotsValid, type WorkCalendarData, type WorkPeriod, type WorkException } from '@cuberoot/shared/workspace-planning';
import type { QueryRunner } from '../db/connection.js';

const date = z.string().refine(isPlanningDate).refine(d => d >= '1970-01-01' && d <= '2100-12-31');
const slots = z.array(z.object({ weekday: z.number().int().min(0).max(6), startHour: z.number().int().min(0).max(23), endHour: z.number().int().min(1).max(24) }).strict()).max(168).refine(workSlotsValid, '工作时间重叠或无效 / Overlapping or invalid hours');
const version = z.number().int().min(0);
export const workPatternInput = z.object({ version, from: date, tz: z.string().max(100).refine(isValidZone), slots }).strict();
export const workExceptionInput = z.object({ version, periodId: z.string().uuid(), date, slots: slots.nullable() }).strict();
const periodColumns = 'id, user_id::int AS "userId", effective_from::text AS "from", effective_until::text AS "until", tz, slots';
const eligible = '(u.is_admin OR u.wca_id=ANY(?::text[])) AND u.merged_into_user_id IS NULL AND NOT u.forum_banned';
interface Context { userId: number; admin: boolean; fail: (message: string, status: number) => never; audit: (action: string, id: string) => Promise<void> }
/** Caller holds workspace membership/write transaction lock; every mutation uses the verified account. */
export function workCalendarService(q: QueryRunner, ctx: Context) {
  function authorize() { if (!ctx.admin) ctx.fail('需要管理员权限 / Administrator required', 403); }
  async function bump(expected: number) {
    await q('INSERT INTO workspace_work_calendars(user_id) VALUES (?) ON CONFLICT DO NOTHING', [ctx.userId]);
    const rows = await q('UPDATE workspace_work_calendars SET version=version+1 WHERE user_id=? AND version=? RETURNING version', [ctx.userId, expected]);
    if (!rows.length) ctx.fail('工作时间已更新，请重新加载 / Working hours changed; reload before saving', 409);
  }
  return {
    async list(search: URLSearchParams): Promise<WorkCalendarData> {
      authorize();
      const from = date.parse(search.get('from')), to = date.parse(search.get('to'));
      if (to <= from || Date.parse(to) - Date.parse(from) > 64 * 86400000) ctx.fail('日期范围无效 / Invalid date range', 400);
      const members = await q<WorkCalendarData['members'][number]>(`SELECT u.id::int AS "userId", COALESCE(NULLIF(u.display_name,''),u.id::text) AS name, COALESCE(c.version,0) AS version FROM app_users u LEFT JOIN workspace_work_calendars c ON c.user_id=u.id WHERE ${eligible} ORDER BY u.id`, [[...ADMIN_WCA_IDS]]);
      const ids = members.map(m => m.userId);
      const periods = await q<WorkPeriod>(`SELECT ${periodColumns} FROM workspace_work_periods WHERE user_id=ANY(?::bigint[]) AND effective_from<?::date AND (effective_until IS NULL OR effective_until>?::date) ORDER BY user_id,effective_from`, [ids, to, from]);
      const exceptions = periods.length ? await q<WorkException>('SELECT period_id AS "periodId", work_date::text AS date, slots FROM workspace_work_exceptions WHERE period_id=ANY(?::uuid[]) AND work_date>=?::date AND work_date<?::date', [periods.map(p => p.id), from, to]) : [];
      return { me: ctx.userId, members, periods, exceptions };
    },
    async savePattern(input: unknown) {
      authorize(); const d = workPatternInput.parse(input); await bump(d.version);
      // Replace the chosen date onward. Earlier periods and occurrences stay intact.
      await q('DELETE FROM workspace_work_exceptions WHERE period_id IN (SELECT id FROM workspace_work_periods WHERE user_id=?) AND work_date>=?::date', [ctx.userId, d.from]);
      await q('DELETE FROM workspace_work_periods WHERE user_id=? AND effective_from>=?::date', [ctx.userId, d.from]);
      await q('UPDATE workspace_work_periods SET effective_until=?::date WHERE user_id=? AND effective_from<?::date AND (effective_until IS NULL OR effective_until>?::date)', [d.from, ctx.userId, d.from, d.from]);
      const id = randomUUID();
      await q('INSERT INTO workspace_work_periods(id,user_id,effective_from,tz,slots) VALUES (?,?,?::date,?,?::jsonb)', [id, ctx.userId, d.from, d.tz, d.slots]);
      await ctx.audit('work-calendar.pattern', id);
      return { id, version: d.version + 1 };
    },
    async saveException(input: unknown) {
      authorize(); const d = workExceptionInput.parse(input);
      const [period] = await q<WorkPeriod>(`SELECT ${periodColumns} FROM workspace_work_periods WHERE id=? AND user_id=? AND effective_from<=?::date AND (effective_until IS NULL OR effective_until>?::date)`, [d.periodId, ctx.userId, d.date, d.date]);
      if (!period) ctx.fail('工作安排不存在或无权修改 / Working hours unavailable', 404);
      const weekday = new Date(`${d.date}T00:00:00Z`).getUTCDay();
      if (d.slots?.some(s => s.weekday !== weekday)) ctx.fail('日期与星期不符 / Weekday does not match date', 400);
      await bump(d.version);
      if (d.slots === null) await q('DELETE FROM workspace_work_exceptions WHERE period_id=? AND work_date=?::date', [d.periodId, d.date]);
      else await q('INSERT INTO workspace_work_exceptions(period_id,work_date,slots) VALUES (?,?::date,?::jsonb) ON CONFLICT(period_id,work_date) DO UPDATE SET slots=EXCLUDED.slots', [d.periodId, d.date, d.slots]);
      await ctx.audit('work-calendar.exception', `${d.periodId}:${d.date}`);
      return { version: d.version + 1 };
    },
  };
}
