'use client';
import { TimerScatterChart } from '@cuberoot/timer-ui';
import type { ComponentProps } from 'react';
import { tr } from '@/i18n/tr';
export default function ScatterChart(props: ComponentProps<typeof TimerScatterChart>) { return <TimerScatterChart {...props} isZh={tr({en:'en',zh:'zh'}) === 'zh'} />; }
