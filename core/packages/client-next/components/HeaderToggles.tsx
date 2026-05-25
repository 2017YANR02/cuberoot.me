'use client';

// Ported from packages/client/src/components/HeaderToggles.tsx.

import LangToggle from './LangToggle';
import ThemeToggle from './ThemeToggle';

export default function HeaderToggles({ className }: { className?: string }) {
  const cls = ['header-toggles', className].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      <LangToggle />
      <ThemeToggle />
    </div>
  );
}
