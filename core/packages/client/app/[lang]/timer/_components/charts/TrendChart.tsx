'use client';
import { TimerTrendChart } from '@cuberoot/timer-ui';
import type { ComponentProps } from 'react';
import { tr } from '@/i18n/tr';
export default function TrendChart(props: ComponentProps<typeof TimerTrendChart>) { return <TimerTrendChart {...props} isZh={tr({en:'en',zh:'zh'}) === 'zh'} />; }
