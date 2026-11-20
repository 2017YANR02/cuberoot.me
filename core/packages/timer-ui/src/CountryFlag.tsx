'use client';

import { countryFlagIdentity } from '@cuberoot/shared/country-flag';
import type { JSX } from 'react';

// A package-owned URL lets both Next and Vite fingerprint the asset. Capacitor
// therefore renders the exact WCA Chinese Taipei mark without network access.
export const CHINESE_TAIPEI_FLAG_PATH = new URL(
  './assets/ChineseTaipei.svg',
  import.meta.url,
).href;

export type FlagInfo =
  | { kind: 'img'; src: string; alt: string }
  | { kind: 'span'; className: string; ariaLabel: string };

export function flagInfo(countryOrIso2: string): FlagInfo {
  const { kind, code } = countryFlagIdentity(countryOrIso2);
  if (kind === 'chinese-taipei') {
    return { kind: 'img', src: CHINESE_TAIPEI_FLAG_PATH, alt: 'Chinese Taipei' };
  }
  if (kind === 'world') {
    return {
      kind: 'span',
      className: 'fi flag-multi flag-multi-world',
      ariaLabel: code,
    };
  }
  if (kind === 'continent') {
    return {
      kind: 'span',
      className: 'fi flag-multi flag-multi-continent',
      ariaLabel: code,
    };
  }
  if (kind === 'unknown') {
    return { kind: 'span', className: 'fi flag-multi', ariaLabel: code };
  }
  return { kind: 'span', className: `fi fi-${code}`, ariaLabel: code };
}

export interface FlagProps {
  iso2: string;
  className?: string;
  imgClassName?: string;
  spanClassName?: string;
}

function withImgBase(className?: string): string {
  return className ? `cr-flag-img ${className}` : 'cr-flag-img';
}

/** Canonical country flag renderer shared by Web and Capacitor hosts. */
export function Flag({ iso2, className, imgClassName, spanClassName }: FlagProps): JSX.Element {
  const info = flagInfo(iso2);
  if (info.kind === 'img') {
    return (
      <img
        alt={info.alt}
        className={withImgBase(imgClassName ?? className)}
        src={info.src}
      />
    );
  }
  const extra = spanClassName ?? className;
  return (
    <span
      aria-label={info.ariaLabel || undefined}
      className={extra ? `${info.className} ${extra}` : info.className}
    />
  );
}

export interface FlagHtmlOpts {
  className?: string;
  imgClassName?: string;
  spanClassName?: string;
}

/** Canonical renderer for trusted innerHTML/MapLibre popup call sites. */
export function flagHtml(iso2: string, opts?: FlagHtmlOpts): string {
  const info = flagInfo(iso2);
  if (info.kind === 'img') {
    const cls = withImgBase(opts?.imgClassName ?? opts?.className);
    return `<img class="${cls}" src="${info.src}" alt="${info.alt}" />`;
  }
  const extra = opts?.spanClassName ?? opts?.className ?? '';
  const cls = extra ? `${info.className} ${extra}` : info.className;
  const aria = info.ariaLabel ? ` aria-label="${info.ariaLabel}"` : '';
  return `<span class="${cls}"${aria}></span>`;
}
