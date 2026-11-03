import { expect, it, vi } from 'vitest';
import { createSiteAssistantRoutes } from '../src/routes/site_assistant.js';
import { readAssistantAttachment, resolveAssistantImages, saveAssistantAttachment } from '../src/utils/site_assistant_attachments.js';
import { AssistantFailure } from '../src/utils/site_assistant_diagnostics.js';
import type { QueryRunner } from '../src/db/connection.js';

const id = 'bfcf5b1a-c001-4000-8000-000000000001';
const conversationId = 'bfcf5b1a-c002-4000-8000-000000000001';
const image = { mediaType: 'image/png' as const, data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0u8AAAAASUVORK5CYII=' };
const reference = { mediaType: image.mediaType, data: '', attachmentId: id };
function setup() {
  const answer = vi.fn().mockResolvedValue({ answer: 'ok', sources: [] });
  const readAttachment = vi.fn().mockImplementation(async (uid, key) => uid === 42 && key === id ? { ...image, attachmentId: id } : null);
  const saveAttachment = vi.fn().mockResolvedValue(reference);
  const authenticate = vi.fn().mockResolvedValue({ uid: 42, wcaId: '2017YANR02' });
  const reserve = vi.fn().mockResolvedValue({ allowed: true });
  const route = createSiteAssistantRoutes({ answer, authenticate, reserve, readAttachment, saveAttachment, now: Date.now,
    config: () => ({ key: 'test', baseUrl: 'https://model.example/v1', model: 'vision' }) });
  return { route, answer, authenticate, reserve, readAttachment, saveAttachment };
}
it('saves only authenticated attachments, with private responses and no public URL', async () => {
  const s = setup();
  const response = await s.route.request('/site-assistant/attachments', { method: 'POST', body: JSON.stringify({ conversationId, image }) });
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(await response.json()).toEqual(reference);
  expect(s.saveAttachment).toHaveBeenCalledWith(42, conversationId, image);
  s.authenticate.mockRejectedValue(new AssistantFailure('login_required'));
  expect((await s.route.request(`/site-assistant/attachments/${id}`)).status).toBe(401);
  expect(s.readAttachment).not.toHaveBeenCalled();
});
it('resolves references after authentication, preserves turn order, and rejects another owner before model/quota', async () => {
  const s = setup();
  const body = JSON.stringify({ question: '再给我 COLL', lang: 'zh', history: [{ role: 'user', content: '图', images: [reference] }] });
  const response = await s.route.request('/site-assistant', { method: 'POST', body });
  expect(response.status).toBe(200);
  expect(s.answer.mock.calls[0][5][0].images).toEqual([{ ...image, attachmentId: id }]);
  s.answer.mockClear(); s.reserve.mockClear();
  s.authenticate.mockResolvedValue({ uid: 43, wcaId: '2017YANR02' });
  const rejected = await s.route.request('/site-assistant', { method: 'POST', body });
  expect(await rejected.json()).toEqual({ error: 'invalid_image' });
  expect(s.answer).not.toHaveBeenCalled(); expect(s.reserve).not.toHaveBeenCalled();
  expect((await s.route.request(`/site-assistant/attachments/${id}`)).status).toBe(404);
});
it('scopes storage reads to the owner and normalizes PostgreSQL base64 line breaks', async () => {
  const run = vi.fn().mockResolvedValue([{ media_type: 'image/png', data: 'YW\nJj' }]);
  expect(await readAssistantAttachment(42, id, run)).toEqual({ mediaType: 'image/png', data: 'YWJj', attachmentId: id });
  expect(run.mock.calls[0][1]).toEqual([id, 42]);
  expect(run.mock.calls[0][0]).toContain('user_id=? AND deleted_at IS NULL');
  await expect(resolveAssistantImages(42, [reference], async () => null)).rejects.toThrow('invalid_image');
});
it('deduplicates retries within the owner transaction and enforces the byte budget', async () => {
  const run = vi.fn().mockResolvedValueOnce([{ id: 42 }]).mockResolvedValueOnce([{ id }]);
  expect(await saveAssistantAttachment(42, conversationId, image, async fn => fn(run as QueryRunner))).toEqual(reference);
  expect(run).toHaveBeenCalledTimes(2);
  const full = vi.fn().mockResolvedValueOnce([{ id: 42 }]).mockResolvedValueOnce([]).mockResolvedValueOnce([{ bytes: String(100 * 1024 * 1024) }]);
  await expect(saveAssistantAttachment(42, conversationId, image, async fn => fn(full as QueryRunner))).rejects.toThrow('request_too_large');
  expect(full).toHaveBeenCalledTimes(3);
});
