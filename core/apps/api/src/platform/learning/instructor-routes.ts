import { requirePlatformActor } from '../auth.js';
import { requireInstructor, platformDb, platformQuery } from '../db.js';
import { privateNoStore } from '../http.js';
import { pagination } from '../validation.js';
import { type Hono } from 'hono';

export function registerInstructorRoutes(platformLearningRoutes: Hono): void {
  platformLearningRoutes.get('/instructor/students', async (c) => {
    const actor = await requirePlatformActor(c);
    const {page,pageSize,offset}=pagination(c);
    const paged=c.req.query('page')!==undefined;
    await requireInstructor(platformDb(), actor);
    const rows = await platformQuery(platformDb(), `
      SELECT DISTINCT COUNT(*) OVER()::int AS "resultTotal", e.id::text AS id, e.user_id::text AS "userId", COALESCE(NULLIF(u.display_name,''), e.user_id::text) AS title,
             e.course_id::text AS "courseId", cr.title_zh AS "courseTitleZh", cr.title_en AS "courseTitleEn", COALESCE(NULLIF(cr.title_zh, ''), cr.title_en) AS "courseTitle",
             e.status, e.valid_from AS "validFrom", e.valid_until AS "validUntil",
             (SELECT COUNT(*)::int FROM platform_lesson_progress p JOIN platform_lessons l ON l.id=p.lesson_id WHERE p.user_id=e.user_id AND l.course_id=e.course_id AND p.status='completed' AND l.status='published') AS "completedLessons",
             (SELECT COUNT(*)::int FROM platform_lessons l WHERE l.course_id=e.course_id AND l.status='published') AS "totalLessons"
      FROM platform_course_owners owner
      JOIN platform_instructors instructor ON instructor.id = owner.instructor_id
      JOIN platform_course_entitlements e ON e.course_id = owner.course_id
      JOIN app_users u ON u.id=e.user_id
      JOIN platform_courses course ON course.id = e.course_id
      LEFT JOIN platform_course_revisions cr ON cr.course_id = course.id AND cr.revision = course.current_revision
      WHERE instructor.user_id = $1 AND instructor.status = 'active' AND owner.status = 'active'
        AND e.user_id IS NOT NULL
      ORDER BY "validFrom" DESC, "userId" LIMIT $2 OFFSET $3
    `, [actor.userId,paged?pageSize:null,paged?offset:0]);
    privateNoStore(c);
    return c.json({items:rows,page,pageSize,total:Number(rows[0]?.resultTotal??0)});
  });

  platformLearningRoutes.get('/instructor/earnings', async (c) => {
    const actor = await requirePlatformActor(c);
    await requireInstructor(platformDb(), actor);
    const rows = await platformQuery(platformDb(), `
      SELECT ledger.id::text, ledger.entry_type AS "entryType", ledger.delta_amount_minor::text AS "amountMinor",
             ledger.currency, ledger.order_id::text AS "orderId", ledger.refund_id::text AS "refundId",
             ledger.created_at AS "createdAt", COALESCE(NULLIF(instructor.display_name_snapshot, ''), instructor.id::text) AS title
      FROM platform_instructor_revenue_ledger ledger
      JOIN platform_instructors instructor ON instructor.id = ledger.instructor_id
      WHERE instructor.user_id = $1 AND instructor.status = 'active'
      ORDER BY ledger.created_at DESC, ledger.id
    `, [actor.userId]);
    privateNoStore(c);
    return c.json({ items: rows });
  });

  platformLearningRoutes.get('/instructor/dashboard',async c=>{
    const actor=await requirePlatformActor(c); const db=platformDb(); const instructorId=await requireInstructor(db,actor);
    const [courses,students,months,payouts,recent]=await Promise.all([
      platformQuery(db,`SELECT COUNT(*)::int AS count FROM platform_course_owners o JOIN platform_courses c ON c.id=o.course_id WHERE o.instructor_id=$1::uuid AND o.status='active' AND c.status<>'archived'`,[instructorId]),
      platformQuery(db,`SELECT COUNT(DISTINCT e.user_id)::int AS count FROM platform_course_owners o JOIN platform_course_entitlements e ON e.course_id=o.course_id WHERE o.instructor_id=$1::uuid AND o.status='active' AND e.status='active'`,[instructorId]),
      platformQuery(db,`SELECT to_char(l.created_at AT TIME ZONE 'Asia/Shanghai','YYYY-MM') AS month,l.currency,
        COUNT(DISTINCT l.order_id) FILTER(WHERE l.entry_type='sale')::int AS orders,
        COALESCE(SUM(l.delta_amount_minor) FILTER(WHERE l.entry_type='sale'),0)::text AS "saleAmountMinor",
        COALESCE(SUM(l.delta_amount_minor) FILTER(WHERE l.entry_type IN ('refund','chargeback')),0)::text AS "refundAmountMinor",
        SUM(l.delta_amount_minor)::text AS "netAmountMinor"
        FROM platform_instructor_revenue_ledger l WHERE l.instructor_id=$1::uuid GROUP BY month,l.currency ORDER BY month DESC,l.currency`,[instructorId]),
      platformQuery(db,`SELECT id::text,payout_number AS "payoutNumber",status,amount_minor::text AS "amountMinor",currency,provider_reference AS "providerReference",paid_at AS "paidAt",created_at AS "createdAt" FROM platform_instructor_payouts WHERE instructor_id=$1::uuid ORDER BY created_at DESC`,[instructorId]),
      platformQuery(db,`SELECT l.id::text,o.order_number AS "orderNumber",COALESCE(NULLIF(u.display_name,''),'—') AS "studentName",o.status,l.currency,l.delta_amount_minor::text AS "amountMinor",l.created_at AS "createdAt"
        FROM platform_instructor_revenue_ledger l LEFT JOIN platform_orders o ON o.id=l.order_id LEFT JOIN app_users u ON u.id=o.buyer_user_id
        WHERE l.instructor_id=$1::uuid ORDER BY l.created_at DESC LIMIT 20`,[instructorId]),
    ]);privateNoStore(c);return c.json({courseCount:courses[0]?.count??0,studentCount:students[0]?.count??0,months,payouts,recent});
  });
}
