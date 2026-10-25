import { beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadRoutes } from '../src/routes/downloads.js';
import { diagnosticLog } from '../src/observability/request.js';

vi.mock('../src/observability/request.js', () => ({ diagnosticLog: vi.fn() }));

let requestNumber = 0;
function post(body: string, ip = `download-test-${++requestNumber}`) {
  return downloadRoutes.request('/downloads/events', {
    method: 'POST', headers: { 'Content-Type': 'text/plain', 'X-Real-IP': ip }, body,
  });
}

describe('download click statistics', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(['play', 'apk'])('records %s clicks without identity or request content', async (channel) => {
    const response = await post(JSON.stringify({ channel, language: 'zh' }));
    expect(response.status).toBe(204);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(diagnosticLog).toHaveBeenCalledExactlyOnceWith('download_click', {
      platform: 'android', channel, language: 'zh',
    });
  });

  it.each(['windows-installer', 'windows-portable'])('records %s with the correct platform', async channel => {
    expect((await post(JSON.stringify({ channel, language: 'en' }))).status).toBe(204);
    expect(diagnosticLog).toHaveBeenCalledWith('download_click', { platform: 'windows', channel, language: 'en' });
  });

  it.each([
    'not-json', 'null', '[]', '{}',
    JSON.stringify({ channel: 'windows', language: 'en' }),
    JSON.stringify({ channel: 'play', language: 'fr' }),
    JSON.stringify({ channel: 'play', language: 'en', userId: 'private' }),
  ])('rejects malformed or undeclared dimensions: %s', async (body) => {
    expect((await post(body)).status).toBe(400);
    expect(diagnosticLog).not.toHaveBeenCalled();
  });

  it('bounds request size before recording an event', async () => {
    expect((await post('x'.repeat(257))).status).toBe(413);
    expect(diagnosticLog).not.toHaveBeenCalled();
  });

  it('limits repeated requests without recording excess clicks', async () => {
    const body = JSON.stringify({ channel: 'play', language: 'en' });
    for (let index = 0; index < 30; index++) expect((await post(body, 'download-rate-test')).status).toBe(204);
    const response = await post(body, 'download-rate-test');
    expect(response.status).toBe(429);
    expect(Number(response.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(diagnosticLog).toHaveBeenCalledTimes(30);
  });
});
