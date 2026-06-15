import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db, schema } from "@/db";
import type { PointLedgerRow } from "@/db/schema";
import { recomputeAchievements } from "@/lib/db/achievements";

export type { PointLedgerRow };

// 统一积分账本:正负 delta 记一条流水,余额 = SUM(delta)。
// 所有发分 / 扣分都走 awardPoints(),业务侧别直接 insert point_ledger。
// reason 用稳定字符串标来源,常见值:
//   purchase / lesson_complete / post / checkin / review / streak / membership / refund_clawback
export type PointReason =
  | "purchase"
  | "lesson_complete"
  | "post"
  | "checkin"
  | "review"
  | "streak"
  | "membership"
  | "refund_clawback"
  | (string & {});

export type AwardOpts = {
  refId?: string;
  note?: string;
};

function b64url(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function newLedgerId(): string {
  return "pl_" + b64url(randomBytes(9));
}

// 幂等去重键:同一 (userId, reason, refId) 是否已记过账。
// refId 为空时无法去重,直接返回 false(允许重复,如手动调分场景)。
export function hasAwarded(
  userId: string,
  reason: string,
  refId: string | null | undefined,
): boolean {
  if (!refId) return false;
  const rows = db
    .select({ id: schema.pointLedger.id })
    .from(schema.pointLedger)
    .where(
      and(
        eq(schema.pointLedger.userId, userId),
        eq(schema.pointLedger.reason, reason),
        eq(schema.pointLedger.refId, refId),
      ),
    )
    .limit(1)
    .all();
  return rows.length > 0;
}

// 记一条积分流水(delta 可正可负)。
// 带 refId 时幂等:同 reason+refId 已存在则跳过,返回 null(避免重复发分)。
// 成功写入返回新建的流水行。delta=0 视为无意义,直接跳过。
export async function awardPoints(
  userId: string,
  delta: number,
  reason: PointReason,
  opts: AwardOpts = {},
): Promise<PointLedgerRow | null> {
  const d = Math.trunc(delta);
  if (!userId || d === 0) return null;
  const refId = opts.refId ?? null;
  if (hasAwarded(userId, reason, refId)) return null;

  const now = Math.floor(Date.now() / 1000);
  const row: PointLedgerRow = {
    id: newLedgerId(),
    userId,
    delta: d,
    reason,
    refId,
    note: opts.note ?? null,
    createdAt: now,
  };
  db.insert(schema.pointLedger).values(row).run();
  // 流水写完后重算成就(可能解锁积分类成就;achievements.ts 直接写流水不回调本函数,无循环)。
  await recomputeAchievements(userId);
  return row;
}

// 当前余额 = 该用户所有 delta 之和(无流水返回 0)。
export async function getBalance(userId: string): Promise<number> {
  const rows = db
    .select({ total: sql<number>`COALESCE(SUM(${schema.pointLedger.delta}), 0)` })
    .from(schema.pointLedger)
    .where(eq(schema.pointLedger.userId, userId))
    .all();
  return rows[0]?.total ?? 0;
}

export type LedgerPage = {
  rows: PointLedgerRow[];
  total: number; // 流水条数(用于分页)
  page: number;
  pageSize: number;
};

// 分页流水(按时间倒序),page 从 1 起,limit = 每页条数。
export async function listLedger(
  userId: string,
  opts: { limit?: number; page?: number } = {},
): Promise<LedgerPage> {
  const pageSize = Math.min(Math.max(Math.trunc(opts.limit ?? 20), 1), 100);
  const page = Math.max(Math.trunc(opts.page ?? 1), 1);
  const offset = (page - 1) * pageSize;

  const countRows = db
    .select({ n: sql<number>`COUNT(*)` })
    .from(schema.pointLedger)
    .where(eq(schema.pointLedger.userId, userId))
    .all();
  const total = countRows[0]?.n ?? 0;

  const rows = db
    .select()
    .from(schema.pointLedger)
    .where(eq(schema.pointLedger.userId, userId))
    .orderBy(desc(schema.pointLedger.createdAt), desc(schema.pointLedger.id))
    .limit(pageSize)
    .offset(offset)
    .all();

  return { rows, total, page, pageSize };
}

// 最近 N 条流水(默认 5),给个人中心 / 浮层做简略展示。
export async function recent(
  userId: string,
  limit = 5,
): Promise<PointLedgerRow[]> {
  const n = Math.min(Math.max(Math.trunc(limit), 1), 50);
  return db
    .select()
    .from(schema.pointLedger)
    .where(eq(schema.pointLedger.userId, userId))
    .orderBy(desc(schema.pointLedger.createdAt), desc(schema.pointLedger.id))
    .limit(n)
    .all();
}
