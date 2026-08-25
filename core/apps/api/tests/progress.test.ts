import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HTTPException } from 'hono/http-exception';

vi.mock('../src/db/connection.js', () => ({ query: vi.fn() }));
vi.mock('../src/utils/analytics_helpers.js', () => ({ getIp: vi.fn(() => '127.0.0.1') }));
vi.mock('../src/utils/recon_helpers.js', () => ({
  checkRateLimit: vi.fn(),
  requireAuth: vi.fn(),
}));

import { query } from '../src/db/connection.js';
import { progressRoutes } from '../src/routes/progress.js';
import { checkRateLimit, requireAuth } from '../src/utils/recon_helpers.js';

const queryMock = vi.mocked(query);
const requireAuthMock = vi.mocked(requireAuth);
const checkRateLimitMock = vi.mocked(checkRateLimit);

const validResult = {
  caseId: 'F2L-1',
  timeMs: 1234,
  correct: true,
  timestamp: Date.now() - 1000,
};

describe('progress routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockResolvedValue({ wcaId: 'u42', name: 'Learner', uid: 42 });
    queryMock.mockResolvedValue([]);
  });

  it('uses the authenticated owner for reads and ignores a spoofed query userId', async () => {
    const response = await progressRoutes.request('/progress/f2l?userId=victim');

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-cache, no-store, must-revalidate');
    expect(requireAuthMock).toHaveBeenCalledOnce();
    expect(checkRateLimitMock).toHaveBeenNthCalledWith(1, '127.0.0.1', { bucket: 'progress-read-ip', max: 600 });
    expect(checkRateLimitMock).toHaveBeenNthCalledWith(2, 'u42', { bucket: 'progress-read-user', max: 120 });
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('FROM train_results'), ['u42', 'f2l']);
  });

  it('uses the authenticated owner for every uploaded row and ignores a spoofed body userId', async () => {
    const response = await progressRoutes.request('/progress/f2l', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'victim', results: [validResult, { ...validResult, caseId: 'F2L-2' }] }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, count: 2 });
    expect(checkRateLimitMock).toHaveBeenNthCalledWith(1, '127.0.0.1', { bucket: 'progress-write-ip', max: 120 });
    expect(checkRateLimitMock).toHaveBeenNthCalledWith(2, 'u42', { bucket: 'progress-write-user', max: 30 });
    const [, params] = queryMock.mock.calls[0];
    expect(params).toEqual([
      'u42', 'f2l', 'F2L-1', 1234, 1, validResult.timestamp,
      'u42', 'f2l', 'F2L-2', 1234, 1, validResult.timestamp,
    ]);
    expect(params).not.toContain('victim');
  });

  it('rate limits invalid authentication attempts before token verification', async () => {
    requireAuthMock.mockRejectedValueOnce(new HTTPException(401, { message: 'Unauthorized' }));

    const response = await progressRoutes.request('/progress/f2l', {
      headers: { Authorization: 'Bearer invalid' },
    });

    expect(response.status).toBe(401);
    expect(checkRateLimitMock).toHaveBeenCalledOnce();
    expect(checkRateLimitMock).toHaveBeenCalledWith('127.0.0.1', { bucket: 'progress-read-ip', max: 600 });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('uses separate authenticated quotas for different users behind one IP', async () => {
    requireAuthMock
      .mockResolvedValueOnce({ wcaId: 'u42', name: 'Learner A', uid: 42 })
      .mockResolvedValueOnce({ wcaId: 'u43', name: 'Learner B', uid: 43 });

    const first = await progressRoutes.request('/progress/f2l');
    const second = await progressRoutes.request('/progress/f2l');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(checkRateLimitMock).toHaveBeenNthCalledWith(2, 'u42', { bucket: 'progress-read-user', max: 120 });
    expect(checkRateLimitMock).toHaveBeenNthCalledWith(4, 'u43', { bucket: 'progress-read-user', max: 120 });
  });

  it.each([
    ['empty batch', { results: [] }, 'results are required'],
    ['invalid case id', { results: [{ ...validResult, caseId: '\u0000' }] }, 'invalid result'],
    ['invalid duration', { results: [{ ...validResult, timeMs: 0 }] }, 'invalid result'],
    ['invalid correctness', { results: [{ ...validResult, correct: 1 }] }, 'invalid result'],
    ['future timestamp', { results: [{ ...validResult, timestamp: Date.now() + 10 * 60 * 1000 }] }, 'invalid result'],
  ])('rejects %s before writing', async (_name, body, error) => {
    const response = await progressRoutes.request('/progress/f2l', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('rejects oversized batches before writing', async () => {
    const response = await progressRoutes.request('/progress/f2l', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results: Array.from({ length: 201 }, () => validResult) }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'too many results' });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('rejects an oversized streamed JSON envelope before parsing it', async () => {
    const response = await progressRoutes.request('/progress/f2l', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results: [validResult], padding: 'x'.repeat(70 * 1024) }),
    });

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: 'Payload too large' });
    expect(requireAuthMock).toHaveBeenCalledOnce();
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('rejects a declared oversized body before authentication', async () => {
    const body = JSON.stringify({ results: [validResult], padding: 'x'.repeat(70 * 1024) });
    const response = await progressRoutes.request('/progress/f2l', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(new TextEncoder().encode(body).byteLength),
      },
      body,
    });

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: 'Payload too large' });
    expect(requireAuthMock).not.toHaveBeenCalled();
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('rejects an oversized body even when its declared length is false', async () => {
    const body = JSON.stringify({ results: [validResult], padding: 'x'.repeat(70 * 1024) });
    const response = await progressRoutes.request('/progress/f2l', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': '1',
      },
      body,
    });

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: 'Payload too large' });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('rejects malformed and non-object JSON before writing', async () => {
    const malformed = await progressRoutes.request('/progress/f2l', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    });
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ error: 'invalid json' });

    const nonObject = await progressRoutes.request('/progress/f2l', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'null',
    });
    expect(nonObject.status).toBe(400);
    expect(await nonObject.json()).toEqual({ error: 'invalid body' });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('rejects invalid route identifiers before querying', async () => {
    const response = await progressRoutes.request(`/progress/${encodeURIComponent('\u0000')}`);

    expect(response.status).toBe(400);
    expect(queryMock).not.toHaveBeenCalled();
  });
});
