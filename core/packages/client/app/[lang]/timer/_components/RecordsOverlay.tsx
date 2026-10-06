'use client';
import { TimerRecordsOverlay } from '@cuberoot/timer-ui';
import type { ComponentProps } from 'react';
import { tr } from '@/i18n/tr';
export default function RecordsOverlay(props: ComponentProps<typeof TimerRecordsOverlay>) { return <TimerRecordsOverlay {...props} isZh={tr({en:'en',zh:'zh'}) === 'zh'} />; }
