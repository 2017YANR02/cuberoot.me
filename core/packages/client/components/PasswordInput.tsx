'use client';

import { PasswordInput as SharedPasswordInput, type PasswordInputProps } from '@cuberoot/app-ui/account-forms';
import { useT } from '@/hooks/useT';

export type { PasswordInputProps };
export function PasswordInput(props: PasswordInputProps) {
  const t = useT();
  return <SharedPasswordInput {...props} t={t} />;
}
