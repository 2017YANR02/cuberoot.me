'use client';

/**
 * Small celebratory toast shown when a freshly-recorded solve produces a new
 * personal best. 1:1 with packages/client-vite/src/pages/timer/components/PbToast.tsx.
 *
 * (The existing components/PbToast.tsx in this dir uses a slim variant tied
 * to the prior phase's TimerPage. This _components/ copy mirrors the Vite
 * source verbatim for the upcoming wired port.)
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
  single: '新单次最佳!',
  ao5: '新 Ao5 最佳!',
  ao12: '新 Ao12 最佳!',
};
const TITLE_EN: Record<PbKind, string> = {
  single: 'New PB single!',
  ao5: 'New PB Ao5!',
  ao12: 'New PB Ao12!',
};

export default function PbToast({ kind, value, isZh, onClose }: Props) {
  useEffect(() => {
    if (kind === null) return;
    const id = window.setTimeout(onClose, 3000);
    return () => window.clearTimeout(id);
  }, [kind, value, onClose]);

  if (kind === null) return null;
  const title = (isZh ? TITLE_ZH[kind] : TITLE_EN[kind]);
  return (
    <div className="tmr-pb-card" role="status" aria-live="polite" onClick={onClose}>
      <Trophy size={18} className="tmr-pb-icon" />
      <span className="tmr-pb-title">{title}</span>
      <span className="tmr-pb-val">{value}</span>
    </div>
  );
}
