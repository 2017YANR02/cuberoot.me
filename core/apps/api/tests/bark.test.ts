import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('Bark language-neutral links', () => {
  it.each([
    ['https://cuberoot.me/zh/wca/comp/WuhanCrimsonAutumn2026?event=333&round=2', 'https://cuberoot.me/wca/comp/WuhanCrimsonAutumn2026?event=333&round=2'],
    ['https://cuberoot.me/en/wca/comp/WuhanCrimsonAutumn2026?view=result#round', 'https://cuberoot.me/wca/comp/WuhanCrimsonAutumn2026?view=result#round'],
    ['https://cuberoot.me/wca/comp/WuhanCrimsonAutumn2026', 'https://cuberoot.me/wca/comp/WuhanCrimsonAutumn2026'],
    ['https://cuberoot.me/zh', 'https://cuberoot.me'],
    ['https://cuberoot.me/english', 'https://cuberoot.me/english'],
    ['https://example.com/zh/wca', 'https://example.com/zh/wca'],
    ['https://cuberoot.me/wca?next=/zh/comp', 'https://cuberoot.me/wca?next=/zh/comp'],
    ['', ''],
  ])('sends %s as %s', async (input, expected) => {
    vi.stubEnv('MONITOR_PUSH_ENABLED', '1');
    vi.stubEnv('BARK_DEVICE_KEY', 'test-device');
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ code: 200 }) });
    vi.stubGlobal('fetch', fetchMock);
    const { sendBark } = await import('../src/monitors/bark');
    expect(await sendBark({ title: '中文', body: 'English', url: input, group: 'test' })).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ url: expected, title: '中文', body: 'English' });
  });

  it('uses the same URL in dry runs without sending a push', async () => {
    vi.stubEnv('MONITOR_PUSH_ENABLED', '0');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { sendBark } = await import('../src/monitors/bark');
    expect(await sendBark({ title: '测试', body: 'Test', url: 'https://cuberoot.me/en/wca', group: 'test' })).toBe(true);
    expect(JSON.parse(log.mock.calls[0][1])).toMatchObject({ url: 'https://cuberoot.me/wca' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
