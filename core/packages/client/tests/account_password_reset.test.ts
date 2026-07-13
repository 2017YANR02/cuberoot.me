// 守卫:「忘记密码」授权窗口(server/src/utils/session.ts 的 amr=email_code + 15 分钟)。
//
// 这条规矩撑着两个相反方向的安全不变量,任何一边破了都是真事故:
//   ① 能收邮件的人必须能重设密码 —— 否则忘了密码的账号永久锁死(本次修复前就是这样:
//      /auth/password/set 无条件要 currentPassword,拿验证码登录进来也改不了)。
//   ② 除此之外的任何会话都不得免旧密码改密码 —— 偷到 localStorage 里 token 的人若能直接
//      换密码,就等于接管账号。故密码登录 / WCA / Google / 三方签出的会话一律没有 grant,
//      邮箱验证码签出的会话也只在 15 分钟内有效。
//
// 注:测试文件在 client 包下,不能直接 import 'jsonwebtoken'(它是 server 的依赖,解析不到);
//     要把会话「放旧」就用 fake timer 拨钟 —— jwt 的 iat / 本模块的判定都读 Date.now()。
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  signSession, hasFreshEmailGrant, EMAIL_GRANT_TTL_S,
} from '../../server/src/utils/session';

const T0 = new Date('2026-07-13T00:00:00Z').getTime();

/** 在 secondsAgo 秒前签出的会话(拨钟到过去签,再拨回现在)。 */
function sessionIssuedAgo(secondsAgo: number, amr?: string): string {
  vi.setSystemTime(T0 - secondsAgo * 1000);
  const token = signSession({ uid: 1, name: 'x', amr });
  vi.setSystemTime(T0);
  return token;
}

afterEach(() => { vi.useRealTimers(); });

describe('邮箱验证码会话 → 可免旧密码重设密码', () => {
  it('刚用邮箱验证码登录 = 有 grant', () => {
    vi.useFakeTimers();
    expect(hasFreshEmailGrant(sessionIssuedAgo(0, 'email_code'))).toBe(true);
  });

  it('窗口内(14 分钟前登录)仍有 grant —— 够走完「收信 → 输码 → 设新密码」', () => {
    vi.useFakeTimers();
    expect(hasFreshEmailGrant(sessionIssuedAgo(EMAIL_GRANT_TTL_S - 60, 'email_code'))).toBe(true);
  });

  it('窗口外(16 分钟前登录)grant 失效 → 回到「改密要旧密码」', () => {
    vi.useFakeTimers();
    expect(hasFreshEmailGrant(sessionIssuedAgo(EMAIL_GRANT_TTL_S + 60, 'email_code'))).toBe(false);
  });
});

describe('其它任何会话都拿不到 grant(防会话劫持者直接换密码)', () => {
  it('密码登录签出的会话没有 grant', () => {
    // /auth/email/password 走 signSession 不传 amr —— 偷到这种 token 也改不了密码(仍要旧密码)。
    expect(hasFreshEmailGrant(signSession({ uid: 1, name: 'x' }))).toBe(false);
  });

  it('WCA / Google / 三方登录签出的会话没有 grant', () => {
    expect(hasFreshEmailGrant(signSession({ uid: 1, wcaId: '2017YANR02', name: 'x' }))).toBe(false);
  });

  it('手机验证码会话没有 grant(密码是邮箱凭据,不由短信通道兜底)', () => {
    expect(hasFreshEmailGrant(signSession({ uid: 1, name: 'x', amr: 'phone_code' }))).toBe(false);
  });

  it('篡改签名后的 token 无效(amr 不可自封)', () => {
    const real = signSession({ uid: 1, name: 'x', amr: 'email_code' });
    const [h, p] = real.split('.');
    expect(hasFreshEmailGrant(`${h}.${p}.tampered-signature`)).toBe(false);
  });

  it('乱串 / 空串不崩,一律无 grant', () => {
    expect(hasFreshEmailGrant('')).toBe(false);
    expect(hasFreshEmailGrant('not.a.jwt')).toBe(false);
  });
});

describe('窗口长度', () => {
  it('15 分钟 —— 够用完,又不给劫持者留长尾', () => {
    expect(EMAIL_GRANT_TTL_S).toBe(15 * 60);
  });
});
