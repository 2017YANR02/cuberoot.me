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
  vi.stubEnv('WECHAT_MCHID', '1900000001');
  vi.stubEnv('WECHAT_API_V3_KEY', apiV3Key);
  vi.stubEnv('WECHAT_CERT_SERIAL', 'MERCHANT_CERT_SERIAL');
  vi.stubEnv('WECHAT_PRIVATE_KEY', merchantPrivateKey);
  vi.stubEnv('WECHAT_PLATFORM_PUBKEY_ID', publicKeyId);
  vi.stubEnv('WECHAT_PLATFORM_PUBKEY', platformPublicKey);
  wechat = await import('../src/payment/wechat.js');
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function encryptedCallbackBody(): string {
  const nonce = 'qwertyuiop12';
  const associatedData = 'transaction';
  const plaintext = JSON.stringify({
    out_trade_no: 'M_test_1',
    trade_state: 'SUCCESS',
    transaction_id: '4200001',
  });
  const cipher = createCipheriv(
    'aes-256-gcm',
    Buffer.from(apiV3Key, 'utf8'),
    Buffer.from(nonce, 'utf8'),
  );
  cipher.setAAD(Buffer.from(associatedData, 'utf8'));
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const ciphertext = Buffer.concat([encrypted, cipher.getAuthTag()]).toString('base64');
  return JSON.stringify({ resource: { ciphertext, nonce, associated_data: associatedData } });
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
    const body=JSON.stringify({refund_id:'refund-test',status:'PROCESSING'});
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
    await expect(wechat.queryWechatRefund('stable-refund')).rejects.toThrow('signature verification failed');
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
    })).rejects.toThrow('signature verification failed');
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
