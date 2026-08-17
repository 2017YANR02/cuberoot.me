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
