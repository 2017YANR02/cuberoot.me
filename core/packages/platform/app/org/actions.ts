"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-user";
import {
  archiveTeachingCampus,
  archiveTeachingGroup,
  completeTeachingSession,
  createTeachingCampus,
  createTeachingGroup,
  createTeachingPackageProduct,
  createTeachingSession,
  createTeachingStudentGroupMembership,
  createTeachingStudentPackage,
  createTeachingOrganization,
  createTeachingStudent,
  createTeachingTeacherAssignment,
  listTeachingStudentPackages,
  revokeTeachingStudentGroupMembership,
  revokeTeachingTeacherAssignment,
  saveTeachingAttendanceBatch,
} from "@/lib/teaching-api";
import { teachingErrorMessage } from "@/lib/teaching-labels";

export type CreateOrganizationResult =
  | { ok: true; slug: string }
  | { ok: false; error: string };

export type CreateStudentResult =
  | { ok: true; studentId: string }
  | { ok: false; error: string };

export type TeachingMutationResult =
  | { ok: true; entityId?: string; message: string }
  | { ok: false; error: string };

export type StudentPackageOption = {
  id: string;
  name: string;
  remainingCredits: number;
  creditUnit: "lesson" | "minute";
};

export type LoadStudentPackagesResult =
  | { ok: true; items: StudentPackageOption[]; truncated: boolean }
  | { ok: false; error: string };

export type TeachingAssignmentTarget =
  | { groupId: string; studentId?: never }
  | { studentId: string; groupId?: never };

const OPERATION_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

function validOperationKey(formData: FormData): string | null {
  const value = String(formData.get("operationKey") ?? "");
  return OPERATION_KEY_PATTERN.test(value) ? value : null;
}

function validResourceId(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim().toLowerCase();
  return UUID_PATTERN.test(value) ? value : null;
}

function validAssignmentTarget(value: unknown): TeachingAssignmentTarget | null {
  if (!value || typeof value !== "object") return null;
  const target = value as Record<string, unknown>;
  const hasGroupId = Object.hasOwn(target, "groupId");
  const hasStudentId = Object.hasOwn(target, "studentId");
  if (hasGroupId === hasStudentId) return null;
  if (hasGroupId) {
    return typeof target.groupId === "string" && UUID_PATTERN.test(target.groupId)
      ? { groupId: target.groupId.toLowerCase() }
      : null;
  }
  return typeof target.studentId === "string" && UUID_PATTERN.test(target.studentId)
    ? { studentId: target.studentId.toLowerCase() }
    : null;
}

function integerField(
  formData: FormData,
  key: string,
  minimum: number,
  maximum: number,
): number | null {
  const value = String(formData.get(key) ?? "").trim();
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : null;
}

function validTimestamp(value: string): boolean {
  return ISO_TIMESTAMP_PATTERN.test(value) && Number.isFinite(Date.parse(value));
}

function validOptionalCode(formData: FormData): string | null | false {
  const value = String(formData.get("code") ?? "").trim().toLowerCase();
  if (!value) return null;
  return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(value) ? value : false;
}

function effectiveRange(formData: FormData):
  | { effectiveFrom: string; effectiveTo?: string }
  | null {
  const effectiveFrom = String(formData.get("effectiveFrom") ?? "").trim();
  const effectiveTo = String(formData.get("effectiveTo") ?? "").trim();
  if (
    !validTimestamp(effectiveFrom) ||
    (effectiveTo && (!validTimestamp(effectiveTo) || Date.parse(effectiveTo) <= Date.parse(effectiveFrom)))
  ) {
    return null;
  }
  return effectiveTo ? { effectiveFrom, effectiveTo } : { effectiveFrom };
}

function validTimezone(value: string): boolean {
  if (!value || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export async function createOrganizationAction(
  formData: FormData,
): Promise<CreateOrganizationResult> {
  const user = await requireUser("/org");
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const operationKey = String(formData.get("operationKey") ?? "");
  if (!name || name.length > 160) {
    return { ok: false, error: "机构名称需为 1 至 160 个字符" };
  }
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(slug)) {
    return { ok: false, error: "机构标识只能使用小写字母、数字和中间连字符" };
  }
  if (!OPERATION_KEY_PATTERN.test(operationKey)) {
    return { ok: false, error: "操作标识已失效，请刷新页面后重试" };
  }
  try {
    const organization = await createTeachingOrganization(user, { name, slug }, operationKey);
    revalidatePath("/org");
    return { ok: true, slug: organization.slug };
  } catch (error) {
    return { ok: false, error: teachingErrorMessage(error) };
  }
}

export async function createStudentAction(
  orgSlug: string,
  formData: FormData,
): Promise<CreateStudentResult> {
  const user = await requireUser(`/org/${orgSlug}/students`);
  const displayName = String(formData.get("displayName") ?? "").trim();
  const rawExternalRef = String(formData.get("externalRef") ?? "").trim();
  const operationKey = String(formData.get("operationKey") ?? "");
  if (!displayName || displayName.length > 160) {
    return { ok: false, error: "学员姓名需为 1 至 160 个字符" };
  }
  if (rawExternalRef.length > 100) {
    return { ok: false, error: "学员编号不能超过 100 个字符" };
  }
  if (!OPERATION_KEY_PATTERN.test(operationKey)) {
    return { ok: false, error: "操作标识已失效，请刷新页面后重试" };
  }
  try {
    const student = await createTeachingStudent(user, orgSlug, {
      displayName,
      externalRef: rawExternalRef || null,
    }, operationKey);
    revalidatePath(`/org/${orgSlug}`);
    revalidatePath(`/org/${orgSlug}/students`);
    return { ok: true, studentId: student.id };
  } catch (error) {
    return { ok: false, error: teachingErrorMessage(error) };
  }
}

export async function createCampusAction(
  orgSlug: string,
  formData: FormData,
): Promise<TeachingMutationResult> {
  const user = await requireUser(`/org/${orgSlug}/campuses`);
  const name = String(formData.get("name") ?? "").trim();
  const code = validOptionalCode(formData);
  const timezone = String(formData.get("timezone") ?? "").trim();
  const operationKey = validOperationKey(formData);
  if (!name || name.length > 160) {
    return { ok: false, error: "校区名称需为 1 至 160 个字符" };
  }
  if (code === false) {
    return { ok: false, error: "校区代码需使用小写字母、数字、下划线或连字符" };
  }
  if (timezone && !validTimezone(timezone)) {
    return { ok: false, error: "校区时区无效，或留空继承机构时区" };
  }
  if (!operationKey) {
    return { ok: false, error: "操作标识已失效，请刷新页面后重试" };
  }
  try {
    const campus = await createTeachingCampus(user, orgSlug, {
      name,
      code,
      timezone: timezone || null,
    }, operationKey);
    revalidatePath(`/org/${orgSlug}/campuses`);
    revalidatePath(`/org/${orgSlug}/classes`);
    return { ok: true, entityId: campus.id, message: "校区已创建。" };
  } catch (error) {
    return { ok: false, error: teachingErrorMessage(error) };
  }
}

export async function archiveCampusAction(
  orgSlug: string,
  campusId: string,
  formData: FormData,
): Promise<TeachingMutationResult> {
  const user = await requireUser(`/org/${orgSlug}/campuses`);
  if (!UUID_PATTERN.test(campusId)) {
    return { ok: false, error: "校区标识无效" };
  }
  const operationKey = validOperationKey(formData);
  if (!operationKey) {
    return { ok: false, error: "操作标识已失效，请刷新页面后重试" };
  }
  try {
    await archiveTeachingCampus(user, orgSlug, campusId, operationKey);
    revalidatePath(`/org/${orgSlug}/campuses`);
    revalidatePath(`/org/${orgSlug}/classes`);
    return { ok: true, message: "校区已归档。" };
  } catch (error) {
    return { ok: false, error: teachingErrorMessage(error) };
  }
}

export async function createGroupAction(
  orgSlug: string,
  formData: FormData,
): Promise<TeachingMutationResult> {
  const user = await requireUser(`/org/${orgSlug}/classes`);
  const name = String(formData.get("name") ?? "").trim();
  const code = validOptionalCode(formData);
  const rawCampusId = String(formData.get("campusId") ?? "").trim().toLowerCase();
  const campusId = rawCampusId ? validResourceId(formData, "campusId") : null;
  const operationKey = validOperationKey(formData);
  if (!name || name.length > 160) {
    return { ok: false, error: "班级名称需为 1 至 160 个字符" };
  }
  if (code === false) {
    return { ok: false, error: "班级代码需使用小写字母、数字、下划线或连字符" };
  }
  if (rawCampusId && !campusId) {
    return { ok: false, error: "请选择有效的校区" };
  }
  if (!operationKey) {
    return { ok: false, error: "操作标识已失效，请刷新页面后重试" };
  }
  try {
    const group = await createTeachingGroup(user, orgSlug, { name, code, campusId }, operationKey);
    revalidatePath(`/org/${orgSlug}/classes`);
    return { ok: true, entityId: group.id, message: "班级已创建。" };
  } catch (error) {
    return { ok: false, error: teachingErrorMessage(error) };
  }
}

export async function archiveGroupAction(
  orgSlug: string,
  groupId: string,
  formData: FormData,
): Promise<TeachingMutationResult> {
  const user = await requireUser(`/org/${orgSlug}/classes/${groupId}`);
  if (!UUID_PATTERN.test(groupId)) {
    return { ok: false, error: "班级标识无效" };
  }
  const operationKey = validOperationKey(formData);
  if (!operationKey) {
    return { ok: false, error: "操作标识已失效，请刷新页面后重试" };
  }
  try {
    await archiveTeachingGroup(user, orgSlug, groupId, operationKey);
    revalidatePath(`/org/${orgSlug}/classes`);
    revalidatePath(`/org/${orgSlug}/classes/${groupId}`);
    revalidatePath(`/org/${orgSlug}/students`);
    return { ok: true, message: "班级已归档，相关负责范围已立即停止生效。" };
  } catch (error) {
    return { ok: false, error: teachingErrorMessage(error) };
  }
}

export async function createGroupMembershipAction(
  orgSlug: string,
  groupId: string,
  formData: FormData,
): Promise<TeachingMutationResult> {
  const user = await requireUser(`/org/${orgSlug}/classes/${groupId}`);
  if (!UUID_PATTERN.test(groupId)) {
    return { ok: false, error: "班级标识无效" };
  }
  const studentId = validResourceId(formData, "studentId");
  const range = effectiveRange(formData);
  const operationKey = validOperationKey(formData);
  if (!studentId) {
    return { ok: false, error: "请选择有效的学员" };
  }
  if (!range) {
    return { ok: false, error: "分班有效期无效，结束时间必须晚于开始时间" };
  }
  if (!operationKey) {
    return { ok: false, error: "操作标识已失效，请刷新页面后重试" };
  }
  try {
    const membership = await createTeachingStudentGroupMembership(
      user,
      orgSlug,
      groupId,
      { studentId, ...range },
      operationKey,
    );
    revalidatePath(`/org/${orgSlug}/classes/${groupId}`);
    revalidatePath(`/org/${orgSlug}/students`);
    return { ok: true, entityId: membership.id, message: "学员已加入班级。" };
  } catch (error) {
    return { ok: false, error: teachingErrorMessage(error) };
  }
}

export async function revokeGroupMembershipAction(
  orgSlug: string,
  groupId: string,
  membershipId: string,
  formData: FormData,
): Promise<TeachingMutationResult> {
  const user = await requireUser(`/org/${orgSlug}/classes/${groupId}`);
  if (!UUID_PATTERN.test(groupId) || !UUID_PATTERN.test(membershipId)) {
    return { ok: false, error: "分班关系标识无效" };
  }
  const operationKey = validOperationKey(formData);
  if (!operationKey) {
    return { ok: false, error: "操作标识已失效，请刷新页面后重试" };
  }
  try {
    await revokeTeachingStudentGroupMembership(user, orgSlug, membershipId, operationKey);
    revalidatePath(`/org/${orgSlug}/classes/${groupId}`);
    revalidatePath(`/org/${orgSlug}/students`);
    return { ok: true, message: "学员分班关系已撤销。" };
  } catch (error) {
    return { ok: false, error: teachingErrorMessage(error) };
  }
}

export async function createTeacherAssignmentAction(
  orgSlug: string,
  target: TeachingAssignmentTarget,
  formData: FormData,
): Promise<TeachingMutationResult> {
  const validatedTarget = validAssignmentTarget(target);
  if (!validatedTarget) {
    return { ok: false, error: "负责范围目标无效" };
  }
  const targetPath = "groupId" in validatedTarget
    ? `/org/${orgSlug}/classes/${validatedTarget.groupId}`
    : `/org/${orgSlug}/students/${validatedTarget.studentId}/responsibilities`;
  const user = await requireUser(targetPath);
  const teacherUserId = integerField(formData, "teacherUserId", 1, Number.MAX_SAFE_INTEGER);
  const range = effectiveRange(formData);
  const operationKey = validOperationKey(formData);
  if (teacherUserId === null) {
    return { ok: false, error: "请选择有效的负责人" };
  }
  if (!range) {
    return { ok: false, error: "负责范围有效期无效，结束时间必须晚于开始时间" };
  }
  if (!operationKey) {
    return { ok: false, error: "操作标识已失效，请刷新页面后重试" };
  }
  try {
    const assignment = await createTeachingTeacherAssignment(
      user,
      orgSlug,
      { teacherUserId, ...validatedTarget, ...range },
      operationKey,
    );
    revalidatePath(targetPath);
    revalidatePath(`/org/${orgSlug}/classes`);
    revalidatePath(`/org/${orgSlug}/students`);
    return { ok: true, entityId: assignment.id, message: "负责范围已分配。" };
  } catch (error) {
    return { ok: false, error: teachingErrorMessage(error) };
  }
}

export async function revokeTeacherAssignmentAction(
  orgSlug: string,
  target: TeachingAssignmentTarget,
  assignmentId: string,
  formData: FormData,
): Promise<TeachingMutationResult> {
  const validatedTarget = validAssignmentTarget(target);
  if (!validatedTarget) {
    return { ok: false, error: "负责范围目标无效" };
  }
  const targetPath = "groupId" in validatedTarget
    ? `/org/${orgSlug}/classes/${validatedTarget.groupId}`
    : `/org/${orgSlug}/students/${validatedTarget.studentId}/responsibilities`;
  const user = await requireUser(targetPath);
  if (!UUID_PATTERN.test(assignmentId)) {
    return { ok: false, error: "负责范围标识无效" };
  }
  const operationKey = validOperationKey(formData);
  if (!operationKey) {
    return { ok: false, error: "操作标识已失效，请刷新页面后重试" };
  }
  try {
    await revokeTeachingTeacherAssignment(user, orgSlug, assignmentId, operationKey);
    revalidatePath(targetPath);
    revalidatePath(`/org/${orgSlug}/classes`);
    revalidatePath(`/org/${orgSlug}/students`);
    return { ok: true, message: "负责范围已撤销。" };
  } catch (error) {
    return { ok: false, error: teachingErrorMessage(error) };
  }
}

export async function createPackageProductAction(
  orgSlug: string,
  formData: FormData,
): Promise<TeachingMutationResult> {
  const user = await requireUser(`/org/${orgSlug}/packages`);
  const code = String(formData.get("code") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const creditUnit = String(formData.get("creditUnit") ?? "");
  const creditType = String(formData.get("creditType") ?? "").trim().toLowerCase();
  const totalCredits = integerField(formData, "totalCredits", 1, 1_000_000);
  const rawValidityDays = String(formData.get("validityDays") ?? "").trim();
  const validityDays = rawValidityDays
    ? integerField(formData, "validityDays", 1, 36_500)
    : null;
  const priceAmountMinor = integerField(formData, "priceAmountMinor", 0, Number.MAX_SAFE_INTEGER);
  const currency = String(formData.get("currency") ?? "CNY").trim().toUpperCase();
  const operationKey = validOperationKey(formData);
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(code)) {
    return { ok: false, error: "课包代码需使用小写字母、数字、下划线或连字符" };
  }
  if (!name || name.length > 160) {
    return { ok: false, error: "课包名称需为 1 至 160 个字符" };
  }
  if (creditUnit !== "lesson" && creditUnit !== "minute") {
    return { ok: false, error: "请选择有效的课时单位" };
  }
  if (!/^[a-z][a-z0-9_-]{0,63}$/.test(creditType)) {
    return { ok: false, error: "课时类型需使用小写字母开头的英文标识" };
  }
  if (totalCredits === null) {
    return { ok: false, error: "总课时需为 1 至 1000000 的整数" };
  }
  if (rawValidityDays && validityDays === null) {
    return { ok: false, error: "有效天数需为 1 至 36500 的整数，或留空表示长期有效" };
  }
  if (priceAmountMinor === null) {
    return { ok: false, error: "价格需为非负整数（单位：分）" };
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    return { ok: false, error: "币种需为三个大写英文字母" };
  }
  if (!operationKey) {
    return { ok: false, error: "操作标识已失效，请刷新页面后重试" };
  }
  try {
    const product = await createTeachingPackageProduct(user, orgSlug, {
      code,
      name,
      creditUnit,
      creditType,
      totalCredits,
      validityDays,
      priceAmountMinor,
      currency,
    }, operationKey);
    revalidatePath(`/org/${orgSlug}/packages`);
    return { ok: true, entityId: product.id, message: "课包产品已创建。" };
  } catch (error) {
    return { ok: false, error: teachingErrorMessage(error) };
  }
}

export async function createStudentPackageAction(
  orgSlug: string,
  studentId: string,
  formData: FormData,
): Promise<TeachingMutationResult> {
  const user = await requireUser(`/org/${orgSlug}/students/${studentId}/credits`);
  if (!UUID_PATTERN.test(studentId)) {
    return { ok: false, error: "学员标识无效" };
  }
  const productId = validResourceId(formData, "productId");
  const validFrom = String(formData.get("validFrom") ?? "").trim();
  const operationKey = validOperationKey(formData);
  if (!productId) {
    return { ok: false, error: "请选择有效的课包产品" };
  }
  if (!validTimestamp(validFrom)) {
    return { ok: false, error: "生效时间无效，请重新选择" };
  }
  if (!operationKey) {
    return { ok: false, error: "操作标识已失效，请刷新页面后重试" };
  }
  try {
    const studentPackage = await createTeachingStudentPackage(user, orgSlug, studentId, {
      productId,
      acquisitionType: "grant",
      validFrom,
      sourceSystem: null,
      sourceRef: null,
      sourceLineRef: null,
    }, operationKey);
    revalidatePath(`/org/${orgSlug}/students/${studentId}/credits`);
    return { ok: true, entityId: studentPackage.id, message: "课包已发放。" };
  } catch (error) {
    return { ok: false, error: teachingErrorMessage(error) };
  }
}

export async function loadStudentPackageOptionsAction(
  orgSlug: string,
  studentId: string,
): Promise<LoadStudentPackagesResult> {
  const user = await requireUser(`/org/${orgSlug}/schedule`);
  if (!UUID_PATTERN.test(studentId)) {
    return { ok: false, error: "学员标识无效" };
  }
  try {
    const result = await listTeachingStudentPackages(user, orgSlug, studentId, {
      page: 1,
      pageSize: 100,
    });
    return {
      ok: true,
      truncated: result.total > result.items.length,
      items: result.items
        .filter((item) => item.status === "active" && item.remainingCredits > 0)
        .map((item) => ({
          id: item.id,
          name: item.productNameSnapshot,
          remainingCredits: item.remainingCredits,
          creditUnit: item.creditUnit,
        })),
    };
  } catch (error) {
    return { ok: false, error: teachingErrorMessage(error) };
  }
}

export async function createSessionAction(
  orgSlug: string,
  formData: FormData,
): Promise<TeachingMutationResult> {
  const user = await requireUser(`/org/${orgSlug}/schedule`);
  const title = String(formData.get("title") ?? "").trim();
  const startsAt = String(formData.get("startsAt") ?? "").trim();
  const endsAt = String(formData.get("endsAt") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "").trim();
  const rawTeacherUserId = String(formData.get("teacherUserId") ?? "").trim();
  const teacherUserId = rawTeacherUserId
    ? integerField(formData, "teacherUserId", 1, Number.MAX_SAFE_INTEGER)
    : null;
  const rawAttendees = String(formData.get("attendees") ?? "");
  const operationKey = validOperationKey(formData);
  if (!title || title.length > 160) {
    return { ok: false, error: "课堂标题需为 1 至 160 个字符" };
  }
  if (!validTimestamp(startsAt) || !validTimestamp(endsAt)) {
    return { ok: false, error: "上课与下课时间无效，请重新选择" };
  }
  if (Date.parse(endsAt) <= Date.parse(startsAt)) {
    return { ok: false, error: "下课时间必须晚于上课时间" };
  }
  if (!validTimezone(timezone)) {
    return { ok: false, error: "课堂时区无效" };
  }
  if (rawTeacherUserId && teacherUserId === null) {
    return { ok: false, error: "授课成员无效，请重新选择" };
  }
  if (!rawAttendees || rawAttendees.length > 100_000) {
    return { ok: false, error: "课堂学员数据无效" };
  }
  if (!operationKey) {
    return { ok: false, error: "操作标识已失效，请刷新页面后重试" };
  }
  let attendees: Array<{ studentId: string; studentPackageId: string; creditCost: number }>;
  try {
    const parsed: unknown = JSON.parse(rawAttendees);
    if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 100) throw new Error();
    attendees = parsed.map((item) => {
      if (typeof item !== "object" || item === null || Array.isArray(item)) throw new Error();
      const record = item as Record<string, unknown>;
      const studentId = String(record.studentId ?? "").toLowerCase();
      const studentPackageId = String(record.studentPackageId ?? "").toLowerCase();
      const creditCost = Number(record.creditCost);
      if (
        !UUID_PATTERN.test(studentId) ||
        !UUID_PATTERN.test(studentPackageId) ||
        !Number.isSafeInteger(creditCost) ||
        creditCost < 1 ||
        creditCost > 1_000_000
      ) throw new Error();
      return { studentId, studentPackageId, creditCost };
    });
    if (new Set(attendees.map((item) => item.studentId)).size !== attendees.length) {
      return { ok: false, error: "同一课堂不能重复添加同一名学员" };
    }
  } catch {
    return { ok: false, error: "请选择学员、有效课包，并填写正确的扣课数量" };
  }
  try {
    const session = await createTeachingSession(user, orgSlug, {
      title,
      startsAt,
      endsAt,
      timezone,
      teacherUserIds: teacherUserId === null ? [] : [teacherUserId],
      attendees,
    }, operationKey);
    revalidatePath(`/org/${orgSlug}/schedule`);
    return { ok: true, entityId: session.id, message: "课堂已创建。" };
  } catch (error) {
    return { ok: false, error: teachingErrorMessage(error) };
  }
}

export async function saveAttendanceBatchAction(
  orgSlug: string,
  sessionId: string,
  formData: FormData,
): Promise<TeachingMutationResult> {
  const user = await requireUser(`/org/${orgSlug}/sessions/${sessionId}`);
  if (!UUID_PATTERN.test(sessionId)) {
    return { ok: false, error: "课堂标识无效" };
  }
  const operationKey = validOperationKey(formData);
  const rawRecords = String(formData.get("records") ?? "");
  if (!operationKey) {
    return { ok: false, error: "操作标识已失效，请刷新页面后重试" };
  }
  if (!rawRecords || rawRecords.length > 100_000) {
    return { ok: false, error: "出勤记录无效" };
  }
  let records: Array<{ attendanceId: string; status: "present" | "late" | "absent" | "excused" }>;
  try {
    const parsed: unknown = JSON.parse(rawRecords);
    if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 500) throw new Error();
    records = parsed.map((item) => {
      if (
        typeof item !== "object" || item === null || Array.isArray(item) ||
        !UUID_PATTERN.test(String((item as { attendanceId?: unknown }).attendanceId ?? ""))
      ) throw new Error();
      const status = (item as { status?: unknown }).status;
      if (status !== "present" && status !== "late" && status !== "absent" && status !== "excused") {
        throw new Error();
      }
      return {
        attendanceId: String((item as { attendanceId: unknown }).attendanceId).toLowerCase(),
        status,
      };
    });
    if (new Set(records.map((item) => item.attendanceId)).size !== records.length) throw new Error();
  } catch {
    return { ok: false, error: "出勤记录无效，请刷新页面后重试" };
  }
  try {
    await saveTeachingAttendanceBatch(user, orgSlug, sessionId, records, operationKey);
    revalidatePath(`/org/${orgSlug}/sessions/${sessionId}`);
    revalidatePath(`/org/${orgSlug}/schedule`);
    return { ok: true, message: "出勤已保存。" };
  } catch (error) {
    return { ok: false, error: teachingErrorMessage(error) };
  }
}

export async function completeSessionAction(
  orgSlug: string,
  sessionId: string,
  formData: FormData,
): Promise<TeachingMutationResult> {
  const user = await requireUser(`/org/${orgSlug}/sessions/${sessionId}`);
  if (!UUID_PATTERN.test(sessionId)) {
    return { ok: false, error: "课堂标识无效" };
  }
  const operationKey = validOperationKey(formData);
  if (!operationKey) {
    return { ok: false, error: "操作标识已失效，请刷新页面后重试" };
  }
  try {
    const consumption = await completeTeachingSession(user, orgSlug, sessionId, operationKey);
    revalidatePath(`/org/${orgSlug}/sessions/${sessionId}`);
    revalidatePath(`/org/${orgSlug}/schedule`);
    revalidatePath(`/org/${orgSlug}/students`);
    return {
      ok: true,
      message: `完课成功，已为 ${consumption.attendanceCount} 人扣减 ${consumption.totalCredits} 个课时单位。`,
    };
  } catch (error) {
    return { ok: false, error: teachingErrorMessage(error) };
  }
}
