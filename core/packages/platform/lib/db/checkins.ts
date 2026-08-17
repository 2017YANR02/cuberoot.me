import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { StudyCheckin, StudyCheckinInsert } from "@/db/schema";

export type { StudyCheckin };

function newCheckinId(): string {
  return "ck_" + randomBytes(9).toString("base64url");
}

// 用本地时间(非 UTC)拼今天的 YYYY-MM-DD,避免跨时区差一天。
// 注意:用 new Date() 直接取本地 getFullYear/Month/Date,别 parse 字符串。
export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 把 YYYY-MM-DD 往前推 n 天,返回新的日期字符串(纯算术,不依赖时区解析)。
function shiftDate(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  // 用 UTC 构造仅做天数加减,再读 UTC 字段,绕开本地夏令时跳变。
  const t = Date.UTC(y, m - 1, d) + deltaDays * 86400_000;
  const nd = new Date(t);
  const yy = nd.getUTCFullYear();
  const mm = String(nd.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(nd.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export type CheckInResult = { created: boolean; date: string };

// 幂等签到:今天已签到不报错,返回 created=false;否则插入返回 created=true。
export async function checkInToday(
  userId: string,
  source: string = "study",
): Promise<CheckInResult> {
  const date = localDateStr();
  const existing = db
    .select({ id: schema.studyCheckins.id })
    .from(schema.studyCheckins)
    .where(
      and(
        eq(schema.studyCheckins.userId, userId),
        eq(schema.studyCheckins.date, date),
      ),
    )
    .all()[0];
  if (existing) return { created: false, date };

  const values: StudyCheckinInsert = {
    id: newCheckinId(),
    userId,
    date,
    source,
    createdAt: Math.floor(Date.now() / 1000),
  };
  try {
    db.insert(schema.studyCheckins).values(values).run();
    return { created: true, date };
  } catch {
    // 并发下唯一索引冲突视为已签到(幂等)。
    return { created: false, date };
  }
}

export type StreakInfo = {
  current: number; // 当前连续天数(含今天;今天没签则从昨天起算)
  longest: number; // 历史最长连续天数
  total: number; // 累计签到天数
  dates: string[]; // 最近 365 天内已签到的日期(升序)
  checkedToday: boolean;
};

export async function getStreakInfo(userId: string): Promise<StreakInfo> {
  const rows = db
    .select({ date: schema.studyCheckins.date })
    .from(schema.studyCheckins)
    .where(eq(schema.studyCheckins.userId, userId))
    .all();

  const total = rows.length;
  if (total === 0) {
    return { current: 0, longest: 0, total: 0, dates: [], checkedToday: false };
  }

  const set = new Set(rows.map((r) => r.date));
  const today = localDateStr();
  const checkedToday = set.has(today);

  // 当前连续:从今天往前数;今天没签则从昨天起(不打断昨天攒下的连续)。
  let current = 0;
  let cursor = checkedToday ? today : shiftDate(today, -1);
  while (set.has(cursor)) {
    current += 1;
    cursor = shiftDate(cursor, -1);
  }

  // 最长连续:对全部已签日期排序后扫一遍相邻差。
  const sorted = Array.from(set).sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    if (prev !== null && shiftDate(prev, 1) === d) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
    prev = d;
  }

  // 最近 365 天窗口内的日期(给热力图用)。
  const windowStart = shiftDate(today, -364);
  const dates = sorted.filter((d) => d >= windowStart);

  return { current, longest, total, dates, checkedToday };
}
