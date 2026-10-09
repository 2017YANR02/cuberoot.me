import { platformQuery, type PlatformDb } from './db.js';
import { badRequest } from './errors.js';

/** Server determines today's date; users cannot award themselves points by backdating. */
export function learningDate(timezone: string, now = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const get = (type: string) => parts.find(part => part.type === type)?.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch { return badRequest('A valid IANA timezone is required'); }
}

export function learningStreak(dates: string[], today: string) {
  const days = [...new Set(dates)].map(day => Date.parse(`${day.slice(0, 10)}T00:00:00Z`) / 86400000).filter(Number.isFinite).sort((a, b) => a - b);
  let longest = 0; let run = 0; let previous = -Infinity;
  for (const day of days) { run = day === previous + 1 ? run + 1 : 1; longest = Math.max(longest, run); previous = day; }
  const now = Date.parse(`${today}T00:00:00Z`) / 86400000;
  return { current: previous >= now - 1 ? run : 0, longest, checkedToday: previous === now, total: days.length };
}

/** Same user lock as check-ins. A unique source prevents retries/re-watching awarding points twice. */
export async function awardLearningPoints(db: PlatformDb, userId: number, source: string, points: number): Promise<boolean> {
  if (!points) return false;
  await platformQuery(db, 'SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [userId]);
  const existing = await platformQuery(db, `SELECT id FROM platform_point_ledger WHERE user_id=$1 AND entry_type='achievement' AND reason=$2`, [userId, source]);
  if (existing.length) return false;
  await platformQuery(db, `INSERT INTO platform_point_ledger(user_id,entry_type,delta_points,balance_after,reason)
    SELECT $1,'achievement',$3::integer,COALESCE(SUM(delta_points),0)+$3::integer,$2 FROM platform_point_ledger WHERE user_id=$1`, [userId, source, points]);
  return true;
}

/** Same owner key and approved/nondeleted post rules as the main forum; first posts are already in forum_posts. */
export async function learningAchievementMetrics(db: PlatformDb, userId: number, ownerKey: string): Promise<Record<string, number>> {
  const [stats, dates] = await Promise.all([
    platformQuery(db, `SELECT
      (SELECT COUNT(*)::int FROM platform_lesson_progress WHERE user_id=$1 AND status='completed') AS lessons,
      (SELECT COUNT(*)::int FROM platform_course_reviews WHERE user_id=$1 AND status='published') AS reviews,
      (SELECT COUNT(*)::int FROM platform_orders WHERE buyer_user_id=$1 AND status IN ('paid','fulfilled','partially_fulfilled') AND total_amount_minor>0) AS orders,
      (SELECT COUNT(*)::int FROM forum_posts p JOIN forum_threads t ON t.id=p.thread_id WHERE p.author_id=$2 AND p.status='approved' AND t.status='approved' AND NOT p.is_deleted AND NOT t.is_deleted) AS posts,
      (SELECT COALESCE(SUM(delta_points),0) FROM platform_point_ledger WHERE user_id=$1) AS points,
      (SELECT COALESCE(SUM(GREATEST(0,o.total_amount_minor-COALESCE((SELECT SUM(r.amount_minor) FROM platform_refunds r WHERE r.order_id=o.id AND r.status IN ('succeeded','chargeback')),0))),0)/100.0
        FROM platform_orders o WHERE o.buyer_user_id=$1 AND o.currency='CNY' AND o.paid_at IS NOT NULL AND o.status IN ('paid','fulfilled','partially_fulfilled','partially_refunded','refunded')) AS spent_cny`, [userId, ownerKey]),
    platformQuery<{day:string}>(db,'SELECT local_date::text AS day FROM platform_checkins WHERE user_id=$1',[userId]),
  ]);
  return {...Object.fromEntries(Object.entries(stats[0]??{}).map(([key,value])=>[key,Number(value)])),streak:learningStreak(dates.map(row=>row.day),learningDate('Asia/Shanghai')).longest};
}
