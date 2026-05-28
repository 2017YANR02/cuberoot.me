'use client';

// Ported from packages/client/src/components/LangToggle.tsx.
// Phase 3 [lang]: clicking the toggle swaps the URL's /<lang>/ segment via
// router.replace so the user lands on the same page in the other locale
// (e.g. /en/recon → /zh/recon). Falls back to syncLangToUrl on paths without
// a [lang] segment (root '/', /auth/callback) so the cookie still updates.

import { useRouter, usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { syncLangToUrl } from '@/i18n/i18n-client';

interface LangToggleProps {
  variant?: 'inline' | 'fixed';
  className?: string;
}

function TranslateIcon({ size = 16, isZh }: { size?: number; isZh: boolean }) {
  const back = isZh ? 'A' : '文';
  const front = isZh ? '文' : 'A';
  const backIsZh = !isZh;
  const frontIsZh = isZh;
  const cnFont = "system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif";
  const enFont = "ui-sans-serif, 'Inter', -apple-system, sans-serif";
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <rect x="0.5" y="0.5" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1" />
      <text
        x="5.5"
        y="8.2"
        textAnchor="middle"
        fontSize={backIsZh ? 7 : 7.5}
        fontWeight={backIsZh ? 500 : 700}
        fontFamily={backIsZh ? cnFont : enFont}
        fill="currentColor"
      >
        {back}
      </text>
      <rect x="5.5" y="5.5" width="10" height="10" rx="1.5" fill="currentColor" />
      <text
        x="10.5"
        y="13.2"
        textAnchor="middle"
        fontSize={frontIsZh ? 7 : 7.5}
        fontWeight={frontIsZh ? 500 : 700}
        fontFamily={frontIsZh ? cnFont : enFont}
        fill="var(--background)"
      >
        {front}
      </text>
    </svg>
  );
}

export default function LangToggle({ variant = 'inline', className }: LangToggleProps) {
  const { i18n } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const isZh = i18n.language.startsWith('zh');

  const toggle = () => {
    const next = isZh ? 'en' : 'zh';
    void i18n.changeLanguage(next);
    syncLangToUrl(next);

    // Phase 3 path swap: /en/foo → /zh/foo, /zh → /en, etc.
    // If we're not on a [lang]-prefixed path (e.g. /auth/callback), bail —
    // cookie has been updated, next navigation will pick the right locale.
    if (!pathname) return;
    const match = pathname.match(/^\/(en|zh)(\/.*)?$/);
    if (!match) return;
    const rest = match[2] ?? '';
    // Read the query lazily here (not via useSearchParams at render) so this
    // globally-mounted toggle doesn't force every page to bail to CSR during
    // static prerender.
    const query = typeof window !== 'undefined' ? window.location.search : '';
    router.replace(`/${next}${rest}${query}`);
  };

  const cls = ['lang-toggle', variant === 'fixed' ? 'lang-toggle--fixed' : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={cls}
      onClick={toggle}
      title={isZh ? 'Switch to English' : '切换为中文'}
      aria-label={isZh ? 'Switch to English' : '切换为中文'}
    >
      <TranslateIcon size={14} isZh={isZh} />
    </button>
  );
}
