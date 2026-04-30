// 统一国旗渲染：flag-icons CSS 类 + TW 特判自定义 SVG。
// TW 不能用 flag-icons 的默认 TW 旗（青天白日满地红），WCA 场景下统一用 Chinese Taipei 梅花旗。
// 同一套 flagInfo 内核供 React 组件（JSX）和 HTML 字符串（innerHTML / MapLibre popup）使用。

import type { JSX } from 'react';
import { countryToIso2 } from './country_flags';

const CHINESE_TAIPEI_SVG = '/tools/assets/images/ChineseTaipei.svg';

// WCA 多地 / 超国家代码（XW=World, XA/XE/XF/XN/XO/XS=各大洲多国, XM=多大洲）
// 没有真国旗，渲染成 WCA 官网那种"空描边"占位
const MULTI_REGION = new Set(['xa', 'xe', 'xf', 'xn', 'xo', 'xs', 'xm', 'xw']);

export type FlagInfo =
  | { kind: 'img'; src: string; alt: string }
  | { kind: 'span'; className: string; ariaLabel: string };

/** 接受 iso2（"US" / "tw"）或 WCA 全名（"China" / "Korea"），自动归一化为小写 iso2 */
function normalizeIso2(input: string): string {
  const s = (input || '').trim();
  if (!s) return '';
  if (s.length === 2) return s.toLowerCase();
  return countryToIso2(s).toLowerCase();
}

/** 国旗渲染信息。TW → 自定义 SVG；多地代码（XW/XA/...）→ 空描边占位；其他 → flag-icons CSS 类。
 * 多地占位风格对齐 WCA 官网：
 *   XW（全球）→ 蓝→红渐变描边（无 border-radius）
 *   其他多地（XA/XE/XF/XN/XO/XS/XM）→ 纯蓝描边（带圆角） */
export function flagInfo(iso2OrCountry: string): FlagInfo {
  const code = normalizeIso2(iso2OrCountry);
  if (code === 'tw') return { kind: 'img', src: CHINESE_TAIPEI_SVG, alt: 'Chinese Taipei' };
  if (code === 'xw') return { kind: 'span', className: `fi flag-multi flag-multi-world`, ariaLabel: code };
  if (MULTI_REGION.has(code)) return { kind: 'span', className: `fi flag-multi flag-multi-continent`, ariaLabel: code };
  return { kind: 'span', className: `fi fi-${code}`, ariaLabel: code };
}

interface FlagProps {
  iso2: string;
  /** 同时应用到 img 和 span，除非被 imgClassName / spanClassName 覆盖 */
  className?: string;
  /** 仅在 TW（img 分支）时应用；未传则回落到 className */
  imgClassName?: string;
  /** 仅在非 TW（span 分支）时应用到 flag-icons span 上；未传则回落到 className */
  spanClassName?: string;
}

/** JSX 场景：<Flag iso2="us" className="cuber-flag" />  或 spanClassName/imgClassName 分别指定 */
export function Flag({ iso2, className, imgClassName, spanClassName }: FlagProps): JSX.Element {
  const info = flagInfo(iso2);
  if (info.kind === 'img') {
    const cls = imgClassName ?? className;
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
