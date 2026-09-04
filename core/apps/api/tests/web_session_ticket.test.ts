import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock('../src/db/connection.js', () => ({ query: queryMock }));

import {
  approveWechatBrowserSession,
  consumeMobileSessionTicket,
  consumeWechatBrowserSession,
  consumeWebSessionTicket,
  issueMobileSessionTicket,
  issueWechatBrowserSession,
  issueWebSessionTicket,
  rejectWechatBrowserSession,
  WECHAT_BROWSER_SESSION_TTL_SECONDS,
  WEB_SESSION_TICKET_TTL_SECONDS,
} from '../src/utils/web_session_ticket.js';

describe('web session tickets', () => {
  beforeEach(() => queryMock.mockReset());

  it('rejects invalid user ids before generating database work', async () => {
    await expect(issueWebSessionTicket(0)).rejects.toThrow(RangeError);
    await expect(issueWebSessionTicket(Number.NaN)).rejects.toThrow(RangeError);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('stores only a hash and returns a short-lived random ticket', async () => {
    queryMock.mockResolvedValue([]);

    const result = await issueWebSessionTicket(42);

    expect(result.ticket).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.expiresIn).toBe(WEB_SESSION_TICKET_TTL_SECONDS);
    expect(queryMock).toHaveBeenCalledTimes(2);
    const [, params] = queryMock.mock.calls[1];
    expect(params[0]).toBe(createHash('sha256').update(result.ticket).digest('hex'));
    expect(params[0]).not.toContain(result.ticket);
    expect(params[1]).toBe(42);
    expect(params[2]).toBe('web');
    expect(params[3]).toBeNull();
    expect(params[4]).toBeInstanceOf(Date);
  });

  it('stores a mobile PKCE challenge without storing its verifier', async () => {
    const verifier = 'V'.repeat(43);
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    queryMock.mockResolvedValue([]);

    const result = await issueMobileSessionTicket(42, challenge);

    expect(result.ticket).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const [, params] = queryMock.mock.calls[1];
    expect(params[2]).toBe('mobile');
    expect(params[3]).toBe(challenge);
    expect(params).not.toContain(verifier);
  });

  it('keeps browser and Mini Program secrets separate through approval and one-time exchange', async () => {
    queryMock.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const pending = await issueWechatBrowserSession();

    expect(pending.ticket).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(pending.approval).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(pending.approval).not.toBe(pending.ticket);
    expect(pending.expiresIn).toBe(WECHAT_BROWSER_SESSION_TTL_SECONDS);
    const [, issuedParams] = queryMock.mock.calls[1];
    expect(issuedParams).toEqual([
      createHash('sha256').update(pending.ticket).digest('hex'),
      createHash('sha256').update(pending.approval).digest('base64url'),
      expect.any(Date),
    ]);

    queryMock.mockResolvedValueOnce([{ user_id: 42 }]);
    await expect(approveWechatBrowserSession(pending.approval, 42)).resolves.toBe(true);
    expect(queryMock.mock.calls[2][1]).toEqual([
      42,
      createHash('sha256').update(pending.approval).digest('base64url'),
      42,
    ]);

    queryMock.mockResolvedValueOnce([{ user_id: 42 }]);
    await expect(consumeWechatBrowserSession(pending.ticket)).resolves.toBe(42);
    expect(queryMock.mock.calls[3][0]).toContain("purpose = 'wechat_browser'");

    queryMock.mockResolvedValueOnce([{ ticket_hash: 'hash' }]);
    await expect(rejectWechatBrowserSession(pending.approval)).resolves.toBe(true);
    expect(queryMock.mock.calls[4][1]).toEqual([
      createHash('sha256').update(pending.approval).digest('base64url'),
    ]);
  });

  it('rejects malformed mobile challenges before touching the database', async () => {
    await expect(issueMobileSessionTicket(42, 'invalid')).rejects.toThrow(RangeError);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('rejects malformed tickets before touching the database', async () => {
    await expect(consumeWebSessionTicket('not-a-ticket')).resolves.toBeNull();
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('atomically consumes a valid ticket and rejects replay', async () => {
    const ticket = 'A'.repeat(43);
    queryMock.mockResolvedValueOnce([{ user_id: 42 }]).mockResolvedValueOnce([]);

    await expect(consumeWebSessionTicket(ticket)).resolves.toBe(42);
    await expect(consumeWebSessionTicket(ticket)).resolves.toBeNull();
    expect(queryMock.mock.calls[0][0]).toContain('DELETE FROM auth_web_session_tickets');
    expect(queryMock.mock.calls[0][0]).toContain('expires_at > NOW()');
    expect(queryMock.mock.calls[0][0]).toContain('RETURNING user_id');
  });

  it('atomically consumes a mobile ticket only with the matching PKCE verifier', async () => {
    const ticket = 'A'.repeat(43);
    const verifier = 'V'.repeat(43);
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    queryMock.mockResolvedValueOnce([{ user_id: 42 }]);

    await expect(consumeMobileSessionTicket(ticket, verifier)).resolves.toBe(42);
    expect(queryMock.mock.calls[0][0]).toContain("purpose = 'mobile'");
    expect(queryMock.mock.calls[0][1]).toEqual([
      createHash('sha256').update(ticket).digest('hex'),
      challenge,
    ]);
  });

  it('rejects malformed mobile tickets and verifiers before touching the database', async () => {
    await expect(consumeMobileSessionTicket('invalid', 'V'.repeat(43))).resolves.toBeNull();
    await expect(consumeMobileSessionTicket('A'.repeat(43), 'invalid')).resolves.toBeNull();
    expect(queryMock).not.toHaveBeenCalled();
  });
});
