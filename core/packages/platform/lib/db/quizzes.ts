import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Quiz, QuizInsert, QuizAttempt, QuizAttemptInsert } from "@/db/schema";

export type { Quiz, QuizInsert, QuizAttempt };

function newQuizId(): string {
  return "qz_" + randomBytes(9).toString("base64url");
}

function newAttemptId(): string {
  return "qa_" + randomBytes(9).toString("base64url");
}

// 钳制选项下标到 [0, len-1];越界 / 非整数归 0(出题入口已校验,这里再兜底)。
function clampIdx(idx: number, len: number): number {
  if (!Number.isFinite(idx)) return 0;
  const n = Math.trunc(idx);
  if (len <= 0) return 0;
  return Math.min(Math.max(n, 0), len - 1);
}

// 某 lesson 的全部题目,按 sortOrder 升序(并列时按创建时间)。
export async function listByLesson(lessonId: string): Promise<Quiz[]> {
  return db
    .select()
    .from(schema.quizzes)
    .where(eq(schema.quizzes.lessonId, lessonId))
    .orderBy(asc(schema.quizzes.sortOrder), asc(schema.quizzes.createdAt))
    .all();
}

export async function findById(id: string): Promise<Quiz | undefined> {
  const rows = db
    .select()
    .from(schema.quizzes)
    .where(eq(schema.quizzes.id, id))
    .all();
  return rows[0];
}

export type CreateQuizInput = {
  lessonId: string;
  courseId: string;
  question: string;
  options: string[];
  answerIdx: number;
  explain?: string | null;
  sortOrder?: number;
};

// 下一个 sortOrder(同 lesson 现有最大值 +1,空则 0)。
async function nextSortOrder(lessonId: string): Promise<number> {
  const rows = db
    .select({ sortOrder: schema.quizzes.sortOrder })
    .from(schema.quizzes)
    .where(eq(schema.quizzes.lessonId, lessonId))
    .all();
  if (rows.length === 0) return 0;
  return Math.max(...rows.map((r) => r.sortOrder)) + 1;
}

export async function createQuiz(input: CreateQuizInput): Promise<Quiz> {
  const options = input.options.map((o) => o.trim()).filter((o) => o.length > 0);
  if (options.length < 2) throw new Error("quiz needs at least 2 options");
  const now = Math.floor(Date.now() / 1000);
  const id = newQuizId();
  const values: QuizInsert = {
    id,
    lessonId: input.lessonId,
    courseId: input.courseId,
    question: input.question.trim(),
    options,
    answerIdx: clampIdx(input.answerIdx, options.length),
    explain: input.explain?.trim() || null,
    sortOrder:
      typeof input.sortOrder === "number"
        ? input.sortOrder
        : await nextSortOrder(input.lessonId),
    createdAt: now,
  };
  db.insert(schema.quizzes).values(values).run();
  const row = await findById(id);
  if (!row) throw new Error("quiz create failed");
  return row;
}

export type UpdateQuizInput = {
  id: string;
  question?: string;
  options?: string[];
  answerIdx?: number;
  explain?: string | null;
  sortOrder?: number;
};

export async function updateQuiz(input: UpdateQuizInput): Promise<void> {
  const existing = await findById(input.id);
  if (!existing) return;
  const patch: Partial<QuizInsert> = {};
  let options = existing.options;
  if (input.options !== undefined) {
    const cleaned = input.options.map((o) => o.trim()).filter((o) => o.length > 0);
    if (cleaned.length < 2) throw new Error("quiz needs at least 2 options");
    options = cleaned;
    patch.options = cleaned;
  }
  if (typeof input.question === "string") patch.question = input.question.trim();
  if (typeof input.answerIdx === "number") {
    patch.answerIdx = clampIdx(input.answerIdx, options.length);
  }
  if (input.explain !== undefined) patch.explain = input.explain?.trim() || null;
  if (typeof input.sortOrder === "number") patch.sortOrder = input.sortOrder;
  if (Object.keys(patch).length === 0) return;
  db.update(schema.quizzes).set(patch).where(eq(schema.quizzes.id, input.id)).run();
}

export async function deleteQuiz(id: string): Promise<void> {
  db.delete(schema.quizzes).where(eq(schema.quizzes.id, id)).run();
}

// 记一次作答。correct 由调用方按 answerIdx 判定后传入(数据层不再判分,保持单一判分源)。
export type RecordAttemptInput = {
  userId: string;
  quizId: string;
  lessonId: string;
  selectedIdx: number;
  correct: boolean;
};

export async function recordAttempt(
  input: RecordAttemptInput,
): Promise<QuizAttempt> {
  const now = Math.floor(Date.now() / 1000);
  const values: QuizAttemptInsert = {
    id: newAttemptId(),
    userId: input.userId,
    quizId: input.quizId,
    lessonId: input.lessonId,
    selectedIdx: Math.trunc(input.selectedIdx),
    correct: input.correct,
    createdAt: now,
  };
  db.insert(schema.quizAttempts).values(values).run();
  const row = db
    .select()
    .from(schema.quizAttempts)
    .where(eq(schema.quizAttempts.id, values.id))
    .all()[0];
  if (!row) throw new Error("attempt record failed");
  return row;
}

// 某用户某题的最近一次作答(按时间倒序取首条)。
export async function latestAttempt(
  userId: string,
  quizId: string,
): Promise<QuizAttempt | undefined> {
  const rows = db
    .select()
    .from(schema.quizAttempts)
    .where(
      and(
        eq(schema.quizAttempts.userId, userId),
        eq(schema.quizAttempts.quizId, quizId),
      ),
    )
    .orderBy(desc(schema.quizAttempts.createdAt))
    .limit(1)
    .all();
  return rows[0];
}

// 每题最近一次作答,key = quizId。
export type LessonQuizResult = {
  // 该 lesson 题目总数
  total: number;
  // 已作答且答对的题数(仅统计每题最近一次)
  correctCount: number;
  // 是否每题都已作答(可用于「已完成测验」判定)
  answered: number;
  // quizId -> { selectedIdx, correct } 最近一次作答
  latestByQuiz: Record<string, { selectedIdx: number; correct: boolean }>;
};

// 某用户在某 lesson 的测验结果汇总:每题取最近一次作答,统计正确数 / 总数。
export async function lessonQuizResult(
  userId: string,
  lessonId: string,
): Promise<LessonQuizResult> {
  const quizzes = await listByLesson(lessonId);
  const total = quizzes.length;
  if (total === 0) {
    return { total: 0, correctCount: 0, answered: 0, latestByQuiz: {} };
  }

  // 该用户该 lesson 全部作答按时间倒序;遍历时每题只保留首见(=最近)那条。
  const attempts = db
    .select()
    .from(schema.quizAttempts)
    .where(
      and(
        eq(schema.quizAttempts.userId, userId),
        eq(schema.quizAttempts.lessonId, lessonId),
      ),
    )
    .orderBy(desc(schema.quizAttempts.createdAt))
    .all();

  const quizIds = new Set(quizzes.map((q) => q.id));
  const latestByQuiz: Record<string, { selectedIdx: number; correct: boolean }> = {};
  for (const a of attempts) {
    // 跳过已删题目的历史作答,只统计当前在用题目。
    if (!quizIds.has(a.quizId)) continue;
    if (latestByQuiz[a.quizId]) continue;
    latestByQuiz[a.quizId] = { selectedIdx: a.selectedIdx, correct: a.correct };
  }

  let correctCount = 0;
  let answered = 0;
  for (const q of quizzes) {
    const r = latestByQuiz[q.id];
    if (!r) continue;
    answered += 1;
    if (r.correct) correctCount += 1;
  }

  return { total, correctCount, answered, latestByQuiz };
}
