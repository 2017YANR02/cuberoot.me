'use client';

import { useEffect, useRef, useState } from 'react';
import BoolToggle from '@/components/BoolToggle';
import SettingsDialog from '@/components/SettingsDialog';
import { VideoCropSelection } from '@/components/VideoCropSelection';
import { VideoTrimTimeline } from '@/components/VideoTrimTimeline';
import { useT } from '@/hooks/useT';
import { timecode, trimRange, type SolveRange } from '@/lib/video-recon/engine/solve-range';
import { cropPixels, type PixelCrop } from '@/lib/video-recon/engine/source-crop';

export interface ReconExportSelection { range: SolveRange; crop?: PixelCrop; captions?: boolean }

export function ReconExportEditor({ file, duration, initial, fps, thumbnails, onClose, onExport }: {
  file: File; duration: number; initial: ReconExportSelection; fps: number; thumbnails?: string[];
  onClose: () => void; onExport: (selection: ReconExportSelection) => void;
}) {
  const t = useT();
  const video = useRef<HTMLVideoElement>(null);
  const [range, setRange] = useState(initial.range);
  const [crop, setCrop] = useState(initial.crop);
  const [captions, setCaptions] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [position, setPosition] = useState(range.start);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const url = URL.createObjectURL(file);
    if (video.current) video.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    // Both dialogs listen for Escape. Dismiss only the innermost editing step.
    function escape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (selecting) setSelecting(false);
      else onClose();
    }
    window.addEventListener('keydown', escape, true);
    return () => window.removeEventListener('keydown', escape, true);
  }, [onClose, selecting]);
  function seek(value: number) {
    setPosition(value);
    if (video.current?.readyState) video.current.currentTime = value;
  }
  function trim(edge: 'start' | 'end', value: number) {
    const next = trimRange(range, edge, value, duration, fps);
    setRange(next);
    seek(next[edge]);
  }
  const labels = { start: t('开始', 'Start'), end: t('结束', 'End'), seek: t('视频进度', 'Video position') };
  return <SettingsDialog label={t('自定义导出', 'Custom export')} heading onClose={onClose}>
    <div className="recon-caption-editor" style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ position: 'relative', overflow: 'hidden', justifySelf: 'center', maxWidth: '100%' }}>
        <video ref={video} muted playsInline preload="auto" style={{ display: 'block', maxWidth: '100%', maxHeight: '40dvh' }}
          onLoadedMetadata={({ currentTarget }) => {
            setSize({ width: currentTarget.videoWidth, height: currentTarget.videoHeight });
            currentTarget.currentTime = position;
          }} />
        {crop && size.width > 0 && !selecting && <div className="video-crop-selection" style={{
          left: crop.x / size.width * 100 + '%', top: crop.y / size.height * 100 + '%',
          width: crop.width / size.width * 100 + '%', height: crop.height / size.height * 100 + '%',
        }} />}
        {selecting && <VideoCropSelection onCancel={() => setSelecting(false)} onSelect={bounds => {
          setCrop(cropPixels({ x: bounds.left, y: bounds.top, width: bounds.right - bounds.left,
            height: bounds.bottom - bounds.top }, size.width, size.height));
          setSelecting(false);
        }} />}
      </div>
      <div className="recon-caption-actions">
        <button type="button" className="btn-secondary" disabled={!size.width} onClick={() => setSelecting(!selecting)}>
          {selecting ? t('取消框选', 'Cancel selection') : t('裁剪画面', 'Crop frame')}</button>
        <button type="button" className="btn-secondary" disabled={!crop && !selecting}
          onClick={() => { setSelecting(false); setCrop(undefined); }}>{t('完整画面', 'Full frame')}</button>
      </div>
      <VideoTrimTimeline total={duration} start={range.start} end={range.end} position={position} timeLabel={timecode(position)}
        step={1 / fps} labels={labels} onSeek={seek} onTrim={(edge, value) => trim(edge === 'left' ? 'start' : 'end', value)}
        thumbnails={thumbnails?.map((src, i) => <div className="video-timeline-thumb" key={i}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Local video thumbnails. */}
          <img src={src} alt="" draggable={false} />
        </div>)} />
      <div className="recon-caption-actions">
        {(['start', 'end'] as const).map(edge => <label key={edge} className="video-recon-inline-label">
          {edge === 'start' ? t('开始（秒）', 'Start (s)') : t('结束（秒）', 'End (s)')}
          <input type="number" key={range[edge]} defaultValue={Number(range[edge].toFixed(3))} min={0} max={duration} step="any"
            onBlur={e => { if (e.currentTarget.value && Number(e.currentTarget.value) !== Number(range[edge].toFixed(3))) trim(edge, e.currentTarget.valueAsNumber); }}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
        </label>)}
        <button type="button" className="btn-secondary" onClick={() => setRange({ start: 0, end: duration })}>
          {t('完整时长', 'Full duration')}</button>
      </div>
      <BoolToggle label={t('嵌入复盘字幕和动画', 'Include reconstruction overlays')} value={captions} onChange={setCaptions} />
      <button type="button" className="btn-primary" disabled={selecting} onClick={() => onExport({ range, crop, captions })}>
        {t('导出', 'Export')}</button>
    </div>
  </SettingsDialog>;
}
