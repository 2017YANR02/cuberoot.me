'use client';

// Ported from packages/client-vite/src/utils/flag.tsx.
// 国旗渲染 — flag-icons CSS 类 + TW 特判自定义 SVG。

import type { JSX } from 'react';

const CHINESE_TAIPEI_SVG = '/tools/assets/images/ChineseTaipei.svg';

// WCA 多地 / 超国家代码（无真国旗,渲染成"空描边"占位）
const MULTI_REGION = new Set(['xa', 'xe', 'xf', 'xn', 'xo', 'xs', 'xm', 'xw']);

export type FlagInfo =
  | { kind: 'img'; src: string; alt: string }
  | { kind: 'span'; className: string; ariaLabel: string };

export function flagInfo(iso2: string): FlagInfo {
  const code = (iso2 || '').trim().toLowerCase();
  if (code === 'tw') return { kind: 'img', src: CHINESE_TAIPEI_SVG, alt: 'Chinese Taipei' };
  if (code === 'xw') return { kind: 'span', className: `fi flag-multi flag-multi-world`, ariaLabel: code };
  if (MULTI_REGION.has(code)) return { kind: 'span', className: `fi flag-multi flag-multi-continent`, ariaLabel: code };
  return { kind: 'span', className: `fi fi-${code}`, ariaLabel: code };
}

interface FlagProps {
  iso2: string;
  className?: string;
  imgClassName?: string;
  spanClassName?: string;
}

export function Flag({ iso2, className, imgClassName, spanClassName }: FlagProps): JSX.Element {
  const info = flagInfo(iso2);
  if (info.kind === 'img') {
    const cls = imgClassName ?? className;
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={cls} src={info.src} alt={info.alt} />;
  }
  const extra = spanClassName ?? className;
  const cls = extra ? `${info.className} ${extra}` : info.className;
  return <span className={cls} aria-label={info.ariaLabel} />;
}

export interface FlagHtmlOpts {
  className?: string;
  imgClassName?: string;
  spanClassName?: string;
}

/** innerHTML / MapLibre popup 场景 */
export function flagHtml(iso2: string, opts?: FlagHtmlOpts): string {
  const info = flagInfo(iso2);
  if (info.kind === 'img') {
    const cls = opts?.imgClassName ?? opts?.className ?? '';
    return `<img class="${cls}" src="${info.src}" alt="${info.alt}" />`;
  }
  const extra = opts?.spanClassName ?? opts?.className ?? '';
  const cls = extra ? `${info.className} ${extra}` : info.className;
  return `<span class="${cls}" aria-label="${info.ariaLabel}"></span>`;
}
