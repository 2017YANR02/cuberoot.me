'use client';
import { TimerCfopCaseStatsPanel } from '@cuberoot/timer-ui';
import type { ComponentProps } from 'react';
import { tr } from '@/i18n/tr';
export default function CfopCaseStatsPanel(props: ComponentProps<typeof TimerCfopCaseStatsPanel>) { return <TimerCfopCaseStatsPanel {...props} isZh={tr({en:'en',zh:'zh'}) === 'zh'} />; }
