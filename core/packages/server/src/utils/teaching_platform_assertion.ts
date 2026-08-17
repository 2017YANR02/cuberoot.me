import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { Context } from 'hono';
import {
  TEACHING_PLATFORM_ASSERTION_AUDIENCE,
  TEACHING_PLATFORM_ASSERTION_HEADER,
  TEACHING_PLATFORM_ASSERTION_ISSUER,
  TEACHING_PLATFORM_ASSERTION_MAX_AGE_SECONDS,
  type TeachingPlatformAssertionV1,
} from '@cuberoot/shared/teaching';
import { BANNED_WCA_IDS } from '@cuberoot/shared/admin';
import { sql } from '../db/connection.js';
import { getUserById, isValidPhone, normalizePhone } from './account.js';
import { requireAppUserId } from './app_user_auth.js';

const CLOCK_SKEW_SECONDS = 15;
const NONCE_RETENTION_MINUTES = 10;

export interface TeachingActor {
  userId: number;
  displayName: string;
  source: 'session' | 'platform';
  platformSubject?: string;
}

export class InvalidTeachingPlatformAssertionError extends Error {
  constructor(message = 'Invalid teaching platform assertion') {
    super(message);
    this.name = 'InvalidTeachingPlatformAssertionError';
  }
}

function invalid(): never {
  throw new InvalidTeachingPlatformAssertionError();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Verify signature, lifetime, and exact request binding without touching the database. */
export function verifyTeachingPlatformAssertion(
  token: string,
  secret: string,
  request: { method: string; path: string; body: Uint8Array },
  nowSeconds = Math.floor(Date.now() / 1000),
): TeachingPlatformAssertionV1 {
  if (secret.length < 32 || token.length > 4096) invalid();
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !/^[A-Za-z0-9_-]{43}$/.test(parts[1])) invalid();

  const expected = createHmac('sha256', secret).update(parts[0]).digest();
  const actual = Buffer.from(parts[1], 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) invalid();

  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  } catch {
    invalid();
  }
  if (!isRecord(value)) invalid();

  if (
    value.v !== 1
    || value.iss !== TEACHING_PLATFORM_ASSERTION_ISSUER
    || value.aud !== TEACHING_PLATFORM_ASSERTION_AUDIENCE
    || !validString(value.sub, 128)
    || !validString(value.phone, 32)
    || typeof value.name !== 'string'
    || value.name.length > 200
    || !validString(value.method, 10)
    || !validString(value.path, 500)
    || typeof value.bodySha256 !== 'string'
    || !/^[0-9a-f]{64}$/.test(value.bodySha256)
    || !Number.isSafeInteger(value.iat)
    || !Number.isSafeInteger(value.exp)
    || !validString(value.jti, 200)
    || !/^[A-Za-z0-9_-]{16,200}$/.test(value.jti)
  ) invalid();

  const payload = value as unknown as TeachingPlatformAssertionV1;
  if (
    payload.exp <= payload.iat
    || payload.exp - payload.iat > TEACHING_PLATFORM_ASSERTION_MAX_AGE_SECONDS
    || payload.iat > nowSeconds + CLOCK_SKEW_SECONDS
    || payload.exp < nowSeconds - CLOCK_SKEW_SECONDS
    || payload.method !== request.method.toUpperCase()
    || payload.path !== request.path
    || payload.bodySha256 !== sha256(request.body)
  ) invalid();

  const normalizedPhone = normalizePhone(payload.phone);
  if (!isValidPhone(normalizedPhone)) invalid();
  return { ...payload, phone: normalizedPhone };
}

async function resolvePlatformActor(payload: TeachingPlatformAssertionV1): Promise<TeachingActor> {
  const nonceHash = sha256(payload.jti);
  try {
    return await sql.begin(async (tx) => {
      // Stable advisory locks serialize first-link races without exposing raw identifiers.
      const locks = [sha256(`phone:${payload.phone}`), sha256(`subject:${payload.sub}`)].sort();
      for (const lock of locks) {
        await tx`SELECT pg_advisory_xact_lock(hashtextextended(${lock}, 0))`;
      }

      const mappedRows = await tx`
        SELECT u.id, u.display_name, u.wca_id,
               EXISTS (
                 SELECT 1 FROM auth_identities i
                 WHERE i.user_id = u.id AND i.provider = 'phone' AND i.provider_uid = ${payload.phone}
               ) AS phone_matches
        FROM teaching_platform_identities p
        JOIN app_users u ON u.id = p.user_id
        WHERE p.platform_subject = ${payload.sub}
        FOR UPDATE OF p, u`;

      let user: { id: number; display_name: string; wca_id: string | null };
      if (mappedRows.length) {
        const mapped = mappedRows[0] as unknown as typeof user & { phone_matches: boolean };
        if (!mapped.phone_matches) invalid();
        user = mapped;
      } else {
        const phoneRows = await tx`
          SELECT u.id, u.display_name, u.wca_id
          FROM auth_identities i
          JOIN app_users u ON u.id = i.user_id
          WHERE i.provider = 'phone' AND i.provider_uid = ${payload.phone}
          FOR UPDATE OF i, u`;
        if (phoneRows.length) {
          user = phoneRows[0] as unknown as typeof user;
        } else {
          const created = await tx`
            INSERT INTO app_users (display_name)
            VALUES (${payload.name})
            RETURNING id, display_name, wca_id`;
          user = created[0] as unknown as typeof user;
          await tx`
            INSERT INTO auth_identities (user_id, provider, provider_uid, verified_at)
            VALUES (${user.id}, 'phone', ${payload.phone}, NOW())`;
        }
        await tx`
          INSERT INTO teaching_platform_identities (platform_subject, user_id)
          VALUES (${payload.sub}, ${user.id})`;
      }

      if (user.wca_id && BANNED_WCA_IDS.includes(user.wca_id)) {
        throw new Error('Your account has been suspended');
      }
      if (!user.display_name && payload.name) {
        await tx`UPDATE app_users SET display_name = ${payload.name} WHERE id = ${user.id}`;
        user.display_name = payload.name;
      }
      await tx`
        UPDATE teaching_platform_identities
        SET last_seen_at = NOW()
        WHERE platform_subject = ${payload.sub}`;
      await tx`
        DELETE FROM teaching_platform_assertion_nonces
        WHERE expires_at <= NOW()`;
      await tx`
        INSERT INTO teaching_platform_assertion_nonces (nonce_hash, actor_user_id, expires_at)
        VALUES (${nonceHash}, ${user.id}, NOW() + (${NONCE_RETENTION_MINUTES} * INTERVAL '1 minute'))`;

      return {
        userId: Number(user.id),
        displayName: user.display_name,
        source: 'platform' as const,
        platformSubject: payload.sub,
      };
    }) as TeachingActor;
  } catch (error) {
    if (error instanceof InvalidTeachingPlatformAssertionError) throw error;
    const detail = `${(error as { constraint_name?: string }).constraint_name ?? ''} ${(error as Error).message ?? ''}`;
    if (detail.includes('teaching_platform_assertion_nonces')) invalid();
    throw error;
  }
}

/** Authenticate either a normal CubeRoot bearer token or the server-side platform bridge. */
export async function authenticateTeachingActor(c: Context): Promise<TeachingActor> {
  const assertion = c.req.header(TEACHING_PLATFORM_ASSERTION_HEADER);
  if (assertion) {
    const secret = process.env.TEACHING_PLATFORM_SECRET ?? '';
    const body = new Uint8Array(await c.req.raw.clone().arrayBuffer());
    const payload = verifyTeachingPlatformAssertion(assertion, secret, {
      method: c.req.method,
      path: c.req.path,
      body,
    });
    return resolvePlatformActor(payload);
  }

  const userId = await requireAppUserId(c);
  const user = await getUserById(userId);
  if (!user) throw new Error('Authentication required');
  return { userId, displayName: user.display_name, source: 'session' };
}
