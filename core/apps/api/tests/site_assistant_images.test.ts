import { afterEach, expect, it, vi } from 'vitest';
import { createSiteAssistantRoutes } from '../src/routes/site_assistant.js';
import { assistantConfig } from '../src/utils/site_assistant.js';
import { AssistantFailure } from '../src/utils/site_assistant_diagnostics.js';
import { SITE_ASSISTANT_BODY_BYTES } from '@cuberoot/shared/site-assistant';

const image = { mediaType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0u8AAAAASUVORK5CYII=' };
const setup = () => {
  const answer = vi.fn().mockResolvedValue({ answer: 'A screenshot.', sources: [] });
  const config = vi.fn().mockReturnValue({ key: 'test', baseUrl: 'https://model.example/v1', model: 'vision' });
  const reserve = vi.fn().mockResolvedValue({ allowed: true });
  const authenticate = vi.fn().mockResolvedValue({ uid: 42, wcaId: '2017YANR02' });
  const route = createSiteAssistantRoutes({ answer, config, reserve, authenticate, now: Date.now });
  const ask = (extra: object, stream = false) => route.request('/site-assistant', {
    method: 'POST', body: JSON.stringify({ question: '', lang: 'zh', images: [image], ...extra }),
    headers: { 'content-type': 'application/json', ...(stream ? { Accept: 'text/event-stream' } : {}) },
  });
  return { ask, answer, config, reserve, authenticate };
};
afterEach(() => vi.unstubAllEnvs());
it.each([false, true])('passes image-only questions through authenticated JSON/SSE: %s', async stream => {
  const { ask, answer, config, reserve } = setup();
  const response = await ask({}, stream);
  expect(response.status).toBe(200);
  expect(await response.text()).toContain('A screenshot.');
  expect(config).toHaveBeenCalledWith(true);
  expect(reserve).toHaveBeenCalledTimes(1);
  expect(answer.mock.calls[0][6]).toBe('2017YANR02');
  expect(answer.mock.calls[0][9]).toEqual([image]);
});
it('routes a text follow-up with earlier images to vision', async () => {
  const { ask, answer, config } = setup();
  const history = [{ role: 'user', content: '看看这个', images: [image] }, { role: 'assistant', content: '截图' }];
  expect((await ask({ question: '图上写什么？', images: [], history })).status).toBe(200);
  expect(config).toHaveBeenCalledWith(true);
  expect(answer.mock.calls[0][5]).toEqual(history);
});
it('rejects malformed, remote, forged, oversized and misplaced images before quota/model work', async () => {
  const oversized = Buffer.from(image.data, 'base64'); oversized.writeUInt32BE(100_000, 16);
  const invalid = [
    { images: [{ ...image, data: 'https://127.0.0.1/private' }] },
    { images: [{ ...image, data: image.data + '\n' }] },
    { images: [{ ...image, mediaType: 'image/jpeg' }] },
    { images: [{ ...image, data: oversized.toString('base64') }] },
    { images: [image, image, image, image] },
    { images: [image, image], history: [{ role: 'user', content: '', images: [image, image] }] },
    { history: [{ role: 'assistant', content: '', images: [image] }] },
    { images: [{ ...image, data: 'A'.repeat(SITE_ASSISTANT_BODY_BYTES) }] },
  ];
  for (const input of invalid) {
    const { ask, answer, reserve } = setup();
    const response = await ask(input);
    expect([400, 413]).toContain(response.status);
    expect(await response.json()).toEqual({ error: 'invalid_image' });
    expect(reserve).not.toHaveBeenCalled(); expect(answer).not.toHaveBeenCalled();
  }
});
it('does not spend quota or forward images for an unauthenticated visitor', async () => {
  const { ask, authenticate, answer, reserve } = setup();
  authenticate.mockRejectedValue(new AssistantFailure('login_required'));
  expect((await ask({})).status).toBe(401);
  expect(answer).not.toHaveBeenCalled(); expect(reserve).not.toHaveBeenCalled();
});
it('separates vision configuration from text credentials and fails closed when absent', async () => {
  vi.stubEnv('SITE_ASSISTANT_PROVIDER', 'deepseek'); vi.stubEnv('DEEPSEEK_API_KEY', 'text-key');
  vi.stubEnv('SITE_ASSISTANT_API_KEY', 'image-key'); vi.stubEnv('SITE_ASSISTANT_BASE_URL', 'https://bailian.example/v1/');
  vi.stubEnv('SITE_ASSISTANT_VISION_API_KEY', ''); vi.stubEnv('SITE_ASSISTANT_VISION_BASE_URL', ''); vi.stubEnv('SITE_ASSISTANT_VISION_MODEL', '');
  expect(assistantConfig(false)?.key).toBe('text-key');
  expect(assistantConfig(true)).toEqual({ key: 'image-key', baseUrl: 'https://bailian.example/v1', model: 'qwen3.8-flash' });
  vi.stubEnv('SITE_ASSISTANT_API_KEY', ''); expect(assistantConfig(true)).toBeNull();
  const { ask, config, reserve } = setup(); config.mockReturnValue(null);
  expect(await (await ask({})).json()).toEqual({ error: 'vision_unavailable' });
  expect(reserve).not.toHaveBeenCalled();
});
