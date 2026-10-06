'use client';
import { TimerHourChart } from '@cuberoot/timer-ui';
import type { ComponentProps } from 'react';
import { tr } from '@/i18n/tr';
export default function HourChart(props: ComponentProps<typeof TimerHourChart>) { return <TimerHourChart {...props} isZh={tr({en:'en',zh:'zh'}) === 'zh'} />; }
