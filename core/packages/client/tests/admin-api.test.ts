import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/auth-store', () => ({ getSessionToken: () => null, getWcaToken: () => null }));
import { handleApi } from '@/lib/admin-api';

describe('shared API response errors', () => {
  it.each([
    [{ error: 'Registration closed' }, 'Registration closed'],
    [{ error: { code: 'conflict', message: 'This session is full' } }, 'This session is full'],
    [{ error: { code: 'conflict' } }, 'API error 409'],
    [null, 'API error 409'],
  ])('keeps a readable error for %j', async (body, message) => {
    await expect(handleApi(new Response(JSON.stringify(body), { status: 409 }))).rejects.toThrow(message);
  });
  it('passes successful response data through', async () => {
    await expect(handleApi(new Response('{"order":{"id":"123"}}'))).resolves.toEqual({ order: { id: '123' } });
  });
});
