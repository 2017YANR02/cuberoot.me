'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpCircle, ImagePlus, RotateCcw, ScanLine, SlidersHorizontal } from 'lucide-react';
import Link from '@/components/AppLink';
import HeaderToggles from '@/components/HeaderToggles';
import { InfoTooltip } from '@/components/InfoTooltip/InfoTooltip';
import { VisualCube } from '@/components/VisualCube';
import { tr } from '@/i18n/tr';
import { prepareImageUpload, type PreparedImageUpload } from '@/lib/image-upload';
import { loadAssistantAttachment } from '@/lib/site-assistant-images';
import { FACE_NAMES, faceGrid, faceQuad, homography, manualCorners, project, validQuad, type CubeCorners, type FaceName } from '@/lib/cube-photo/geometry';
import type { CubePhotoDetection, PhotoPixels } from '@/lib/cube-photo/detect';
import { resizePhotoPixels } from '@cuberoot/shared/cube-photo/pixels';
import PhotoResults from './PhotoResults';
import PhotoLoading from './PhotoLoading';
import './cube-photo.css';

interface Photo { src: string; width: number; height: number; pixels: PhotoPixels }
interface Result { detection: CubePhotoDetection }
const LABELS = { top: { zh: '顶面', en: 'Top' }, left: { zh: '左侧面', en: 'Left' }, right: { zh: '右侧面', en: 'Right' } };
const POINT_LABELS = [
  { zh: '顶面后角', en: 'Top back corner' }, { zh: '顶面左角', en: 'Top left corner' },
  { zh: '三面交点', en: 'Three-face junction' }, { zh: '顶面右角', en: 'Top right corner' },
  { zh: '推算左下角', en: 'Estimated bottom left' }, { zh: '推算前下角', en: 'Estimated bottom front' },
  { zh: '推算右下角', en: 'Estimated bottom right' },
];
// Fixed media annotations, intentionally independent of the page's theme.
const COLORS: Record<FaceName, string> = { top: '#facc15', left: '#22d3ee', right: '#fb7185' };

export default function CubePhotoTool() {
  useTranslation();
  const input = useRef<HTMLInputElement>(null), svg = useRef<SVGSVGElement>(null);
  const worker = useRef<Worker | null>(null), generation = useRef(0), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [photo, setPhoto] = useState<Photo | null>(null), [result, setResult] = useState<Result | null>(null);
  const [corners, setCorners] = useState<CubeCorners | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [editing, setEditing] = useState(false), [modified, setModified] = useState(false);
  const drag = useRef<{ index: number; pointer: number } | null>(null);

  function stopWorker() {
    worker.current?.terminate(); worker.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }
  useEffect(() => () => { generation.current++; stopWorker(); }, []);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('attachment');
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return;
    const controller = new AbortController();
    const version = generation.current;
    void loadAssistantAttachment(id, controller.signal).then(image => {
      if (controller.signal.aborted || version !== generation.current) return;
      void upload(undefined, { dataB64: image.data, mime: image.mediaType, previewUrl: `data:${image.mediaType};base64,${image.data}` });
    }).catch(() => {
      if (!controller.signal.aborted && version === generation.current) setError(tr({ zh: '无法读取会话图片，请登录原账号或重新选择照片。', en: 'Could not read the chat image. Sign in to its owner account or choose a photo.' }));
    });
    return () => controller.abort();
  }, []);

  function restoreDetection(data: Result, image: Photo) {
    const found = data.detection.candidates[0];
    const sx = image.width / image.pixels.width, sy = image.height / image.pixels.height;
    setModified(false); setEditing(false);
    setCorners(found ? found.corners.map(p => ({ x: p.x * sx, y: p.y * sy })) as CubeCorners : null);
  }

  function detect(image: Photo, version: number) {
    stopWorker(); setBusy(true); setResult(null); setCorners(null); setError(''); setModified(false);
    try {
      const current = new Worker(new URL('../../lib/cube-photo/detect.worker.ts', import.meta.url), { type: 'module' });
      worker.current = current;
      const fail = () => {
        if (generation.current !== version) return;
        stopWorker(); setBusy(false); setError(tr({ zh: '检测未完成，可以重试或手动标定。', en: 'Detection did not finish. Retry or place the grid manually.' }));
      };
      current.onerror = fail;
      current.onmessage = (event: MessageEvent<Result & { error?: string }>) => {
        if (generation.current !== version) return;
        if (event.data.error) { fail(); return; }
        stopWorker(); setBusy(false); setResult(event.data); restoreDetection(event.data, image);
      };
      timer.current = setTimeout(fail, 20000);
      const copy = new Uint8ClampedArray(image.pixels.data);
      current.postMessage({ width: image.pixels.width, height: image.pixels.height, data: copy }, [copy.buffer]);
    } catch { stopWorker(); setBusy(false); setError(tr({ zh: '浏览器无法启动检测，请重试。', en: 'The browser could not start detection. Please retry.' })); }
  }

  async function upload(file?: File, saved?: PreparedImageUpload) {
    if (!file && !saved) return;
    const version = ++generation.current;
    stopWorker(); setBusy(true); setError(''); setResult(null); setCorners(null); setPhoto(null); setEditing(false);
    if (file && file.size > 20 * 1024 * 1024) {
      setBusy(false); setError(tr({ zh: '请选择不超过 20 MB 的照片。', en: 'Choose a photo smaller than 20 MB.' })); return;
    }
    try {
      const prepared = saved ?? await prepareImageUpload(file!, 1920);
      const image = new Image(); image.src = prepared.previewUrl; await image.decode();
      if (generation.current !== version) return;
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('canvas');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const next: Photo = { src: prepared.previewUrl, width: image.naturalWidth, height: image.naturalHeight,
        pixels: resizePhotoPixels(context.getImageData(0, 0, canvas.width, canvas.height)) };
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

  const selected = result?.detection.candidates[0];
  const hasPhotoWorkspace = busy || photo !== null;
  const failure = error || (photo && result && !selected
    ? tr({ zh: '未找到有足够线索的三面网格。可以换一张照片或手动标定。', en: 'No three-face grid with enough evidence was found. Try another photo or place it manually.' }) : null);
  const unit = photo ? Math.max(photo.width, photo.height) / 900 : 1;
  return <main className="cube-photo-page" onPaste={event => { const file = event.clipboardData.files[0]; if (file) { event.preventDefault(); void upload(file); } }}>
    <header className="cube-photo-header">
      <div><Link href="/alg" prefetch={false}>{tr({ zh: '公式库', en: 'Algorithms' })}</Link><h1>{tr({ zh: '拍照查公式', en: 'Photo algorithm lookup' })}
        <InfoTooltip icon={HelpCircle} iconSize={19} ariaLabel={tr({ zh: '拍摄说明', en: 'Photo requirements' })}
          content={tr({ zh: '标准配色、前两层已复原。拍到完整顶面和两个侧面的顶层，自动识别并检索公式；前两层可以被手遮挡。照片仅在本机处理。', en: 'Use a standard color scheme with F2L solved. Show the full top face and the top row of both side faces to identify the state and find algorithms. Hands may cover the lower layers. Photos stay on your device.' })} />
      </h1></div>
      <HeaderToggles />
    </header>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={event => { void upload(event.target.files?.[0]); event.target.value = ''; }} />
    <div className="cube-photo-toolbar">
      <button className="cube-photo-action cube-photo-primary" onClick={() => input.current?.click()}><ImagePlus size={17} />{tr({ zh: '选择照片', en: 'Choose photo' })}</button>
      {hasPhotoWorkspace && <>
        <button className="cube-photo-action" disabled={busy || !photo} onClick={() => photo && detect(photo, ++generation.current)}><ScanLine size={17} />{tr({ zh: '重新识别', en: 'Detect again' })}</button>
        <button className="cube-photo-action" disabled={busy || !photo} aria-pressed={editing} onClick={() => {
          if (!photo) return;
          if (!corners) { setCorners(manualCorners(photo.width, photo.height)); setModified(true); }
          setEditing(!editing);
        }}><SlidersHorizontal size={17} />{corners || busy ? tr({ zh: '调整角点', en: 'Adjust corners' }) : tr({ zh: '手动标定', en: 'Place grid manually' })}</button>
        {modified && selected && result && photo && <button className="cube-photo-action" onClick={() => restoreDetection(result, photo)}><RotateCcw size={17} />{tr({ zh: '恢复自动结果', en: 'Restore automatic result' })}</button>}
      </>}
    </div>
    {!hasPhotoWorkspace && error && <p className="cube-photo-error" role="alert">{error}</p>}
    <div className={`cube-photo-workspace${hasPhotoWorkspace ? ' has-photo' : ''}`}>
    {/* Photo and overlay share the same coordinate system at every display size. */}
    <div className={`cube-photo-stage${hasPhotoWorkspace ? '' : ' is-empty'}`} onDragOver={event => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); }} onDrop={event => { event.preventDefault(); void upload(event.dataTransfer.files[0]); }}>
      {photo ? <svg ref={svg} xmlns="http://www.w3.org/2000/svg" width={photo.width} height={photo.height} viewBox={`0 0 ${photo.width} ${photo.height}`} role="group" aria-label={tr({ zh: '照片与三面网格叠加', en: 'Photo with three-face grid overlay' })}>
        <image key={photo.src} className="cube-photo-image" href={photo.src} width={photo.width} height={photo.height} />
        {corners && FACE_NAMES.map(face => {
          const quad = faceQuad(corners, face), h = homography(quad), label = h ? project(h, 0.5, face === 'top' ? 0.5 : 0.16) : null;
          return <g key={face}>
            {faceGrid(quad, face).filter(line => !line.inferred).map((line, i) => <g key={i}>
              <line x1={line.a.x} y1={line.a.y} x2={line.b.x} y2={line.b.y} stroke="#111827" strokeOpacity={0.8} strokeWidth={(line.boundary ? 4 : 3) * unit} />
              <line x1={line.a.x} y1={line.a.y} x2={line.b.x} y2={line.b.y} stroke={COLORS[face]} strokeWidth={(line.boundary ? 2.2 : 1.3) * unit} />
            </g>)}
            {label && <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle" fill={COLORS[face]} stroke="#111827" strokeWidth={3 * unit} paintOrder="stroke" fontFamily="sans-serif" fontSize={16 * unit} fontWeight="700">{tr(LABELS[face])}</text>}
          </g>;
        })}
        {corners && editing && corners.map((p, index) => <g key={index} data-handle="true">
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
      </svg> : busy ? <div className="cube-photo-image-placeholder" aria-hidden="true"><ImagePlus size={32} /></div> : <button className="cube-photo-empty" onClick={() => input.current?.click()}>
        <span className="cube-photo-guide">
          <VisualCube local view="pll-iso" algorithm="R U R' U R U2 R'" size={180}
            alt={tr({ zh: '拍摄角度示意：完整顶面和两个侧面的顶层可见', en: 'Camera angle: show the full top face and the top row of both side faces' })} />
          <small>{tr({ zh: '完整顶面 · 两侧顶层', en: 'Full top face · Both side top rows' })}</small>
        </span>
        <span>{tr({ zh: '选择、拖入或粘贴一张照片', en: 'Choose, drop or paste a photo' })}</span><small>JPG · PNG · WebP</small>
      </button>}
    </div>
    {photo && corners ? <PhotoResults pixels={photo.pixels} corners={corners} width={photo.width} height={photo.height} />
      : hasPhotoWorkspace && <section className="cube-photo-results" aria-label={tr({ zh: '状态与公式', en: 'State and algorithms' })} aria-busy={busy}>
        {busy ? <PhotoLoading /> : failure && <p className="cube-photo-error" role="alert">{failure}</p>}
      </section>}
    </div>
  </main>;
}
