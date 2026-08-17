import { createHash, createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/db/schema";

vi.mock("server-only", () => ({}));

const user: User = {
  id: "u_platform_actor",
  phone: "13800138000",
  nickname: "测试老师",
  avatar: null,
  role: "user",
  instructorId: null,
  createdAt: 1,
  updatedAt: 1,
};

const secret = "platform-bridge-test-secret-32-bytes-minimum";

describe("teaching platform API bridge", () => {
  beforeEach(() => {
    process.env.TEACHING_PLATFORM_SECRET = secret;
    process.env.TEACHING_API_BASE_URL = "https://api.example.test/v1";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    delete process.env.TEACHING_PLATFORM_SECRET;
    delete process.env.TEACHING_API_BASE_URL;
  });

  it("signs the exact actor, method, path, and body", async () => {
    const { createTeachingPlatformAssertion } = await import(
      "@/lib/teaching-api"
    );
    const body = JSON.stringify({ displayName: "小明", externalRef: null });
    const token = createTeachingPlatformAssertion(
      user,
      {
        method: "post",
        path: "/v1/teaching/organizations/demo/students",
        body,
        idempotencyKey: "11111111-1111-4111-8111-111111111111",
      },
      { secret, nowSeconds: 1_800_000_000, nonce: "fixed_nonce_for_contract" },
    );
    const [encoded, signature] = token.split(".");
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    );
    expect(payload).toMatchObject({
      v: 1,
      iss: "cuberoot-platform",
      aud: "cuberoot-teaching-api",
      sub: user.id,
      phone: user.phone,
      name: user.nickname,
      method: "POST",
      path: "/v1/teaching/organizations/demo/students",
      bodySha256: createHash("sha256").update(body).digest("hex"),
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
      iat: 1_800_000_000,
      exp: 1_800_000_060,
      jti: "fixed_nonce_for_contract",
    });
    expect(signature).toBe(
      createHmac("sha256", secret).update(encoded).digest("base64url"),
    );
  });

  it("binds a list request to the mounted /v1 path", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ organizations: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const { listTeachingOrganizations } = await import("@/lib/teaching-api");
    await expect(listTeachingOrganizations(user)).resolves.toEqual([]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.example.test/v1/teaching/organizations");
    expect(init?.method).toBe("GET");
    expect(init?.cache).toBe("no-store");
    const headers = new Headers(init?.headers);
    const token = headers.get("X-CubeRoot-Platform-Assertion");
    expect(token).toBeTruthy();
    const payload = JSON.parse(
      Buffer.from(token!.split(".")[0], "base64url").toString("utf8"),
    );
    expect(payload.path).toBe("/v1/teaching/organizations");
    expect(payload.idempotencyKey).toBeNull();
    expect(payload.bodySha256).toBe(createHash("sha256").update("").digest("hex"));
    expect(headers.has("Idempotency-Key")).toBe(false);
  });

  it("uses exact JSON and an idempotency key for mutations", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          student: {
            id: "student-1",
            externalRef: null,
            displayName: "小明",
            status: "active",
            createdAt: "2026-08-17T00:00:00.000Z",
            updatedAt: "2026-08-17T00:00:00.000Z",
          },
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );
    const { createTeachingStudent } = await import("@/lib/teaching-api");
    const operationKey = "22222222-2222-4222-8222-222222222222";
    await createTeachingStudent(
      user,
      "demo",
      { displayName: "小明", externalRef: null },
      operationKey,
    );

    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ displayName: "小明", externalRef: null }));
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("Idempotency-Key")).toBe(operationKey);
    const token = headers.get("X-CubeRoot-Platform-Assertion")!;
    const payload = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8"));
    expect(payload.idempotencyKey).toBe(operationKey);
  });

  it("strictly parses package products and rejects invalid credit totals", async () => {
    const validProduct = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      code: "private_10",
      name: "十节一对一",
      status: "active",
      creditUnit: "lesson",
      creditType: "general",
      totalCredits: 10,
      validityDays: 365,
      priceAmountMinor: 12_800,
      currency: "CNY",
      createdAt: "2026-08-17T00:00:00.000Z",
      updatedAt: "2026-08-17T00:00:00.000Z",
    };
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        packageProducts: [validProduct], total: 1, page: 1, pageSize: 30,
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        packageProducts: [{ ...validProduct, totalCredits: 0 }], total: 1, page: 1, pageSize: 30,
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const { listTeachingPackageProducts } = await import("@/lib/teaching-api");

    await expect(listTeachingPackageProducts(user, "demo")).resolves.toMatchObject({
      items: [{ code: "private_10", totalCredits: 10 }],
      total: 1,
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.example.test/v1/teaching/organizations/demo/package-products?page=1&pageSize=30",
    );
    await expect(listTeachingPackageProducts(user, "demo")).rejects.toMatchObject({
      code: "BAD_RESPONSE",
    });
  });

  it("signs the final session-create shape and normalizes attendance", async () => {
    const operationKey = "33333333-3333-4333-8333-333333333333";
    const input = {
      title: "周六训练",
      startsAt: "2026-08-22T01:00:00.000Z",
      endsAt: "2026-08-22T02:00:00.000Z",
      timezone: "Asia/Shanghai",
      teacherUserIds: [],
      attendees: [{
        studentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        studentPackageId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        creditCost: 1,
      }],
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      session: {
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        title: input.title,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        timezone: input.timezone,
        status: "scheduled",
        attendance: [{
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          studentId: input.attendees[0].studentId,
          displayName: "小明",
          studentPackageId: input.attendees[0].studentPackageId,
          status: "expected",
          creditCost: 1,
        }],
        createdAt: "2026-08-17T00:00:00.000Z",
        updatedAt: "2026-08-17T00:00:00.000Z",
      },
    }), { status: 201, headers: { "Content-Type": "application/json" } }));
    const { createTeachingSession } = await import("@/lib/teaching-api");

    await expect(createTeachingSession(user, "demo", input, operationKey)).resolves.toMatchObject({
      attendeeCount: 1,
      attendees: [{ studentName: "小明", attendanceStatus: "expected" }],
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.example.test/v1/teaching/organizations/demo/sessions");
    expect(init?.body).toBe(JSON.stringify(input));
    const headers = new Headers(init?.headers);
    expect(headers.get("Idempotency-Key")).toBe(operationKey);
    const payload = JSON.parse(Buffer.from(headers.get("X-CubeRoot-Platform-Assertion")!.split(".")[0], "base64url").toString("utf8"));
    expect(payload.path).toBe("/v1/teaching/organizations/demo/sessions");
    expect(payload.bodySha256).toBe(createHash("sha256").update(JSON.stringify(input)).digest("hex"));
    expect(payload.idempotencyKey).toBe(operationKey);
  });

  it("uses record-only attendance batches with the same signed idempotency key", async () => {
    const operationKey = "44444444-4444-4444-8444-444444444444";
    const sessionId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const records = [{
      attendanceId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      status: "present" as const,
    }];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      attendance: [{
        id: records[0].attendanceId,
        studentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        studentPackageId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        status: "present",
        creditCost: 1,
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const { saveTeachingAttendanceBatch } = await import("@/lib/teaching-api");

    await expect(saveTeachingAttendanceBatch(user, "demo", sessionId, records, operationKey)).resolves.toMatchObject([
      { attendanceStatus: "present", creditCost: 1 },
    ]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`https://api.example.test/v1/teaching/organizations/demo/sessions/${sessionId}/attendance/batch`);
    expect(init?.body).toBe(JSON.stringify({ records }));
    expect(new Headers(init?.headers).get("Idempotency-Key")).toBe(operationKey);
  });

  it("signs completion with an explicit empty JSON body and parses consumption", async () => {
    const operationKey = "55555555-5555-4555-8555-555555555555";
    const sessionId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      session: { id: sessionId, status: "completed", completedAt: "2026-08-22T02:00:00.000Z" },
      consumption: { attendanceCount: 1, totalCredits: 1 },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const { completeTeachingSession } = await import("@/lib/teaching-api");

    await expect(completeTeachingSession(user, "demo", sessionId, operationKey)).resolves.toEqual({
      attendanceCount: 1,
      totalCredits: 1,
    });
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.body).toBe("{}");
    const headers = new Headers(init?.headers);
    expect(headers.get("Idempotency-Key")).toBe(operationKey);
    const payload = JSON.parse(Buffer.from(headers.get("X-CubeRoot-Platform-Assertion")!.split(".")[0], "base64url").toString("utf8"));
    expect(payload.bodySha256).toBe(createHash("sha256").update("{}").digest("hex"));
    expect(payload.idempotencyKey).toBe(operationKey);
  });

  it("binds pagination to the signed query and validates page metadata", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          students: [{
            id: "student-31",
            accountUserId: null,
            externalRef: "S-31",
            displayName: "第三十一位学员",
            status: "active",
            createdAt: "2026-08-17T00:00:00.000Z",
            updatedAt: "2026-08-17T00:00:00.000Z",
          }],
          total: 31,
          page: 2,
          pageSize: 30,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const { listTeachingStudents } = await import("@/lib/teaching-api");

    await expect(
      listTeachingStudents(user, "demo", { page: 2, pageSize: 30 }),
    ).resolves.toMatchObject({ total: 31, page: 2, pageSize: 30, totalPages: 2 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      "https://api.example.test/v1/teaching/organizations/demo/students?page=2&pageSize=30",
    );
    const token = new Headers(init?.headers).get("X-CubeRoot-Platform-Assertion")!;
    const payload = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8"));
    expect(payload.path).toBe(
      "/v1/teaching/organizations/demo/students?page=2&pageSize=30",
    );
  });

  it("normalizes non-finite and out-of-range pagination before signing", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ members: [], total: 0, page: 1, pageSize: 30 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const { listTeachingMembers } = await import("@/lib/teaching-api");

    await listTeachingMembers(user, "demo", { page: Number.POSITIVE_INFINITY, pageSize: Number.NaN });

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.example.test/v1/teaching/organizations/demo/members?page=1&pageSize=30",
    );
  });

  it("strictly parses named campus and group lists", async () => {
    const campus = {
      id: "11111111-1111-4111-8111-111111111111",
      code: null,
      name: "城西校区",
      timezone: null,
      status: "active",
      archivedAt: null,
      createdAt: "2026-08-17T00:00:00.000Z",
      updatedAt: "2026-08-17T00:00:00.000Z",
    };
    const group = {
      id: "22222222-2222-4222-8222-222222222222",
      campusId: campus.id,
      code: "sat-a",
      name: "周六进阶班",
      status: "active",
      archivedAt: null,
      createdAt: "2026-08-17T00:00:00.000Z",
      updatedAt: "2026-08-17T00:00:00.000Z",
    };
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ campuses: [campus], total: 1, page: 1, pageSize: 100 }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ groups: [group], total: 1, page: 1, pageSize: 30 }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const { listTeachingCampuses, listTeachingGroups } = await import("@/lib/teaching-api");

    await expect(listTeachingCampuses(user, "demo", { pageSize: 100 })).resolves.toMatchObject({ items: [{ name: "城西校区", timezone: null }] });
    await expect(listTeachingGroups(user, "demo")).resolves.toMatchObject({ items: [{ name: "周六进阶班", campusId: campus.id }] });
    expect(String(fetchMock.mock.calls[0][0])).toContain("/campuses?page=1&pageSize=100");
    expect(String(fetchMock.mock.calls[1][0])).toContain("/groups?page=1&pageSize=30");
  });

  it("signs a group membership mutation with the canonical effective range", async () => {
    const groupId = "22222222-2222-4222-8222-222222222222";
    const studentId = "33333333-3333-4333-8333-333333333333";
    const input = {
      studentId,
      effectiveFrom: "2026-08-18T00:00:00.000Z",
      effectiveTo: "2026-12-01T00:00:00.000Z",
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      membership: {
        id: "44444444-4444-4444-8444-444444444444",
        groupId,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        createdAt: "2026-08-17T00:00:00.000Z",
        student: { id: studentId, displayName: "小明", externalRef: null, status: "active" },
      },
    }), { status: 201, headers: { "Content-Type": "application/json" } }));
    const { createTeachingStudentGroupMembership } = await import("@/lib/teaching-api");
    const operationKey = "55555555-5555-4555-8555-555555555555";

    await expect(createTeachingStudentGroupMembership(user, "demo", groupId, input, operationKey)).resolves.toMatchObject({ groupId, student: { id: studentId } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`https://api.example.test/v1/teaching/organizations/demo/groups/${groupId}/students`);
    expect(init?.body).toBe(JSON.stringify(input));
    expect(new Headers(init?.headers).get("Idempotency-Key")).toBe(operationKey);
  });

  it("parses assignment snapshots and rejects inconsistent live identities", async () => {
    const groupId = "22222222-2222-4222-8222-222222222222";
    const assignment = {
      id: "66666666-6666-4666-8666-666666666666",
      teacherUserId: 42,
      teacherUserIdSnapshot: 42,
      groupId,
      studentId: null,
      effectiveFrom: "2026-08-18T00:00:00.000Z",
      effectiveTo: null,
      createdAt: "2026-08-17T00:00:00.000Z",
      teacher: { userId: 42, displayName: "负责人", role: "owner", status: "active" },
    };
    const cancelledFutureAssignment = {
      ...assignment,
      id: "99999999-9999-4999-8999-999999999999",
      teacherUserId: null,
      effectiveTo: assignment.effectiveFrom,
      teacher: { ...assignment.teacher, userId: null, status: null },
    };
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ assignments: [assignment], total: 1, page: 2, pageSize: 10 }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ assignments: [cancelledFutureAssignment], total: 1, page: 1, pageSize: 30 }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ assignments: [{ ...assignment, teacher: { ...assignment.teacher, userId: 43 } }], total: 1, page: 1, pageSize: 30 }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const { listTeachingTeacherAssignments } = await import("@/lib/teaching-api");

    await expect(listTeachingTeacherAssignments(user, "demo", { groupId }, { page: 2, pageSize: 10 })).resolves.toMatchObject({ items: [{ teacherUserIdSnapshot: 42, teacher: { role: "owner" } }] });
    expect(String(fetchMock.mock.calls[0][0])).toBe(`https://api.example.test/v1/teaching/organizations/demo/teacher-assignments?groupId=${groupId}&page=2&pageSize=10`);
    await expect(listTeachingTeacherAssignments(user, "demo", { groupId })).resolves.toMatchObject({ items: [{ teacherUserId: null, effectiveTo: assignment.effectiveFrom }] });
    await expect(listTeachingTeacherAssignments(user, "demo", { groupId })).rejects.toMatchObject({ code: "BAD_RESPONSE" });
  });

  it("signs the exact direct-student assignment body", async () => {
    const studentId = "33333333-3333-4333-8333-333333333333";
    const input = { teacherUserId: 42, studentId, effectiveFrom: "2026-08-18T00:00:00.000Z" };
    const response = {
      id: "77777777-7777-4777-8777-777777777777",
      teacherUserId: 42,
      teacherUserIdSnapshot: 42,
      groupId: null,
      studentId,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: null,
      createdAt: "2026-08-17T00:00:00.000Z",
      teacher: { userId: 42, displayName: "管理员", role: "admin", status: "active" },
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ assignment: response }), { status: 201, headers: { "Content-Type": "application/json" } }));
    const { createTeachingTeacherAssignment } = await import("@/lib/teaching-api");
    const operationKey = "88888888-8888-4888-8888-888888888888";

    await expect(createTeachingTeacherAssignment(user, "demo", input, operationKey)).resolves.toMatchObject({ teacherUserIdSnapshot: 42, studentId });
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.body).toBe(JSON.stringify(input));
    expect(new Headers(init?.headers).get("Idempotency-Key")).toBe(operationKey);
  });

  it("fails closed before fetch when the shared secret is missing", async () => {
    delete process.env.TEACHING_PLATFORM_SECRET;
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const { listTeachingOrganizations, TeachingApiError } = await import(
      "@/lib/teaching-api"
    );
    await expect(listTeachingOrganizations(user)).rejects.toBeInstanceOf(
      TeachingApiError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed before fetch when the production API base is missing or invalid", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.TEACHING_API_BASE_URL;
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const { listTeachingOrganizations, TeachingApiError } = await import(
      "@/lib/teaching-api"
    );

    await expect(listTeachingOrganizations(user)).rejects.toBeInstanceOf(
      TeachingApiError,
    );
    process.env.TEACHING_API_BASE_URL = "not-a-url";
    await expect(listTeachingOrganizations(user)).rejects.toBeInstanceOf(
      TeachingApiError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
