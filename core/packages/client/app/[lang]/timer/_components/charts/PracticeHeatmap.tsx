'use client';
import { TimerPracticeHeatmap } from '@cuberoot/timer-ui';
import type { ComponentProps } from 'react';
import { tr } from '@/i18n/tr';
export default function PracticeHeatmap(props: ComponentProps<typeof TimerPracticeHeatmap>) { return <TimerPracticeHeatmap {...props} isZh={tr({en:'en',zh:'zh'}) === 'zh'} />; }
