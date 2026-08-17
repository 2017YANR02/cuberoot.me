import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { UserAchievement } from "@/db/schema";
import { getStreakInfo } from "@/lib/db/checkins";

export type { UserAchievement };

// 成就分类:学习 / 计时 / 社群 / 交易。
export type AchievementCategory =
  | "learning"
  | "timer"
  | "community"
  | "commerce";

// 一条成就目录项:key 稳定不可改(已写进流水 refId / user_achievements 主键),
// name/description 可改;icon 为 lucide-react 图标名(BadgeWall 按名取组件);
// points 为解锁奖励积分(0 表示无奖励);check 注释解锁规则。
export type Achievement = {
  key: string;
  name: string;
  description: string;
  icon: string; // lucide-react icon name
  category: AchievementCategory;
  points: number;
  // check 规则用注释说明,实际判定在 recomputeAchievements 里按 UserStats 逐条算。
};

// ───────────────────────── 成就目录(代码定义,非 DB) ─────────────────────────
// 改这里只增不删 key;新增成就直接 push,旧用户下次触发 recompute 时补发。
export const ACHIEVEMENTS: Achievement[] = [
  {
    key: "first_lesson",
    name: "第一课",
    description: "完成你的第一节课程",
    icon: "GraduationCap",
    category: "learning",
    points: 20,
    // check: completedLessons >= 1
  },
  {
    key: "lessons_5",
    name: "勤学不辍",
    description: "累计完成 5 节课程",
    icon: "BookOpenCheck",
    category: "learning",
    points: 50,
    // check: completedLessons >= 5
  },
  {
    key: "first_post",
    name: "初次发声",
    description: "在社群发布第一个帖子",
    icon: "MessageSquarePlus",
    category: "community",
    points: 20,
    // check: posts >= 1
  },
  {
    key: "posts_10",
    name: "活跃分享者",
    description: "累计发布 10 个帖子",
    icon: "MessagesSquare",
    category: "community",
    points: 60,
    // check: posts >= 10
  },
  {
    key: "first_review",
    name: "乐于点评",
    description: "提交第一条课程评价",
    icon: "Star",
    category: "community",
    points: 20,
    // check: reviews >= 1
  },
  {
    key: "streak_7",
    name: "七日不辍",
    description: "连续签到满 7 天",
    icon: "Flame",
    category: "learning",
    points: 70,
    // check: longestStreak >= 7
  },
  {
    key: "streak_30",
    name: "月度坚持",
    description: "连续签到满 30 天",
    icon: "CalendarHeart",
    category: "learning",
    points: 200,
    // check: longestStreak >= 30
  },
  {
    key: "first_order",
    name: "首次下单",
    description: "完成第一笔付费订单",
    icon: "ShoppingBag",
    category: "commerce",
    points: 30,
    // check: paidOrders >= 1
  },
  {
    key: "spend_1000",
    name: "鼎力支持",
    description: "累计消费满 1000 元",
    icon: "Wallet",
    category: "commerce",
    points: 100,
    // check: 累计实付(amount-discount, 单位元) >= 1000
  },
  {
    key: "first_solve",
    name: "第一次还原",
    description: "用计时器记录第一次还原成绩",
    icon: "Timer",
    category: "timer",
    points: 20,
    // check: solves >= 1
  },
  {
    key: "solves_100",
    name: "百次磨练",
    description: "累计计时还原满 100 次",
    icon: "Repeat",
    category: "timer",
    points: 80,
    // check: solves >= 100
  },
  {
    key: "sub_10s",
    name: "破十达人",
    description: "三阶有效成绩突破 10 秒",
    icon: "Zap",
    category: "timer",
    points: 150,
    // check: best333Ms 有值且 < 10000
  },
  {
    key: "points_1000",
    name: "积分达人",
    description: "积分余额达到 1000",
    icon: "Trophy",
    category: "commerce",
    points: 100,
    // check: pointsBalance >= 1000(用解锁前余额判定,避免自我奖励循环触顶)
  },
];

// key → 目录项,便于按 key 取 name/points。
const BY_KEY: Map<string, Achievement> = new Map(
  ACHIEVEMENTS.map((a) => [a.key, a]),
);

function newLedgerId(): string {
  return (
    "pl_" +
    randomBytes(9)
      .toString("base64")
      .replace(/=+$/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
  );
}

// 用户当前可被成就规则判定的状态快照。
type UserStats = {
  completedLessons: number;
  posts: number;
  reviews: number;
  paidOrders: number;
  totalSpentCents: number; // 已付订单实付金额合计(分)
  solves: number;
  best333Ms: number | null; // 三阶最好有效成绩(ms),全 DNF / 无成绩为 null
  longestStreak: number;
  pointsBalance: number; // 当前积分余额(本次解锁奖励之前)
};

// 一次性收集判定所需的全部状态(尽量直接 db+schema 查,不 import points.ts 防循环)。
async function collectStats(userId: string): Promise<UserStats> {
  const completedLessons =
    db
      .select({ n: sql<number>`COUNT(*)` })
      .from(schema.learningProgress)
      .where(
        and(
          eq(schema.learningProgress.userId, userId),
          eq(schema.learningProgress.completed, true),
        ),
      )
      .all()[0]?.n ?? 0;

  const posts =
    db
      .select({ n: sql<number>`COUNT(*)` })
      .from(schema.posts)
      .where(eq(schema.posts.authorId, userId))
      .all()[0]?.n ?? 0;

  const reviews =
    db
      .select({ n: sql<number>`COUNT(*)` })
      .from(schema.courseReviews)
      .where(eq(schema.courseReviews.userId, userId))
      .all()[0]?.n ?? 0;

  const paidAgg =
    db
      .select({
        n: sql<number>`COUNT(*)`,
        spent: sql<number>`COALESCE(SUM(${schema.orders.amount} - ${schema.orders.discount}), 0)`,
      })
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.userId, userId),
          eq(schema.orders.status, "paid"),
        ),
      )
      .all()[0] ?? { n: 0, spent: 0 };
  const paidOrders = paidAgg.n ?? 0;
  const totalSpentCents = Math.max(0, paidAgg.spent ?? 0);

  const solves =
    db
      .select({ n: sql<number>`COUNT(*)` })
      .from(schema.timerSolves)
      .where(eq(schema.timerSolves.userId, userId))
      .all()[0]?.n ?? 0;

  // 三阶最好有效成绩:排除 DNF;+2 加 2000ms 后取最小。
  const best333Row = db
    .select({
      best: sql<number | null>`MIN(
        CASE
          WHEN ${schema.timerSolves.penalty} = 'plus2' THEN ${schema.timerSolves.timeMs} + 2000
          ELSE ${schema.timerSolves.timeMs}
        END
      )`,
    })
    .from(schema.timerSolves)
    .where(
      and(
        eq(schema.timerSolves.userId, userId),
        eq(schema.timerSolves.event, "333"),
        sql`${schema.timerSolves.penalty} != 'dnf'`,
      ),
    )
    .all()[0];
  const best333Ms =
    best333Row && best333Row.best != null ? Number(best333Row.best) : null;

  const pointsBalance =
    db
      .select({
        total: sql<number>`COALESCE(SUM(${schema.pointLedger.delta}), 0)`,
      })
      .from(schema.pointLedger)
      .where(eq(schema.pointLedger.userId, userId))
      .all()[0]?.total ?? 0;

  const streak = await getStreakInfo(userId);

  return {
    completedLessons,
    posts,
    reviews,
    paidOrders,
    totalSpentCents,
    solves,
    best333Ms,
    longestStreak: streak.longest,
    pointsBalance,
  };
}

// 按 key 判定是否满足解锁条件(纯函数,基于状态快照)。
function isUnlocked(key: string, s: UserStats): boolean {
  switch (key) {
    case "first_lesson":
      return s.completedLessons >= 1;
    case "lessons_5":
      return s.completedLessons >= 5;
    case "first_post":
      return s.posts >= 1;
    case "posts_10":
      return s.posts >= 10;
    case "first_review":
      return s.reviews >= 1;
    case "streak_7":
      return s.longestStreak >= 7;
    case "streak_30":
      return s.longestStreak >= 30;
    case "first_order":
      return s.paidOrders >= 1;
    case "spend_1000":
      // orders.amount 单位是【元】(全站 ¥{amount} 直接显示),阈值 = 1000 元
      return s.totalSpentCents >= 1000;
    case "first_solve":
      return s.solves >= 1;
    case "solves_100":
      return s.solves >= 100;
    case "sub_10s":
      return s.best333Ms != null && s.best333Ms < 10_000;
    case "points_1000":
      return s.pointsBalance >= 1000;
    default:
      return false;
  }
}

// 已解锁的 key 集合。
function unlockedKeys(userId: string): Set<string> {
  const rows = db
    .select({ key: schema.userAchievements.achievementKey })
    .from(schema.userAchievements)
    .where(eq(schema.userAchievements.userId, userId))
    .all();
  return new Set(rows.map((r) => r.key));
}

// 重新计算并补发用户成就:对每条目录项判定,新满足且未解锁的写入 user_achievements,
// 并把奖励积分直接 insert point_ledger(不 import points.ts 防循环依赖)。
// 返回本次新解锁的成就 key 列表。
export async function recomputeAchievements(
  userId: string,
): Promise<string[]> {
  if (!userId) return [];

  const already = unlockedKeys(userId);
  // 先收集状态(points 余额取本次解锁前快照,避免自我奖励叠加导致 points_1000 误触)。
  const stats = await collectStats(userId);

  const newlyUnlocked: string[] = [];
  const now = Math.floor(Date.now() / 1000);

  for (const a of ACHIEVEMENTS) {
    if (already.has(a.key)) continue;
    if (!isUnlocked(a.key, stats)) continue;

    // 防重复:插入前再查一次(并发 / 主键冲突兜底)。
    const existing = db
      .select({ key: schema.userAchievements.achievementKey })
      .from(schema.userAchievements)
      .where(
        and(
          eq(schema.userAchievements.userId, userId),
          eq(schema.userAchievements.achievementKey, a.key),
        ),
      )
      .all();
    if (existing.length > 0) continue;

    try {
      db.insert(schema.userAchievements)
        .values({ userId, achievementKey: a.key, unlockedAt: now })
        .run();
    } catch {
      // 主键冲突视为已解锁,跳过发分。
      continue;
    }

    // 解锁奖励积分:直接写流水(reason=achievement,refId=key 幂等去重)。
    if (a.points > 0) {
      const hasReward =
        db
          .select({ id: schema.pointLedger.id })
          .from(schema.pointLedger)
          .where(
            and(
              eq(schema.pointLedger.userId, userId),
              eq(schema.pointLedger.reason, "achievement"),
              eq(schema.pointLedger.refId, a.key),
            ),
          )
          .limit(1)
          .all().length > 0;
      if (!hasReward) {
        db.insert(schema.pointLedger)
          .values({
            id: newLedgerId(),
            userId,
            delta: a.points,
            reason: "achievement",
            refId: a.key,
            note: a.name,
            createdAt: Math.floor(Date.now() / 1000),
          })
          .run();
      }
    }

    newlyUnlocked.push(a.key);
  }

  return newlyUnlocked;
}

export type UserAchievementView = Achievement & {
  unlocked: boolean;
  unlockedAt: number | null;
};

// 全目录 + 每条是否已解锁 + 解锁时间;按"已解锁在前、目录原序"排列。
export async function listUserAchievements(
  userId: string,
): Promise<UserAchievementView[]> {
  const rows = db
    .select({
      key: schema.userAchievements.achievementKey,
      unlockedAt: schema.userAchievements.unlockedAt,
    })
    .from(schema.userAchievements)
    .where(eq(schema.userAchievements.userId, userId))
    .all();
  const unlockedMap = new Map<string, number>(
    rows.map((r) => [r.key, r.unlockedAt]),
  );

  const views: UserAchievementView[] = ACHIEVEMENTS.map((a) => ({
    ...a,
    unlocked: unlockedMap.has(a.key),
    unlockedAt: unlockedMap.get(a.key) ?? null,
  }));

  // 已解锁在前(按解锁时间倒序),未解锁保持目录原序在后。
  const order = new Map(ACHIEVEMENTS.map((a, i) => [a.key, i]));
  views.sort((x, y) => {
    if (x.unlocked !== y.unlocked) return x.unlocked ? -1 : 1;
    if (x.unlocked && y.unlocked) {
      return (y.unlockedAt ?? 0) - (x.unlockedAt ?? 0);
    }
    return (order.get(x.key) ?? 0) - (order.get(y.key) ?? 0);
  });
  return views;
}

// 给主线 / 个人中心用的概要:已解锁数 / 总数 / 已得成就积分。
export async function achievementSummary(
  userId: string,
): Promise<{ unlocked: number; total: number; earnedPoints: number }> {
  const keys = unlockedKeys(userId);
  let earnedPoints = 0;
  for (const k of keys) earnedPoints += BY_KEY.get(k)?.points ?? 0;
  return { unlocked: keys.size, total: ACHIEVEMENTS.length, earnedPoints };
}
