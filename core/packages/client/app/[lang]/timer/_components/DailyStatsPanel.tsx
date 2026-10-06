'use client';
import { TimerDailyStatsPanel } from '@cuberoot/timer-ui';
import type { ComponentProps } from 'react';
import { tr } from '@/i18n/tr';
export default function DailyStatsPanel(props: ComponentProps<typeof TimerDailyStatsPanel>) { return <TimerDailyStatsPanel {...props} isZh={tr({en:'en',zh:'zh'}) === 'zh'} />; }
