import {
  createCipheriv,
  createSign,
  createVerify,
  generateKeyPairSync,
} from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildWechatV3VerifyMessage } from '@cuberoot/shared/payment';

const apiV3Key = 'abcdefghijklmnopqrstuvwxyz012345';
const publicKeyId = 'PUB_KEY_ID_0000000001';
const { privateKey: merchantPrivateKey, publicKey: merchantPublicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const { privateKey: platformPrivateKey, publicKey: platformPublicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

type WechatModule = typeof import('../src/payment/wechat.js');
let wechat: WechatModule;

beforeAll(async () => {
  vi.stubEnv('WECHAT_APPID', 'wx-test');
  vi.stubEnv('WECHAT_MINI_APP_ID', 'wx-mini-test');
  vi.stubEnv('WECHAT_MINI_PAY_ENABLED', 'true');
  vi.stubEnv('WECHAT_H5_ENABLED', 'false');
  vi.stubEnv('WECHAT_MCHID', '1900000001');
  vi.stubEnv('WECHAT_API_V3_KEY', apiV3Key);
  vi.stubEnv('WECHAT_CERT_SERIAL', 'AABBCCDDEEFF00112233');
  vi.stubEnv('WECHAT_PRIVATE_KEY', merchantPrivateKey);
  vi.stubEnv('WECHAT_PLATFORM_PUBKEY_ID', publicKeyId);
  vi.stubEnv('WECHAT_PLATFORM_PUBKEY', platformPublicKey);
  wechat = await import('../src/payment/wechat.js');
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function encryptedCallbackBody(overrides: Record<string, unknown> = {}): string {
  const nonce = 'qwertyuiop12';
  const associatedData = 'transaction';
  const plaintext = JSON.stringify({
    out_trade_no: 'M_test_1',
    trade_state: 'SUCCESS',
    transaction_id: '4200001',
    appid: 'wx-test',
    mchid: '1900000001',
    amount: { total: 1234, currency: 'CNY', payer_total: 1234, payer_currency: 'CNY' },
    ...overrides,
  });
  const cipher = createCipheriv(
    'aes-256-gcm',
    Buffer.from(apiV3Key, 'utf8'),
    Buffer.from(nonce, 'utf8'),
  );
  cipher.setAAD(Buffer.from(associatedData, 'utf8'));
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const ciphertext = Buffer.concat([encrypted, cipher.getAuthTag()]).toString('base64');
  return JSON.stringify({ event_type: 'TRANSACTION.SUCCESS', resource_type: 'encrypt-resource', resource: { original_type: 'transaction', algorithm: 'AEAD_AES_256_GCM', ciphertext, nonce, associated_data: associatedData } });
}

function signedHeaders(body: string, serial = publicKeyId) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = 'SIGNED_NONCE';
  const message = buildWechatV3VerifyMessage({ timestamp, nonce, body });
  const signature = createSign('RSA-SHA256')
    .update(message, 'utf8')
    .sign(platformPrivateKey, 'base64');
  return { serial, timestamp, nonce, signature };
}

describe('official WeChat payment verification', () => {
  it('sends a stable refund number and verifies the signed provider response', async () => {
    const body=JSON.stringify({refund_id:'refund-test',status:'PROCESSING',transaction_id:'original-payment',out_refund_no:'stable-refund',amount:{refund:1001,total:1001,currency:'CNY'}});
    const signed=signedHeaders(body);
    const fetchMock=vi.fn().mockResolvedValue(new Response(body,{status:200,headers:{
      'Wechatpay-Serial':signed.serial,'Wechatpay-Timestamp':signed.timestamp,
      'Wechatpay-Nonce':signed.nonce,'Wechatpay-Signature':signed.signature,
    }}));
    vi.stubGlobal('fetch',fetchMock);
    expect(await wechat.createWechatRefund({transactionId:'original-payment',refundNo:'stable-refund',amountMinor:1001,totalMinor:1001,reason:'schedule'})).toMatchObject({status:'PROCESSING'});
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.mch.weixin.qq.com/v3/refund/domestic/refunds');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({transaction_id:'original-payment',out_refund_no:'stable-refund',amount:{refund:1001,total:1001,currency:'CNY'}});
  });
  it('refuses an unsigned refund success response',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{"refund_id":"forged","status":"SUCCESS"}',{status:200})));
    await expect(wechat.queryWechatRefund('stable-refund')).rejects.toThrow(/signature/i);
  });
  it('uses the Mini Program AppID and bound payer, then signs native checkout parameters', async () => {
    const body = JSON.stringify({ prepay_id: 'prepay-test' });
    const signed = signedHeaders(body);
    const fetchMock = vi.fn().mockResolvedValue(new Response(body, { status: 200, headers: {
      'Wechatpay-Serial': signed.serial, 'Wechatpay-Timestamp': signed.timestamp,
      'Wechatpay-Nonce': signed.nonce, 'Wechatpay-Signature': signed.signature,
    } }));
    vi.stubGlobal('fetch', fetchMock);
    const params = await wechat.createWechatMiniProgram({
      outTradeNo: 'attempt-123', amountCents: 1234, description: 'Competition',
      notifyUrl: 'https://example.com/notify', openid: 'payer-openid',
    });
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi');
    expect(JSON.parse(request.body)).toMatchObject({ appid: 'wx-mini-test', payer: { openid: 'payer-openid' }, amount: { total: 1234, currency: 'CNY' } });
    expect(params.package).toBe('prepay_id=prepay-test');
    expect(params.signType).toBe('RSA');
    expect(createVerify('RSA-SHA256').update(`wx-mini-test\n${params.timeStamp}\n${params.nonceStr}\n${params.package}\n`).verify(merchantPublicKey, params.paySign, 'base64')).toBe(true);
    expect(wechat.isWechatPaymentAppId('wx-mini-test')).toBe(true);
    expect(wechat.isWechatPaymentAppId('another-app')).toBe(false);
  });

  it('never returns checkout parameters from an unsigned provider response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"prepay_id":"forged"}', { status: 200 })));
    await expect(wechat.createWechatMiniProgram({ outTradeNo: 'attempt-123', amountCents: 1234,
      description: 'Competition', notifyUrl: 'https://example.com/notify', openid: 'payer-openid',
    })).rejects.toThrow(/signature/i);
  });
  it('requires a complete merchant and WeChat Pay public-key configuration', () => {
    expect(wechat.wechatConfigured()).toBe(true);
    expect(wechat.wechatH5Configured()).toBe(false);
  });

  it('accepts a correctly signed and encrypted callback', () => {
    const body = encryptedCallbackBody();
    expect(wechat.handleWechatCallback(body, signedHeaders(body))).toMatchObject({
      ok: true,
      paid: true,
      outTradeNo: 'M_test_1',
      txn: '4200001',
    });
  });

  it('rejects a signature made for a different body', () => {
    const body = encryptedCallbackBody();
    const headers = signedHeaders(body);
    expect(wechat.handleWechatCallback(`${body} `, headers)).toEqual({ ok: false });
  });

  it('rejects a callback carrying a different Wechatpay-Serial', () => {
    const body = encryptedCallbackBody();
    expect(wechat.handleWechatCallback(body, signedHeaders(body, 'PUB_KEY_ID_OTHER')))
      .toEqual({ ok: false });
  });

  it('rejects a stale signature timestamp', () => {
    const body = encryptedCallbackBody();
    const headers = signedHeaders(body);
    const timestamp = String(Math.floor(Date.now() / 1000) - 301);
    const message = buildWechatV3VerifyMessage({ timestamp, nonce: headers.nonce, body });
    const signature = createSign('RSA-SHA256')
      .update(message, 'utf8')
      .sign(platformPrivateKey, 'base64');
    expect(wechat.handleWechatCallback(body, { ...headers, timestamp, signature }))
      .toEqual({ ok: false });
  });
});


describe('shared WeChat adapter boundaries', () => {
  it('does not issue an H5 request without the product switch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(wechat.createWechatH5({ outTradeNo: 'attempt-h5', amountCents: 1234,
      description: 'Checkout', notifyUrl: 'https://example.com/notify', payerClientIp: '203.0.113.1',
    })).rejects.toThrow('H5 Pay is not configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the H5 provider URL only after explicitly enabling the product', async () => {
    const previous = process.env.WECHAT_H5_ENABLED;
    vi.stubEnv('WECHAT_H5_ENABLED', 'true');
    try {
      const h5Url = 'https://wx.tenpay.com/cgi-bin/mmpayweb-bin/checkmweb?prepay_id=test';
      const body = JSON.stringify({ h5_url: h5Url });
      const signed = signedHeaders(body);
      const fetchMock = vi.fn().mockResolvedValue(new Response(body, { status: 200, headers: {
        'Wechatpay-Serial': signed.serial, 'Wechatpay-Timestamp': signed.timestamp,
        'Wechatpay-Nonce': signed.nonce, 'Wechatpay-Signature': signed.signature,
      } }));
      vi.stubGlobal('fetch', fetchMock);
      expect(await wechat.createWechatH5({ outTradeNo: 'attempt-h5', amountCents: 1234,
        description: 'Checkout', notifyUrl: 'https://example.com/notify', payerClientIp: '203.0.113.1',
      })).toBe(h5Url);
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ appid: 'wx-test',
        scene_info: { payer_client_ip: '203.0.113.1', h5_info: { type: 'Wap' } } });
    } finally { vi.stubEnv('WECHAT_H5_ENABLED', previous); }
  });

  it('blocks Mini Program payment and AppID acceptance when its product is disabled', async () => {
    const previous = process.env.WECHAT_MINI_PAY_ENABLED;
    vi.stubEnv('WECHAT_MINI_PAY_ENABLED', 'false');
    try {
      expect(wechat.wechatMiniProgramPayConfigured()).toBe(false);
      expect(wechat.isWechatPaymentAppId('wx-mini-test')).toBe(false);
      await expect(wechat.createWechatMiniProgram({ outTradeNo: 'attempt-mini', amountCents: 1234,
        description: 'Checkout', notifyUrl: 'https://example.com/notify', openid: 'payer-openid',
      })).rejects.toThrow('not configured');
    } finally { vi.stubEnv('WECHAT_MINI_PAY_ENABLED', previous); }
  });

  it.each([
    { appid: 'wx-other' },
    { mchid: '1900000002' },
    { amount: { total: 0, currency: 'CNY' } },
    { amount: { total: 1234, currency: 'USD' } },
    { amount: undefined },
  ])('rejects a signed notification with invalid merchant or amount %#', (overrides) => {
    const body = encryptedCallbackBody(overrides);
    expect(wechat.handleWechatCallback(body, signedHeaders(body))).toEqual({ ok: false });
  });

  it('surfaces a forged query response as an error, not an unpaid order', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ trade_state: 'SUCCESS' }), { status: 200 })));
    await expect(wechat.queryWechatOrder('M_test_1')).rejects.toThrow(/signature/i);
  });

  it('returns null only for a signed missing-order response', async () => {
    const body = JSON.stringify({ code: 'ORDER_NOT_EXIST', message: 'not found' });
    const signed = signedHeaders(body);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 404, headers: {
      'Wechatpay-Serial': signed.serial, 'Wechatpay-Timestamp': signed.timestamp,
      'Wechatpay-Nonce': signed.nonce, 'Wechatpay-Signature': signed.signature,
    } })));
    expect(await wechat.queryWechatOrder('M_test_1')).toBeNull();
  });

  it('reads later transport mocks through an already used adapter', async () => {
    const body = JSON.stringify({ out_trade_no: 'M_test_1', trade_state: 'SUCCESS', transaction_id: '4200001',
      appid: 'wx-test', mchid: '1900000001', amount: { total: 1234, currency: 'CNY' } });
    const signed = signedHeaders(body);
    const fetchMock = vi.fn().mockResolvedValue(new Response(body, { status: 200, headers: {
      'Wechatpay-Serial': signed.serial, 'Wechatpay-Timestamp': signed.timestamp,
      'Wechatpay-Nonce': signed.nonce, 'Wechatpay-Signature': signed.signature,
    } }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await wechat.queryWechatOrder('M_test_1')).toMatchObject({ paid: true, txn: '4200001' });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('keeps an unconfigured provider disabled without throwing on import', async () => {
    const previous = process.env.WECHAT_MCHID;
    vi.stubEnv('WECHAT_MCHID', '');
    try {
      expect(wechat.wechatConfigured()).toBe(false);
      expect(wechat.wechatMiniProgramPayConfigured()).toBe(false);
      expect(wechat.verifyWechatSignature({}, '')).toBe(false);
      await expect(wechat.createWechatNative({ outTradeNo: 'disabled', amountCents: 1,
        description: 'Checkout', notifyUrl: 'https://example.com/notify',
      })).rejects.toThrow('not configured');
    } finally { vi.stubEnv('WECHAT_MCHID', previous); }
  });
});
