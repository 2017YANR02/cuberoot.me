'use client';
import { TimerCrossSessionStats } from '@cuberoot/timer-ui';
import type { ComponentProps } from 'react';
import { tr } from '@/i18n/tr';
import { loadAllSessionData, getActiveSessionId } from '../_lib/storage/db';
export default function CrossSessionStats(props: Omit<ComponentProps<typeof TimerCrossSessionStats>, 'data' | 'activeId'>) { return <TimerCrossSessionStats {...props} data={loadAllSessionData()} activeId={getActiveSessionId()} isZh={tr({en:'en',zh:'zh'}) === 'zh'} />; }
