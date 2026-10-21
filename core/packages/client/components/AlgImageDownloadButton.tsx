'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Download } from '@app-foundation/icons/lucide';
import { TimerRoomDialog } from '@cuberoot/timer-ui';
import BoolToggle from '@/components/BoolToggle';
import { Tooltip } from '@/components/Tooltip';
import { tr } from '@/i18n/tr';
import type { CaseImageBatch } from '@/lib/alg-case-images';
import './alg-image-download.css';

/** Snapshot the current display settings at click time; render images only on download. */
export default function AlgImageDownloadButton({ build, icon = false, batch = false, children }: {
  build: () => CaseImageBatch;
  icon?: boolean;
  batch?: boolean;
  /** Right-click / touch hold on a case opens the same export options. */
  children?: ReactNode;
}) {
  const [snapshot, setSnapshot] = useState<CaseImageBatch | null>(null);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const suppressClick = useRef(false);
  const cancelHold = () => { if (hold.current !== null) clearTimeout(hold.current); hold.current = null; };
  useEffect(() => cancelHold, []);
  const label = tr({ zh: '下载图片', en: 'Download images' });
  return <>
    {children ? <div className="alg-image-download-target" role="group" tabIndex={0} aria-label={label}
      onContextMenu={event => { event.preventDefault(); event.stopPropagation(); cancelHold(); setSnapshot(build()); }}
      onKeyDown={event => {
        if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
          event.preventDefault(); event.stopPropagation(); setSnapshot(build());
        }
      }}
      onPointerDown={event => {
        cancelHold(); suppressClick.current = false;
        if (event.pointerType === 'mouse' || !event.isPrimary) return;
        origin.current = { x: event.clientX, y: event.clientY };
        hold.current = setTimeout(() => { suppressClick.current = true; setSnapshot(build()); }, 550);
      }}
      onPointerMove={event => { if (Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > 10) cancelHold(); }}
      onPointerUp={cancelHold} onPointerCancel={cancelHold} onPointerLeave={cancelHold}
      onClickCapture={event => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}
    >{children}</div> : <Tooltip content={label}>{tip => <button {...tip} type="button"
      className={icon ? 'alg-image-download-icon' : 'alg-pdf-btn'} aria-label={label}
      onClick={event => { event.preventDefault(); event.stopPropagation(); setSnapshot(build()); }}>
      {icon ? <Download size={15} aria-hidden="true" /> : label}
    </button>}</Tooltip>}
    {snapshot && <ImageDownloadDialog snapshot={snapshot} batch={batch} onClose={() => setSnapshot(null)} />}
  </>;
}

function ImageDownloadDialog({ snapshot, batch, onClose }: { snapshot: CaseImageBatch; batch: boolean; onClose(): void }) {
  const [format, setFormat] = useState<'png' | 'svg'>('png');
  const [background, setBackground] = useState<'transparent' | 'white'>('transparent');
  const [size, setSize] = useState(1024);
  const [allOris, setAllOris] = useState(false);
  const [custom, setCustom] = useState(false);
  const [selected, setSelected] = useState(() => new Set(snapshot.groups.map(group => group.id)));
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [failures, setFailures] = useState<string[]>([]);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const close = () => { controller.current?.abort(); onClose(); };
  const images = snapshot.groups.filter(group => !custom || selected.has(group.id))
    .flatMap(group => allOris ? group.all : group.current);
  const busy = progress !== null;
  const zipped = batch || images.length > 1;
  const run = async () => {
    if (controller.current || !images.length) return;
    const job = new AbortController();
    controller.current = job;
    setProgress(0); setMessage(''); setFailures([]);
    try {
      const { downloadCaseImages } = await import('@/lib/alg-case-image-export');
      const result = await downloadCaseImages(images, {
        format, background, size, zip: zipped, filename: snapshot.filename, signal: job.signal,
        onProgress: done => setProgress(done),
      });
      if (!job.signal.aborted) {
        setFailures(result.failures);
        setMessage(tr({ zh: `已导出 ${result.downloaded} 张图片`, en: `${result.downloaded} images exported` }));
      }
    } catch (error) {
      if (job.signal.aborted) setMessage(tr({ zh: '已取消', en: 'Cancelled' }));
      else { console.error('[alg] image download failed', error); setMessage(tr({ zh: '导出失败，请重试', en: 'Export failed. Please retry.' })); }
    } finally {
      controller.current = null;
      setProgress(null);
    }
  };
  return <TimerRoomDialog title={tr({ zh: '下载图片', en: 'Download images' })}
    className="alg-image-download-dialog" language={tr({ zh: 'zh', en: 'en' }) as 'zh' | 'en'} onClose={close}>
    <fieldset className="alg-image-download-options" disabled={busy}>
      <label>{tr({ zh: '格式', en: 'Format' })}<select className="alg-image-download-select" aria-label={tr({ zh: '格式', en: 'Format' })} value={format} onChange={e => setFormat(e.target.value as 'png' | 'svg')}><option value="png">PNG</option><option value="svg">SVG</option></select></label>
      <label>{tr({ zh: '背景', en: 'Background' })}<select className="alg-image-download-select" aria-label={tr({ zh: '背景', en: 'Background' })} value={background} onChange={e => setBackground(e.target.value as 'transparent' | 'white')}>
        <option value="transparent">{tr({ zh: '透明', en: 'Transparent' })}</option><option value="white">{tr({ zh: '白底', en: 'White' })}</option>
      </select></label>
      {format === 'png' && <label>{tr({ zh: '长边尺寸', en: 'Longest edge' })}<select className="alg-image-download-select" aria-label={tr({ zh: '长边尺寸', en: 'Longest edge' })} value={size} onChange={e => setSize(Number(e.target.value))}>
        {[512, 1024, 2048].map(value => <option key={value} value={value}>{value} px</option>)}
      </select></label>}
      {snapshot.groups.some(group => group.all.length > 1) && <label>{tr({ zh: '朝向', en: 'Orientations' })}
        <select className="alg-image-download-select" aria-label={tr({ zh: '朝向', en: 'Orientations' })} value={allOris ? 'all' : 'current'} onChange={e => setAllOris(e.target.value === 'all')}>
          <option value="current">{tr({ zh: '当前朝向', en: 'Current orientation' })}</option>
          <option value="all">{tr({ zh: '全部朝向', en: 'All orientations' })}</option>
        </select></label>}
      {batch && <label>{tr({ zh: '范围', en: 'Scope' })}<select className="alg-image-download-select" aria-label={tr({ zh: '范围', en: 'Scope' })} value={custom ? 'custom' : 'all'} onChange={e => setCustom(e.target.value === 'custom')}>
        <option value="all">{tr({ zh: '当前筛选结果', en: 'Current filtered results' })}</option>
        <option value="custom">{tr({ zh: '选择 case', en: 'Select cases' })}</option>
      </select></label>}
      {custom && <>
        <div className="alg-image-download-actions">
          <button className="alg-image-download-action" type="button" onClick={() => setSelected(new Set(snapshot.groups.map(g => g.id)))}>{tr({ zh: '全选', en: 'Select all' })}</button>
          <button className="alg-image-download-action" type="button" onClick={() => setSelected(new Set())}>{tr({ zh: '清空', en: 'Clear' })}</button>
        </div>
        <div className="alg-image-download-cases">
          {snapshot.groups.map(group => <BoolToggle key={group.id} label={group.label} disabled={busy} value={selected.has(group.id)}
            onChange={value => setSelected(previous => { const next = new Set(previous); if (value) next.add(group.id); else next.delete(group.id); return next; })} />)}
        </div>
      </>}
    </fieldset>
    <p>{tr({ zh: `${images.length} 张图片`, en: `${images.length} images` })}{zipped ? ' · ZIP' : ''}</p>
    <div className="alg-image-download-actions">
      <button className="alg-image-download-action" type="button" disabled={busy || !images.length} onClick={() => void run()}>{tr({ zh: '下载', en: 'Download' })}</button>
      {busy && <button className="alg-image-download-action" type="button" onClick={() => controller.current?.abort()}>{tr({ zh: '取消', en: 'Cancel' })}</button>}
    </div>
    <div role="status" aria-live="polite">
      {busy ? tr({ zh: `已生成 ${progress} / ${images.length}，正在准备下载…`, en: `Generated ${progress} / ${images.length}, preparing download…` }) : message}
    </div>
    {failures.length > 0 && <div role="alert"><p>{tr({ zh: '以下图片未能导出：', en: 'These images could not be exported:' })}</p><ul>{failures.map((name, i) => <li key={i}>{name}</li>)}</ul></div>}
  </TimerRoomDialog>;
}
