'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Download, ImagePlus, RotateCcw, ScanLine, SlidersHorizontal } from 'lucide-react';
import Link from '@/components/AppLink';
import HeaderToggles from '@/components/HeaderToggles';
import BoolToggle from '@/components/BoolToggle';
import { tr } from '@/i18n/tr';
import { prepareImageUpload } from '@/lib/image-upload';
import { FACE_NAMES, faceGrid, faceQuad, homography, manualCorners, project, validQuad, type CubeCorners, type FaceName } from '@/lib/cube-photo/geometry';
import type { CubePhotoDetection } from '@/lib/cube-photo/detect';
import PhotoResults from './PhotoResults';
import './cube-photo.css';

interface Photo { src: string; width: number; height: number; name: string; pixels: ImageData }
interface Result { detection: CubePhotoDetection; elapsedMs: number }
const LABELS = { top: { zh: '顶面', en: 'Top' }, left: { zh: '左侧面', en: 'Left' }, right: { zh: '右侧面', en: 'Right' } };
const POINT_LABELS = [
  { zh: '顶面后角', en: 'Top back corner' }, { zh: '顶面左角', en: 'Top left corner' },
  { zh: '三面交点', en: 'Three-face junction' }, { zh: '顶面右角', en: 'Top right corner' },
  { zh: '推算左下角', en: 'Estimated bottom left' }, { zh: '推算前下角', en: 'Estimated bottom front' },
  { zh: '推算右下角', en: 'Estimated bottom right' },
];
// Fixed media annotations, intentionally independent of the page's theme.
const COLORS: Record<FaceName, string> = { top: '#facc15', left: '#22d3ee', right: '#fb7185' };

export default function CubePhotoPage() {
  useTranslation();
  const input = useRef<HTMLInputElement>(null), svg = useRef<SVGSVGElement>(null);
  const worker = useRef<Worker | null>(null), generation = useRef(0), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [photo, setPhoto] = useState<Photo | null>(null), [result, setResult] = useState<Result | null>(null);
  const [corners, setCorners] = useState<CubeCorners | null>(null);
  const [candidate, setCandidate] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [overlay, setOverlay] = useState(true), [editing, setEditing] = useState(false), [modified, setModified] = useState(false);
  const [showLower, setShowLower] = useState(true), [showSamples, setShowSamples] = useState(false);
  const drag = useRef<{ index: number; pointer: number } | null>(null);

  function stopWorker() {
    worker.current?.terminate(); worker.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }
  useEffect(() => () => { generation.current++; stopWorker(); }, []);

  function selectCandidate(data: Result, index: number, image: Photo) {
    const found = data.detection.candidates[index];
    const sx = image.width / image.pixels.width, sy = image.height / image.pixels.height;
    setCandidate(index); setModified(false); setEditing(false);
    setCorners(found ? found.corners.map(p => ({ x: p.x * sx, y: p.y * sy })) as CubeCorners : null);
  }

  function detect(image: Photo, version: number) {
    stopWorker(); setBusy(true); setResult(null); setCorners(null); setError(''); setModified(false); setOverlay(true);
    try {
      const current = new Worker(new URL('../../../../lib/cube-photo/detect.worker.ts', import.meta.url), { type: 'module' });
      worker.current = current;
      const fail = () => {
        if (generation.current !== version) return;
        stopWorker(); setBusy(false); setError(tr({ zh: '检测未完成，可以重试或手动标定。', en: 'Detection did not finish. Retry or place the grid manually.' }));
      };
      current.onerror = fail;
      current.onmessage = (event: MessageEvent<Result & { error?: string }>) => {
        if (generation.current !== version) return;
        if (event.data.error) { fail(); return; }
        stopWorker(); setBusy(false); setResult(event.data); selectCandidate(event.data, 0, image);
      };
      timer.current = setTimeout(fail, 20000);
      const copy = new Uint8ClampedArray(image.pixels.data);
      current.postMessage({ width: image.pixels.width, height: image.pixels.height, data: copy }, [copy.buffer]);
    } catch { stopWorker(); setBusy(false); setError(tr({ zh: '浏览器无法启动检测，请重试。', en: 'The browser could not start detection. Please retry.' })); }
  }

  async function upload(file?: File) {
    if (!file) return;
    const version = ++generation.current;
    stopWorker(); setBusy(true); setError(''); setResult(null); setCorners(null); setPhoto(null); setEditing(false);
    if (file.size > 20 * 1024 * 1024) {
      setBusy(false); setError(tr({ zh: '请选择不超过 20 MB 的照片。', en: 'Choose a photo smaller than 20 MB.' })); return;
    }
    try {
      const prepared = await prepareImageUpload(file, 1920);
      const image = new Image(); image.src = prepared.previewUrl; await image.decode();
      if (generation.current !== version) return;
      const scale = Math.min(1, 640 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('canvas');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const next: Photo = { src: prepared.previewUrl, width: image.naturalWidth, height: image.naturalHeight, name: file.name,
        pixels: context.getImageData(0, 0, canvas.width, canvas.height) };
      setPhoto(next); detect(next, version);
    } catch {
      if (generation.current !== version) return;
      setBusy(false); setError(tr({ zh: '无法读取照片。支持 JPG、PNG 和 WebP；HEIC 请先转为 JPG。', en: 'Could not read the photo. Use JPG, PNG or WebP; convert HEIC to JPG first.' }));
    }
  }

  function moveCorner(index: number, x: number, y: number) {
    if (!photo) return;
    setCorners(previous => {
      if (!previous) return previous;
      const next = previous.map(p => ({ ...p })) as CubeCorners;
      next[index] = { x: Math.max(0, Math.min(photo.width, x)), y: Math.max(0, Math.min(photo.height, y)) };
      return FACE_NAMES.every(face => validQuad(faceQuad(next, face), 16)) ? next : previous;
    });
    setModified(true);
  }
  function pointerMove(event: PointerEvent<SVGCircleElement>) {
    if (!drag.current || event.pointerId !== drag.current.pointer || !svg.current) return;
    const matrix = svg.current.getScreenCTM();
    if (!matrix) return;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    moveCorner(drag.current.index, p.x, p.y);
  }

  async function downloadOverlay() {
    if (!photo || !svg.current) return;
    try {
      const source = svg.current.cloneNode(true) as SVGSVGElement;
      source.querySelectorAll('[data-handle]').forEach(el => el.remove());
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(source)], { type: 'image/svg+xml' }));
      try {
        const image = new Image(); image.src = url; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = photo.width; canvas.height = photo.height;
        const context = canvas.getContext('2d'); if (!context) throw new Error('canvas');
        context.drawImage(image, 0, 0);
        const png = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!png) throw new Error('export');
        const pngUrl = URL.createObjectURL(png), a = document.createElement('a');
        a.href = pngUrl; a.download = `${photo.name.replace(/\.[^.]+$/, '')}-grid${modified ? '-adjusted' : '-auto'}.png`; a.click();
        setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
      } finally { URL.revokeObjectURL(url); }
    } catch { setError(tr({ zh: '导出失败，请重试。', en: 'Export failed. Please retry.' })); }
  }
  function saveGeometry() {
    if (!photo || !corners) return;
    const blob = new Blob([JSON.stringify({ version: 1, image: { width: photo.width, height: photo.height },
      mode: modified ? 'manual' : 'automatic', corners, inferredSideRows: [2, 3], automatic: result?.detection ?? null,
      detectionImage: { width: photo.pixels.width, height: photo.pixels.height },
    }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'cube-photo-grid.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const selected = result?.detection.candidates[candidate];
  const unit = photo ? Math.max(photo.width, photo.height) / 900 : 1;
  return <main className="cube-photo-page" onPaste={event => { const file = event.clipboardData.files[0]; if (file) { event.preventDefault(); void upload(file); } }}>
    <header className="cube-photo-header">
      <div><Link href="/dev" prefetch={false}>/dev</Link><h1>{tr({ zh: '魔方照片识别', en: 'Cube photo recognition' })}</h1></div>
      <HeaderToggles />
    </header>
    <p className="cube-photo-description">{tr({ zh: '标准配色、前两层已复原。拍到完整顶面和两个侧面的顶层，自动识别并检索公式；前两层可以被手遮挡。照片仅在本机处理。', en: 'Use a standard color scheme with F2L solved. Show the full top face and the top row of both side faces to identify the state and find algorithms. Hands may cover the lower layers. Photos stay on your device.' })}</p>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={event => { void upload(event.target.files?.[0]); event.target.value = ''; }} />
    <div className="cube-photo-toolbar">
      <button className="cube-photo-primary" onClick={() => input.current?.click()}><ImagePlus size={17} />{tr({ zh: '选择照片', en: 'Choose photo' })}</button>
      {photo && <>
        <button disabled={busy} onClick={() => detect(photo, ++generation.current)}><ScanLine size={17} />{tr({ zh: '重新识别', en: 'Detect again' })}</button>
        <button disabled={busy} aria-pressed={editing} onClick={() => {
          if (!corners) { setCorners(manualCorners(photo.width, photo.height)); setModified(true); }
          setEditing(!editing); setOverlay(true);
        }}><SlidersHorizontal size={17} />{corners ? tr({ zh: '调整角点', en: 'Adjust corners' }) : tr({ zh: '手动标定', en: 'Place grid manually' })}</button>
        {modified && selected && result && <button onClick={() => selectCandidate(result, candidate, photo)}><RotateCcw size={17} />{tr({ zh: '恢复自动结果', en: 'Restore automatic result' })}</button>}
        {corners && <button onClick={() => void downloadOverlay()}><Download size={17} />{tr({ zh: '保存叠加图', en: 'Save overlay' })}</button>}
      </>}
    </div>
    <div className="cube-photo-status" role="status" aria-live="polite">
      {busy ? tr({ zh: '正在识别边界与网格…', en: 'Detecting boundaries and grids…' }) : modified ? tr({ zh: '手动调整结果', en: 'Manually adjusted result' }) : selected ? tr({ zh: '自动候选，待实拍核对', en: 'Automatic candidate — check against the photo' }) : photo && result ? tr({ zh: '未找到有足够线索的三面网格。可以换一张照片或手动标定。', en: 'No three-face grid with enough evidence was found. Try another photo or place it manually.' }) : null}
    </div>
    {error && <p className="cube-photo-error" role="alert">{error}</p>}
    <div className={`cube-photo-workspace${photo && corners ? ' has-results' : ''}`}>
    {/* Photo and overlay are one SVG, so scaling and downloads use identical coordinates. */}
    <div className={`cube-photo-stage${photo ? '' : ' is-empty'}`} onDragOver={event => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); }} onDrop={event => { event.preventDefault(); void upload(event.dataTransfer.files[0]); }}>
      {photo ? <svg ref={svg} xmlns="http://www.w3.org/2000/svg" width={photo.width} height={photo.height} viewBox={`0 0 ${photo.width} ${photo.height}`} role="group" aria-label={tr({ zh: '照片与三面网格叠加', en: 'Photo with three-face grid overlay' })}>
        <image href={photo.src} width={photo.width} height={photo.height} />
        {corners && overlay && FACE_NAMES.map(face => {
          const quad = faceQuad(corners, face), h = homography(quad), label = h ? project(h, 0.5, face === 'top' ? 0.5 : 0.16) : null;
          return <g key={face}>
            {faceGrid(quad, face).filter(line => showLower || !line.inferred).map((line, i) => <g key={i}>
              <line x1={line.a.x} y1={line.a.y} x2={line.b.x} y2={line.b.y} stroke="#111827" strokeOpacity={0.8} strokeWidth={(line.boundary ? 4 : 3) * unit} strokeDasharray={line.inferred ? `${7 * unit} ${5 * unit}` : undefined} />
              <line x1={line.a.x} y1={line.a.y} x2={line.b.x} y2={line.b.y} stroke={COLORS[face]} strokeWidth={(line.boundary ? 2.2 : 1.3) * unit} strokeDasharray={line.inferred ? `${7 * unit} ${5 * unit}` : undefined} />
            </g>)}
            {label && <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle" fill={COLORS[face]} stroke="#111827" strokeWidth={3 * unit} paintOrder="stroke" fontFamily="sans-serif" fontSize={16 * unit} fontWeight="700">{tr(LABELS[face])}</text>}
            {showSamples && h && Array.from({ length: face === 'top' ? 9 : 3 }, (_, i) => {
              const p = project(h, (i % 3 + 0.5) / 3, (Math.floor(i / 3) + 0.5) / 3);
              return <circle key={i} cx={p.x} cy={p.y} r={3 * unit} fill={COLORS[face]} stroke="#111827" strokeWidth={unit} />;
            })}
          </g>;
        })}
        {corners && overlay && editing && corners.map((p, index) => <g key={index} data-handle="true">
          <circle cx={p.x} cy={p.y} r={6 * unit} fill="#ffffff" stroke="#111827" strokeWidth={2 * unit} pointerEvents="none" />
          <circle className="cube-photo-handle" cx={p.x} cy={p.y} r={18 * unit} fill="transparent" role="button" tabIndex={0} aria-label={tr(POINT_LABELS[index])}
            onPointerDown={event => { event.preventDefault(); drag.current = { index, pointer: event.pointerId }; event.currentTarget.setPointerCapture(event.pointerId); }}
            onPointerMove={pointerMove} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
            onKeyDown={event => {
              const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
              const delta = arrows[event.key]; if (!delta) return;
              event.preventDefault(); const step = unit * (event.shiftKey ? 10 : 2); moveCorner(index, p.x + delta[0] * step, p.y + delta[1] * step);
            }} />
        </g>)}
        {corners && overlay && <text x={12 * unit} y={photo.height - 12 * unit} fill="#ffffff" stroke="#111827" strokeWidth={3 * unit} paintOrder="stroke" fontFamily="sans-serif" fontSize={12 * unit}>{modified ? tr({ zh: '手动调整 · 虚线为下两层推算', en: 'Manually adjusted · dashed lower layers are extrapolated' }) : tr({ zh: '自动候选 · 虚线为下两层推算', en: 'Automatic candidate · dashed lower layers are extrapolated' })}</text>}
      </svg> : <button className="cube-photo-empty" onClick={() => input.current?.click()}><ImagePlus size={32} /><span>{tr({ zh: '选择、拖入或粘贴一张照片', en: 'Choose, drop or paste a photo' })}</span><small>JPG · PNG · WebP</small></button>}
    </div>
    {photo && corners && <PhotoResults pixels={photo.pixels} corners={corners} width={photo.width} height={photo.height} />}
    </div>
    {photo && corners && <div className="cube-photo-options">
      <BoolToggle value={overlay} onChange={setOverlay} label={tr({ zh: '显示网格', en: 'Show grid' })} />
      <BoolToggle value={showLower} onChange={setShowLower} label={tr({ zh: '显示下两层推算', en: 'Show extrapolated lower layers' })} />
      <BoolToggle value={showSamples} onChange={setShowSamples} label={tr({ zh: '显示采样点', en: 'Show sample points' })} />
      {FACE_NAMES.map(face => <span className="cube-photo-legend" key={face}><svg width="14" height="4" aria-hidden="true"><path d="M0 2h14" stroke={COLORS[face]} strokeWidth="3" /></svg>{tr(LABELS[face])}</span>)}
    </div>}
    {editing && <p className="cube-photo-note">{tr({ zh: '拖动白色角点；键盘方向键微调，Shift 加速。底部角点控制推算范围。', en: 'Drag the white corners, or use arrow keys (Shift for larger steps). Bottom corners control the extrapolated area.' })}</p>}
    {result && <details className="cube-photo-details"><summary><ChevronDown size={16} />{tr({ zh: '检测详情', en: 'Detection details' })}</summary>
      <p>{tr({ zh: '候选仅按图像线索排序，不代表识别正确率。下两层不参与主要评分。', en: 'Candidates are ranked by image evidence, not a calibrated probability. Lower layers are excluded from the main score.' })}</p>
      <div className="cube-photo-candidates">{result.detection.candidates.map((item, index) => <button key={index} aria-pressed={index === candidate && !modified} onClick={() => photo && selectCandidate(result, index, photo)}>{tr({ zh: '候选', en: 'Candidate' })} {index + 1} · {tr({ zh: '顶面', en: 'top' })} {item.topSupport.toFixed(2)} / {tr({ zh: '侧面', en: 'sides' })} {item.sideSupport.toFixed(2)}</button>)}</div>
      <p>{result.detection.lineCount} {tr({ zh: '条候选直线', en: 'line candidates' })} · {result.elapsedMs} ms</p>
      {corners && <button onClick={saveGeometry}>{tr({ zh: '保存坐标 JSON', en: 'Save coordinates as JSON' })}</button>}
    </details>}
  </main>;
}
