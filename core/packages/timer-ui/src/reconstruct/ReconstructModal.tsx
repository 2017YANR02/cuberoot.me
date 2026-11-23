'use client';
import { useState } from 'react';
import { timerSupportsTrainingTiming } from '@cuberoot/shared/timer/training-settings';
import '../timer-data-settings.css';
import { TimerRoomDialog } from '../TimerRoomDialog';
import ReconstructReport, { type ReconstructHost, type ReconstructReportProps } from './ReconstructReport';

export interface ReconstructModalProps extends ReconstructReportProps { host: ReconstructHost; onClose(): void; }
export default function ReconstructModal({ onClose, onUseScramble, ...props }: ReconstructModalProps) {
  const [summaryTarget, setSummaryTarget] = useState<HTMLDivElement | null>(null);
  const language = props.isZh ? 'zh' : 'en';
  const showSummaryInHeader = !props.live && !timerSupportsTrainingTiming(props.solve.event);
  return <TimerRoomDialog title={{ en: 'Reconstruct', zh: '复盘' }[language]} className="reconstruct-modal" language={language} onClose={onClose}
    headerTitle={showSummaryInHeader ? <div className="rc-modal-summary" ref={setSummaryTarget} /> : undefined}>
    <ReconstructReport {...props} summaryTarget={showSummaryInHeader ? summaryTarget : undefined}
      onUseScramble={onUseScramble && (scramble => { onUseScramble(scramble); onClose(); })} />
  </TimerRoomDialog>;
}
