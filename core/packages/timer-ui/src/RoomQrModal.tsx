import { CopySuccessIcon } from './CopySuccessIcon';
import { Copy } from 'lucide-react';
import { useMemo } from 'react';
import { useClipboardFeedback } from './browser-clipboard';
import { timerRoomQrSvg } from './room-qr';
import { TimerRoomDialog } from './TimerRoomDialog';
import './room-qr-modal.css';

export interface RoomQrModalLabels {
  copiedCode: string;
  copiedInvite: string;
  copyCode: string;
  copyFailed: string;
  copyInvite: string;
  scanToJoin: string;
}

export interface RoomQrModalProps {
  code: string;
  labels: RoomQrModalLabels;
  language: 'en' | 'zh';
  onClose(): void;
  url: string;
  writeClipboardText(text: string): Promise<void>;
}

export function RoomQrCode({ url }: { url: string }) {
  const svg = useMemo(() => timerRoomQrSvg(url), [url]);
  return <div className="room-qr-code" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function RoomQrModal({ code, labels, language, onClose, url, writeClipboardText }: RoomQrModalProps) {
  const { copy, feedback } = useClipboardFeedback(JSON.stringify([code, url]), writeClipboardText);
  const codeCopied = feedback?.target === 'code' && feedback.copied;
  const inviteCopied = feedback?.target === 'invite' && feedback.copied;
  return <TimerRoomDialog title={labels.scanToJoin} language={language} className="room-qr-modal" onClose={onClose}>
    <RoomQrCode url={url} />
    <button type="button" className="room-qr-code-text" aria-label={`${labels.copyCode}: ${code}`}
      onClick={() => void copy(code, 'code')}>
      {code}{codeCopied ? <CopySuccessIcon size={16} /> : <Copy size={16} aria-hidden />}
    </button>
    <button type="button" className="room-qr-link" aria-label={labels.copyInvite} onClick={() => void copy(url, 'invite')}>
      {inviteCopied ? <CopySuccessIcon size={13} /> : <Copy size={13} aria-hidden />}
      <span className="room-qr-link-text">{url}</span>
    </button>
    <div className="room-qr-status" role="status">{feedback && (
      !feedback.copied ? labels.copyFailed : codeCopied ? labels.copiedCode : labels.copiedInvite
    )}</div>
  </TimerRoomDialog>;
}
