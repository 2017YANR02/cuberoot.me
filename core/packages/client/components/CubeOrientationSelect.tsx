'use client';
import type { ComponentProps } from 'react';
import { CubeOrientationSelect as SharedCubeOrientationSelect } from '@cuberoot/timer-ui';
import { tr } from '@/i18n/tr';

/** Preserve the site-wide entry; the picker itself is shared with installed apps. */
export default function CubeOrientationSelect(props: Omit<ComponentProps<typeof SharedCubeOrientationSelect>, 'localize'>) {
  return <SharedCubeOrientationSelect {...props} localize={tr} />;
}
