import "server-only";

import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import {
  TEACHING_MEMBER_STATUSES,
  TEACHING_ORGANIZATION_STATUSES,
  TEACHING_PLATFORM_ASSERTION_AUDIENCE,
  TEACHING_PLATFORM_ASSERTION_HEADER,
  TEACHING_PLATFORM_ASSERTION_ISSUER,
  TEACHING_PLATFORM_ASSERTION_MAX_AGE_SECONDS,
  TEACHING_STUDENT_STATUSES,
  isTeachingOrganizationRole,
  type TeachingApiErrorBody,
  type TeachingErrorCode,
  type TeachingMemberStatus,
  type TeachingOrganizationRole,
  type TeachingOrganizationStatus,
  type TeachingPlatformAssertionV1,
  type TeachingStudentStatus,
} from "@cuberoot/shared/teaching";
import type { User } from "@/db/schema";

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

export class TeachingApiError extends Error {
  constructor(
    readonly code: TeachingErrorCode | "BAD_RESPONSE" | "UNAVAILABLE",
    message: string,
    readonly status?: number,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "TeachingApiError";
  }
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
