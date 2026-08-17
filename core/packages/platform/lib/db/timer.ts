import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CubeEventId, SolvePenalty, TimerSolve } from "@/db/schema";

export type { TimerSolve };

function newSolveId(): string {
  return "ts_" + randomBytes(9).toString("base64url");
}

export type InsertSolveInput = {
  event: CubeEventId;
  timeMs: number;
  scramble: string;
  penalty?: SolvePenalty;
};

export async function insertSolve(
  userId: string,
  input: InsertSolveInput,
): Promise<TimerSolve> {
  const now = Math.floor(Date.now() / 1000);
  const id = newSolveId();
  await db.insert(schema.timerSolves).values({
    id,
    userId,
    event: input.event,
    timeMs: Math.max(0, Math.floor(input.timeMs)),
    scramble: input.scramble,
    penalty: input.penalty ?? "none",
    createdAt: now,
  });
  const row = db
    .select()
    .from(schema.timerSolves)
    .where(eq(schema.timerSolves.id, id))
    .all()[0];
  if (!row) throw new Error("insertSolve failed");
  return row;
}

// 最近 N 次,createdAt 降序(最新在前)。
export async function listRecent(
  userId: string,
  event: CubeEventId,
  limit = 50,
): Promise<TimerSolve[]> {
  return db
    .select()
    .from(schema.timerSolves)
    .where(
      and(
        eq(schema.timerSolves.userId, userId),
        eq(schema.timerSolves.event, event),
      ),
    )
    .orderBy(desc(schema.timerSolves.createdAt))
    .limit(Math.max(1, Math.floor(limit)))
    .all();
}

export async function updatePenalty(
  id: string,
  userId: string,
  penalty: SolvePenalty,
): Promise<boolean> {
  const res = db
    .update(schema.timerSolves)
    .set({ penalty })
    .where(
      and(eq(schema.timerSolves.id, id), eq(schema.timerSolves.userId, userId)),
    )
    .run();
  return res.changes > 0;
}

export async function deleteSolve(
  id: string,
  userId: string,
): Promise<boolean> {
  const res = db
    .delete(schema.timerSolves)
    .where(
      and(eq(schema.timerSolves.id, id), eq(schema.timerSolves.userId, userId)),
    )
    .run();
  return res.changes > 0;
}

// ───────────────────────── 统计 ─────────────────────────

// 有效时间(毫秒):+2 加 2000;DNF 用 Infinity 代表"作废"(参与 ao 计算时按最差处理)。
export function effectiveMs(timeMs: number, penalty: SolvePenalty): number {
  if (penalty === "dnf") return Infinity;
  if (penalty === "plus2") return timeMs + 2000;
  return timeMs;
}

// WCA averageOfN:去掉最好 1 个 + 最差 1 个,取中间平均。
// DNF 计为 +Infinity(最差);>1 个 DNF 则整个 average 作废(返回 Infinity = DNF)。
// 入参 effs 为有效时间数组(已含 +2 / Infinity),长度需 == n。
function averageOf(effs: number[]): number {
  const n = effs.length;
  if (n < 3) return Infinity;
  const dnfCount = effs.filter((v) => !Number.isFinite(v)).length;
  if (dnfCount > 1) return Infinity; // 2 个及以上 DNF,该 average 作废
  const sorted = [...effs].sort((a, b) => a - b);
  // 去掉最好(首)和最差(尾,可能是唯一的那个 DNF)
  const middle = sorted.slice(1, n - 1);
  const sum = middle.reduce((acc, v) => acc + v, 0);
  return Math.round(sum / middle.length);
}

// 取最近 n 次(solves 已按"最新在前"排序)算一个滚动 average。
function rollingAverage(solves: TimerSolve[], n: number): number | null {
  if (solves.length < n) return null;
  const recent = solves.slice(0, n);
  const effs = recent.map((s) => effectiveMs(s.timeMs, s.penalty));
  return averageOf(effs);
}

export type TimerStats = {
  count: number;
  best: number | null; // 最好有效时间(ms),全 DNF 时 null
  worst: number | null; // 最差有效时间(排除 DNF),全 DNF 时 null
  mean: number | null; // 所有有效(非 DNF)成绩的算术平均
  ao5: number | null; // 最近 5 次 ao5(Infinity 表示 DNF average → 返回 Infinity 标记)
  ao12: number | null;
};

// best/worst/mean 只看非 DNF 有效时间;ao5/ao12 看最近 N 次(含 DNF 规则)。
// solves 传入顺序:最新在前(listRecent 的顺序)。
export function computeStats(solves: TimerSolve[]): TimerStats {
  const count = solves.length;
  const finite = solves
    .map((s) => effectiveMs(s.timeMs, s.penalty))
    .filter((v) => Number.isFinite(v));

  const best = finite.length ? Math.min(...finite) : null;
  const worst = finite.length ? Math.max(...finite) : null;
  const mean = finite.length
    ? Math.round(finite.reduce((a, b) => a + b, 0) / finite.length)
    : null;

  const ao5 = rollingAverage(solves, 5);
  const ao12 = rollingAverage(solves, 12);

  return { count, best, worst, mean, ao5, ao12 };
}

export async function stats(
  userId: string,
  event: CubeEventId,
): Promise<TimerStats> {
  const solves = await listRecent(userId, event, 1000);
  return computeStats(solves);
}
