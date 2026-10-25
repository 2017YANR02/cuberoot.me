'use client';
import { TimerSoloLayoutEditor } from '@cuberoot/timer-ui';
import { getSettings, updateSettings } from '../_lib/settings';
import { tr } from '@/i18n/tr';
import type { ComponentProps } from 'react';
export default function SoloLayoutEditor(props: Pick<ComponentProps<typeof TimerSoloLayoutEditor>, 'surfaceRef' | 'contentKey' | 'onDone'>) {
  return <TimerSoloLayoutEditor {...props} getSettings={getSettings} updateSettings={updateSettings}
    language={tr({ en: 'en', zh: 'zh' }) as 'en' | 'zh'} />;
}
