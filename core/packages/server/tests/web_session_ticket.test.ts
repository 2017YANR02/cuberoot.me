import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock('../src/db/connection.js', () => ({ query: queryMock }));

import {
  consumeWebSessionTicket,
  issueWebSessionTicket,
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
    expect(params[2]).toBeInstanceOf(Date);
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
});
