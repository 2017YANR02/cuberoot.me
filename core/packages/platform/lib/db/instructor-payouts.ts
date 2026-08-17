import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { InstructorPayout, PayoutStatus } from "@/db/schema";
import { newPayoutId } from "@/lib/auth-user";
import { list as listInstructors } from "@/lib/db/instructors";
import {
  earningsByMonth,
  INSTRUCTOR_REVENUE_SHARE,
} from "@/lib/db/instructor-stats";

export type { InstructorPayout, PayoutStatus };

export type PayoutWithInstructor = InstructorPayout & { instructorName: string };

function now(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * 为指定月份(period = "YYYY-MM")生成/刷新每位讲师的结算单。
 * 已标记 paid 的结算单不会被覆盖;pending 的会按最新统计刷新金额。
 */
export async function generatePayouts(
  period: string,
): Promise<{ created: number; updated: number; skipped: number }> {
  const instructors = await listInstructors();
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const ins of instructors) {
    const months = await earningsByMonth(ins.id);
    const row = months.find((m) => m.month === period);
    if (!row || row.orders <= 0) continue;

    const existing = db
      .select()
      .from(schema.instructorPayouts)
      .where(
        and(
          eq(schema.instructorPayouts.instructorId, ins.id),
          eq(schema.instructorPayouts.period, period),
        ),
      )
      .all();
    const prev = existing[0];

    if (prev && prev.status === "paid") {
      skipped += 1;
      continue;
    }

    const grossAmount = row.net;
    const shareAmount = Math.round(grossAmount * INSTRUCTOR_REVENUE_SHARE);

    if (prev) {
      await db
        .update(schema.instructorPayouts)
        .set({
          orderCount: row.orders,
          grossAmount,
          shareRate: INSTRUCTOR_REVENUE_SHARE,
          shareAmount,
        })
        .where(eq(schema.instructorPayouts.id, prev.id));
      updated += 1;
    } else {
      await db.insert(schema.instructorPayouts).values({
        id: newPayoutId(),
        instructorId: ins.id,
        period,
        orderCount: row.orders,
        grossAmount,
        shareRate: INSTRUCTOR_REVENUE_SHARE,
        shareAmount,
        status: "pending",
        createdAt: now(),
      });
      created += 1;
    }
  }

  return { created, updated, skipped };
}

/**
 * 全部结算单,join 讲师名,按 period desc、status 排序。
 */
export async function listPayouts(opts?: {
  status?: PayoutStatus;
}): Promise<PayoutWithInstructor[]> {
  const base = db
    .select({
      payout: schema.instructorPayouts,
      instructorName: schema.instructors.name,
    })
    .from(schema.instructorPayouts)
    .leftJoin(
      schema.instructors,
      eq(schema.instructorPayouts.instructorId, schema.instructors.id),
    )
    .orderBy(
      desc(schema.instructorPayouts.period),
      desc(schema.instructorPayouts.status),
    );

  const rows = opts?.status
    ? base.where(eq(schema.instructorPayouts.status, opts.status)).all()
    : base.all();

  return rows.map((r) => ({
    ...r.payout,
    instructorName: r.instructorName ?? "—",
  }));
}

/**
 * 某讲师的结算单,period desc。
 */
export async function listByInstructor(
  instructorId: string,
): Promise<InstructorPayout[]> {
  return db
    .select()
    .from(schema.instructorPayouts)
    .where(eq(schema.instructorPayouts.instructorId, instructorId))
    .orderBy(desc(schema.instructorPayouts.period))
    .all();
}

/**
 * 把 pending 结算单置 paid,记录打款方式/凭证/备注。仅 pending → paid 生效。
 */
export async function markPaidPayout(
  id: string,
  patch: { method?: string; reference?: string; note?: string },
): Promise<boolean> {
  const res = await db
    .update(schema.instructorPayouts)
    .set({
      status: "paid",
      paidAt: now(),
      method: patch.method ?? null,
      reference: patch.reference ?? null,
      note: patch.note ?? null,
    })
    .where(
      and(
        eq(schema.instructorPayouts.id, id),
        eq(schema.instructorPayouts.status, "pending"),
      ),
    )
    .run();
  return res.changes > 0;
}

/**
 * 全局汇总:待结/已结 笔数与金额(金额用 shareAmount)。
 */
export async function payoutSummary(): Promise<{
  pendingCount: number;
  pendingAmount: number;
  paidCount: number;
  paidAmount: number;
}> {
  const rows = db
    .select({
      status: schema.instructorPayouts.status,
      shareAmount: schema.instructorPayouts.shareAmount,
    })
    .from(schema.instructorPayouts)
    .all();

  let pendingCount = 0;
  let pendingAmount = 0;
  let paidCount = 0;
  let paidAmount = 0;
  for (const r of rows) {
    if (r.status === "paid") {
      paidCount += 1;
      paidAmount += r.shareAmount;
    } else {
      pendingCount += 1;
      pendingAmount += r.shareAmount;
    }
  }
  return { pendingCount, pendingAmount, paidCount, paidAmount };
}
