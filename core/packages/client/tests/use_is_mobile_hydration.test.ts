// @vitest-environment jsdom
//
// useIsMobile 必须能在 SSR 出来的 HTML 上正确「补写」——这是 issue #66 的根因。
//
// 老写法在 useState 的惰性初值里直接读 window.matchMedia:服务端渲染出的是桌面档(没有
// window → false),客户端 hydration 那一次渲染却已经是手机档 → 属性对不上。React 对
// hydration 属性不一致的处理是「记一条 error,**不修**」(This won't be patched up),而之后
// props 再也不变(60 === 60),DOM 就永远停在服务端那份桌面尺寸上。
//
// 表现:/alg/3x3 手机端,唯一在服务端就渲染出来的缩略图(LSLL,facelets 是静态的,不像别的
// 套要等 fetch)外层盒子停在 96px,里面的图是 60px,于是图左对齐并顶穿卡片左边框 —— 看着就是
// 「LSLL 的图没居中」。
//
// 判据:把服务端那份 HTML 喂给 hydrateRoot,mount 完之后 DOM 必须是手机档。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { useIsMobile } from '@/hooks/useIsMobile';

/** 窄屏:任何 max-width 查询都命中。 */
function stubMatchMedia(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

/** 缩略图那条真实用法:窄屏 60,宽屏 96。 */
const Probe = () => createElement('span', { id: 'probe', 'data-size': useIsMobile(480) ? 60 : 96 });

describe('useIsMobile — hydration', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('服务端出桌面档(没有 window,只能这样)', () => {
    expect(renderToStaticMarkup(createElement(Probe))).toContain('data-size="96"');
  });

  it('hydrate 到窄屏后 DOM 补成手机档,不停在服务端那份', async () => {
    // 服务端那份 HTML(桌面档),原样放进容器再 hydrate —— 和线上一模一样的顺序。
    const html = renderToStaticMarkup(createElement(Probe));
    const host = document.createElement('div');
    host.innerHTML = html;
    document.body.appendChild(host);

    stubMatchMedia(true);
    // hydration 期间的 mismatch 只会被 console.error 记一笔,不会抛 —— 所以判据是最终 DOM,
    // 顺带断言没有 mismatch 报错(有的话说明又在渲染期读了 matchMedia)。
    const errors: unknown[][] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => { errors.push(a); });
    await act(async () => { hydrateRoot(host, createElement(Probe)); });
    spy.mockRestore();

    expect(host.querySelector('#probe')?.getAttribute('data-size')).toBe('60');
    expect(
      errors.filter((e) => String(e[0]).includes('hydrat')),
      `hydration 期间读了实时视口 → React 记 mismatch 且不修属性:\n${errors.map(e => String(e[0])).join('\n')}`,
    ).toEqual([]);

    host.remove();
  });

  it('hydration 之后才挂载的子树直接拿真实视口,不多闪一帧', async () => {
    // /alg 列表里别的缩略图都是这条路(要等 fetch 才有 case,服务端那份 HTML 里没有它们):
    // 全新 mount,第一次渲染就得是手机档 —— 不能为了修上面那条改成「先桌面再纠正」。
    stubMatchMedia(true);
    const host = document.createElement('div');
    document.body.appendChild(host);
    await act(async () => { createRoot(host).render(createElement(Probe)); });
    expect(host.querySelector('#probe')?.getAttribute('data-size')).toBe('60');
    host.remove();
  });
});
