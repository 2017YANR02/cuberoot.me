'use client';

import { ResetDefaultsButton as SharedResetDefaultsButton, type ResetDefaultsButtonProps as SharedProps } from '@cuberoot/timer-ui/reset-defaults-button';
import { tr } from '@/i18n/tr';

export type ResetDefaultsButtonProps = Omit<SharedProps, 'localize'>;

export default function ResetDefaultsButton(props: ResetDefaultsButtonProps) {
  return <SharedResetDefaultsButton {...props} localize={tr} />;
}
