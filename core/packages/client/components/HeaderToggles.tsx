'use client';

// Ported from packages/client-vite/src/components/HeaderToggles.tsx.
// 语言 + 外观(明暗 / 配色合一)两连。外观入口走 AppearanceToggle 单菜单。

import LangToggle from './LangToggle';
import AppearanceToggle from './AppearanceToggle';
import type { ReactNode } from 'react';

export default function HeaderToggles({ className, showLabels = false, appearanceContent }: { className?: string; showLabels?: boolean; appearanceContent?: ReactNode }) {
  const cls = ['header-toggles', className].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      <LangToggle showLabel={showLabels} />
      <AppearanceToggle showLabel={showLabels} menuContent={appearanceContent} />
    </div>
  );
}
