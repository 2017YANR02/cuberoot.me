import { createHash, randomBytes } from 'node:crypto';
import {
  isMobileAuthCodeChallenge,
  isMobileAuthCodeVerifier,
  isWebSessionTicket,
  type WebSessionTicketEnvelope,
} from '@cuberoot/shared/auth/web-session';
import { query } from '../db/connection.js';

export const WEB_SESSION_TICKET_TTL_SECONDS = 90;
export const WECHAT_BROWSER_SESSION_TTL_SECONDS = 5 * 60;

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

export async function issueWechatBrowserSession(): Promise<{
  approval: string;
  expiresIn: number;
  ticket: string;
}> {
  const ticket = randomBytes(32).toString('base64url');
  const approval = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + WECHAT_BROWSER_SESSION_TTL_SECONDS * 1000);

  await query('DELETE FROM auth_web_session_tickets WHERE expires_at <= NOW()');
  await query(
    `INSERT INTO auth_web_session_tickets
      (ticket_hash, user_id, purpose, code_challenge, expires_at)
     VALUES (?, NULL, 'wechat_browser', ?, ?)`,
    [hashTicket(ticket), challengeFromVerifier(approval), expiresAt],
  );
  return { approval, expiresIn: WECHAT_BROWSER_SESSION_TTL_SECONDS, ticket };
}

/** Mini Program approval is idempotent for the same account, but cannot be reassigned. */
export async function approveWechatBrowserSession(
  approval: string,
  userId: number,
): Promise<boolean> {
  if (!isWebSessionTicket(approval)) return false;
  assertUserId(userId);
  const rows = await query<{ user_id: number }>(
    `UPDATE auth_web_session_tickets
     SET user_id = COALESCE(user_id, ?)
     WHERE purpose = 'wechat_browser'
       AND code_challenge = ?
       AND expires_at > NOW()
       AND (user_id IS NULL OR user_id = ?)
     RETURNING user_id`,
    [userId, challengeFromVerifier(approval), userId],
  );
  return Number(rows[0]?.user_id) === userId;
}

export async function rejectWechatBrowserSession(approval: string): Promise<boolean> {
  if (!isWebSessionTicket(approval)) return false;
  const rows = await query<{ ticket_hash: string }>(
    `DELETE FROM auth_web_session_tickets
     WHERE purpose = 'wechat_browser'
       AND code_challenge = ?
       AND expires_at > NOW()
     RETURNING ticket_hash`,
    [challengeFromVerifier(approval)],
  );
  return rows.length > 0;
}

/** Consume an approved browser ticket; a valid unapproved ticket remains pollable. */
export async function consumeWechatBrowserSession(
  ticket: string,
): Promise<number | 'pending' | null> {
  if (!isWebSessionTicket(ticket)) return null;
  const ticketHash = hashTicket(ticket);
  const rows = await query<{ user_id: number }>(
    `DELETE FROM auth_web_session_tickets
     WHERE ticket_hash = ?
       AND purpose = 'wechat_browser'
       AND user_id IS NOT NULL
       AND expires_at > NOW()
     RETURNING user_id`,
    [ticketHash],
  );
  const userId = Number(rows[0]?.user_id);
  if (Number.isSafeInteger(userId) && userId > 0) return userId;

  const pending = await query<{ pending: number }>(
    `SELECT 1 AS pending FROM auth_web_session_tickets
     WHERE ticket_hash = ? AND purpose = 'wechat_browser' AND expires_at > NOW()`,
    [ticketHash],
  );
  return pending.length > 0 ? 'pending' : null;
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
