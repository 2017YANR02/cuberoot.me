// 内部账号纯逻辑回归。核心安全不变量:合成归属键 `u<uid>` 永远不会与真实 WCA id 撞
// (业务表 801 处仍以 wcaId 为主键,撞了就会串号 / 越权),外加邮箱 / 手机的规范化 + 校验。
import { describe, it, expect } from 'vitest';
import {
  ownerKey, isWcaIdFormat, normalizeEmail, isValidEmail, normalizePhone, isValidPhone, isValidPassword,
} from '@cuberoot/shared/account';

describe('ownerKey', () => {
  it('绑了 WCA → 原样返回真实 wca_id', () => {
    expect(ownerKey(42, '2017YANR02')).toBe('2017YANR02');
    // 即使有 uid,只要 wcaId 非空就优先用真实 id(现有数据零迁移)。
    expect(ownerKey(undefined, '2009ZEMD01')).toBe('2009ZEMD01');
  });
  it('没绑 WCA → 合成 u<uid>', () => {
    expect(ownerKey(42, null)).toBe('u42');
    expect(ownerKey(1, undefined)).toBe('u1');
    expect(ownerKey(999999, '')).toBe('u999999');
  });
  it('既无 uid 又无 wcaId → 空串(未登录)', () => {
    expect(ownerKey(undefined, undefined)).toBe('');
    expect(ownerKey(null, null)).toBe('');
  });
});

describe('合成键与真实 WCA id 天然不撞', () => {
  it('真实 WCA id 命中格式,合成键永不命中', () => {
    expect(isWcaIdFormat('2017YANR02')).toBe(true);
    for (const uid of [1, 7, 42, 1000, 88888888]) {
      const key = ownerKey(uid, null);
      expect(isWcaIdFormat(key)).toBe(false); // u<digits> 小写打头,永远不是 WCA id
    }
  });
  it('__api_key__ 合成身份也不撞 WCA 格式', () => {
    expect(isWcaIdFormat('__api_key__')).toBe(false);
  });
});

describe('email 规范化 + 校验', () => {
  it('trim + 小写', () => {
    expect(normalizeEmail('  Foo@Bar.COM ')).toBe('foo@bar.com');
  });
  it('接受合法、拒绝非法', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('no-at-sign')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail('a b@c.com')).toBe(false);
    expect(isValidEmail('x'.repeat(320) + '@a.com')).toBe(false); // 超 320
  });
});

describe('phone 规范化 + 校验(仅 +86)', () => {
  it('11 位 → +86,86 前缀 / 已 +86 归一', () => {
    expect(normalizePhone('13800138000')).toBe('+8613800138000');
    expect(normalizePhone('+86 138 0013 8000')).toBe('+8613800138000');
    expect(normalizePhone('8613800138000')).toBe('+8613800138000');
  });
  it('校验大陆手机号', () => {
    expect(isValidPhone('+8613800138000')).toBe(true);
    expect(isValidPhone(normalizePhone('13800138000'))).toBe(true);
    expect(isValidPhone('+8612345')).toBe(false);     // 太短
    expect(isValidPhone('+14155552671')).toBe(false); // 非 +86
    expect(isValidPhone('13800138000')).toBe(false);  // 未规范化
  });
});

describe('password 校验(长度 8..128)', () => {
  it('接受 8..128 位', () => {
    expect(isValidPassword('abcdefgh')).toBe(true);      // 恰好 8
    expect(isValidPassword('a'.repeat(128))).toBe(true); // 恰好 128
    expect(isValidPassword('Str0ng-Pass!')).toBe(true);
  });
  it('拒绝过短 / 过长 / 非字符串', () => {
    expect(isValidPassword('short')).toBe(false);        // 5 位
    expect(isValidPassword('a'.repeat(7))).toBe(false);  // 7 位
    expect(isValidPassword('a'.repeat(129))).toBe(false); // 超 128
    expect(isValidPassword(undefined)).toBe(false);
    expect(isValidPassword(12345678)).toBe(false);       // 非字符串,即便"长度"够
  });
});
