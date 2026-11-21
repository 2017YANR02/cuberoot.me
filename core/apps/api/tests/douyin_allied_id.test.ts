import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('Douyin cross-application identity', () => {
  it.each([
    ['website', 'DOUYIN_LOGIN_CLIENT_KEY', 'DOUYIN_LOGIN_CLIENT_SECRET', '/api/douyin/v1/auth/get_related_id/'],
    ['miniprogram', 'DOUYIN_MINI_APP_ID', 'DOUYIN_MINI_APP_SECRET', '/api/apps/v1/auth/get_related_id/'],
  ] as const)('uses the %s application credentials and endpoint', async (application, keyName, secretName, path) => {
    vi.stubEnv(keyName, `${application}-key`);
    vi.stubEnv(secretName, `${application}-secret`);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ data: { error_code: 0, access_token: 'client-token', expires_in: 7200 } }))
      .mockResolvedValueOnce(Response.json({ err_no: 0, data: { allied_id: 'same-person' } }));
    vi.stubGlobal('fetch', fetchMock);

    const { getDouyinAlliedId } = await import('../src/utils/douyin_allied_id.js');
    const { getDouyinMiniProgramCredentials } = await import('../src/utils/douyin_miniprogram.js');
    const source = application === 'website' ? application : getDouyinMiniProgramCredentials()!;
    await expect(getDouyinAlliedId(source, 'app-open-id')).resolves.toBe('allied:same-person');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe('https://open.douyin.com/oauth/client_token/');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ client_key: `${application}-key`, client_secret: `${application}-secret` });
    expect(fetchMock.mock.calls[1][0]).toBe(`https://open.douyin.com${path}`);
    expect(fetchMock.mock.calls[1][1].headers).toMatchObject({ 'access-token': 'client-token' });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ open_id: 'app-open-id' });
  });

  it('keeps company, legacy and unknown AppIDs separate', async () => {
    vi.stubEnv('DOUYIN_MINI_APP_ID', 'ttlegacy');
    vi.stubEnv('DOUYIN_MINI_APP_SECRET', 'legacy-secret');
    vi.stubEnv('DOUYIN_COMPANY_MINI_APP_ID', 'ttcompany');
    vi.stubEnv('DOUYIN_COMPANY_MINI_APP_SECRET', 'company-secret');
    const { getDouyinMiniProgramCredentials } = await import('../src/utils/douyin_miniprogram.js');
    expect(getDouyinMiniProgramCredentials()).toEqual({ appId: 'ttlegacy', secret: 'legacy-secret', legacy: true });
    expect(getDouyinMiniProgramCredentials('ttlegacy')).toEqual(getDouyinMiniProgramCredentials());
    expect(getDouyinMiniProgramCredentials('ttcompany')).toEqual({ appId: 'ttcompany', secret: 'company-secret', legacy: false });
    expect(getDouyinMiniProgramCredentials('ttunknown')).toBeUndefined();
  });

  it('rejects an invalid related ID rather than creating an unsafe alias', async () => {
    vi.stubEnv('DOUYIN_LOGIN_CLIENT_KEY', 'site-key');
    vi.stubEnv('DOUYIN_LOGIN_CLIENT_SECRET', 'site-secret');
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(Response.json({ data: { error_code: 0, access_token: 'client-token', expires_in: 7200 } }))
      .mockResolvedValueOnce(Response.json({ err_no: 0, data: { allied_id: { unexpected: true } } })));
    const { getDouyinAlliedId } = await import('../src/utils/douyin_allied_id.js');
    await expect(getDouyinAlliedId('website', 'open-id')).rejects.toThrow('invalid response');
  });
});
