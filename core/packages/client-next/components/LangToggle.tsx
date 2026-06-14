'use client';

// Two-locale picker: English (bare URL) / 简体中文 (/zh).
// Pattern B path swap: strip any /en, /zh prefix, then re-apply the
// target locale's prefix (English stays bare). Reads the query lazily (not via
// useSearchParams at render) so this globally mounted control doesn't force
// pages to bail to CSR during prerender.

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { changeAppLanguage, normalizeAppLang, syncLangToUrl, type AppLang } from '@/i18n/i18n-client';

interface LangToggleProps {
  variant?: 'inline' | 'fixed';
  className?: string;
  /** Switch language in place without a route navigation, so a host overlay
   *  (e.g. an open modal) keeps its React state. The choice still persists via
   *  cookie / localStorage / ?lang=. */
  soft?: boolean;
}

const OPTIONS: { code: AppLang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '简体中文' },
];

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
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (next: AppLang) => {
    setOpen(false);
    if (next === current) return;
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

  const cls = ['lang-toggle', variant === 'fixed' ? 'lang-toggle--fixed' : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className="lang-toggle-wrap" ref={ref}>
      <button
        type="button"
        className={cls}
        onClick={() => setOpen((v) => !v)}
        title="Language / 语言"
        aria-label="Language"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <TranslateIcon size={14} />
      </button>
      {open && (
        <div className="lang-menu" role="menu">
          {OPTIONS.map((o) => (
            <button
              key={o.code}
              type="button"
              role="menuitemradio"
              aria-checked={o.code === current}
              className={`lang-menu-item${o.code === current ? ' is-active' : ''}`}
              onClick={() => pick(o.code)}
            >
              <span className="lang-menu-check">{o.code === current && <Check size={13} />}</span>
              <span>{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
