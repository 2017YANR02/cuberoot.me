'use client';

/**
 * useHashHighlight — 「点某项 → URL 片段更新 → 滚到它并高亮」这一模式的单一实现。
 *
 * 全站原本有多处各写一份(/wiki 词条、person 页两张成绩表、/alg 公式卡、/wca/prediction
 * 项目段、论坛帖子),核心逻辑一致、只在几个点上有真实差异,故抽成本 hook。差异点即参数:
 *   - resolve:  hash(含 '#')→ 目标元素。默认 getElementById(解码后的 slug);
 *               person 表按 ROUND_VARIANTS 反查子轮次,alg 按 case 名反查。
 *   - reveal:   滚动前把目标「变得可达」的预处理——展开折叠组 / 把虚拟列表里的目标行
 *               先塞进渲染窗口 / 打开 <details>。返回 false 表示这一拍还没就绪(effect
 *               会在 deps 变化时重跑重试)。
 *   - block:    scrollIntoView 的对齐,默认 'center'。
 *   - linger:   高亮寿命。'sticky' = 持续到 hash 变(成绩行选中态);数字 = 闪一下(该毫秒后
 *               移除 class,且同一 hash 不重放)。默认 'sticky'。
 *   - highlightClass: 命中后往目标元素上挂的 class,由 hook 增删(适合列表里逐项、不随
 *               highlight 重渲染的元素,如成绩行 / 词条)。省略则 hook 不碰 class ——
 *               改由调用方在 onScroll 里用 React state 打高亮(元素在 highlight 期间会重渲染、
 *               命令式 class 会被 React 覆盖时用,如 /alg 公式卡)。
 *   - onScroll: 刚滚到一个「新命中」目标时回调,给调用方做额外动作(React state 打闪 /
 *               记录当前项)。
 *   - deps:     异步内容就绪信号(fetch 到的数据 / 分组行 / 渲染条数)——变化时重算,
 *               因为目标元素要等这些渲染出来才存在。
 *
 * 返回 { hash, setHash }:setHash 给「用 Next router 改片段」的调用方手动同步——
 * router.replace 改 hash 不会触发 hashchange,高亮要立刻生效就得手动 setHash。
 * 走原生 <a href="#..."> 的调用方无需 setHash(浏览器会派发 hashchange)。
 *
 * 片段不是页内状态(是「现在指着哪一项」的名片,供复制分享),与 CLAUDE.md「URL 状态
 * 统一 nuqs」不冲突;写片段走 lib/url_hash.ts 的 replaceHash 或原生 <a>。
 */
import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

type Resolve = (hash: string) => HTMLElement | null;

export interface UseHashHighlightOptions {
  /** 命中后往目标挂的 class,由 hook 增删。省略则 hook 不碰 class(改在 onScroll 里用
   *  React state 打高亮,给 highlight 期间会重渲染的元素用)。 */
  highlightClass?: string;
  /** hash(含 '#')→ 目标元素。默认按解码后的 slug getElementById。 */
  resolve?: Resolve;
  /** 滚动前的预处理:让目标可达。返回 false = 本拍未就绪,deps 变化后重试。 */
  reveal?: (hash: string) => boolean | void;
  /** 刚滚到一个新命中目标时回调(React state 打闪 / 记录当前项)。 */
  onScroll?: (el: HTMLElement, hash: string) => void;
  /** scrollIntoView 对齐,默认 'center'。 */
  block?: ScrollLogicalPosition;
  /** 高亮寿命:'sticky' 持续到 hash 变(默认);数字 = 闪一下(移除 class + 同一 hash 不重放)。 */
  linger?: 'sticky' | number;
  /** 异步就绪信号:目标元素依赖这些渲染后才存在,变化时重算。 */
  deps?: DependencyList;
}

const decodeHash = (hash: string): string => {
  const raw = hash.replace(/^#/, '');
  try { return decodeURIComponent(raw); } catch { return raw; }
};

const defaultResolve: Resolve = (hash) => {
  const id = decodeHash(hash);
  return id ? document.getElementById(id) : null;
};

export function useHashHighlight(opts: UseHashHighlightOptions): {
  hash: string;
  /**
   * 手动同步片段(给用 Next router / replaceHash 静默改 URL 的调用方——那不触发
   * hashchange)。opts.markActed:把该片段当成「已处理」记下,effect 不会再为它自动
   * 滚动/闪一下——用于「用户自己点选」这种目标已在眼前、不该再跳的场景。
   */
  setHash: (hash: string, opts?: { markActed?: boolean }) => void;
} {
  const {
    highlightClass,
    resolve = defaultResolve,
    reveal,
    onScroll,
    block = 'center',
    linger = 'sticky',
    deps,
  } = opts;

  // Next App Router 不经 hooks 暴露 URL 片段,自己追踪 window。
  const [hash, setHashState] = useState<string>(() => (typeof window !== 'undefined' ? window.location.hash : ''));
  // 首次落地(分享链接 / 搜索跳来)瞬时定位——整页可能很长,smooth 会一路滚过;之后
  // 页内点击再用 smooth。
  const firstScroll = useRef(true);
  // 已经「滚动+高亮」过的 hash。deps 变化(展开分组 / 渐进渲染补行)时 effect 会重跑,但对
  // 同一个 hash 不该重滚、也不该把 flash 动画重放一遍——只在 hash 真的换了、或目标此前还没
  // 就绪(reveal/resolve 失败,没记 acted)才重新动作。
  const actedHash = useRef<string>('');

  const setHash = useCallback((h: string, o?: { markActed?: boolean }) => {
    if (o?.markActed) actedHash.current = h; // 自己点选的:记为已处理,别再自动跳/闪
    setHashState(h);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onHash = () => setHashState(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const clearHighlight = () => {
      if (highlightClass) document.querySelectorAll<HTMLElement>('.' + highlightClass).forEach((el) => el.classList.remove(highlightClass));
    };
    if (!hash) {
      if (linger === 'sticky') clearHighlight(); // 片段清空 → 撤掉持续型高亮
      actedHash.current = '';
      return;
    }
    const isNew = actedHash.current !== hash;
    if (linger === 'sticky') {
      // 持续型(如成绩行选中):每次运行把高亮移到当前 hash —— 静态 class,重挂无副作用。
      clearHighlight();
    } else if (!isNew) {
      // 闪一下型:同一 hash 已放过,deps 变化不重放。
      return;
    }
    if (reveal && reveal(hash) === false) return; // 目标还没就绪 → 等 deps 变化重试(不记 acted)
    const el = resolve(hash);
    if (!el) return;                              // 还没挂到 DOM → 等 deps 变化重试
    if (isNew) {
      el.scrollIntoView({ behavior: firstScroll.current ? 'auto' : 'smooth', block });
      firstScroll.current = false;
      actedHash.current = hash;
      onScroll?.(el, hash);
    }
    if (highlightClass) {
      el.classList.add(highlightClass);
      if (typeof linger === 'number') {
        const id = window.setTimeout(() => el.classList.remove(highlightClass), linger);
        return () => window.clearTimeout(id);
      }
    }
    // resolve/reveal/onScroll/highlightClass/block/linger 只随 hash / 就绪信号触发,不进 deps。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash, ...(deps ?? [])]);

  return { hash, setHash };
}
