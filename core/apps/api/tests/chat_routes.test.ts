import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { ChatError } from '@cuberoot/shared/chat';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), limit: vi.fn(), messages: vi.fn(), conversations: vi.fn(), send: vi.fn(), read: vi.fn(), upload: vi.fn(), image: vi.fn(), save: vi.fn(), list: vi.fn() }));
vi.mock('../src/utils/app_user_auth.js', () => ({ requireAppUserId: mocks.auth }));
vi.mock('../src/utils/recon_helpers.js', () => ({ checkRateLimit: mocks.limit }));
vi.mock('../src/utils/chat_repository.js', () => ({ chatRepository: mocks }));
vi.mock('../src/utils/chat_stickers.js', () => ({ stickerRepository: mocks }));
import { chatRoutes } from '../src/routes/chat.js';
const app = new Hono().route('/v1', chatRoutes);
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue(42); mocks.messages.mockResolvedValue({ items: [] }); });
describe('friend chat HTTP boundary', () => {
  it('keeps uploads binary, authenticated and uncached without widening message limits', async () => {
    const data = new Uint8Array(40_000).fill(7);
    mocks.upload.mockResolvedValue({ id: 'sticker' });
    const r = await app.request('/v1/chat/stickers', { method: 'POST', headers: { 'Content-Type': 'image/gif' }, body: data });
    expect(r.status).toBe(201);
    expect(mocks.upload).toHaveBeenCalledWith(42, Buffer.from(data));
    expect(r.headers.get('Cache-Control')).toBe('no-store');
    mocks.image.mockResolvedValue({ data: Buffer.from([1, 2, 3]), mime: 'image/gif' });
    const image = await app.request('/v1/chat/stickers/id/image');
    expect(image.headers.get('Content-Type')).toBe('image/gif');
    expect(image.headers.get('Cache-Control')).toBe('no-store');
    expect(image.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(mocks.image).toHaveBeenCalledWith(42, 'id');
    expect((await app.request('/v1/chat/stickers/id', { method: 'PUT', body: '{"saved":"true"}' })).status).toBe(400);
  });
  it('requires authentication and never caches errors', async () => {
    mocks.auth.mockRejectedValue(new Error('Authentication required'));
    const r = await app.request('/v1/chat/conversations');
    expect(r.status).toBe(401); expect(r.headers.get('Cache-Control')).toBe('no-store');
    expect(mocks.conversations).not.toHaveBeenCalled();
  });
  it('gets the sender from the session, not submitted JSON', async () => {
    mocks.send.mockResolvedValue({ message: { body: 'hello' }, replay: false });
    const r = await app.request('/v1/chat/peers/7/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senderUserId: 900, body: 'hello', clientMessageId: 'key' }) });
    expect(r.status).toBe(201); expect(mocks.send.mock.calls[0].slice(0, 2)).toEqual([42, 7]);
    expect(r.headers.get('Cache-Control')).toBe('no-store');
  });
  it('returns the replay status without a second send', async () => {
    mocks.send.mockResolvedValue({ message: {}, replay: true });
    const r = await app.request('/v1/chat/peers/7/messages', { method: 'POST', body: '{}' });
    expect(r.status).toBe(200);
  });
  it('rejects malformed and oversized requests', async () => {
    expect((await app.request('/v1/chat/peers/7/messages', { method: 'POST', body: '{' })).status).toBe(400);
    expect((await app.request('/v1/chat/peers/7/messages', { method: 'POST', body: 'x'.repeat(32769) })).status).toBe(413);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('preserves cursors and caps through the repository contract', async () => {
    await app.request('/v1/chat/peers/7/messages?after=9007199254740993&limit=80');
    expect(mocks.messages).toHaveBeenCalledWith(42, 7, { before: undefined, after: '9007199254740993', limit: 80 });
  });
  it('conceals internals and reports actionable rate-limit timing', async () => {
    mocks.read.mockRejectedValue(new ChatError('RATE_LIMITED', 4500));
    const r = await app.request('/v1/chat/peers/7/read', { method: 'PUT', body: '{"throughSequence":"1"}' });
    expect(r.status).toBe(429); expect(r.headers.get('Retry-After')).toBe('5');
    mocks.messages.mockRejectedValue(new Error('sensitive SQL contents'));
    const error = await app.request('/v1/chat/peers/7/messages');
    expect(error.status).toBe(500); expect(await error.text()).not.toContain('sensitive');
  });
});
