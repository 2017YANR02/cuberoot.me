import "server-only";

import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import {
  TEACHING_MEMBER_STATUSES,
  TEACHING_ATTENDANCE_STATUSES,
  TEACHING_CREDIT_UNITS,
  TEACHING_ORGANIZATION_STATUSES,
  TEACHING_PACKAGE_ACQUISITION_TYPES,
  TEACHING_PACKAGE_PRODUCT_STATUSES,
  TEACHING_PLATFORM_ASSERTION_AUDIENCE,
  TEACHING_PLATFORM_ASSERTION_HEADER,
  TEACHING_PLATFORM_ASSERTION_ISSUER,
  TEACHING_PLATFORM_ASSERTION_MAX_AGE_SECONDS,
  TEACHING_SESSION_STATUSES,
  TEACHING_STUDENT_PACKAGE_STATUSES,
  TEACHING_STUDENT_STATUSES,
  isTeachingOrganizationRole,
  type TeachingAttendanceStatus,
  type TeachingCreditUnit,
  type TeachingApiErrorBody,
  type TeachingMemberStatus,
  type TeachingOrganizationRole,
  type TeachingOrganizationStatus,
  type TeachingPlatformAssertionV1,
  type TeachingPackageAcquisitionType,
  type TeachingPackageProductStatus,
  type TeachingSessionStatus,
  type TeachingStudentPackageStatus,
  type TeachingStudentStatus,
} from "@cuberoot/shared/teaching";
import type { User } from "@/db/schema";
import { TeachingApiError } from "@/lib/teaching-api-error";

export { TeachingApiError } from "@/lib/teaching-api-error";

const DEFAULT_API_BASE = "https://api.cuberoot.me/v1";
const ASSERTION_LIFETIME_SECONDS = Math.min(
  60,
  TEACHING_PLATFORM_ASSERTION_MAX_AGE_SECONDS,
);
const MAX_RESPONSE_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;

export interface TeachingOrganization {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  status: TeachingOrganizationStatus;
  version: number;
  role: TeachingOrganizationRole;
}

export interface TeachingMember {
  userId: number;
  displayName: string;
  avatarUrl: string | null;
  role: TeachingOrganizationRole;
  status: TeachingMemberStatus;
  joinedAt?: string;
  createdAt?: string;
}

export interface TeachingStudent {
  id: string;
  accountUserId: number | null;
  externalRef: string | null;
  displayName: string;
  status: TeachingStudentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TeachingPagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface TeachingOrganizationSummary {
  organization: TeachingOrganization;
  memberCount: number | null;
  studentCount: number | null;
}

export type TeachingStructureStatus = "active" | "archived";

export interface TeachingCampus {
  id: string;
  code: string | null;
  name: string;
  timezone: string | null;
  status: TeachingStructureStatus;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeachingGroup {
  id: string;
  campusId: string | null;
  code: string | null;
  name: string;
  status: TeachingStructureStatus;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeachingStudentGroupMembership {
  id: string;
  groupId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  student: Pick<TeachingStudent, "id" | "displayName" | "externalRef" | "status">;
}

export interface TeachingTeacherAssignment {
  id: string;
  teacherUserId: number | null;
  teacherUserIdSnapshot: number;
  groupId: string | null;
  studentId: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  teacher: {
    userId: number | null;
    displayName: string;
    role: Extract<TeachingOrganizationRole, "owner" | "admin" | "teacher" | "assistant">;
    status: TeachingMemberStatus | null;
  };
}

export interface CreateTeachingCampusInput {
  code: string | null;
  name: string;
  timezone: string | null;
}

export interface CreateTeachingGroupInput {
  campusId: string | null;
  code: string | null;
  name: string;
}

export interface TeachingEffectiveRangeInput {
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface TeachingPackageProduct {
  id: string;
  code: string;
  name: string;
  status: TeachingPackageProductStatus;
  creditUnit: TeachingCreditUnit;
  creditType: string;
  totalCredits: number;
  validityDays: number | null;
  priceAmountMinor: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeachingStudentPackage {
  id: string;
  studentId: string;
  productId: string;
  productNameSnapshot: string;
  status: TeachingStudentPackageStatus;
  creditUnit: TeachingCreditUnit;
  creditType: string;
  totalCredits: number;
  remainingCredits: number;
  acquisitionType: TeachingPackageAcquisitionType;
  validFrom: string;
  validUntil: string | null;
  createdAt: string;
}

export interface TeachingCreditLedgerEntry {
  id: number;
  entryType: string;
  delta: number;
  balanceAfter: number | null;
  reason: string;
  sessionId: string | null;
  createdAt: string;
}

export interface TeachingSessionAttendee {
  id: string;
  studentId: string;
  studentName: string;
  studentPackageId: string | null;
  attendanceStatus: TeachingAttendanceStatus;
  creditCost: number;
}

export type TeachingSavedAttendance = Omit<TeachingSessionAttendee, "studentName">;

export interface TeachingSessionSummary {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: TeachingSessionStatus;
  attendeeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeachingSession extends TeachingSessionSummary {
  attendees: TeachingSessionAttendee[];
}

export interface TeachingSessionConsumption {
  attendanceCount: number;
  totalCredits: number;
}

export interface CreateTeachingPackageProductInput {
  code: string;
  name: string;
  creditUnit: TeachingCreditUnit;
  creditType: string;
  totalCredits: number;
  validityDays: number | null;
  priceAmountMinor: number;
  currency: string;
}

export interface CreateTeachingSessionInput {
  title: string;
  startsAt: string;
  endsAt: string;
  timezone?: string;
  teacherUserIds?: number[];
  attendees?: Array<{
    studentId: string;
    studentPackageId: string;
    creditCost: number;
  }>;
}

interface AssertionOptions {
  secret?: string;
  nowSeconds?: number;
  nonce?: string;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function apiBase(): URL {
  const configured = process.env.TEACHING_API_BASE_URL?.trim();
  if (process.env.NODE_ENV === "production" && !configured) {
    throw new TeachingApiError("UNAVAILABLE", "教学服务尚未配置完成，请联系平台管理员");
  }
  let url: URL;
  try {
    url = new URL(configured || DEFAULT_API_BASE);
  } catch {
    throw new TeachingApiError("UNAVAILABLE", "教学服务地址配置无效");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new TeachingApiError("UNAVAILABLE", "教学服务地址配置无效");
  }
  if (
    process.env.NODE_ENV === "production" &&
    url.protocol !== "https:"
  ) {
    throw new TeachingApiError("UNAVAILABLE", "生产教学服务必须使用 HTTPS");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TeachingApiError("UNAVAILABLE", "教学服务地址配置无效");
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url;
}

function teachingUrl(relativePath: string): URL {
  const base = apiBase();
  const normalized = relativePath.replace(/^\/+/, "");
  const queryAt = normalized.indexOf("?");
  const pathname = queryAt === -1 ? normalized : normalized.slice(0, queryAt);
  base.pathname = `${base.pathname}/${pathname}`;
  base.search = queryAt === -1 ? "" : normalized.slice(queryAt + 1);
  return base;
}

function validBridgeUser(user: User): void {
  if (!user.id || user.id.length > 128) {
    throw new TeachingApiError("UNAVAILABLE", "当前账号无法连接教学服务");
  }
  if (!/^\+?\d{6,20}$/.test(user.phone)) {
    throw new TeachingApiError("UNAVAILABLE", "当前账号缺少已验证手机号");
  }
}

/** Build a short-lived proof bound to this exact method, path, and JSON body. */
export function createTeachingPlatformAssertion(
  user: User,
  request: {
    method: string;
    path: string;
    body: string;
    idempotencyKey?: string | null;
  },
  options: AssertionOptions = {},
): string {
  validBridgeUser(user);
  const secret = options.secret ?? process.env.TEACHING_PLATFORM_SECRET ?? "";
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new TeachingApiError(
      "UNAVAILABLE",
      "教学服务尚未配置完成，请联系平台管理员",
    );
  }
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const payload: TeachingPlatformAssertionV1 = {
    v: 1,
    iss: TEACHING_PLATFORM_ASSERTION_ISSUER,
    aud: TEACHING_PLATFORM_ASSERTION_AUDIENCE,
    sub: user.id,
    phone: user.phone,
    name: user.nickname.slice(0, 200),
    method: request.method.toUpperCase(),
    path: request.path,
    bodySha256: sha256(request.body),
    idempotencyKey: request.idempotencyKey ?? null,
    iat: now,
    exp: now + ASSERTION_LIFETIME_SECONDS,
    jti: options.nonce ?? randomBytes(24).toString("base64url"),
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const signature = createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

function isErrorBody(value: unknown): value is TeachingApiErrorBody {
  if (!value || typeof value !== "object" || !("error" in value)) return false;
  const error = (value as { error?: unknown }).error;
  return Boolean(
    error &&
      typeof error === "object" &&
      typeof (error as { code?: unknown }).code === "string" &&
      typeof (error as { message?: unknown }).message === "string",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseOrganization(value: unknown): TeachingOrganization {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.slug !== "string" ||
    typeof value.name !== "string" ||
    typeof value.timezone !== "string" ||
    !TEACHING_ORGANIZATION_STATUSES.includes(value.status as TeachingOrganizationStatus) ||
    !Number.isSafeInteger(value.version) ||
    !isTeachingOrganizationRole(value.role)
  ) {
    throw new TeachingApiError("BAD_RESPONSE", "教学服务返回了无效的机构数据");
  }
  return value as unknown as TeachingOrganization;
}

function parseMember(value: unknown): TeachingMember {
  if (
    !isRecord(value) ||
    !Number.isSafeInteger(value.userId) ||
    typeof value.displayName !== "string" ||
    (value.avatarUrl !== undefined && value.avatarUrl !== null && typeof value.avatarUrl !== "string") ||
    !isTeachingOrganizationRole(value.role) ||
    !TEACHING_MEMBER_STATUSES.includes(value.status as TeachingMemberStatus)
  ) {
    throw new TeachingApiError("BAD_RESPONSE", "教学服务返回了无效的成员数据");
  }
  return {
    userId: value.userId as number,
    displayName: value.displayName,
    avatarUrl: typeof value.avatarUrl === "string" ? value.avatarUrl : null,
    role: value.role,
    status: value.status as TeachingMemberStatus,
    ...(typeof value.joinedAt === "string" ? { joinedAt: value.joinedAt } : {}),
    ...(typeof value.createdAt === "string" ? { createdAt: value.createdAt } : {}),
  };
}

function parseStudent(value: unknown): TeachingStudent {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    (value.accountUserId !== undefined && value.accountUserId !== null && !Number.isSafeInteger(value.accountUserId)) ||
    (value.externalRef !== null && typeof value.externalRef !== "string") ||
    typeof value.displayName !== "string" ||
    !TEACHING_STUDENT_STATUSES.includes(value.status as TeachingStudentStatus) ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string"
  ) {
    throw new TeachingApiError("BAD_RESPONSE", "教学服务返回了无效的学员数据");
  }
  return {
    id: value.id,
    accountUserId: Number.isSafeInteger(value.accountUserId) ? value.accountUserId as number : null,
    externalRef: value.externalRef as string | null,
    displayName: value.displayName,
    status: value.status as TeachingStudentStatus,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function parseStructureStatus(value: unknown, label: string): TeachingStructureStatus {
  if (value !== "active" && value !== "archived") {
    throw new TeachingApiError("BAD_RESPONSE", `教学服务返回了无效的${label}状态`);
  }
  return value;
}

function parseNullableString(value: unknown, label: string): string | null {
  return value === null ? null : parseRequiredString(value, label);
}

function parseCampus(value: unknown): TeachingCampus {
  if (!isRecord(value)) {
    throw new TeachingApiError("BAD_RESPONSE", "教学服务返回了无效的校区数据");
  }
  return {
    id: parseResourceId(value.id, "校区标识"),
    code: parseNullableString(value.code, "校区代码"),
    name: parseRequiredString(value.name, "校区名称"),
    timezone: parseNullableString(value.timezone, "校区时区"),
    status: parseStructureStatus(value.status, "校区"),
    archivedAt: parseNullableTimestamp(value.archivedAt, "校区归档时间"),
    createdAt: parseTimestamp(value.createdAt, "校区创建时间"),
    updatedAt: parseTimestamp(value.updatedAt, "校区更新时间"),
  };
}

function parseGroup(value: unknown): TeachingGroup {
  if (!isRecord(value)) {
    throw new TeachingApiError("BAD_RESPONSE", "教学服务返回了无效的班级数据");
  }
  return {
    id: parseResourceId(value.id, "班级标识"),
    campusId: value.campusId === null
      ? null
      : parseResourceId(value.campusId, "校区标识"),
    code: parseNullableString(value.code, "班级代码"),
    name: parseRequiredString(value.name, "班级名称"),
    status: parseStructureStatus(value.status, "班级"),
    archivedAt: parseNullableTimestamp(value.archivedAt, "班级归档时间"),
    createdAt: parseTimestamp(value.createdAt, "班级创建时间"),
    updatedAt: parseTimestamp(value.updatedAt, "班级更新时间"),
  };
}

function parseEffectiveRange(value: Record<string, unknown>, label: string) {
  const effectiveFrom = parseTimestamp(value.effectiveFrom, `${label}生效时间`);
  const effectiveTo = parseNullableTimestamp(value.effectiveTo, `${label}失效时间`);
  if (effectiveTo !== null && Date.parse(effectiveTo) < Date.parse(effectiveFrom)) {
    throw new TeachingApiError("BAD_RESPONSE", `教学服务返回了无效的${label}有效期`);
  }
  return {
    effectiveFrom,
    effectiveTo,
    createdAt: parseTimestamp(value.createdAt, `${label}创建时间`),
  };
}

function parseMembershipStudent(value: unknown): TeachingStudentGroupMembership["student"] {
  if (!isRecord(value) || !TEACHING_STUDENT_STATUSES.includes(value.status as TeachingStudentStatus)) {
    throw new TeachingApiError("BAD_RESPONSE", "教学服务返回了无效的班级学员数据");
  }
  return {
    id: parseResourceId(value.id, "学员标识"),
    displayName: parseRequiredString(value.displayName, "学员姓名"),
    externalRef: value.externalRef === null
      ? null
      : parseRequiredString(value.externalRef, "学员编号"),
    status: value.status as TeachingStudentStatus,
  };
}

function parseStudentGroupMembership(value: unknown): TeachingStudentGroupMembership {
  if (!isRecord(value)) {
    throw new TeachingApiError("BAD_RESPONSE", "教学服务返回了无效的分班数据");
  }
  return {
    id: parseResourceId(value.id, "分班关系标识"),
    groupId: parseResourceId(value.groupId, "班级标识"),
    ...parseEffectiveRange(value, "分班关系"),
    student: parseProperty(value, "student", parseMembershipStudent),
  };
}

function parseAssignmentTeacher(value: unknown): TeachingTeacherAssignment["teacher"] {
  if (
    !isRecord(value) ||
    (value.userId !== null && !Number.isSafeInteger(value.userId)) ||
    typeof value.displayName !== "string" || !value.displayName.trim() ||
    !["owner", "admin", "teacher", "assistant"].includes(String(value.role)) ||
    (value.status !== null && !TEACHING_MEMBER_STATUSES.includes(value.status as TeachingMemberStatus))
  ) {
    throw new TeachingApiError("BAD_RESPONSE", "教学服务返回了无效的负责老师数据");
  }
  return {
    userId: Number.isSafeInteger(value.userId) ? value.userId as number : null,
    displayName: value.displayName,
    role: value.role as TeachingTeacherAssignment["teacher"]["role"],
    status: value.status === null ? null : value.status as TeachingMemberStatus,
  };
}

function parseTeacherAssignment(value: unknown): TeachingTeacherAssignment {
  if (!isRecord(value)) {
    throw new TeachingApiError("BAD_RESPONSE", "教学服务返回了无效的负责范围数据");
  }
  const groupId = value.groupId === null ? null : parseResourceId(value.groupId, "班级标识");
  const studentId = value.studentId === null ? null : parseResourceId(value.studentId, "学员标识");
  if ((groupId === null) === (studentId === null)) {
    throw new TeachingApiError("BAD_RESPONSE", "教学服务返回了无效的负责范围目标");
  }
  const teacherUserId = value.teacherUserId === null
    ? null
    : parsePositiveInteger(value.teacherUserId, "老师账号标识");
  const teacherUserIdSnapshot = parsePositiveInteger(value.teacherUserIdSnapshot, "老师账号快照标识");
  const teacher = parseProperty(value, "teacher", parseAssignmentTeacher);
  if (
    (teacherUserId !== null && teacherUserId !== teacherUserIdSnapshot) ||
    teacher.userId !== teacherUserId
  ) {
    throw new TeachingApiError("BAD_RESPONSE", "教学服务返回了不一致的负责老师数据");
  }
  return {
    id: parseResourceId(value.id, "负责范围标识"),
    teacherUserId,
    teacherUserIdSnapshot,
    groupId,
    studentId,
    ...parseEffectiveRange(value, "负责范围"),
    teacher,
  };
}

function parseTimestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new TeachingApiError("BAD_RESPONSE", `教学服务返回了无效的${label}`);
  }
  return value;
}

function parseNullableTimestamp(value: unknown, label: string): string | null {
  return value === null ? null : parseTimestamp(value, label);
}

function parseRequiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new TeachingApiError("BAD_RESPONSE", `教学服务返回了无效的${label}`);
  }
  return value;
}

const RESOURCE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseResourceId(value: unknown, label: string): string {
  const parsed = parseRequiredString(value, label);
  if (!RESOURCE_ID_PATTERN.test(parsed)) {
    throw new TeachingApiError("BAD_RESPONSE", `教学服务返回了无效的${label}`);
  }
  return parsed.toLowerCase();
}

function parseSafeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value)) {
    throw new TeachingApiError("BAD_RESPONSE", `教学服务返回了无效的${label}`);
  }
  return value as number;
}

function parsePositiveInteger(value: unknown, label: string): number {
  const parsed = parseSafeInteger(value, label);
  if (parsed < 1) {
    throw new TeachingApiError("BAD_RESPONSE", `教学服务返回了无效的${label}`);
  }
  return parsed;
}

function parsePackageProduct(value: unknown): TeachingPackageProduct {
  if (
    !isRecord(value) ||
    !TEACHING_PACKAGE_PRODUCT_STATUSES.includes(value.status as TeachingPackageProductStatus) ||
    !TEACHING_CREDIT_UNITS.includes(value.creditUnit as TeachingCreditUnit)
  ) {
    throw new TeachingApiError("BAD_RESPONSE", "教学服务返回了无效的课包产品数据");
  }
  const validityDays = value.validityDays === null
    ? null
    : parsePositiveInteger(value.validityDays, "有效天数");
  return {
    id: parseResourceId(value.id, "课包产品标识"),
    code: parseRequiredString(value.code, "课包代码"),
    name: parseRequiredString(value.name, "课包名称"),
    status: value.status as TeachingPackageProductStatus,
    creditUnit: value.creditUnit as TeachingCreditUnit,
    creditType: parseRequiredString(value.creditType, "课时类型"),
    totalCredits: parsePositiveInteger(value.totalCredits, "总课时"),
    validityDays,
    priceAmountMinor: parseNonNegativeInteger(value.priceAmountMinor, "课包价格"),
    currency: parseRequiredString(value.currency, "币种"),
    createdAt: parseTimestamp(value.createdAt, "创建时间"),
    updatedAt: parseTimestamp(value.updatedAt, "更新时间"),
  };
}

function parseStudentPackage(value: unknown): TeachingStudentPackage {
  if (
    !isRecord(value) ||
    !TEACHING_STUDENT_PACKAGE_STATUSES.includes(value.status as TeachingStudentPackageStatus) ||
    !TEACHING_CREDIT_UNITS.includes(value.creditUnit as TeachingCreditUnit) ||
    !TEACHING_PACKAGE_ACQUISITION_TYPES.includes(value.acquisitionType as TeachingPackageAcquisitionType)
  ) {
    throw new TeachingApiError("BAD_RESPONSE", "教学服务返回了无效的学员课包数据");
  }
  const productName = value.productNameSnapshot ?? value.productName;
  const totalCredits = value.totalCredits ?? value.entitledCredits;
  return {
    id: parseResourceId(value.id, "学员课包标识"),
    studentId: parseResourceId(value.studentId, "学员标识"),
    productId: parseResourceId(value.productId, "课包产品标识"),
    productNameSnapshot: parseRequiredString(productName, "课包名称"),
    status: value.status as TeachingStudentPackageStatus,
    creditUnit: value.creditUnit as TeachingCreditUnit,
    creditType: parseRequiredString(value.creditType, "课时类型"),
    totalCredits: parsePositiveInteger(totalCredits, "总课时"),
    remainingCredits: parseNonNegativeInteger(value.remainingCredits, "剩余课时"),
    acquisitionType: value.acquisitionType as TeachingPackageAcquisitionType,
    validFrom: parseTimestamp(value.validFrom, "生效时间"),
    validUntil: parseNullableTimestamp(value.validUntil, "失效时间"),
    createdAt: parseTimestamp(value.createdAt, "创建时间"),
  };
}

function parseLedgerEntry(value: unknown): TeachingCreditLedgerEntry {
  if (!isRecord(value)) {
    throw new TeachingApiError("BAD_RESPONSE", "教学服务返回了无效的课时流水");
  }
  return {
    id: parsePositiveInteger(value.id, "流水标识"),
    entryType: parseRequiredString(value.entryType, "流水类型"),
    delta: parseSafeInteger(value.delta, "课时变动"),
    balanceAfter: value.balanceAfter === undefined || value.balanceAfter === null
      ? null
      : parseSafeInteger(value.balanceAfter, "变动后余额"),
    reason: parseRequiredString(value.reason, "流水原因"),
    sessionId: value.sessionId === null
      ? null
      : parseResourceId(value.sessionId, "课堂标识"),
    createdAt: parseTimestamp(value.createdAt, "流水时间"),
  };
}

function parseSessionStatus(value: unknown): TeachingSessionStatus {
  if (!TEACHING_SESSION_STATUSES.includes(value as TeachingSessionStatus)) {
    throw new TeachingApiError("BAD_RESPONSE", "教学服务返回了无效的课堂状态");
  }
  return value as TeachingSessionStatus;
}

function parseAttendanceStatus(value: unknown): TeachingAttendanceStatus {
  if (!TEACHING_ATTENDANCE_STATUSES.includes(value as TeachingAttendanceStatus)) {
    throw new TeachingApiError("BAD_RESPONSE", "教学服务返回了无效的出勤状态");
  }
  return value as TeachingAttendanceStatus;
}

function parseSessionBase(value: unknown): TeachingSessionSummary {
  if (!isRecord(value)) {
    throw new TeachingApiError("BAD_RESPONSE", "教学服务返回了无效的课堂数据");
  }
  const rawCount = value.attendeeCount ?? value.attendanceCount ?? 0;
  return {
    id: parseResourceId(value.id, "课堂标识"),
    title: parseRequiredString(value.title, "课堂标题"),
    startsAt: parseTimestamp(value.startsAt, "上课时间"),
    endsAt: parseTimestamp(value.endsAt, "下课时间"),
    timezone: parseRequiredString(value.timezone, "课堂时区"),
    status: parseSessionStatus(value.status),
    attendeeCount: parseNonNegativeInteger(rawCount, "出勤人数"),
    createdAt: parseTimestamp(value.createdAt, "创建时间"),
    updatedAt: parseTimestamp(value.updatedAt, "更新时间"),
  };
}

function parseSessionAttendee(value: unknown): TeachingSessionAttendee {
  if (!isRecord(value)) {
    throw new TeachingApiError("BAD_RESPONSE", "教学服务返回了无效的出勤记录");
  }
  const studentName = value.studentName ?? value.displayName;
  const attendanceStatus = value.attendanceStatus ?? value.status;
  return {
    id: parseResourceId(value.id, "出勤标识"),
    studentId: parseResourceId(value.studentId, "学员标识"),
    studentName: parseRequiredString(studentName, "学员姓名"),
    studentPackageId: value.studentPackageId === null
      ? null
      : parseResourceId(value.studentPackageId, "学员课包标识"),
    attendanceStatus: parseAttendanceStatus(attendanceStatus),
    creditCost: parsePositiveInteger(value.creditCost, "扣课数量"),
  };
}

function parseSavedAttendance(value: unknown): TeachingSavedAttendance {
  if (!isRecord(value)) {
    throw new TeachingApiError("BAD_RESPONSE", "教学服务返回了无效的出勤记录");
  }
  return {
    id: parseResourceId(value.id, "出勤标识"),
    studentId: parseResourceId(value.studentId, "学员标识"),
    studentPackageId: value.studentPackageId === null
      ? null
      : parseResourceId(value.studentPackageId, "学员课包标识"),
    attendanceStatus: parseAttendanceStatus(value.attendanceStatus ?? value.status),
    creditCost: parsePositiveInteger(value.creditCost, "扣课数量"),
  };
}

function parseSession(value: unknown): TeachingSession {
  const summary = parseSessionBase(value);
  if (!isRecord(value)) {
    throw new TeachingApiError("BAD_RESPONSE", "教学服务返回了无效的课堂数据");
  }
  const rawAttendance = value.attendees ?? value.attendance;
  if (!Array.isArray(rawAttendance)) {
    throw new TeachingApiError("BAD_RESPONSE", "教学服务响应缺少出勤列表");
  }
  return {
    ...summary,
    attendeeCount: rawAttendance.length,
    attendees: rawAttendance.map(parseSessionAttendee),
  };
}

function parseProperty<T>(
  value: unknown,
  key: string,
  parse: (item: unknown) => T,
): T {
  if (!isRecord(value) || !(key in value)) {
    throw new TeachingApiError("BAD_RESPONSE", "教学服务响应缺少必要数据");
  }
  return parse(value[key]);
}

function parseArrayProperty<T>(
  value: unknown,
  key: string,
  parse: (item: unknown) => T,
): T[] {
  if (!isRecord(value) || !Array.isArray(value[key])) {
    throw new TeachingApiError("BAD_RESPONSE", "教学服务响应缺少必要列表");
  }
  return value[key].map(parse);
}

function parseNonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new TeachingApiError("BAD_RESPONSE", `教学服务返回了无效的${label}`);
  }
  return value as number;
}

function boundedPositiveInteger(value: number | undefined, fallback: number, maximum: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(1, Math.trunc(value)));
}

function parsePage<T>(
  value: unknown,
  key: string,
  parse: (item: unknown) => T,
): TeachingPagedResult<T> {
  if (!isRecord(value)) {
    throw new TeachingApiError("BAD_RESPONSE", "教学服务响应缺少分页数据");
  }
  const items = parseArrayProperty(value, key, parse);
  const total = parseNonNegativeInteger(value.total, "总数");
  const page = parseNonNegativeInteger(value.page, "页码");
  const pageSize = parseNonNegativeInteger(value.pageSize, "每页数量");
  if (page < 1 || pageSize < 1 || pageSize > 100) {
    throw new TeachingApiError("BAD_RESPONSE", "教学服务返回了无效的分页范围");
  }
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

async function requestJson<T>(
  user: User,
  relativePath: string,
  init: {
    method?: "GET" | "POST";
    body?: Record<string, unknown>;
    idempotencyKey?: string;
  },
  parse: (value: unknown) => T,
): Promise<T> {
  const url = teachingUrl(relativePath);
  const method = init.method ?? "GET";
  const body = init.body ? JSON.stringify(init.body) : "";
  const idempotencyKey = method === "POST" ? init.idempotencyKey : undefined;
  if (method === "POST" && (!idempotencyKey || idempotencyKey.length > 200)) {
    throw new TeachingApiError("UNAVAILABLE", "操作标识无效，请刷新页面后重试");
  }
  const assertion = createTeachingPlatformAssertion(user, {
    method,
    path: `${url.pathname}${url.search}`,
    body,
    idempotencyKey: idempotencyKey ?? null,
  });
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      body: body || undefined,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        [TEACHING_PLATFORM_ASSERTION_HEADER]: assertion,
        "X-Request-ID": randomUUID(),
        ...(body
          ? {
              "Content-Type": "application/json",
              "Idempotency-Key": idempotencyKey!,
            }
          : {}),
      },
    });
  } catch (error) {
    if (error instanceof TeachingApiError) throw error;
    throw new TeachingApiError("UNAVAILABLE", "教学服务暂时无法连接");
  }

  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    throw new TeachingApiError("BAD_RESPONSE", "教学服务响应过大", response.status);
  }

  let value: unknown;
  try {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_RESPONSE_BYTES) {
      throw new TeachingApiError("BAD_RESPONSE", "教学服务响应过大", response.status);
    }
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    if (error instanceof TeachingApiError) throw error;
    throw new TeachingApiError(
      "BAD_RESPONSE",
      "教学服务返回了无法识别的响应",
      response.status,
    );
  }
  if (!response.ok) {
    if (isErrorBody(value)) {
      throw new TeachingApiError(
        value.error.code,
        value.error.message,
        response.status,
        value.error.requestId,
      );
    }
    throw new TeachingApiError(
      "BAD_RESPONSE",
      "教学服务请求失败",
      response.status,
    );
  }
  return parse(value);
}

function orgPath(slug: string, suffix = ""): string {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(slug)) {
    throw new TeachingApiError("INVALID_INPUT", "机构标识无效");
  }
  return `teaching/organizations/${encodeURIComponent(slug)}${suffix}`;
}

function resourceId(value: string, label: string): string {
  const normalized = value.trim().toLowerCase();
  if (!RESOURCE_ID_PATTERN.test(normalized)) {
    throw new TeachingApiError("INVALID_INPUT", `${label}无效`);
  }
  return encodeURIComponent(normalized);
}

export async function listTeachingOrganizations(
  user: User,
): Promise<TeachingOrganization[]> {
  const value = await requestJson<{ organizations: TeachingOrganization[] }>(
    user,
    "teaching/organizations",
    {},
    (body) => ({ organizations: parseArrayProperty(body, "organizations", parseOrganization) }),
  );
  return value.organizations;
}

export async function getTeachingOrganization(
  user: User,
  slug: string,
): Promise<TeachingOrganization> {
  const value = await requestJson<{ organization: TeachingOrganization }>(
    user,
    orgPath(slug),
    {},
    (body) => ({ organization: parseProperty(body, "organization", parseOrganization) }),
  );
  return value.organization;
}

export async function getTeachingOrganizationSummary(
  user: User,
  slug: string,
): Promise<TeachingOrganizationSummary> {
  return requestJson<TeachingOrganizationSummary>(
    user,
    orgPath(slug, "/summary"),
    {},
    (body) => {
      const summary = parseProperty(body, "summary", (value) => {
        if (!isRecord(value)) {
          throw new TeachingApiError("BAD_RESPONSE", "教学服务返回了无效的概览数据");
        }
        const memberCount = value.memberCount === null
          ? null
          : parseNonNegativeInteger(value.memberCount, "成员总数");
        const studentCount = value.studentCount === null
          ? null
          : parseNonNegativeInteger(value.studentCount, "学员总数");
        return {
          organization: parseProperty(value, "organization", parseOrganization),
          memberCount,
          studentCount,
        };
      });
      return summary;
    },
  );
}

export async function createTeachingOrganization(
  user: User,
  input: { slug: string; name: string; timezone?: string },
  idempotencyKey: string,
): Promise<TeachingOrganization> {
  const value = await requestJson<{ organization: TeachingOrganization }>(
    user,
    "teaching/organizations",
    {
      method: "POST",
      body: {
        slug: input.slug,
        name: input.name,
        timezone: input.timezone ?? "Asia/Shanghai",
      },
      idempotencyKey,
    },
    (body) => ({ organization: parseProperty(body, "organization", parseOrganization) }),
  );
  return value.organization;
}

export async function listTeachingCampuses(
  user: User,
  slug: string,
  options: { page?: number; pageSize?: number } = {},
): Promise<TeachingPagedResult<TeachingCampus>> {
  const page = boundedPositiveInteger(options.page, 1, 1_000_000);
  const pageSize = boundedPositiveInteger(options.pageSize, 30, 100);
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return requestJson<TeachingPagedResult<TeachingCampus>>(
    user,
    orgPath(slug, `/campuses?${query}`),
    {},
    (body) => parsePage(body, "campuses", parseCampus),
  );
}

export async function getTeachingCampus(
  user: User,
  slug: string,
  campusId: string,
): Promise<TeachingCampus> {
  const value = await requestJson<{ campus: TeachingCampus }>(
    user,
    orgPath(slug, `/campuses/${resourceId(campusId, "校区标识")}`),
    {},
    (body) => ({ campus: parseProperty(body, "campus", parseCampus) }),
  );
  return value.campus;
}

export async function createTeachingCampus(
  user: User,
  slug: string,
  input: CreateTeachingCampusInput,
  idempotencyKey: string,
): Promise<TeachingCampus> {
  const value = await requestJson<{ campus: TeachingCampus }>(
    user,
    orgPath(slug, "/campuses"),
    { method: "POST", body: { ...input }, idempotencyKey },
    (body) => ({ campus: parseProperty(body, "campus", parseCampus) }),
  );
  return value.campus;
}

export async function archiveTeachingCampus(
  user: User,
  slug: string,
  campusId: string,
  idempotencyKey: string,
): Promise<TeachingCampus> {
  const value = await requestJson<{ campus: TeachingCampus }>(
    user,
    orgPath(slug, `/campuses/${resourceId(campusId, "校区标识")}/archive`),
    { method: "POST", body: {}, idempotencyKey },
    (body) => ({ campus: parseProperty(body, "campus", parseCampus) }),
  );
  return value.campus;
}

export async function listTeachingGroups(
  user: User,
  slug: string,
  options: { page?: number; pageSize?: number } = {},
): Promise<TeachingPagedResult<TeachingGroup>> {
  const page = boundedPositiveInteger(options.page, 1, 1_000_000);
  const pageSize = boundedPositiveInteger(options.pageSize, 30, 100);
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return requestJson<TeachingPagedResult<TeachingGroup>>(
    user,
    orgPath(slug, `/groups?${query}`),
    {},
    (body) => parsePage(body, "groups", parseGroup),
  );
}

export async function getTeachingGroup(
  user: User,
  slug: string,
  groupId: string,
): Promise<TeachingGroup> {
  const value = await requestJson<{ group: TeachingGroup }>(
    user,
    orgPath(slug, `/groups/${resourceId(groupId, "班级标识")}`),
    {},
    (body) => ({ group: parseProperty(body, "group", parseGroup) }),
  );
  return value.group;
}

export async function createTeachingGroup(
  user: User,
  slug: string,
  input: CreateTeachingGroupInput,
  idempotencyKey: string,
): Promise<TeachingGroup> {
  const value = await requestJson<{ group: TeachingGroup }>(
    user,
    orgPath(slug, "/groups"),
    { method: "POST", body: { ...input }, idempotencyKey },
    (body) => ({ group: parseProperty(body, "group", parseGroup) }),
  );
  return value.group;
}

export async function archiveTeachingGroup(
  user: User,
  slug: string,
  groupId: string,
  idempotencyKey: string,
): Promise<TeachingGroup> {
  const value = await requestJson<{ group: TeachingGroup }>(
    user,
    orgPath(slug, `/groups/${resourceId(groupId, "班级标识")}/archive`),
    { method: "POST", body: {}, idempotencyKey },
    (body) => ({ group: parseProperty(body, "group", parseGroup) }),
  );
  return value.group;
}

export async function listTeachingMembers(
  user: User,
  slug: string,
  options: { page?: number; pageSize?: number } = {},
): Promise<TeachingPagedResult<TeachingMember>> {
  const page = boundedPositiveInteger(options.page, 1, 1_000_000);
  const pageSize = boundedPositiveInteger(options.pageSize, 30, 100);
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return requestJson<TeachingPagedResult<TeachingMember>>(
    user,
    orgPath(slug, `/members?${query}`),
    {},
    (body) => parsePage(body, "members", parseMember),
  );
}

export async function listTeachingStudents(
  user: User,
  slug: string,
  options: { page?: number; pageSize?: number } = {},
): Promise<TeachingPagedResult<TeachingStudent>> {
  const page = boundedPositiveInteger(options.page, 1, 1_000_000);
  const pageSize = boundedPositiveInteger(options.pageSize, 30, 100);
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return requestJson<TeachingPagedResult<TeachingStudent>>(
    user,
    orgPath(slug, `/students?${query}`),
    {},
    (body) => parsePage(body, "students", parseStudent),
  );
}

export async function getTeachingStudent(
  user: User,
  slug: string,
  studentId: string,
): Promise<TeachingStudent> {
  const value = await requestJson<{ student: TeachingStudent }>(
    user,
    orgPath(slug, `/students/${resourceId(studentId, "学员标识")}`),
    {},
    (body) => ({ student: parseProperty(body, "student", parseStudent) }),
  );
  return value.student;
}

export async function listTeachingGroupStudents(
  user: User,
  slug: string,
  groupId: string,
  options: { page?: number; pageSize?: number } = {},
): Promise<TeachingPagedResult<TeachingStudentGroupMembership>> {
  const page = boundedPositiveInteger(options.page, 1, 1_000_000);
  const pageSize = boundedPositiveInteger(options.pageSize, 30, 100);
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return requestJson<TeachingPagedResult<TeachingStudentGroupMembership>>(
    user,
    orgPath(slug, `/groups/${resourceId(groupId, "班级标识")}/students?${query}`),
    {},
    (body) => parsePage(body, "memberships", parseStudentGroupMembership),
  );
}

export async function createTeachingStudentGroupMembership(
  user: User,
  slug: string,
  groupId: string,
  input: { studentId: string } & TeachingEffectiveRangeInput,
  idempotencyKey: string,
): Promise<TeachingStudentGroupMembership> {
  const value = await requestJson<{ membership: TeachingStudentGroupMembership }>(
    user,
    orgPath(slug, `/groups/${resourceId(groupId, "班级标识")}/students`),
    { method: "POST", body: { ...input }, idempotencyKey },
    (body) => ({
      membership: parseProperty(body, "membership", parseStudentGroupMembership),
    }),
  );
  return value.membership;
}

export async function revokeTeachingStudentGroupMembership(
  user: User,
  slug: string,
  membershipId: string,
  idempotencyKey: string,
): Promise<TeachingStudentGroupMembership> {
  const value = await requestJson<{ membership: TeachingStudentGroupMembership }>(
    user,
    orgPath(slug, `/student-group-memberships/${resourceId(membershipId, "分班关系标识")}/revoke`),
    { method: "POST", body: {}, idempotencyKey },
    (body) => ({
      membership: parseProperty(body, "membership", parseStudentGroupMembership),
    }),
  );
  return value.membership;
}

export async function listTeachingTeacherAssignments(
  user: User,
  slug: string,
  target: { groupId: string } | { studentId: string },
  options: { page?: number; pageSize?: number } = {},
): Promise<TeachingPagedResult<TeachingTeacherAssignment>> {
  const page = boundedPositiveInteger(options.page, 1, 1_000_000);
  const pageSize = boundedPositiveInteger(options.pageSize, 30, 100);
  const query = new URLSearchParams({
    ...("groupId" in target
      ? { groupId: resourceId(target.groupId, "班级标识") }
      : { studentId: resourceId(target.studentId, "学员标识") }),
    page: String(page),
    pageSize: String(pageSize),
  });
  return requestJson<TeachingPagedResult<TeachingTeacherAssignment>>(
    user,
    orgPath(slug, `/teacher-assignments?${query}`),
    {},
    (body) => parsePage(body, "assignments", parseTeacherAssignment),
  );
}

export async function createTeachingTeacherAssignment(
  user: User,
  slug: string,
  input: TeachingEffectiveRangeInput & (
    | { groupId: string; studentId?: never }
    | { studentId: string; groupId?: never }
  ) & { teacherUserId: number },
  idempotencyKey: string,
): Promise<TeachingTeacherAssignment> {
  const value = await requestJson<{ assignment: TeachingTeacherAssignment }>(
    user,
    orgPath(slug, "/teacher-assignments"),
    { method: "POST", body: { ...input }, idempotencyKey },
    (body) => ({ assignment: parseProperty(body, "assignment", parseTeacherAssignment) }),
  );
  return value.assignment;
}

export async function revokeTeachingTeacherAssignment(
  user: User,
  slug: string,
  assignmentId: string,
  idempotencyKey: string,
): Promise<TeachingTeacherAssignment> {
  const value = await requestJson<{ assignment: TeachingTeacherAssignment }>(
    user,
    orgPath(slug, `/teacher-assignments/${resourceId(assignmentId, "负责范围标识")}/revoke`),
    { method: "POST", body: {}, idempotencyKey },
    (body) => ({ assignment: parseProperty(body, "assignment", parseTeacherAssignment) }),
  );
  return value.assignment;
}

export async function createTeachingStudent(
  user: User,
  slug: string,
  input: { displayName: string; externalRef: string | null },
  idempotencyKey: string,
): Promise<TeachingStudent> {
  const value = await requestJson<{ student: TeachingStudent }>(
    user,
    orgPath(slug, "/students"),
    { method: "POST", body: input, idempotencyKey },
    (body) => ({ student: parseProperty(body, "student", parseStudent) }),
  );
  return value.student;
}

export async function listTeachingPackageProducts(
  user: User,
  slug: string,
  options: { page?: number; pageSize?: number } = {},
): Promise<TeachingPagedResult<TeachingPackageProduct>> {
  const page = boundedPositiveInteger(options.page, 1, 1_000_000);
  const pageSize = boundedPositiveInteger(options.pageSize, 30, 100);
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return requestJson<TeachingPagedResult<TeachingPackageProduct>>(
    user,
    orgPath(slug, `/package-products?${query}`),
    {},
    (body) => parsePage(body, "packageProducts", parsePackageProduct),
  );
}

export async function createTeachingPackageProduct(
  user: User,
  slug: string,
  input: CreateTeachingPackageProductInput,
  idempotencyKey: string,
): Promise<TeachingPackageProduct> {
  const value = await requestJson<{ packageProduct: TeachingPackageProduct }>(
    user,
    orgPath(slug, "/package-products"),
    { method: "POST", body: { ...input }, idempotencyKey },
    (body) => ({
      packageProduct: parseProperty(body, "packageProduct", parsePackageProduct),
    }),
  );
  return value.packageProduct;
}

export async function listTeachingStudentPackages(
  user: User,
  slug: string,
  studentId: string,
  options: { page?: number; pageSize?: number } = {},
): Promise<TeachingPagedResult<TeachingStudentPackage>> {
  const page = boundedPositiveInteger(options.page, 1, 1_000_000);
  const pageSize = boundedPositiveInteger(options.pageSize, 30, 100);
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return requestJson<TeachingPagedResult<TeachingStudentPackage>>(
    user,
    orgPath(slug, `/students/${resourceId(studentId, "学员标识")}/packages?${query}`),
    {},
    (body) => parsePage(body, "studentPackages", parseStudentPackage),
  );
}

export async function createTeachingStudentPackage(
  user: User,
  slug: string,
  studentId: string,
  input: {
    productId: string;
    acquisitionType: TeachingPackageAcquisitionType;
    validFrom: string;
    sourceSystem: string | null;
    sourceRef: string | null;
    sourceLineRef: string | null;
  },
  idempotencyKey: string,
): Promise<TeachingStudentPackage> {
  const value = await requestJson<{ studentPackage: TeachingStudentPackage }>(
    user,
    orgPath(slug, `/students/${resourceId(studentId, "学员标识")}/packages`),
    { method: "POST", body: { ...input }, idempotencyKey },
    (body) => ({
      studentPackage: parseProperty(body, "studentPackage", parseStudentPackage),
    }),
  );
  return value.studentPackage;
}

export async function listTeachingStudentPackageLedger(
  user: User,
  slug: string,
  studentPackageId: string,
  options: { page?: number; pageSize?: number } = {},
): Promise<TeachingPagedResult<TeachingCreditLedgerEntry>> {
  const page = boundedPositiveInteger(options.page, 1, 1_000_000);
  const pageSize = boundedPositiveInteger(options.pageSize, 30, 100);
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return requestJson<TeachingPagedResult<TeachingCreditLedgerEntry>>(
    user,
    orgPath(slug, `/student-packages/${resourceId(studentPackageId, "学员课包标识")}/ledger?${query}`),
    {},
    (body) => parsePage(body, "ledger", parseLedgerEntry),
  );
}

export async function listTeachingSessions(
  user: User,
  slug: string,
  options: { page?: number; pageSize?: number } = {},
): Promise<TeachingPagedResult<TeachingSessionSummary>> {
  const page = boundedPositiveInteger(options.page, 1, 1_000_000);
  const pageSize = boundedPositiveInteger(options.pageSize, 30, 100);
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return requestJson<TeachingPagedResult<TeachingSessionSummary>>(
    user,
    orgPath(slug, `/sessions?${query}`),
    {},
    (body) => parsePage(body, "sessions", parseSessionBase),
  );
}

export async function getTeachingSession(
  user: User,
  slug: string,
  sessionId: string,
): Promise<TeachingSession> {
  const value = await requestJson<{ session: TeachingSession }>(
    user,
    orgPath(slug, `/sessions/${resourceId(sessionId, "课堂标识")}`),
    {},
    (body) => ({ session: parseProperty(body, "session", parseSession) }),
  );
  return value.session;
}

export async function createTeachingSession(
  user: User,
  slug: string,
  input: CreateTeachingSessionInput,
  idempotencyKey: string,
): Promise<TeachingSession> {
  const value = await requestJson<{ session: TeachingSession }>(
    user,
    orgPath(slug, "/sessions"),
    { method: "POST", body: { ...input }, idempotencyKey },
    (body) => ({ session: parseProperty(body, "session", parseSession) }),
  );
  return value.session;
}

export async function saveTeachingAttendanceBatch(
  user: User,
  slug: string,
  sessionId: string,
  records: Array<{
    attendanceId: string;
    status: Exclude<TeachingAttendanceStatus, "expected">;
  }>,
  idempotencyKey: string,
): Promise<TeachingSavedAttendance[]> {
  const value = await requestJson<{ attendance: TeachingSavedAttendance[] }>(
    user,
    orgPath(slug, `/sessions/${resourceId(sessionId, "课堂标识")}/attendance/batch`),
    { method: "POST", body: { records }, idempotencyKey },
    (body) => ({
      attendance: parseArrayProperty(body, "attendance", parseSavedAttendance),
    }),
  );
  return value.attendance;
}

export async function completeTeachingSession(
  user: User,
  slug: string,
  sessionId: string,
  idempotencyKey: string,
): Promise<TeachingSessionConsumption> {
  const value = await requestJson<{
    session: { id: string; status: "completed"; completedAt: string };
    consumption: TeachingSessionConsumption;
  }>(
    user,
    orgPath(slug, `/sessions/${resourceId(sessionId, "课堂标识")}/complete`),
    { method: "POST", body: {}, idempotencyKey },
    (body) => ({
      session: parseProperty(body, "session", (raw) => {
        if (!isRecord(raw)) {
          throw new TeachingApiError("BAD_RESPONSE", "教学服务返回了无效的完课结果");
        }
        const status = parseSessionStatus(raw.status);
        if (status !== "completed") {
          throw new TeachingApiError("BAD_RESPONSE", "教学服务未确认课堂已完课");
        }
        return {
          id: parseResourceId(raw.id, "课堂标识"),
          status,
          completedAt: parseTimestamp(raw.completedAt, "完课时间"),
        };
      }),
      consumption: parseProperty(body, "consumption", (raw) => {
        if (!isRecord(raw)) {
          throw new TeachingApiError("BAD_RESPONSE", "教学服务返回了无效的扣课结果");
        }
        return {
          attendanceCount: parseNonNegativeInteger(raw.attendanceCount, "扣课人数"),
          totalCredits: parseNonNegativeInteger(raw.totalCredits, "扣课总数"),
        };
      }),
    }),
  );
  return value.consumption;
}
