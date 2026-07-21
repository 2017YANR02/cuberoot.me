'use client';

// Two-locale direct toggle: English (bare URL) <-> 简体中文 (/zh).
// Single click flips to the other locale (no menu — only two locales exist).
// Pattern B path swap: strip any /en, /zh prefix, then re-apply the
// target locale's prefix (English stays bare). Reads the query lazily (not via
// useSearchParams at render) so this globally mounted control doesn't force
// pages to bail to CSR during prerender.

import type { MouseEvent } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { changeAppLanguage, normalizeAppLang, syncLangToUrl, type AppLang } from '@/i18n/i18n-client';

interface LangToggleProps {
  variant?: 'inline' | 'fixed';
  className?: string;
  /** Switch language in place without a route navigation, so a host overlay
   *  (e.g. an open modal) keeps its React state. The choice still persists via
   *  cookie / localStorage / ?lang=. */
  soft?: boolean;
}

function TranslateIcon({ size = 14 }: { size?: number }) {
  const cnFont = "system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif";
  const enFont = "ui-sans-serif, 'Inter', -apple-system, sans-serif";
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="0.5" y="0.5" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1" />
      <text x="5.5" y="8.2" textAnchor="middle" fontSize={7} fontWeight={500} fontFamily={cnFont} fill="currentColor">文</text>
      <rect x="5.5" y="5.5" width="10" height="10" rx="1.5" fill="currentColor" />
      <text x="10.5" y="13.2" textAnchor="middle" fontSize={7.5} fontWeight={700} fontFamily={enFont} fill="var(--background)">A</text>
    </svg>
  );
}

export default function LangToggle({ variant = 'inline', className, soft = false }: LangToggleProps) {
  const { i18n } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const current = normalizeAppLang(i18n.language);
  const next: AppLang = current === 'zh' ? 'en' : 'zh';

  // 中键 / Ctrl 点新标签页要真 href:Pattern B 路径换语言。只用 pathname(不读
  // window.search,以免全局挂载的本控件让 SSG 页 CSR bailout / hydration 错位);
  // 原页查询串丢弃可接受。英文裸路径,中文加 /zh 前缀。
  const barePath = (pathname || '/').replace(/^\/(en|zh)(?=\/|$)/, '') || '/';
  const targetPath = ((next === 'en' ? '' : '/zh') + (barePath === '/' ? '' : barePath)) || '/';
  // 必带显式 ?lang=<目标语言>:新标签页 boot 时会按 cookie/localStorage 里存的旧语言
  // 把裸英文 URL 又重定向回 /zh(反之亦然)——?lang= 覆盖存储偏好,锁定目标语言。
  const targetHref = `${targetPath}?lang=${next}`;

  const toggle = () => {
    changeAppLanguage(next);
    syncLangToUrl(next); // cookie + localStorage + html.lang (also adds ?lang=)
    if (soft) return; // stay on the current route so the host (e.g. an open modal) keeps its state

    if (!pathname) return;
    const bare = pathname.replace(/^\/(en|zh)(?=\/|$)/, '') || '/';
    // Drop the ?lang= syncLangToUrl just injected — Pattern B URLs are clean.
    let query = '';
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      sp.delete('lang');
      query = sp.toString() ? `?${sp.toString()}` : '';
    }
    const prefix = next === 'en' ? '' : `/${next}`;
    const path = prefix ? `${prefix}${bare === '/' ? '' : bare}` : bare;
    router.replace(`${path || '/'}${query}`);
  };

  // 左键(无修饰)= 原地软切,保持 SPA;Ctrl/Cmd/Shift/中键 = 放行 href 默认(新标签页)。
  const onLinkClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    toggle();
  };

  const cls = ['lang-toggle', variant === 'fixed' ? 'lang-toggle--fixed' : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className="lang-toggle-wrap">
      <a
        href={targetHref}
        className={cls}
        onClick={onLinkClick}
        title="Language / 语言"
        aria-label={next === 'zh' ? '切换到简体中文' : 'Switch to English'}
      >
        <TranslateIcon size={14} />
      </a>
    </div>
  );
}
