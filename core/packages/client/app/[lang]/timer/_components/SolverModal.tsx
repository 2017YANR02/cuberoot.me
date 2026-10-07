'use client';
import Solver from '@cuberoot/timer-ui/TimerGeneralSolverModal';
import { browserTimerToolTransport } from '@cuberoot/timer-ui/TimerTools';
export default function SolverModal({ isZh, onClose }: { isZh: boolean; onClose(): void }) { return <Solver language={isZh ? 'zh' : 'en'} onClose={onClose} transport={browserTimerToolTransport} />; }
