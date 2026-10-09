'use client';
import '../timer-data-settings.css';
import { TimerRoomDialog } from '../TimerRoomDialog';
import ReconstructReport, { type ReconstructHost, type ReconstructReportProps } from './ReconstructReport';

export interface ReconstructModalProps extends ReconstructReportProps { host: ReconstructHost; onClose(): void; }
export default function ReconstructModal({ onClose, onUseScramble, ...props }: ReconstructModalProps) {
  const language = props.isZh ? 'zh' : 'en';
  return <TimerRoomDialog title={{ en: 'Reconstruct', zh: '复盘' }[language]} className="reconstruct-modal" language={language} onClose={onClose}>
    <ReconstructReport {...props} onUseScramble={onUseScramble && (scramble => { onUseScramble(scramble); onClose(); })} />
  </TimerRoomDialog>;
}
