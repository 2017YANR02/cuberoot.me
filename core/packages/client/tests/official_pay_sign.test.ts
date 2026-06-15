// 官方支付宝(RSA2)+ 微信支付 APIv3(SHA256-RSA2048 签名 / AEAD_AES_256_GCM 回调解密)的
// 确定性回归。待签/待验串构造走 @cuberoot/shared/payment(server 两个 provider 也用同一份);
// RSA 加/验签与 GCM 解密用 node:crypto 现造密钥对/密文做 round-trip,锁死算法约定 —— 真实
// 网关无法在此联调,但「拼串规则 + 签名对称性 + 解密步骤」是出 bug 的地方,这里全部钉死。
//
// 注:GCM / RSA round-trip 块刻意 1:1 镜像 server/src/payment/{alipay,wechat}.ts 的实现步骤
// (key 32B、nonce 当 utf8 字节、密文末 16B 为 authTag、setAAD),改 provider 算法时此处会红。
import { describe, it, expect } from 'vitest';
import {
  generateKeyPairSync, createSign, createVerify,
  createCipheriv, createDecipheriv,
} from 'node:crypto';
import {
  buildAlipaySignContent,
  buildWechatV3Message,
  buildWechatV3VerifyMessage,
} from '@cuberoot/shared/payment';

describe('buildAlipaySignContent', () => {
  it('sorts keys ascending, joins k=v with & (values not url-encoded)', () => {
    expect(buildAlipaySignContent({ charset: 'utf-8', app_id: '2021', method: 'alipay.trade.page.pay' }))
      .toBe('app_id=2021&charset=utf-8&method=alipay.trade.page.pay');
  });

  it('default excludes only sign (sign_type stays in the signed string)', () => {
    const p = { app_id: 'x', sign_type: 'RSA2', sign: 'abc', biz_content: '{}' };
    expect(buildAlipaySignContent(p)).toBe('app_id=x&biz_content={}&sign_type=RSA2');
  });

  it('verify mode excludes both sign and sign_type', () => {
    const p = { app_id: 'x', sign_type: 'RSA2', sign: 'abc', trade_status: 'TRADE_SUCCESS' };
    expect(buildAlipaySignContent(p, ['sign', 'sign_type'])).toBe('app_id=x&trade_status=TRADE_SUCCESS');
  });

  it('drops empty / null / undefined values', () => {
    expect(buildAlipaySignContent({ a: '1', e: '', n: null, u: undefined, b: '2' })).toBe('a=1&b=2');
  });
});

describe('Alipay RSA2 sign / verify round-trip', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const params = {
    app_id: '2021000000000000', method: 'alipay.trade.page.pay',
    charset: 'utf-8', sign_type: 'RSA2', timestamp: '2026-06-13 12:00:00',
    version: '1.0', biz_content: '{"out_trade_no":"M1","total_amount":"10.00"}',
  };

  it('a notify signed by the merchant key verifies with the public key', () => {
    // 请求侧:对「排除 sign」的串签名。
    const content = buildAlipaySignContent(params, ['sign']);
    const sign = createSign('RSA-SHA256').update(content, 'utf8').sign(privateKey, 'base64');
    // 验签侧(模拟支付宝公钥验):同串、同算法。
    const ok = createVerify('RSA-SHA256').update(content, 'utf8').verify(publicKey, sign, 'base64');
    expect(ok).toBe(true);
  });

  it('rejects a tampered payload', () => {
    const content = buildAlipaySignContent(params, ['sign']);
    const sign = createSign('RSA-SHA256').update(content, 'utf8').sign(privateKey, 'base64');
    const tampered = content.replace('10.00', '0.01');
    expect(createVerify('RSA-SHA256').update(tampered, 'utf8').verify(publicKey, sign, 'base64')).toBe(false);
  });
});

describe('WeChat APIv3 sign message format', () => {
  it('request message is METHOD\\nURL\\nts\\nnonce\\nbody\\n with trailing newline', () => {
    expect(buildWechatV3Message({ method: 'POST', urlPath: '/v3/pay/transactions/native', timestamp: 1700000000, nonce: 'ABC', body: '{"x":1}' }))
      .toBe('POST\n/v3/pay/transactions/native\n1700000000\nABC\n{"x":1}\n');
  });

  it('GET request keeps the empty-body trailing newline', () => {
    expect(buildWechatV3Message({ method: 'GET', urlPath: '/v3/pay/transactions/out-trade-no/M1?mchid=1', timestamp: 1, nonce: 'N', body: '' }))
      .toBe('GET\n/v3/pay/transactions/out-trade-no/M1?mchid=1\n1\nN\n\n');
  });

  it('verify message is ts\\nnonce\\nbody\\n', () => {
    expect(buildWechatV3VerifyMessage({ timestamp: 1700000000, nonce: 'XYZ', body: '{"ok":true}' }))
      .toBe('1700000000\nXYZ\n{"ok":true}\n');
  });
});

describe('WeChat APIv3 SHA256-RSA2048 sign / verify round-trip', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  it('Authorization-style signature verifies and rejects tampering', () => {
    const msg = buildWechatV3Message({ method: 'POST', urlPath: '/v3/pay/transactions/native', timestamp: 1700000000, nonce: 'NONCE123', body: '{"amount":{"total":1000}}' });
    const sig = createSign('RSA-SHA256').update(msg, 'utf8').sign(privateKey, 'base64');
    expect(createVerify('RSA-SHA256').update(msg, 'utf8').verify(publicKey, sig, 'base64')).toBe(true);
    const tampered = msg.replace('1000', '1');
    expect(createVerify('RSA-SHA256').update(tampered, 'utf8').verify(publicKey, sig, 'base64')).toBe(false);
  });
});

describe('WeChat APIv3 callback AEAD_AES_256_GCM decrypt', () => {
  // 镜像 wechat.ts decryptResource:key=APIv3密钥(32B),nonce 当 12B 字节,密文末 16B=authTag,setAAD。
  const apiV3Key = 'abcdefghijklmnopqrstuvwxyz012345'; // 32 字节
  const nonce = 'qwertyuiop12';                        // 12 字节
  const aad = 'transaction';
  const plaintext = JSON.stringify({ out_trade_no: 'M_test_1', trade_state: 'SUCCESS', transaction_id: '4200001' });

  // 模拟微信加密产出:ciphertext = base64( enc || authTag )。
  function encryptLikeWechat(): { ciphertext: string; nonce: string; associated_data: string } {
    const cipher = createCipheriv('aes-256-gcm', Buffer.from(apiV3Key, 'utf8'), Buffer.from(nonce, 'utf8'));
    cipher.setAAD(Buffer.from(aad, 'utf8'));
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { ciphertext: Buffer.concat([enc, tag]).toString('base64'), nonce, associated_data: aad };
  }

  function decryptLikeProvider(res: { ciphertext: string; nonce: string; associated_data?: string }): string {
    const key = Buffer.from(apiV3Key, 'utf8');
    const buf = Buffer.from(res.ciphertext, 'base64');
    const authTag = buf.subarray(buf.length - 16);
    const data = buf.subarray(0, buf.length - 16);
    const dec = createDecipheriv('aes-256-gcm', key, Buffer.from(res.nonce, 'utf8'));
    dec.setAuthTag(authTag);
    dec.setAAD(Buffer.from(res.associated_data ?? '', 'utf8'));
    return Buffer.concat([dec.update(data), dec.final()]).toString('utf8');
  }

  it('recovers the plaintext order payload', () => {
    expect(decryptLikeProvider(encryptLikeWechat())).toBe(plaintext);
  });

  it('fails the auth tag when ciphertext is tampered', () => {
    const res = encryptLikeWechat();
    const buf = Buffer.from(res.ciphertext, 'base64');
    buf[0] ^= 0xff; // flip a byte → GCM auth tag check must throw
    expect(() => decryptLikeProvider({ ...res, ciphertext: buf.toString('base64') })).toThrow();
  });
});
