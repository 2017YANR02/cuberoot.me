'use client';
import { useState } from 'react';
import { useT } from '@/hooks/useT';
import type { ScrambleImageSheet } from '@/lib/scramble-sheet-image';

export default function ScrambleImageDownload({ sheets, disabled = false, className }: { sheets: ScrambleImageSheet[]; disabled?: boolean; className?: string }) {
  const t = useT();
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState(false);
  async function download() {
    setProgress('0'); setError(false);
    try {
      const { downloadScrambleImages } = await import('@/lib/scramble-sheet-image');
      await downloadScrambleImages(sheets, t('暂无打乱', 'Scramble unavailable'), (done, total) => setProgress(`${done}/${total}`));
    } catch { setError(true); }
    finally { setProgress(null); }
  }
  return <><button type="button" className={className} disabled={disabled || progress !== null || !sheets.some(sheet => sheet.rows.length)} onClick={() => void download()}>{progress !== null ? t(`正在生成图片 ${progress}`, `Creating images ${progress}`) : t('保存打乱图片', 'Save scramble images')}</button>{error && <span role="alert">{t('图片生成失败，请重试。', 'Image export failed. Please retry.')}</span>}</>;
}
