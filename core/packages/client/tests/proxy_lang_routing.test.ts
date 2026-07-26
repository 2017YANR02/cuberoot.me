// proxy.ts 的 Pattern B 语言路由回归。
//
// 盯死的那个坑:裸(英文)路径靠 middleware **rewrite** 到 /en 树。自托管的 Next 服务器
// 消费不了自己的 x-middleware-rewrite,会带着 x-forwarded-proto=https 自代理回自己的
// 纯 HTTP 端口 → EPROTO → 500。原来只按 NODE_ENV==='production' 关掉 rewrite,于是
// `next dev` 只要也挂在终止 TLS 的反代后面(dev.cuberoot.me → frp → 本机 :3000,nginx
// 发 X-Forwarded-Proto: https)就全站裸 URL 500,而 /zh 正常 —— 表现为「切到英文就
// Internal Server Error」。改成按请求判定后,这里锁住两边都不许回退。

import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

function request(url: string, headers: Record<string, string> = {}) {
  return proxy(new NextRequest(url, { headers: new Headers(headers) }));
}

const FORWARDED_HTTPS = { 'x-forwarded-proto': 'https' };

describe('proxy: 裸路径 → 英文', () => {
  it('直连(没有反代)时透明 rewrite 到 /en,URL 保持裸', () => {
    const res = request('http://127.0.0.1:3000/');
    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-rewrite')).toMatch(/\/en$/);
  });

  it('挂在终止 TLS 的反代后面时改发 307 → /en,不再 rewrite(否则自代理 EPROTO 500)', () => {
    const res = request('https://dev.cuberoot.me/', FORWARDED_HTTPS);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toMatch(/\/en$/);
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it('子路径同样 307 到 /en 下的对应路径', () => {
    const res = request('https://dev.cuberoot.me/timer', FORWARDED_HTTPS);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toMatch(/\/en\/timer$/);
  });
});

describe('proxy: 其它分支不受影响', () => {
  it('/zh 原样服务,不重定向也不 rewrite', () => {
    const res = request('https://dev.cuberoot.me/zh', FORWARDED_HTTPS);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
    expect(res.headers.get('location')).toBeNull();
  });

  it('/en 原样服务(不 308 回裸,否则和 rewrite 打架成环)', () => {
    const res = request('https://dev.cuberoot.me/en/timer', FORWARDED_HTTPS);
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('中文环境访问裸路径仍优先 307 → /zh,与能否 rewrite 无关', () => {
    const res = request('https://dev.cuberoot.me/', {
      ...FORWARDED_HTTPS,
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
    });
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toMatch(/\/zh$/);
  });

  it('lang cookie=en 压过中文 Accept-Language,仍走英文分支', () => {
    const res = request('https://dev.cuberoot.me/', {
      ...FORWARDED_HTTPS,
      'accept-language': 'zh-CN,zh;q=0.9',
      cookie: 'lang=en',
    });
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toMatch(/\/en$/);
  });

  it('?lang= 显式切换先落 cookie 再规范化路径', () => {
    const res = request('https://dev.cuberoot.me/zh/timer?lang=en', FORWARDED_HTTPS);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toMatch(/\/timer$/);
    expect(res.headers.get('set-cookie')).toContain('lang=en');
  });

  it('非 [lang] 树的应用根路由整条放行,不被 rewrite 成 /en/…', () => {
    const res = request('https://dev.cuberoot.me/tools/cstimer/', FORWARDED_HTTPS);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
    expect(res.headers.get('location')).toBeNull();
  });
});
