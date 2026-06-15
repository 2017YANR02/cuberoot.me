import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Collection, CollectionInsert, Course } from "@/db/schema";

export type { Collection };

function newCollectionId(): string {
  return "col_" + randomBytes(6).toString("base64url");
}

function newItemId(): string {
  return "ci_" + randomBytes(6).toString("base64url");
}

// ───────────────────────── 起始演示路径(表空时插入) ─────────────────────────
// item 关联的 courseId 在 ensureCollectionsSeeded() 里按实际存在的课程动态绑定,
// 这里只声明每条路径想收哪些课(按 seed 课程 id),关联不到就退化为「现有前几门课」。
type SeedPath = {
  title: string;
  subtitle: string;
  description: string;
  preferred: string[]; // 期望关联的 seed 课程 id,按顺序
};

const SEED_PATHS: SeedPath[] = [
  {
    title: "从零到 sub-30 入门路线",
    subtitle: "零基础到 30 秒以内的完整进阶路径",
    description:
      "面向刚接触三阶魔方的新手:先用启蒙课建立空间感与基础手法,再切入 CFOP 系统课打通公式体系,最后用私教纠正手法瓶颈,稳步把成绩压进 30 秒。",
    preferred: ["kids-starter", "cfop-foundation", "1v1-coaching"],
  },
  {
    title: "CFOP 进阶路线",
    subtitle: "打通 F2L / OLL / PLL 到竞速实战",
    description:
      "已掌握基础还原、想冲竞速的玩家:以 CFOP 系统课夯实四步法,叠加 ZBLL 速攻训练营拓展高阶公式,最后进赛前突击营按 WCA 流程做实战模拟。",
    preferred: ["cfop-foundation", "zbll-attack", "competition-prep"],
  },
  {
    title: "盲拧专项路线",
    subtitle: "从睁眼还原跨进盲拧世界",
    description:
      "想解锁盲拧成就的进阶玩家:在熟练 CFOP 的基础上,系统学习编码与记忆法,再用私教打磨执行稳定性,完成第一个成功的盲拧还原。",
    preferred: ["cfop-foundation", "blind-cube", "1v1-coaching"],
  },
];

let seededOnce = false;

// 幂等:表空才插入起始路径;关联课程按真实存在的 id 绑定。
export async function ensureCollectionsSeeded(): Promise<void> {
  if (seededOnce) return;
  const countRow = db
    .select({ n: sql<number>`COUNT(*)` })
    .from(schema.collections)
    .all();
  if ((countRow[0]?.n ?? 0) > 0) {
    seededOnce = true;
    return;
  }

  const allCourses = db
    .select({ id: schema.courses.id })
    .from(schema.courses)
    .all();
  if (allCourses.length === 0) {
    // 没有任何课程可关联,不插入空路径(避免出现 0 课程的合集);下次再试。
    return;
  }
  const courseIds = new Set(allCourses.map((c) => c.id));
  const fallbackIds = allCourses.map((c) => c.id);
  const now = Math.floor(Date.now() / 1000);

  SEED_PATHS.forEach((path, pi) => {
    const collectionId = newCollectionId();
    const values: CollectionInsert = {
      id: collectionId,
      title: path.title,
      subtitle: path.subtitle,
      description: path.description,
      coverUrl: null,
      sortOrder: pi,
      createdAt: now,
    };
    db.insert(schema.collections).values(values).run();

    // 解析关联课程:优先用 preferred 中存在的,关联不到则退化为前几门课,去重。
    let resolved = path.preferred.filter((id) => courseIds.has(id));
    if (resolved.length === 0) {
      resolved = fallbackIds.slice(0, Math.min(3, fallbackIds.length));
    }
    const seen = new Set<string>();
    let idx = 0;
    for (const courseId of resolved) {
      if (seen.has(courseId)) continue;
      seen.add(courseId);
      db.insert(schema.collectionItems)
        .values({ id: newItemId(), collectionId, courseId, idx })
        .run();
      idx += 1;
    }
  });

  seededOnce = true;
}

export type CollectionWithCount = Collection & { courseCount: number };

// 公开路径列表:每条带课程数,按 sortOrder 升序。
export async function listCollections(): Promise<CollectionWithCount[]> {
  await ensureCollectionsSeeded();
  const rows = db
    .select()
    .from(schema.collections)
    .orderBy(asc(schema.collections.sortOrder), asc(schema.collections.createdAt))
    .all();
  if (rows.length === 0) return [];

  const counts = db
    .select({
      collectionId: schema.collectionItems.collectionId,
      n: sql<number>`COUNT(*)`,
    })
    .from(schema.collectionItems)
    .groupBy(schema.collectionItems.collectionId)
    .all();
  const countMap = new Map(counts.map((c) => [c.collectionId, c.n]));
  return rows.map((r) => ({ ...r, courseCount: countMap.get(r.id) ?? 0 }));
}

export async function findById(id: string): Promise<Collection | undefined> {
  const rows = db
    .select()
    .from(schema.collections)
    .where(eq(schema.collections.id, id))
    .all();
  return rows[0];
}

export type CollectionCourse = Course & {
  itemId: string;
  itemIdx: number;
  progressPercent: number;
  completedLessons: number;
  totalLessons: number;
};

export type CollectionDetail = {
  collection: Collection;
  courses: CollectionCourse[];
};

// 合集详情:按 idx 排序的课程列表 join courses;传 userId 则附每课完成度。
export async function getCollectionWithCourses(
  id: string,
  userId?: string,
): Promise<CollectionDetail | undefined> {
  await ensureCollectionsSeeded();
  const collection = await findById(id);
  if (!collection) return undefined;

  const itemRows = db
    .select({
      itemId: schema.collectionItems.id,
      itemIdx: schema.collectionItems.idx,
      course: schema.courses,
    })
    .from(schema.collectionItems)
    .innerJoin(
      schema.courses,
      eq(schema.collectionItems.courseId, schema.courses.id),
    )
    .where(eq(schema.collectionItems.collectionId, id))
    .orderBy(asc(schema.collectionItems.idx))
    .all();

  if (itemRows.length === 0) {
    return { collection, courses: [] };
  }

  const courseIds = itemRows.map((r) => r.course.id);

  // 每门课总节数(lessons 行数)
  const lessonCounts = db
    .select({
      courseId: schema.lessons.courseId,
      n: sql<number>`COUNT(*)`,
    })
    .from(schema.lessons)
    .where(inArray(schema.lessons.courseId, courseIds))
    .groupBy(schema.lessons.courseId)
    .all();
  const totalMap = new Map(lessonCounts.map((c) => [c.courseId, c.n]));

  // 登录用户每门课已完成节数
  const completedMap = new Map<string, number>();
  if (userId) {
    const progressRows = db
      .select({
        courseId: schema.learningProgress.courseId,
        n: sql<number>`COUNT(*)`,
      })
      .from(schema.learningProgress)
      .where(
        and(
          eq(schema.learningProgress.userId, userId),
          eq(schema.learningProgress.completed, true),
          inArray(schema.learningProgress.courseId, courseIds),
        ),
      )
      .groupBy(schema.learningProgress.courseId)
      .all();
    for (const r of progressRows) completedMap.set(r.courseId, r.n);
  }

  const courses: CollectionCourse[] = itemRows.map((r) => {
    const total = totalMap.get(r.course.id) ?? 0;
    const completed = userId ? completedMap.get(r.course.id) ?? 0 : 0;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return {
      ...r.course,
      itemId: r.itemId,
      itemIdx: r.itemIdx,
      totalLessons: total,
      completedLessons: completed,
      progressPercent: percent,
    };
  });

  return { collection, courses };
}

// ───────────────────────── admin 写入 ─────────────────────────

export type CollectionPatch = {
  title?: string;
  subtitle?: string | null;
  description?: string | null;
  coverUrl?: string | null;
  sortOrder?: number;
};

export async function createCollection(input: {
  title: string;
  subtitle?: string | null;
  description?: string | null;
  coverUrl?: string | null;
  sortOrder?: number;
}): Promise<Collection> {
  const now = Math.floor(Date.now() / 1000);
  const id = newCollectionId();
  const values: CollectionInsert = {
    id,
    title: input.title,
    subtitle: input.subtitle ?? null,
    description: input.description ?? null,
    coverUrl: input.coverUrl ?? null,
    sortOrder: input.sortOrder ?? 0,
    createdAt: now,
  };
  await db.insert(schema.collections).values(values);
  const row = await findById(id);
  if (!row) throw new Error("collection create failed");
  return row;
}

export async function updateCollection(
  id: string,
  patch: CollectionPatch,
): Promise<void> {
  const set: Partial<CollectionInsert> = {};
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.subtitle !== undefined) set.subtitle = patch.subtitle;
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.coverUrl !== undefined) set.coverUrl = patch.coverUrl;
  if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder;
  if (Object.keys(set).length === 0) return;
  await db.update(schema.collections).set(set).where(eq(schema.collections.id, id));
}

export async function deleteCollection(id: string): Promise<void> {
  await db.delete(schema.collectionItems).where(eq(schema.collectionItems.collectionId, id));
  await db.delete(schema.collections).where(eq(schema.collections.id, id));
}

export type CollectionItemRow = {
  itemId: string;
  courseId: string;
  idx: number;
  title: string;
};

// admin 编辑页:列出某合集已收的课程项(按 idx)
export async function listItems(collectionId: string): Promise<CollectionItemRow[]> {
  const rows = db
    .select({
      itemId: schema.collectionItems.id,
      courseId: schema.collectionItems.courseId,
      idx: schema.collectionItems.idx,
      title: schema.courses.title,
    })
    .from(schema.collectionItems)
    .innerJoin(
      schema.courses,
      eq(schema.collectionItems.courseId, schema.courses.id),
    )
    .where(eq(schema.collectionItems.collectionId, collectionId))
    .orderBy(asc(schema.collectionItems.idx))
    .all();
  return rows;
}

async function nextItemIdx(collectionId: string): Promise<number> {
  const rows = db
    .select({ idx: schema.collectionItems.idx })
    .from(schema.collectionItems)
    .where(eq(schema.collectionItems.collectionId, collectionId))
    .all();
  if (rows.length === 0) return 0;
  return Math.max(...rows.map((r) => r.idx)) + 1;
}

// 加一门课到合集尾部;已存在(唯一约束)则忽略,返回是否新增。
export async function addItem(
  collectionId: string,
  courseId: string,
): Promise<boolean> {
  const exists = db
    .select({ id: schema.collectionItems.id })
    .from(schema.collectionItems)
    .where(
      and(
        eq(schema.collectionItems.collectionId, collectionId),
        eq(schema.collectionItems.courseId, courseId),
      ),
    )
    .all();
  if (exists.length > 0) return false;
  const idx = await nextItemIdx(collectionId);
  await db.insert(schema.collectionItems).values({
    id: newItemId(),
    collectionId,
    courseId,
    idx,
  });
  return true;
}

export async function removeItem(itemId: string): Promise<void> {
  await db.delete(schema.collectionItems).where(eq(schema.collectionItems.id, itemId));
}

// 把 itemId 在所属合集内上移 / 下移一位(与相邻项交换 idx)。
export async function moveItem(
  itemId: string,
  direction: "up" | "down",
): Promise<void> {
  const current = db
    .select()
    .from(schema.collectionItems)
    .where(eq(schema.collectionItems.id, itemId))
    .all()[0];
  if (!current) return;

  const siblings = db
    .select()
    .from(schema.collectionItems)
    .where(eq(schema.collectionItems.collectionId, current.collectionId))
    .orderBy(asc(schema.collectionItems.idx))
    .all();
  const pos = siblings.findIndex((s) => s.id === itemId);
  if (pos === -1) return;
  const swapPos = direction === "up" ? pos - 1 : pos + 1;
  if (swapPos < 0 || swapPos >= siblings.length) return;

  const other = siblings[swapPos];
  // 交换两项的 idx
  await db
    .update(schema.collectionItems)
    .set({ idx: other.idx })
    .where(eq(schema.collectionItems.id, current.id));
  await db
    .update(schema.collectionItems)
    .set({ idx: current.idx })
    .where(eq(schema.collectionItems.id, other.id));
}

// admin 重排:按给定 itemId 顺序重写 idx(0..n)。
export async function reorderItems(
  collectionId: string,
  orderedItemIds: string[],
): Promise<void> {
  const rows = db
    .select({ id: schema.collectionItems.id })
    .from(schema.collectionItems)
    .where(eq(schema.collectionItems.collectionId, collectionId))
    .all();
  const valid = new Set(rows.map((r) => r.id));
  let idx = 0;
  for (const id of orderedItemIds) {
    if (!valid.has(id)) continue;
    await db
      .update(schema.collectionItems)
      .set({ idx })
      .where(eq(schema.collectionItems.id, id));
    idx += 1;
  }
}
