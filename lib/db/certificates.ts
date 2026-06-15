import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Certificate, CertificateInsert } from "@/db/schema";

export type { Certificate };

function newCertId(): string {
  return "cert_" + randomBytes(9).toString("base64url");
}

// 短验证码:8 位大写字母数字,去掉易混淆字符(0/O/1/I)。印在证书上、用于 /cert/[code]。
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newCertCode(): string {
  const buf = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) out += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
  return out;
}

/**
 * 该课是否已学完:课程下所有 lessons 在 learning_progress 里 completed=true。
 * 边界:课程没有任何 lesson 时无从「学完」,返回 false(避免给空课发证)。
 */
export async function isCourseCompleted(
  userId: string,
  courseId: string,
): Promise<boolean> {
  const lessons = db
    .select({ id: schema.lessons.id })
    .from(schema.lessons)
    .where(eq(schema.lessons.courseId, courseId))
    .all();
  if (lessons.length === 0) return false;

  const progress = db
    .select({ lessonId: schema.learningProgress.lessonId })
    .from(schema.learningProgress)
    .where(
      and(
        eq(schema.learningProgress.userId, userId),
        eq(schema.learningProgress.courseId, courseId),
        eq(schema.learningProgress.completed, true),
      ),
    )
    .all();
  const done = new Set(progress.map((p) => p.lessonId));
  return lessons.every((l) => done.has(l.id));
}

export async function getByCode(code: string): Promise<Certificate | undefined> {
  if (!code) return undefined;
  const rows = db
    .select()
    .from(schema.certificates)
    .where(eq(schema.certificates.code, code))
    .all();
  return rows[0];
}

export async function findByUserCourse(
  userId: string,
  courseId: string,
): Promise<Certificate | undefined> {
  const rows = db
    .select()
    .from(schema.certificates)
    .where(
      and(
        eq(schema.certificates.userId, userId),
        eq(schema.certificates.courseId, courseId),
      ),
    )
    .all();
  return rows[0];
}

export async function listByUser(userId: string): Promise<Certificate[]> {
  return db
    .select()
    .from(schema.certificates)
    .where(eq(schema.certificates.userId, userId))
    .orderBy(desc(schema.certificates.issuedAt))
    .all();
}

export type IssueResult =
  | { ok: true; certificate: Certificate; existed: boolean }
  | { ok: false; reason: "not_completed" | "course_not_found" };

/**
 * 颁发结课证书。幂等:已发过直接返回原证书(不重发、不刷新日期)。
 * 校验该课确已学完才发;颁发时快照当下的 user.nickname + course.title。
 */
export async function issueCertificate(
  userId: string,
  courseId: string,
): Promise<IssueResult> {
  const existing = await findByUserCourse(userId, courseId);
  if (existing) return { ok: true, certificate: existing, existed: true };

  const course = db
    .select()
    .from(schema.courses)
    .where(eq(schema.courses.id, courseId))
    .all()[0];
  if (!course) return { ok: false, reason: "course_not_found" };

  const completed = await isCourseCompleted(userId, courseId);
  if (!completed) return { ok: false, reason: "not_completed" };

  const user = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .all()[0];
  const userName = user?.nickname?.trim() || "魔方学员";

  // 唯一短码;极小概率撞车则重试几次。
  let code = newCertCode();
  for (let i = 0; i < 5; i++) {
    const clash = await getByCode(code);
    if (!clash) break;
    code = newCertCode();
  }

  const values: CertificateInsert = {
    id: newCertId(),
    code,
    userId,
    courseId,
    userName,
    courseTitle: course.title,
    issuedAt: Math.floor(Date.now() / 1000),
  };

  try {
    await db.insert(schema.certificates).values(values);
  } catch {
    // 并发下唯一约束(user,course)可能已被另一请求写入,回读返回它。
    const raced = await findByUserCourse(userId, courseId);
    if (raced) return { ok: true, certificate: raced, existed: true };
    throw new Error("issueCertificate failed");
  }

  const row = await getByCode(code);
  if (!row) throw new Error("issueCertificate readback failed");
  return { ok: true, certificate: row, existed: false };
}

/** 公开验证:有该 code 即有效(证书一经颁发不撤销)。 */
export async function verify(
  code: string,
): Promise<{ valid: boolean; certificate?: Certificate }> {
  const cert = await getByCode(code);
  return cert ? { valid: true, certificate: cert } : { valid: false };
}
