'use client';

// BackHome — the site's one consistent "← 首页 / Home" affordance for first-level
// content/hub pages (calc, recon, scramble, math, regulation, …). Immersive tool
// pages (timer/sim/paint/solver) intentionally rely on browser back instead.
// Wraps HomeLink (lang-correct home href) with a shared `.back-home` style so
// pages don't each hand-roll their own back-link CSS. Place it inside the same-width
// header/topbar/wrap as the body, never directly under a full-bleed page root.

import { ChevronLeft } from '@app-foundation/icons/lucide';
import HomeLink from './HomeLink';
import { tr } from '@/i18n/tr';

export default function BackHome({ className, prefetch, miniProgramTarget }: { className?: string; prefetch?: false; miniProgramTarget?: 'tools' | 'account' }) {
  const cls = ['back-home', className].filter(Boolean).join(' ');
  return (
    <HomeLink className={cls} prefetch={prefetch} miniProgramTarget={miniProgramTarget} aria-label={tr({ zh: '返回首页', en: 'Back to home' })}>
      <ChevronLeft size={16} aria-hidden="true" /> <span className="sr-only">{tr({ zh: '首页', en: 'Home' })}</span>
    </HomeLink>
  );
}
