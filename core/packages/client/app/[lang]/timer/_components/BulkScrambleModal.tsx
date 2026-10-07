'use client';
import Bulk from '@cuberoot/timer-ui/TimerBulkScrambleModal';
import { browserTimerToolTransport } from '@cuberoot/timer-ui/TimerTools';
import type { EventId } from '@cuberoot/shared/timer';
import { getSettings } from '../_lib/settings';
import { get222Mode } from '@/lib/scramble-222-mode';
export default function BulkScrambleModal({ defaultEvent, isZh, onClose }: { defaultEvent: EventId; isZh: boolean; onClose(): void }) { return <Bulk defaultEvent={defaultEvent} language={isZh ? 'zh' : 'en'} onClose={onClose} transport={browserTimerToolTransport} randomOptions={{ cnMode: getSettings().cnMode, scramble222Mode: get222Mode() }} />; }
