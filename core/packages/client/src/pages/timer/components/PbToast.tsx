/**
 * Small celebratory toast shown when a freshly-recorded solve produces a new
 * personal best (single / ao5 / ao12) for the current event. Auto-dismisses
 * after 3 seconds.
 */

import { useEffect } from 'react';
import { Trophy } from 'lucide-react';

export type PbKind = 'single' | 'ao5' | 'ao12';

interface Props {
  kind: PbKind | null;
  value: string;
  isZh: boolean;
  onClose: () => void;
}

const TITLE_ZH: Record<PbKind, string> = {
  single: '新单次最佳！',
  ao5:    '新 Ao5 最佳！',
  ao12:   '新 Ao12 最佳！',
};
const TITLE_EN: Record<PbKind, string> = {
  single: 'New PB single!',
  ao5:    'New PB Ao5!',
  ao12:   'New PB Ao12!',
};

export default function PbToast({ kind, value, isZh, onClose }: Props) {
  useEffect(() => {
    if (kind === null) return;
    const id = window.setTimeout(onClose, 3000);
    return () => window.clearTimeout(id);
  }, [kind, value, onClose]);

  if (kind === null) return null;
  const title = isZh ? TITLE_ZH[kind] : TITLE_EN[kind];
  return (
    <div className="pb-toast" role="status" aria-live="polite" onClick={onClose}>
      <Trophy size={18} className="pb-toast-icon" />
      <span className="pb-toast-title">{title}</span>
      <span className="pb-toast-value">{value}</span>
    </div>
  );
}
