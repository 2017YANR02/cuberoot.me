// 虎皮椒(xunhupay)聚合支付签名算法回归。md5 注入 node:crypto(vitest 跑在 node)。
// 拼接逻辑(排序 / 过滤空值 / 排除 hash / 值字符串化)对着字面量锁死;
// signXunhupay 对着 md5(base+secret) 锁死「base 末尾直接追 APPSECRET + 32 位小写」这一关键约定。
//
// 走 shared 的 'node' 子路径(→ dist),CI / 本地跑前需先 build @cuberoot/shared。
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { buildSignBase, signXunhupay, verifyXunhupaySign } from '@cuberoot/shared/payment';

const md5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex');

describe('buildSignBase', () => {
  it('sorts keys ascending and joins k=v with &', () => {
    expect(buildSignBase({ b: '2', a: '1', c: '3' })).toBe('a=1&b=2&c=3');
  });

  it('excludes the hash field itself', () => {
    expect(buildSignBase({ a: '1', hash: 'deadbeef', b: '2' })).toBe('a=1&b=2');
  });

  it('drops empty / null / undefined values (xunhupay 只签非空参数)', () => {
    expect(buildSignBase({ a: '1', empty: '', n: null, u: undefined, b: '2' })).toBe('a=1&b=2');
  });

  it('stringifies numbers and keeps 0 / false (非空)', () => {
    expect(buildSignBase({ total_fee: 100, ok: false, z: 0 })).toBe('ok=false&total_fee=100&z=0');
  });
});

describe('signXunhupay', () => {
  it('appends APPSECRET directly to the base then md5, lowercase', () => {
    const params = { appid: 'app123', trade_order_id: 'T1', total_fee: '1.00' };
    const base = buildSignBase(params); // appid=app123&total_fee=1.00&trade_order_id=T1
    expect(signXunhupay(params, 'secretXYZ', md5)).toBe(md5(base + 'secretXYZ'));
    expect(signXunhupay(params, 'secretXYZ', md5)).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('verifyXunhupaySign', () => {
  const params = { appid: 'app123', trade_order_id: 'T1', status: 'OD' };
  const secret = 's3cr3t';

  it('round-trips a freshly signed payload', () => {
    const hash = signXunhupay(params, secret, md5);
    expect(verifyXunhupaySign({ ...params, hash }, secret, md5)).toBe(true);
  });

  it('is case-insensitive on the supplied hash', () => {
    const hash = signXunhupay(params, secret, md5).toUpperCase();
    expect(verifyXunhupaySign({ ...params, hash }, secret, md5)).toBe(true);
  });

  it('rejects a tampered hash, wrong secret, and missing hash', () => {
    const hash = signXunhupay(params, secret, md5);
    expect(verifyXunhupaySign({ ...params, hash: hash.replace(/.$/, '0') }, secret, md5)).toBe(false);
    expect(verifyXunhupaySign({ ...params, hash }, 'wrong-secret', md5)).toBe(false);
    expect(verifyXunhupaySign({ ...params }, secret, md5)).toBe(false);
  });
});
