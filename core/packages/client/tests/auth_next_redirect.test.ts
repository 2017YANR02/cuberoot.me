import { describe, it, expect } from 'vitest';
import { nextQuery } from '@/lib/auth-store';

/**
 * 「登录」入口是导航到 /account(全站没有登录弹层),?next= 负责登录后回到来处。
 * 这里锁两件容易出事的:回跳目标的规范形式,以及开放重定向。
 */
describe('nextQuery — 登录链接的 ?next=', () => {
  const decode = (q: string) => decodeURIComponent(q.replace(/^\?next=/, ''));

  it('记住当前页,供登录后回跳', () => {
    expect(decode(nextQuery('/zh/forum'))).toBe('/zh/forum');
    expect(decode(nextQuery('/wca/comp'))).toBe('/wca/comp');
  });

  it('把内部 rewrite 路径 /en/* 归一成对外裸路径(Pattern B)', () => {
    // usePathname() 在英文路由上回的是 /en/...;直接当 next 会把人扔到非规范 URL。
    expect(decode(nextQuery('/en/forum'))).toBe('/forum');
    expect(decode(nextQuery('/en'))).toBe('/');
    // /zh 是对外真实前缀,必须原样保留。
    expect(decode(nextQuery('/zh'))).toBe('/zh');
  });

  it('已经在登录页时不塞 next —— 否则登录完又跳回登录页', () => {
    expect(nextQuery('/account')).toBe('');
    expect(nextQuery('/zh/account')).toBe('');
    expect(nextQuery('/en/account')).toBe('');
  });

  it('对 query 做转义,不生成畸形 href', () => {
    expect(decode(nextQuery('/forum?tag=a&b=c'))).toBe('/forum?tag=a&b=c');
    expect(nextQuery('/forum?tag=a&b=c')).not.toContain('&b=c');
  });
});
