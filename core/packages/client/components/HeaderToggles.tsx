'use client';

// Ported from packages/client-vite/src/components/HeaderToggles.tsx.
// 语言与外观设置统一收进 AppearanceToggle 菜单。

import AppearanceToggle from './AppearanceToggle';
import type { ReactNode } from 'react';

export default function HeaderToggles({ className, triggerClassName, triggerLabel, labelClassName, showLabels = false, appearanceContent }: { className?: string; triggerClassName?: string; triggerLabel?: string; labelClassName?: string; showLabels?: boolean; appearanceContent?: ReactNode }) {
  const cls = ['header-toggles', className].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      <AppearanceToggle triggerClassName={triggerClassName} triggerLabel={triggerLabel} labelClassName={labelClassName} showLabel={showLabels} menuContent={appearanceContent} />
    </div>
  );
}
