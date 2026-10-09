'use client';
import { TimerStatsModal } from '@cuberoot/timer-ui';
import type { ComponentProps } from 'react';
import { tr } from '@/i18n/tr';
export default function StatsModal(props: ComponentProps<typeof TimerStatsModal>) { return <TimerStatsModal {...props} isZh={tr({en:'en',zh:'zh'}) === 'zh'} />; }
