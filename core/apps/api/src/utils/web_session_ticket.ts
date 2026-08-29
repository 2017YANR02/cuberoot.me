import { createHash, randomBytes } from 'node:crypto';
import {
  isMobileAuthCodeChallenge,
  isMobileAuthCodeVerifier,
  isWebSessionTicket,
  type WebSessionTicketEnvelope,
} from '@cuberoot/shared/auth/web-session';
import { query } from '../db/connection.js';

export const WEB_SESSION_TICKET_TTL_SECONDS = 90;

function hashTicket(ticket: string): string {
  return createHash('sha256').update(ticket).digest('hex');
}

function challengeFromVerifier(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

function assertUserId(userId: number): void {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new RangeError('userId must be a positive safe integer');
  }
}

async function issueTicket(
  userId: number,
  purpose: 'web' | 'mobile',
  codeChallenge: string | null,
): Promise<WebSessionTicketEnvelope> {
  assertUserId(userId);
  const ticket = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + WEB_SESSION_TICKET_TTL_SECONDS * 1000);

  await query('DELETE FROM auth_web_session_tickets WHERE expires_at <= NOW()');
  await query(
    `INSERT INTO auth_web_session_tickets
      (ticket_hash, user_id, purpose, code_challenge, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [hashTicket(ticket), userId, purpose, codeChallenge, expiresAt],
  );

  return { ticket, expiresIn: WEB_SESSION_TICKET_TTL_SECONDS };
}

export async function issueWebSessionTicket(userId: number): Promise<WebSessionTicketEnvelope> {
  return issueTicket(userId, 'web', null);
}

export async function issueMobileSessionTicket(
  userId: number,
  codeChallenge: string,
): Promise<WebSessionTicketEnvelope> {
  if (!isMobileAuthCodeChallenge(codeChallenge)) {
    throw new RangeError('invalid mobile auth code challenge');
  }
  return issueTicket(userId, 'mobile', codeChallenge);
}

/** 原子删除并返回归属账号；过期、格式错误或已经消费均返回 null。 */
export async function consumeWebSessionTicket(ticket: string): Promise<number | null> {
  if (!isWebSessionTicket(ticket)) return null;

  const rows = await query<{ user_id: number }>(
    `DELETE FROM auth_web_session_tickets
     WHERE ticket_hash = ? AND purpose = 'web' AND expires_at > NOW()
     RETURNING user_id`,
    [hashTicket(ticket)],
  );
  const userId = Number(rows[0]?.user_id);
  return Number.isSafeInteger(userId) && userId > 0 ? userId : null;
}

/** PKCE-bound mobile tickets are consumed only when the native verifier matches. */
export async function consumeMobileSessionTicket(
  ticket: string,
  codeVerifier: string,
): Promise<number | null> {
  if (!isWebSessionTicket(ticket) || !isMobileAuthCodeVerifier(codeVerifier)) return null;

  const rows = await query<{ user_id: number }>(
    `DELETE FROM auth_web_session_tickets
     WHERE ticket_hash = ?
       AND purpose = 'mobile'
       AND code_challenge = ?
       AND expires_at > NOW()
     RETURNING user_id`,
    [hashTicket(ticket), challengeFromVerifier(codeVerifier)],
  );
  const userId = Number(rows[0]?.user_id);
  return Number.isSafeInteger(userId) && userId > 0 ? userId : null;
}
