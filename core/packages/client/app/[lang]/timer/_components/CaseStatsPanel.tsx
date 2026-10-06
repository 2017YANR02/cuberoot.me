'use client';
import { TimerCaseStatsPanel } from '@cuberoot/timer-ui';
import type { ComponentProps } from 'react';
import { tr } from '@/i18n/tr';
export default function CaseStatsPanel(props: ComponentProps<typeof TimerCaseStatsPanel>) { return <TimerCaseStatsPanel {...props} isZh={tr({en:'en',zh:'zh'}) === 'zh'} />; }
