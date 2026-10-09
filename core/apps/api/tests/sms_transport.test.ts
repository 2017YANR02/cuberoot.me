import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function loadSms(configured: boolean) {
  vi.stubEnv('ALIYUN_SMS_ACCESS_KEY_ID', configured ? 'test-access-id' : '');
  vi.stubEnv('ALIYUN_SMS_ACCESS_KEY_SECRET', configured ? 'test-access-secret' : '');
  vi.stubEnv('ALIYUN_SMS_SIGN_NAME', configured ? 'TestSign' : '');
  vi.stubEnv('ALIYUN_SMS_TEMPLATE_CODE', configured ? 'SMS_123456' : '');
  vi.resetModules();
  return import('../src/utils/sms.js');
}

describe('account SMS transport adapter', () => {
  it('does not attempt sending without complete configuration', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const { smsConfigured, sendSmsCode } = await loadSms(false);
    expect(smsConfigured()).toBe(false);
    await expect(sendSmsCode('+8613800138000', '000123')).rejects.toThrow('sms not configured');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('preserves the Aliyun request and accepts only a successful response', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ Code: 'OK', RequestId: 'test-request' })));
    vi.stubGlobal('fetch', fetcher);
    const { smsConfigured, sendSmsCode } = await loadSms(true);
    expect(smsConfigured()).toBe(true);
    await sendSmsCode('+8613800138000', '000123');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, options] = fetcher.mock.calls[0];
    const request = new URL(url);
    expect(request.origin).toBe('https://dysmsapi.aliyuncs.com');
    expect(request.searchParams.get('PhoneNumbers')).toBe('13800138000');
    expect(request.searchParams.get('TemplateCode')).toBe('SMS_123456');
    expect(request.searchParams.get('TemplateParam')).toBe('{"code":"000123"}');
    expect(request.searchParams.get('Signature')).toBeTruthy();
    expect(options.method).toBe('GET');
  });

  it('does not expose provider text or the code on rejection', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      Code: 'isv.BUSINESS_LIMIT_CONTROL', Message: 'private response 000123',
    })));
    vi.stubGlobal('fetch', fetcher);
    const { sendSmsCode } = await loadSms(true);
    await expect(sendSmsCode('+8613800138000', '000123')).rejects.toMatchObject({
      code: 'PROVIDER_REJECTED', providerCode: 'isv.BUSINESS_LIMIT_CONTROL',
    });
    await expect(sendSmsCode('+8613800138000', '000123')).rejects.not.toThrow('private response');
  });
});
