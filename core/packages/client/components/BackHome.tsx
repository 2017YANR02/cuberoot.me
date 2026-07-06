'use client';

// BackHome — the site's one consistent "← 首页 / Home" affordance for first-level
// content/hub pages (calc, recon, scramble, math, regulation, …). Immersive tool
// pages (timer/sim/paint/solver) intentionally rely on browser back instead.
// Wraps HomeLink (lang-correct home href) with a shared `.back-home` style so
// pages don't each hand-roll their own back-link CSS. Drop it at the top of the
// page's outermost container / header.

import { ChevronLeft } from 'lucide-react';
import HomeLink from './HomeLink';
import { tr } from '@/i18n/tr';

export default function BackHome({ className }: { className?: string }) {
  const cls = ['back-home', className].filter(Boolean).join(' ');
  return (
    <HomeLink className={cls} aria-label={tr({ zh: '返回首页', en: 'Back to home' })}>
      <ChevronLeft size={16} aria-hidden="true" /> {tr({ zh: '首页', en: 'Home' })}
    </HomeLink>
  );
}
