import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ query: vi.fn(), run: vi.fn(), verify: vi.fn(), uid: vi.fn(), provider: vi.fn() }));
vi.mock("../src/db/connection.js", () => ({ query: mock.query, withTransaction: (fn: (run: typeof mock.run) => unknown) => fn(mock.run) }));
vi.mock("../src/utils/session.js", () => ({ verifySession: mock.verify }));
vi.mock("../src/utils/app_user_auth.js", () => ({ requireAppUserId: mock.uid }));
vi.mock("../src/utils/aliyun_face.js", async importOriginal => ({
  ...await importOriginal<typeof import("../src/utils/aliyun_face.js")>(),
  faceConfiguration: () => ({ sceneId: "fixture" }), faceVerificationEnabled: () => true,
  aliyunFaceProvider: { query: mock.provider },
}));
import { accountFaceRoutes } from "../src/routes/account_face.js";
const hash = createHash("sha256").update("computer-session").digest("hex");
const row = (extra = {}) => ({ id: "a".repeat(32), user_id: "7", session_hash: hash, status: "pending", scene_id: "fixture", certify_id: "fixture", expires_at: new Date(Date.now() + 60000), verified_at: null, id_last4: "0000", ...extra });
const send = (body?: unknown, token = "computer-session") => accountFaceRoutes.request("/auth/face", {
  method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}),
});
beforeEach(() => { vi.resetAllMocks(); mock.verify.mockReturnValue({ uid: 7 }); mock.uid.mockResolvedValue(7); mock.run.mockResolvedValue([{ id: 7 }]); });
it("shows a different device as non-queryable without exposing the provider ID or session hash", async () => {
  mock.query.mockResolvedValue([row()]);
  const response = await send(undefined, "phone-session");
  const data = await response.json();
  expect(data).toMatchObject({ status: "pending", canCheck: false, sessionChanged: true });
  expect(data).not.toHaveProperty("certify_id"); expect(data).not.toHaveProperty("session_hash");
  const checked = await send({ action: "check" }, "phone-session");
  expect(checked.status).toBe(409); expect(await checked.json()).toMatchObject({ error: "FACE_SESSION_CHANGED" });
  expect(mock.provider).not.toHaveBeenCalled();
});
it("records an explicit failure as terminal so the account can start again", async () => {
  mock.query.mockResolvedValueOnce([row()]).mockResolvedValueOnce([row()]).mockResolvedValueOnce([]).mockResolvedValueOnce([row({ status: "failed" })]);
  mock.provider.mockResolvedValue({ status: "failed" });
  const response = await send({ action: "check" });
  expect(await response.json()).toMatchObject({ status: "failed", attemptId: null });
  expect(mock.query.mock.calls[2][0]).toContain("status = 'failed'");
  expect(mock.run).not.toHaveBeenCalled();
});
it("keeps unfinished results pending without recording a pass or failure", async () => {
  mock.query.mockResolvedValue([row()]); mock.provider.mockResolvedValue({ status: "pending" });
  expect(await (await send({ action: "check" })).json()).toMatchObject({ status: "pending" });
  expect(mock.query).toHaveBeenCalledTimes(3); expect(mock.run).not.toHaveBeenCalled();
});
it("allows same-account cancellation from a phone but never resets quota or changes a completed attempt", async () => {
  mock.query.mockResolvedValue([row({ status: "failed" })]);
  expect((await send({ action: "cancel", attemptId: "a".repeat(32) }, "phone-session")).status).toBe(200);
  const [sql, params] = mock.run.mock.calls[2];
  expect(params).toEqual(["a".repeat(32), 7]);
  expect(sql).toContain("user_id = ? AND status IN ('initializing','pending')");
  expect(sql).not.toMatch(/DELETE|created_at\s*=/i); expect(mock.provider).not.toHaveBeenCalled();
});
it("cannot apply a provider pass after cancellation or expiry while the request is in flight", async () => {
  mock.query.mockResolvedValueOnce([row()]).mockResolvedValueOnce([row()]).mockResolvedValueOnce([row({ status: "failed" })]);
  mock.provider.mockResolvedValue({ status: "passed" }); mock.run.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 7 }]).mockResolvedValueOnce([]);
  expect(await (await send({ action: "check" })).json()).toMatchObject({ status: "failed" });
  const [sql, params] = mock.run.mock.calls[2];
  expect(sql).toContain("user_id = ? AND session_hash = ? AND status = 'pending' AND expires_at > NOW()");
  expect(params).toEqual(["a".repeat(32), 7, hash]);
});
it("does not call the provider after expiry or for an already failed attempt", async () => {
  mock.query.mockResolvedValue([row({ expires_at: new Date(0) })]);
  expect(await (await send({ action: "check" })).json()).toMatchObject({ status: "expired" });
  mock.query.mockResolvedValue([row({ status: "failed" })]);
  expect(await (await send({ action: "check" })).json()).toMatchObject({ status: "failed" });
  expect(mock.provider).not.toHaveBeenCalled();
});
it("separates the five-second throttle from a session error", async () => {
  mock.query.mockResolvedValueOnce([row()]).mockResolvedValueOnce([]).mockResolvedValueOnce([row()]);
  const response = await send({ action: "check" });
  expect(response.status).toBe(429); expect(await response.json()).toMatchObject({ error: "FACE_CHECK_TOO_SOON" });
});
it.each([{ uid: 7, previewId: 1 }, { uid: 8 }])("rejects impersonation or a conflicting authenticated owner", async payload => {
  mock.verify.mockReturnValue(payload);
  expect((await send({ action: "cancel", attemptId: "a".repeat(32) })).status).toBe(401);
  expect(mock.run).not.toHaveBeenCalled(); expect(mock.query).not.toHaveBeenCalled();
});
