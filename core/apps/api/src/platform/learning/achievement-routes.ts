import { requirePlatformActor } from '../auth.js';
import { platformDb, platformQuery, withIdempotency, sendMutation } from '../db.js';
import { badRequest } from '../errors.js';
import { privateNoStore, publicCache } from '../http.js';
import {
  learningAchievementMetrics,
  awardLearningPoints,
  learningDate,
  learningStreak,
} from '../learning_completion.js';
import { readJsonObject, stringField, pagination, enumField } from '../validation.js';
import { type Hono } from 'hono';

export function registerAchievementRoutes(platformLearningRoutes: Hono): void {
  platformLearningRoutes.get('/me/badges', async (c) => {
    const actor = await requirePlatformActor(c);
    const db = platformDb();
    const metrics = await learningAchievementMetrics(db, actor.userId!, actor.ownerKey);
    const rows = await platformQuery(db, `SELECT a.id::text, a.achievement_key AS "achievementKey", a.title_zh AS "titleZh", a.title_en AS "titleEn",
      a.description_zh AS "descriptionZh", a.description_en AS "descriptionEn", a.point_reward AS "pointReward", a.rule_snapshot AS rule,
      ua.awarded_at AS "awardedAt" FROM platform_achievements a LEFT JOIN platform_user_achievements ua ON ua.achievement_id=a.id AND ua.user_id=$1
      WHERE a.status='active' OR ua.id IS NOT NULL ORDER BY a.created_at,a.id`, [actor.userId]);
    // A read is read-only: award evaluation happens explicitly via the refresh action below.
    privateNoStore(c);
    return c.json({ items: rows.map(row => { const rule = row.rule as Record<string, unknown>; return { ...row, progress: metrics[String(rule.metric)] ?? 0 }; }) });
  });

  platformLearningRoutes.post('/me/badges/refresh', async (c) => {
    const actor = await requirePlatformActor(c);
    const result = await withIdempotency(c, actor, 'learning.badges.refresh', await readJsonObject(c), async db => {
      await platformQuery(db, 'SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [actor.userId]);
      // Snapshot before any award: a badge cannot fund its own threshold.
      const metrics = await learningAchievementMetrics(db, actor.userId!, actor.ownerKey);
      const achievements = await platformQuery(db, `SELECT id::text,rule_snapshot AS rule,point_reward AS points FROM platform_achievements WHERE status='active'`);
      for (const achievement of achievements) {
        const rule = achievement.rule as Record<string, unknown>; const value = metrics[String(rule.metric)];
        if (value === undefined || value < Number(rule.threshold)) continue;
        await platformQuery(db, `INSERT INTO platform_user_achievements(user_id,achievement_id,evidence_snapshot)
          VALUES($1,$2::uuid,$3::jsonb) ON CONFLICT(user_id,achievement_id) DO NOTHING`, [actor.userId,achievement.id,{metric:rule.metric,value}]);
        await awardLearningPoints(db, actor.userId!, `learning:badge:${achievement.id}`, Number(achievement.points));
      }
      return {status:200,body:{refreshed:true},resourceType:'learning_achievements',resourceId:String(actor.userId)};
    });
    return sendMutation(c,result);
  });

  platformLearningRoutes.post('/me/checkins', async (c) => {
    const actor = await requirePlatformActor(c);
    const body = await readJsonObject(c);
    const timezone = stringField(body, 'timezone', { max: 80 }) ?? 'Asia/Shanghai';
    const today = learningDate(timezone);
    const localDate = stringField(body, 'localDate', { max: 10, pattern: /^\d{4}-\d{2}-\d{2}$/ }) ?? today;
    if (localDate !== today) badRequest('Check-in is only available for today');
    const result = await withIdempotency(c, actor, `learning.checkin:${localDate}`, body, async (db) => {
      await platformQuery(db, 'SELECT id FROM app_users WHERE id = $1 FOR UPDATE', [actor.userId]);
      const rows = await platformQuery(db, `
        INSERT INTO platform_checkins (user_id, local_date, timezone, points_awarded)
        VALUES ($1, $2::date, $3, 5)
        ON CONFLICT (user_id, local_date) DO NOTHING
        RETURNING id::text, local_date AS "localDate", timezone, points_awarded AS "pointsAwarded", created_at AS "createdAt"
      `, [actor.userId, localDate, timezone]);
      const balances = await platformQuery<{ balance: string }>(db, `
        SELECT COALESCE(SUM(delta_points),0)::text AS balance FROM platform_point_ledger WHERE user_id=$1
      `, [actor.userId]);
      const previousBalance = Number(balances[0]!.balance);
      if (!rows[0]) {
        const existing = await platformQuery(db, `SELECT id::text, local_date AS "localDate", timezone,
          points_awarded AS "pointsAwarded", created_at AS "createdAt"
          FROM platform_checkins WHERE user_id = $1 AND local_date = $2::date`, [actor.userId, localDate]);
        return { status: 200, body: { ...existing[0], balance: previousBalance }, resourceType: 'checkin', resourceId: String(existing[0]!.id) };
      }
      const checkinId = String(rows[0].id);
      const balance = previousBalance + 5;
      await platformQuery(db, `
        INSERT INTO platform_point_ledger (user_id, entry_type, delta_points, balance_after, checkin_id)
        VALUES ($1, 'checkin', 5, $2, $3::uuid) ON CONFLICT DO NOTHING
      `, [actor.userId, balance, checkinId]);
      return { status: 200, body: { ...rows[0], balance }, resourceType: 'checkin', resourceId: checkinId };
    });
    return sendMutation(c, result);
  });

  platformLearningRoutes.get('/leaderboard', async c => {
    const {page,pageSize,offset}=pagination(c);
    const period=enumField({period:c.req.query('period')??'all'},'period',['week','month','all'] as const)!;
    const metric=enumField({metric:c.req.query('metric')??'points'},'metric',['points','learning'] as const)!;
    const days=period==='week'?7:period==='month'?30:null;
    const source=metric==='points'?`SELECT user_id,SUM(delta_points)::bigint AS value FROM platform_point_ledger WHERE user_id IS NOT NULL AND ($1::int IS NULL OR created_at>=NOW()-make_interval(days=>$1)) GROUP BY user_id`:
      `SELECT user_id,COUNT(*)::bigint AS value FROM platform_lesson_progress WHERE status='completed' AND ($1::int IS NULL OR completed_at>=NOW()-make_interval(days=>$1)) GROUP BY user_id`;
    const items=await platformQuery(platformDb(),`SELECT scores.user_id::text AS id,COALESCE(NULLIF(u.display_name,''),'—') AS title,scores.value::text AS value,
      DENSE_RANK() OVER(ORDER BY scores.value DESC)::int AS rank,COUNT(*) OVER()::int AS "resultTotal"
      FROM (${source}) scores JOIN app_users u ON u.id=scores.user_id WHERE scores.value>0 ORDER BY scores.value DESC,scores.user_id LIMIT $2 OFFSET $3`,[days,pageSize,offset]);
    publicCache(c,items.length>0);return c.json({items,page,pageSize,total:Number(items[0]?.resultTotal??0),metric,period});
  });

  platformLearningRoutes.get('/me/checkins', async c => {
    const actor = await requirePlatformActor(c);
    const timezone = c.req.query('timezone') ?? 'Asia/Shanghai'; const today = learningDate(timezone);
    const [dates,balance] = await Promise.all([
      platformQuery<{day:string}>(platformDb(),'SELECT local_date::text AS day FROM platform_checkins WHERE user_id=$1 ORDER BY local_date',[actor.userId]),
      platformQuery(platformDb(),'SELECT COALESCE(SUM(delta_points),0)::text AS balance FROM platform_point_ledger WHERE user_id=$1',[actor.userId]),
    ]);
    privateNoStore(c); return c.json({...learningStreak(dates.map(row=>row.day),today),today,timezone,balance:Number(balance[0]?.balance??0)});
  });
}
