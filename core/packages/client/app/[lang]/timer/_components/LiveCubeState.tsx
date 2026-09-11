'use client';

import LiveCubeState, { type LiveCubeStateProps } from '@cuberoot/timer-ui/LiveCubeState';
import { tr } from '@/i18n/tr';
export type { LiveCubeStateProps } from '@cuberoot/timer-ui/LiveCubeState';
export default function WebLiveCubeState(props: LiveCubeStateProps) {
  return <LiveCubeState {...props} language={tr({ en: 'en', zh: 'zh' }) as 'en' | 'zh'} enableDevSource={process.env.NODE_ENV !== 'production'} />;
}
