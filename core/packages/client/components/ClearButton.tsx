'use client';

import {
  ClearButton as SharedClearButton,
  type ClearButtonProps as SharedClearButtonProps,
} from '@cuberoot/timer-ui';
import type { JSX } from 'react';

import { tr } from '@/i18n/tr';

interface ClearButtonProps extends Omit<SharedClearButtonProps, 'ariaLabel'> {
  isZh?: boolean;
  ariaLabel?: string;
}

export function ClearButton({
  ariaLabel,
  isZh: _isZh,
  ...props
}: ClearButtonProps): JSX.Element {
  return (
    <SharedClearButton
      {...props}
      ariaLabel={ariaLabel ?? tr({ zh: '清除', en: 'Clear' })}
    />
  );
}
