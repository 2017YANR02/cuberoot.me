import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { aliyunFaceProvider } from "../src/utils/aliyun_face.js";
const request = vi.fn();
beforeEach(() => {
  request.mockReset(); vi.stubGlobal("fetch", request);
  for (const [key, value] of Object.entries({ ENABLED: "true", CONSENT_APPROVED: "true", IDENTITY_PEPPER: "x".repeat(32), ACCESS_KEY_ID: "fixture", ACCESS_KEY_SECRET: "fixture", SCENE_ID: "1000", APP_ORIGIN: "https://cuberoot.me" })) vi.stubEnv(`CUBEROOT_FACE_${key}`, value);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it.each(["403", "424"])("treats provider RPC %s as unfinished", async Code => {
  request.mockResolvedValue(Response.json({ Code }));
  expect(await aliyunFaceProvider.query("1000", "fixture")).toEqual({ status: "pending" });
});
it.each([["T", "passed"], ["F", "failed"]])("uses only explicit Passed %s", async (Passed, status) => {
  request.mockResolvedValue(Response.json({ Code: "200", ResultObject: { Passed, MaterialInfo: "not returned" } }));
  expect(await aliyunFaceProvider.query("1000", "fixture")).toEqual({ status });
});
it("does not treat missing Passed, transport failure, or untrusted messages as a result", async () => {
  request.mockResolvedValue(Response.json({ Code: "200", ResultObject: { SubCode: "200" } }));
  await expect(aliyunFaceProvider.query("1000", "fixture")).rejects.toMatchObject({ status: 503 });
  request.mockRejectedValue(new Error("private provider detail"));
  await expect(aliyunFaceProvider.query("1000", "fixture")).rejects.not.toThrow("private provider detail");
});
