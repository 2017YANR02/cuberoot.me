'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Check, ImagePlus, RotateCcw } from 'lucide-react';
import { CompactSelect } from '@/components/CompactSelect';
import { tr } from '@/i18n/tr';
import { readPhoto, type PhotoImage } from '@/lib/cube-photo/image';
import { PHOTO_FACE_NAMES, PUZZLE_PHOTO_FACES, PUZZLE_PHOTO_SETS, PYRA_VERTICES, initialPhotoBounds, projectPhotoPoint, puzzlePhotoCells, samplePuzzlePhoto, type PhotoPuzzle } from '@/lib/cube-photo/puzzle-geometry';
import type { PuzzlePhotoColors } from '@/lib/cube-photo/puzzle-lookup';
import type { PuzzlePhotoReply } from '@/lib/cube-photo/puzzle.worker';
import type { PhotoCardResult } from '@/lib/cube-photo/card-types';
import { COLOR_NAMES, COLOR_ORDER, type CubeColor } from '@cuberoot/shared/cube-photo/recognize';
import { validQuad, type Point, type Quad } from '@cuberoot/shared/cube-photo/geometry';
import PhotoAlgorithmCards, { Swatch } from './PhotoAlgorithmCards';
import PhotoCamera from './PhotoCamera';
import PhotoLoading from './PhotoLoading';

interface Shot { photo: PhotoImage; bounds: Point[]; corrections: Record<number, CubeColor>; confirmed?: CubeColor[] }
interface Lookup { key: string; results: Record<string, PhotoCardResult>; done: boolean; solved: boolean; error: boolean }
const SIDES: Record<string, string[]> = { F: ['U', 'R', 'D', 'L'], R: ['U', 'B', 'D', 'F'], B: ['U', 'L', 'D', 'R'], L: ['U', 'F', 'D', 'B'], U: ['B', 'R', 'F', 'L'], D: ['F', 'R', 'B', 'L'] };

export default function PuzzlePhotoTool({ puzzle }: { puzzle: PhotoPuzzle }) {
  const faces = PUZZLE_PHOTO_FACES[puzzle];
  const [face, setFace] = useState<string>('F');
  const [shots, setShots] = useState<Record<string, Shot>>({});
  const [busy, setBusy] = useState(false), [camera, setCamera] = useState(false), [error, setError] = useState('');
  const [retry, setRetry] = useState(0), [lookup, setLookup] = useState<Lookup | null>(null);
  const input = useRef<HTMLInputElement>(null), svg = useRef<SVGSVGElement>(null), generation = useRef(0);
  const drag = useRef<{ index: number; pointer: number } | null>(null);
  const shot = shots[face];
  const cells = useMemo(() => puzzlePhotoCells(puzzle, face), [puzzle, face]);
  const samples = useMemo(() => {
    if (!shot) return [];
    const { pixels, width, height } = shot.photo;
    return samplePuzzlePhoto(pixels, shot.bounds.map(p => ({ x: p.x * pixels.width / width, y: p.y * pixels.height / height })), cells, shot.corrections);
  }, [shot, cells]);
  const complete = faces.every(f => shots[f]?.confirmed);
  const colorsKey = complete ? JSON.stringify(Object.fromEntries(faces.map(f => [f, shots[f].confirmed]))) : '';
  const current = lookup?.key === colorsKey && colorsKey ? lookup : null;

  useEffect(() => () => { generation.current++; }, []);
  useEffect(() => {
    if (!colorsKey) return;
    let active = true, worker: Worker | undefined;
    const fail = () => {
      if (!active) return;
      clearTimeout(timeout);
      worker?.terminate();
      setLookup(previous => ({ key: colorsKey, results: previous?.key === colorsKey ? previous.results : {}, done: true, solved: false, error: true }));
    };
    setLookup({ key: colorsKey, results: {}, done: false, solved: false, error: false });
    const timeout = setTimeout(fail, 30000);
    try {
      worker = new Worker(new URL('../../lib/cube-photo/puzzle.worker.ts', import.meta.url), { type: 'module' });
      worker.onerror = fail; worker.onmessageerror = fail;
      worker.onmessage = (event: MessageEvent<PuzzlePhotoReply>) => {
        if (!active) return;
        const message = event.data;
        if (message.type === 'done') clearTimeout(timeout);
        setLookup(previous => {
          const base = previous?.key === colorsKey ? previous : { key: colorsKey, results: {}, done: false, solved: false, error: false };
          return message.type === 'result' ? { ...base, results: { ...base.results, [message.result.set]: message.result } } : { ...base, done: true, solved: message.solved };
        });
      };
      worker.postMessage({ puzzle, colors: JSON.parse(colorsKey) as PuzzlePhotoColors });
    } catch { fail(); }
    return () => { active = false; clearTimeout(timeout); worker?.terminate(); };
  }, [colorsKey, puzzle, retry]);

  function selectFace(next: string) { generation.current++; setBusy(false); setError(''); setFace(next); drag.current = null; }
  async function upload(file?: File) {
    if (!file) return;
    const version = ++generation.current, target = face;
    if (file.size > 20 * 1024 * 1024) { setError(tr({ zh: '请选择不超过 20 MB 的照片。', en: 'Choose a photo smaller than 20 MB.' })); return; }
    setBusy(true); setError('');
    // Replacing a confirmed face invalidates the old algorithms immediately.
    setShots(previous => { const next = { ...previous }; delete next[target]; return next; });
    try {
      const photo = await readPhoto(file);
      if (generation.current !== version) return;
      setShots(previous => ({ ...previous, [target]: { photo, bounds: initialPhotoBounds(puzzle, photo.width, photo.height), corrections: {} } }));
    } catch {
      if (generation.current === version) setError(tr({ zh: '无法读取照片，请使用 JPG、PNG 或 WebP。', en: 'Could not read the photo. Use JPG, PNG or WebP.' }));
    } finally { if (generation.current === version) setBusy(false); }
  }
  function moveCorner(index: number, x: number, y: number) {
    if (!shot) return;
    const bounds = shot.bounds.map((p, i) => i === index ? { x: Math.max(0, Math.min(shot.photo.width - 1, x)), y: Math.max(0, Math.min(shot.photo.height - 1, y)) } : p);
    if (bounds.length === 4 ? !validQuad(bounds as Quad, 16) : (bounds[1].x - bounds[0].x) * (bounds[2].y - bounds[0].y) - (bounds[1].y - bounds[0].y) * (bounds[2].x - bounds[0].x) < 16) return;
    setShots(previous => ({ ...previous, [face]: { ...shot, bounds, corrections: {}, confirmed: undefined } }));
  }
  function confirm() {
    if (!shot) return;
    setShots(previous => ({ ...previous, [face]: { ...shot, confirmed: samples.map(s => s.color) } }));
    const next = faces.find(f => f !== face && !shots[f]?.confirmed);
    if (next) selectFace(next);
  }
  const width = shot?.photo.width ?? 600, height = shot?.photo.height ?? 600;
  const bounds = shot?.bounds ?? initialPhotoBounds(puzzle, width, height), unit = Math.max(width, height) / 600;
  const shownSets = PUZZLE_PHOTO_SETS[puzzle].filter(set => current?.results[set]?.status !== 'missing');
  const found = Object.values(current?.results ?? {}).some(r => r.status === 'found');
  const holding = puzzle === 'pyraminx'
    ? tr({ zh: `正对单面拍摄，三个顶点按 ${PYRA_VERTICES[face].join(' / ')} 对齐。换面只转动整个金字塔。`, en: `Photograph one face straight on, with vertices aligned to ${PYRA_VERTICES[face].join(' / ')}. Reorient the whole puzzle between faces.` })
    : tr({ zh: `照片上边靠 ${SIDES[face][0]}，右边靠 ${SIDES[face][1]}；换面只转动整个魔方。`, en: `The photo's top edge borders ${SIDES[face][0]}, and its right edge borders ${SIDES[face][1]}. Reorient the whole puzzle between faces.` });

  return <section onPaste={event => { const file = event.clipboardData.files[0]; if (file) { event.preventDefault(); event.stopPropagation(); void upload(file); } }}>
    <p className="cube-photo-note">{tr(puzzle === 'sq1'
      ? { zh: 'SQ1：正方体外形、上下层各自同色，拍摄六面后检索 PBL。', en: 'Square-1: aligned cubeshape with monochrome top and bottom. Photograph all six faces for PBL lookup.' }
      : puzzle === 'skewb' ? { zh: '拍摄六面，检索 Sarah’s Advanced。', en: 'Photograph all six faces to look up Sarah’s Advanced.' }
        : { zh: '拍摄四面，检索 L3E / L4E，包含尖块调整。', en: 'Photograph all four faces to look up L3E / L4E, including tip adjustments.' })}</p>
    <div className="cube-photo-toolbar">
      <CompactSelect<string> showArrow value={face} ariaLabel={tr({ zh: '拍摄面', en: 'Face to photograph' })}
        label={`${face} · ${tr(PHOTO_FACE_NAMES[face])}`}
        items={faces.map(f => ({ value: f, label: <>{f} · {tr(PHOTO_FACE_NAMES[f])}{shots[f]?.confirmed && <Check size={14} aria-label={tr({ zh: '已确认', en: 'Confirmed' })} />}</> }))} onChange={selectFace} />
      <span className="cube-photo-note" role="status">{faces.filter(f => shots[f]?.confirmed).length} / {faces.length}</span>
      <button type="button" className="cube-photo-action" disabled={busy} onClick={() => setCamera(true)}><Camera size={17} />{tr({ zh: '拍照', en: 'Take photo' })}</button>
      <button type="button" className="cube-photo-action" disabled={busy} onClick={() => input.current?.click()}><ImagePlus size={17} />{tr({ zh: '选择照片', en: 'Choose photo' })}</button>
      {Object.keys(shots).length > 0 && <button type="button" className="cube-photo-action" onClick={() => { generation.current++; setShots({}); setLookup(null); setBusy(false); setError(''); setFace('F'); }}><RotateCcw size={17} />{tr({ zh: '重新开始', en: 'Start over' })}</button>}
    </div>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={event => { void upload(event.target.files?.[0]); event.target.value = ''; }} />
    <p className="cube-photo-note">{holding}</p>
    {error && <p className="cube-photo-error" role="alert">{error}</p>}
    <div className="cube-photo-workspace puzzle-photo-workspace has-photo">
      <div className="cube-photo-stage" onDragOver={event => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); }} onDrop={event => { event.preventDefault(); void upload(event.dataTransfer.files[0]); }}>
        <svg ref={svg} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={tr({ zh: `${face} 面取色网格`, en: `${face} face sampling grid` })}>
          {shot && <image href={shot.photo.src} width={width} height={height} />}
          {cells.map((cell, index) => {
            const points = cell.map(p => projectPhotoPoint(bounds, p));
            const center = { x: points.reduce((s, p) => s + p.x, 0) / points.length, y: points.reduce((s, p) => s + p.y, 0) / points.length };
            return <g key={index} className="puzzle-photo-cell">
              <polygon points={points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" strokeWidth={2 * unit} />
              <text x={center.x} y={center.y} textAnchor="middle" dominantBaseline="middle" fontSize={14 * unit} strokeWidth={3 * unit} paintOrder="stroke">{index + 1}</text>
            </g>;
          })}
          {bounds.map((point, index) => {
            const next = bounds[(index + 1) % bounds.length];
            const label = puzzle === 'pyraminx' ? { x: point.x, y: point.y - 16 * unit } : {
              x: (point.x + next.x) / 2 + (index === 1 ? 18 : index === 3 ? -18 : 0) * unit,
              y: (point.y + next.y) / 2 + (index === 0 ? -16 : index === 2 ? 22 : 0) * unit,
            };
            return <g key={index}>
            <text className="puzzle-photo-direction" x={label.x} y={label.y} fontSize={15 * unit} textAnchor="middle">{puzzle === 'pyraminx' ? PYRA_VERTICES[face][index] : SIDES[face][index]}</text>
            {shot && <circle className="cube-photo-handle puzzle-photo-corner" cx={point.x} cy={point.y} r={10 * unit} strokeWidth={2 * unit}
              role="button" tabIndex={0} aria-label={tr({ zh: `边界点 ${index + 1}`, en: `Boundary point ${index + 1}` })}
              onPointerDown={event => { event.preventDefault(); drag.current = { index, pointer: event.pointerId }; event.currentTarget.setPointerCapture(event.pointerId); }}
              onPointerMove={event => {
                if (drag.current?.pointer !== event.pointerId || !svg.current) return;
                const matrix = svg.current.getScreenCTM(); if (!matrix) return;
                const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()); moveCorner(index, p.x, p.y);
              }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
              onKeyDown={event => {
                const delta: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
                if (!delta[event.key]) return;
                event.preventDefault(); const [x, y] = delta[event.key], step = unit * (event.shiftKey ? 10 : 2); moveCorner(index, point.x + x * step, point.y + y * step);
              }} />}
          </g>; })}
        </svg>
      </div>
      <div className="cube-photo-results">
        {busy ? <PhotoLoading /> : shot ? <>
          <p className="cube-photo-note">{tr({ zh: '将边界点拖到这面的外角，核对各色块。', en: 'Drag the boundary points to this face’s outer corners, then check the colors.' })}</p>
          <div className="puzzle-photo-colors">{samples.map((sample, index) => <CompactSelect<CubeColor> key={index}
            className={`cube-photo-color${sample.reliable ? '' : ' is-uncertain'}`} value={sample.color}
            label={<>{index + 1} <Swatch color={sample.color} /></>} ariaLabel={`${face} ${index + 1} ${tr(COLOR_NAMES[sample.color])}`}
            items={COLOR_ORDER.map(color => ({ value: color, label: <><Swatch color={color} />{tr(COLOR_NAMES[color])}</> }))}
            onChange={color => setShots(previous => ({ ...previous, [face]: { ...shot, corrections: { ...shot.corrections, [index]: color }, confirmed: undefined } }))} />)}</div>
          {samples.some(s => !s.reliable) && <p className="cube-photo-note">{tr({ zh: '描边色块的取色不确定，请核对后确认。', en: 'Outlined colors are uncertain. Review them before confirming.' })}</p>}
          <button type="button" className="cube-photo-action cube-photo-primary" onClick={confirm}><Check size={17} />{tr({ zh: '确认这面颜色', en: 'Confirm face colors' })}</button>
        </> : <p className="cube-photo-note">{tr({ zh: '拍摄、选择、拖入或粘贴这一面的照片。照片仅在本机处理。', en: 'Take, choose, drop or paste a photo of this face. Photos stay on your device.' })}</p>}
        {complete && <div className="puzzle-photo-matches" aria-live="polite">
          {!current?.done && <PhotoLoading />}
          {current?.solved ? <p>{tr({ zh: '已复原。', en: 'Solved.' })} </p> : <PhotoAlgorithmCards stateKey={colorsKey} sets={shownSets} results={current?.results ?? {}} error={current?.error} />}
          {current?.done && !current.solved && !found && !current.error && !Object.values(current.results).some(r => r.status === 'error') && <p className="cube-photo-note">{tr({ zh: '未找到通过验解的公式。请核对拍摄面的方向、颜色与当前阶段。', en: 'No verified algorithm found. Check face orientation, colors and the current stage.' })}</p>}
          {(current?.error || Object.values(current?.results ?? {}).some(r => r.status === 'error')) && <button type="button" className="cube-photo-retry" onClick={() => setRetry(v => v + 1)}><RotateCcw size={15} />{tr({ zh: '识别未完成，重试检索', en: 'Analysis incomplete. Retry lookup' })}</button>}
          {found && puzzle === 'skewb' && <p className="cube-photo-note">{tr({ zh: '公式采用 Sarah 记号，与公式库一致。', en: 'Algorithms use Sarah notation, as in the library.' })}</p>}
        </div>}
      </div>
    </div>
    {camera && <PhotoCamera onClose={() => setCamera(false)} onChoosePhoto={() => { setCamera(false); input.current?.click(); }} onCapture={file => { setCamera(false); void upload(file); }} />}
  </section>;
}
