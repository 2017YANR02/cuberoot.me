import { createHash, createHmac, randomUUID } from "node:crypto";
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { query, withTransaction } from "../db/connection.js";
import { requireAppUserId } from "../utils/app_user_auth.js";
import { verifySession } from "../utils/session.js";
import { aliyunFaceProvider, faceConfiguration, faceVerificationEnabled, FaceVerificationError } from "../utils/aliyun_face.js";

const CONSENT_VERSION = "2026-10-08";
type Attempt = { id: string; user_id: string; session_hash: string; scene_id: string; certify_id: string | null;
  status: string; expires_at: Date; verified_at: Date | null; id_last4: string };

// Only the user's own signed session can create/check an attempt. Never accept a client UID or CertifyId.
async function actor(c: Context) {
  try {
    const token = c.req.header("Authorization")?.replace(/^Bearer /, "") ?? "";
    const payload = verifySession(token) as ReturnType<typeof verifySession> & { previewId?: unknown };
    if (payload.previewId || !Number.isSafeInteger(payload.uid) || !payload.uid) throw new Error();
    const uid = await requireAppUserId(c);
    if (uid !== payload.uid) throw new Error();
    return { uid, sessionHash: createHash("sha256").update(token).digest("hex") };
  } catch { throw new FaceVerificationError("Please sign in to your own account again.", 401); }
}

function fields(input: Record<string, unknown>) {
  if (input.consent !== true || input.consentVersion !== CONSENT_VERSION) throw new FaceVerificationError("Consent required.");
  const realName = typeof input.realName === "string" ? input.realName.trim().normalize("NFKC") : "";
  const idCard = typeof input.idCard === "string" ? input.idCard.trim().toUpperCase() : "";
  if (realName.length < 2 || realName.length > 60 || !/^\d{17}[\dX]$/.test(idCard)) throw new FaceVerificationError("Invalid identity details.");
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  if ("10X98765432"[weights.reduce((n, w, i) => n + w * Number(idCard[i]), 0) % 11] !== idCard[17]) throw new FaceVerificationError("Invalid identity details.");
  const metaInfo = typeof input.metaInfo === "string" ? input.metaInfo : "";
  try {
    const meta = JSON.parse(metaInfo);
    if (!meta || typeof meta !== "object" || Array.isArray(meta) || !Object.keys(meta).length || metaInfo.length > 16_000) throw new Error();
  } catch { throw new FaceVerificationError("Device information unavailable."); }
  return { realName, idCard, metaInfo };
}

async function status(uid: number, sessionHash: string) {
  const [row] = await query<Attempt>("SELECT id, session_hash, status, verified_at, id_last4, expires_at FROM account_face_attempts WHERE user_id = ? ORDER BY created_at DESC LIMIT 1", [uid]);
  const active = Boolean(row && ["pending", "initializing"].includes(row.status) && new Date(row.expires_at).getTime() > Date.now());
  return { attemptId: active ? row.id : null, expiresAt: active ? row.expires_at : null,
    canCheck: active && row.status === "pending" && row.session_hash === sessionHash,
    sessionChanged: active && row.session_hash !== sessionHash, enabled: faceVerificationEnabled(), consentVersion: CONSENT_VERSION,
    status: row?.status === "pending" || row?.status === "initializing"
      ? (new Date(row.expires_at).getTime() > Date.now() ? row.status : "expired") : row?.status ?? "none",
    verifiedAt: row?.verified_at ?? null, idLast4: row?.status === "passed" ? row.id_last4 : null };
}

export const accountFaceRoutes = new Hono();
accountFaceRoutes.use("/auth/face", bodyLimit({ maxSize: 24_000 }));
accountFaceRoutes.use("/auth/face", async (c, next) => {
  c.header("Cache-Control", "no-store");
  c.header("Referrer-Policy", "no-referrer");
  await next();
});
accountFaceRoutes.onError((error, c) => {
  // Never expose provider messages, identity details or database errors.
  const code = error instanceof FaceVerificationError ? error.status : 503;
  return c.json({ error: error instanceof FaceVerificationError ? error.code : "FACE_UNAVAILABLE", retryable: code >= 500 }, code as 400 | 401 | 403 | 409 | 429 | 503);
});
accountFaceRoutes.get("/auth/face", async c => {
  const { uid, sessionHash } = await actor(c);
  return c.json(await status(uid, sessionHash));
});
accountFaceRoutes.post("/auth/face", async c => {
  const { uid, sessionHash } = await actor(c);
  const config = faceConfiguration();
  let input: Record<string, unknown>;
  try {
    input = await c.req.json();
    if (!input || Array.isArray(input) || typeof input !== "object") throw new Error();
  } catch { throw new FaceVerificationError("Invalid request."); }
  if (input.action === "start") {
    const values = fields(input);
    const identityDigest = createHmac("sha256", process.env.CUBEROOT_FACE_IDENTITY_PEPPER!).update(values.idCard).digest("hex");
    const id = randomUUID().replace(/-/g, "");
    await withTransaction(async run => {
      // Serializes quota reservations across workers before making the billable API call.
      await run("SELECT pg_advisory_xact_lock(82341926)");
      const [user] = await run("SELECT id FROM app_users WHERE id = ? AND merged_into_user_id IS NULL FOR UPDATE", [uid]);
      if (!user) throw new FaceVerificationError("Account unavailable.", 403);
      const [used] = await run("SELECT id FROM account_face_attempts WHERE status = 'passed' AND (user_id = ? OR identity_digest = ?) LIMIT 1", [uid, identityDigest]);
      if (used) throw new FaceVerificationError("Identity already verified.", 409);
      const [quota] = await run<{ total: number; own: number; pending: number; recent: number }>(`SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE user_id = ?)::int AS own,
        COUNT(*) FILTER (WHERE user_id = ? AND status IN ('initializing','pending') AND expires_at > NOW())::int AS pending,
        COUNT(*) FILTER (WHERE user_id = ? AND created_at > NOW() - INTERVAL '1 minute')::int AS recent
        FROM account_face_attempts WHERE created_at > NOW() - INTERVAL '24 hours'`, [uid, uid, uid]);
      if (quota.pending > 0) throw new FaceVerificationError("An attempt is pending.", 429, "FACE_PENDING");
      if (quota.own >= 10) throw new FaceVerificationError("Daily attempt limit reached.", 429, "FACE_DAILY_LIMIT");
      if (quota.total >= 100) throw new FaceVerificationError("Site attempt limit reached.", 429, "FACE_SITE_LIMIT");
      if (quota.recent > 0) throw new FaceVerificationError("Retry after one minute.", 429, "FACE_RETRY_SOON");
      await run(`INSERT INTO account_face_attempts (id,user_id,session_hash,identity_digest,id_last4,scene_id,status,consent_version,expires_at)
        VALUES (?,?,?,?,?,?,'initializing',?,NOW() + INTERVAL '30 minutes')`, [id, uid, sessionHash, identityDigest, values.idCard.slice(-4), config.sceneId, CONSENT_VERSION]);
    });
    try {
      const result = await aliyunFaceProvider.init({ id, ...values, ...config });
      const updated = await query("UPDATE account_face_attempts SET certify_id = ?, status = 'pending' WHERE id = ? AND status = 'initializing' AND expires_at > NOW() RETURNING id", [result.certifyId, id]);
      if (!updated.length) throw new FaceVerificationError("Attempt expired.", 409);
      return c.json({ certifyUrl: result.certifyUrl });
    } catch (error) {
      await query("UPDATE account_face_attempts SET status = 'failed' WHERE id = ? AND status = 'initializing'", [id]);
      if (error instanceof FaceVerificationError) throw error;
      throw new FaceVerificationError("Provider unavailable.", 503);
    }
  }
  if (input.action === "cancel") {
    if (typeof input.attemptId !== "string" || !/^[a-f0-9]{32}$/u.test(input.attemptId)) throw new FaceVerificationError("Invalid attempt.");
    // Same-account cancellation is safe across devices: it cannot verify an identity or reset quota.
    // The explicit attempt ID prevents a stale page from cancelling a newer attempt.
    await withTransaction(async run => {
      await run("SELECT pg_advisory_xact_lock(82341926)");
      const [user] = await run("SELECT id FROM app_users WHERE id = ? AND merged_into_user_id IS NULL FOR UPDATE", [uid]);
      if (!user) throw new FaceVerificationError("Account unavailable.", 403);
      await run("UPDATE account_face_attempts SET status = 'failed' WHERE id = ? AND user_id = ? AND status IN ('initializing','pending')", [input.attemptId, uid]);
    });
    return c.json(await status(uid, sessionHash));
  }
  if (input.action !== "check") throw new FaceVerificationError("Invalid action.");
  const current = await status(uid, sessionHash);
  if (!["pending", "initializing"].includes(current.status)) return c.json(current);
  if (current.sessionChanged) throw new FaceVerificationError("Use the originating session or end the attempt.", 409, "FACE_SESSION_CHANGED");
  if (current.status === "initializing") throw new FaceVerificationError("Attempt is initializing.", 429, "FACE_PENDING");
  const [attempt] = await query<Attempt>(`UPDATE account_face_attempts SET checked_at = NOW()
    WHERE id = (SELECT id FROM account_face_attempts WHERE user_id = ? ORDER BY created_at DESC LIMIT 1)
    AND session_hash = ? AND status = 'pending' AND expires_at > NOW()
    AND (checked_at IS NULL OR checked_at < NOW() - INTERVAL '5 seconds') RETURNING *`, [uid, sessionHash]);
  if (!attempt?.certify_id) {
    const latest = await status(uid, sessionHash);
    if (!["pending", "initializing"].includes(latest.status)) return c.json(latest);
    if (latest.sessionChanged) throw new FaceVerificationError("Session changed.", 409, "FACE_SESSION_CHANGED");
    throw new FaceVerificationError("Check again after five seconds.", 429, "FACE_CHECK_TOO_SOON");
  }
  const result = await aliyunFaceProvider.query(attempt.scene_id, attempt.certify_id);
  // Only explicit provider T is success. Unfinished RPC results remain pending; F is terminal.
  if (result.status === "failed") await query(`UPDATE account_face_attempts SET status = 'failed'
    WHERE id = ? AND user_id = ? AND session_hash = ? AND status = 'pending' AND expires_at > NOW()`, [attempt.id, uid, sessionHash]);
  if (result.status === "passed") await withTransaction(async run => {
    await run("SELECT pg_advisory_xact_lock(82341926)");
    const [user] = await run("SELECT id FROM app_users WHERE id = ? AND merged_into_user_id IS NULL FOR UPDATE", [uid]);
    if (!user) throw new FaceVerificationError("Account unavailable.", 403);
    await run(`UPDATE account_face_attempts SET status = 'passed', verified_at = NOW()
      WHERE id = ? AND user_id = ? AND session_hash = ? AND status = 'pending' AND expires_at > NOW()`, [attempt.id, uid, sessionHash]);
  });
  return c.json(await status(uid, sessionHash));
});
