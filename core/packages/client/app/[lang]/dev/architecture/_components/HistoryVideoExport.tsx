'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { Download } from 'lucide-react';
import { ClearButton } from '@/components/ClearButton';
import { CompactSelect } from '@/components/CompactSelect';
import { DateRangeInput } from '@/components/DateRangeInput';
import { saveBlob } from '@/lib/document-export';
import type { ExportProgress } from '@/lib/canvas-video-export';
import { tr } from '@/i18n/tr';
import { HISTORY_LAST, HISTORY_PLACES } from '../history/history-days';
import { HISTORY_VIDEO_SPEEDS, historyVideoPlan } from '../history/history-video-plan';

const DATES = HISTORY_PLACES.map(place => place.date);

export default function HistoryVideoExport({ source, current, initialSpeed, weatherVariation, onClose }: {
  source: RefObject<HTMLDivElement | null>; current: number; initialSpeed: number;
  weatherVariation: number; onClose: () => void;
}) {
  const [from, setFrom] = useState(DATES[current]);
  const [to, setTo] = useState(DATES[HISTORY_LAST]);
  const [speed, setSpeed] = useState(() => {
    try { historyVideoPlan(current, HISTORY_LAST, initialSpeed); return initialSpeed; } catch { return 5; }
  });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const preview = useRef<HTMLCanvasElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const job = useRef<{ aborted: boolean } | null>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    return () => { if (job.current) job.current.aborted = true; };
  }, []);

  const start = DATES.findIndex(date => date >= from);
  const end = DATES.findLastIndex(date => date <= to);
  let plan: ReturnType<typeof historyVideoPlan> | undefined;
  let invalid = '';
  try { plan = historyVideoPlan(start, end, speed); } catch (cause) {
    invalid = cause instanceof Error && cause.message === 'duration'
      ? tr({ zh: '单次视频最长 30 分钟，请加快速度或缩短日期范围。', en: 'Videos can be up to 30 minutes. Increase the speed or select a shorter date range.' })
      : tr({ zh: '这个日期范围内没有更新记录。', en: 'There are no updates in this date range.' });
  }
  const seconds = Math.ceil(plan?.duration ?? 0);

  async function download() {
    if (!plan || !source.current || job.current) return;
    const abortRef = { aborted: false };
    job.current = abortRef;
    setBusy(true); setError(''); setMessage('');
    setProgress({ phase: tr({ zh: '正在准备画卷…', en: 'Preparing the landscape…' }), pct: 0, framesDone: 0, framesTotal: plan.totalFrames });
    try {
      const { exportHistoryVideo } = await import('../history/history-video');
      if (abortRef.aborted) return;
      const blob = await exportHistoryVideo({ source: source.current, start, end, speed, weatherVariation, abortRef,
        preview: preview.current, onProgress: value => { if (!abortRef.aborted) setProgress(value); } });
      if (!abortRef.aborted) {
        saveBlob(blob, `cuberoot-history_${DATES[start]}_${DATES[end]}_${speed}x.mp4`);
        setMessage(tr({ zh: '视频已生成，下载已开始。', en: 'Your video is ready. The download has started.' }));
      }
    } catch (cause) {
      if (!abortRef.aborted) {
        const detail = cause instanceof Error ? cause.message : String(cause);
        setError(/unsupported/i.test(detail)
          ? tr({ zh: '此浏览器不支持 MP4 视频编码，请换用支持 H.264 编码的浏览器。', en: 'This browser cannot encode MP4 video. Please use a browser with H.264 encoding support.' })
          : tr({ zh: `视频生成失败：${detail}`, en: `Video export failed: ${detail}` }));
      }
    } finally {
      if (job.current === abortRef) job.current = null;
      // Closing the panel aborts and unmounts it; no state updates after that.
      if (!abortRef.aborted) { setBusy(false); setProgress(null); }
    }
  }

  function close() {
    if (job.current) job.current.aborted = true;
    onClose();
  }

  return <section id="journey-video-export" className="journey-export" aria-labelledby="journey-export-title">
    <header className="journey-export-heading"><h3 id="journey-export-title" ref={heading} tabIndex={-1}>{tr({ zh: '把这段山河带走', en: 'Take the landscape with you' })}</h3>
      <ClearButton variant="standalone" onClick={close} ariaLabel={tr(busy ? { zh: '取消视频生成', en: 'Cancel video export' } : { zh: '收起视频下载', en: 'Close video download' })} /></header>
    <fieldset className="journey-export-settings" disabled={busy}>
      <DateRangeInput from={from} to={to} onChange={(a, b) => { setFrom(a); setTo(b); }} min={DATES[0]} max={DATES[HISTORY_LAST]} clearable={false} size="compact"
        fromLabel={tr({ zh: '开始日期', en: 'Start date' })} toLabel={tr({ zh: '结束日期', en: 'End date' })} />
      <button type="button" className="journey-button" onClick={() => { setFrom(DATES[0]); setTo(DATES[HISTORY_LAST]); }}>{tr({ zh: '全部日期', en: 'All dates' })}</button>
      <CompactSelect variant="plain" label={`${speed}×`} value={speed} valueText={`${speed}×`} items={HISTORY_VIDEO_SPEEDS.map(value => ({ value, label: `${value}×` }))}
        onChange={setSpeed} ariaLabel={tr({ zh: '视频行走速度', en: 'Video walking speed' })} />
    </fieldset>
    <p className="journey-export-description">{tr({ zh: '1080p MP4，30 帧/秒，无声。保留人物、天气、日期与简述。', en: '1080p MP4, 30 fps, silent. Includes the traveler, weather, dates and notes.' })}
      {plan && <span>{tr({ zh: `预计时长 ${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`, en: `Duration: ${Math.floor(seconds / 60)} min ${seconds % 60} sec` })}</span>}</p>
    {invalid && <p role="alert">{invalid}</p>}
    {error && <p role="alert">{error}</p>}
    <canvas ref={preview} className="journey-export-preview" hidden={!busy && !message} aria-label={tr({ zh: '导出视频预览', en: 'Exported video preview' })} />
    <div className="journey-export-actions">
      {busy ? <><progress max={1} value={progress?.pct ?? 0} aria-label={tr({ zh: '视频生成进度', en: 'Video export progress' })} /><span role="status">{progress?.phase}</span>
        <button type="button" className="journey-button" onClick={close}>{tr({ zh: '取消', en: 'Cancel' })}</button></>
        : <button type="button" className="journey-button" disabled={!plan} onClick={() => void download()}><Download size={17} />{tr({ zh: '生成并下载', en: 'Generate and download' })}</button>}
      {message && <span role="status">{message}</span>}
    </div>
  </section>;
}
