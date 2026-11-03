'use client';

import PhotoAlgorithmCards, { Swatch, PhotoStateHeading } from './PhotoAlgorithmCards';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { CompactSelect } from '@/components/CompactSelect';
import { tr } from '@/i18n/tr';
import { COLOR_NAMES, COLOR_ORDER, type CubeColor, type PhotoRecognition } from '@/lib/cube-photo/recognize';
import type { CubeCorners } from '@/lib/cube-photo/geometry';
import type { PhotoPixels } from '@/lib/cube-photo/detect';
import type { PhotoAnalysisInput, PhotoAnalysisMessage } from '@/lib/cube-photo/analyze.worker';
import { photoAlgSets, type PhotoAlgResult, type PhotoAlgSet } from '@/lib/cube-photo/lookup';

interface Snapshot { request: PhotoAnalysisInput; recognition?: PhotoRecognition; results: Partial<Record<PhotoAlgSet, PhotoAlgResult>>; done: boolean; error: boolean }
const STATUS = {
  'uncertain-colors': { zh: '标记的色块不确定，请校正颜色或调整网格。', en: 'Check the marked colors or adjust the grid.' },
  ambiguous: { zh: '状态不唯一，请指定照片左侧面的中心颜色。', en: 'The state is ambiguous. Specify the center color of the left face in the photo.' },
  invalid: { zh: '颜色无法组成合法顶层，请核对色块、持方与网格。', en: 'These colors do not form a legal last layer. Check the colors, orientation and grid.' },
};

export default function PhotoResults({ pixels, corners, width, height }: { pixels: PhotoPixels; corners: CubeCorners; width: number; height: number }) {
  useTranslation();
  const [adjustments, setAdjustments] = useState<{ corners: CubeCorners; colors: Record<number, CubeColor>; front?: CubeColor } | null>(null);
  const [retry, setRetry] = useState(0), [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const request = useMemo<PhotoAnalysisInput>(() => ({ pixels,
    corners: corners.map(p => ({ x: p.x * pixels.width / width, y: p.y * pixels.height / height })) as CubeCorners,
    corrections: adjustments?.corners === corners ? adjustments.colors : {},
    front: adjustments?.corners === corners ? adjustments.front : undefined,
  }), [pixels, corners, width, height, adjustments]);
  // Never show an old state's algorithms while new geometry/colors are pending.
  const current = snapshot?.request === request ? snapshot : null;
  const recognition = current?.recognition;
  const recovered = recognition?.status === 'ok' ? recognition.candidates[0] : null;
  const sets = recovered ? photoAlgSets(recovered.facelet) : [];

  useEffect(() => {
    let active = true, worker: Worker | undefined;
    const fail = () => { if (active) setSnapshot(previous => ({ request, recognition: previous?.request === request ? previous.recognition : undefined,
      results: previous?.request === request ? previous.results : {}, done: true, error: true })); worker?.terminate(); };
    const deadline = setTimeout(fail, 30000);
    const debounce = setTimeout(() => {
      try {
        worker = new Worker(new URL('../../lib/cube-photo/analyze.worker.ts', import.meta.url), { type: 'module' });
        setSnapshot({ request, results: {}, done: false, error: false });
        worker.onerror = fail;
        worker.onmessage = (event: MessageEvent<PhotoAnalysisMessage>) => {
          if (!active) return;
          const message = event.data;
          if (message.type === 'error') { fail(); return; }
          if (message.type === 'done') { clearTimeout(deadline); worker?.terminate(); }
          setSnapshot(previous => {
            const base = previous?.request === request ? previous : { request, results: {}, done: false, error: false };
            if (message.type === 'state') return { ...base, recognition: message.recognition };
            if (message.type === 'alg') return { ...base, results: { ...base.results, [message.result.set]: message.result } };
            return { ...base, done: true };
          });
        };
        const data = new Uint8ClampedArray(pixels.data);
        // ImageData.width/height are prototype accessors, not spreadable fields.
        worker.postMessage({ ...request, pixels: { width: pixels.width, height: pixels.height, data } }, [data.buffer]);
      } catch { fail(); }
    }, 250);
    return () => { active = false; clearTimeout(debounce); clearTimeout(deadline); worker?.terminate(); };
  }, [request, pixels, retry]);

  const colorOptions = COLOR_ORDER.map(color => ({ value: color, label: <><Swatch color={color} />{tr(COLOR_NAMES[color])}</> }));
  function adjustColor(index: number, color: CubeColor) {
    setAdjustments({ corners, colors: { ...request.corrections, [index]: color }, front: request.front });
  }
  return <section className="cube-photo-results" aria-label={tr({ zh: '状态与公式', en: 'State and algorithms' })}>
    <div className="cube-photo-result-status" role="status" aria-live="polite">
      {!recognition && !current?.error && tr({ zh: '正在读取色块与补全状态…', en: 'Reading colors and completing the state…' })}
      {recognition && recognition.status !== 'ok' && <p className="cube-photo-error">{tr(STATUS[recognition.status])}</p>}
      {recovered && <PhotoStateHeading state={recovered} />}
    </div>
    <PhotoAlgorithmCards sets={sets} results={current?.results ?? {}} error={current?.error} />
    {current?.error && !sets.length && <p className="cube-photo-error" role="alert">{tr({ zh: '识别未完成，请重试。', en: 'Analysis did not finish. Please retry.' })}</p>}
    {(current?.error || Object.values(current?.results ?? {}).some(r => r?.status === 'error')) && <button className="cube-photo-retry" onClick={() => setRetry(v => v + 1)}><RotateCcw size={15} />{tr({ zh: '重试检索', en: 'Retry lookup' })}</button>}
    {recognition && <details className="cube-photo-details" open={recognition.status !== 'ok' || undefined}>
      <summary><ChevronDown size={16} />{tr({ zh: '色块与持方校正', en: 'Colors and orientation' })}</summary>
      <div className="cube-photo-color-grids">{[{ face: 'U', start: 0, count: 9 }, { face: 'F', start: 9, count: 3 }, { face: 'R', start: 12, count: 3 }].map(({ face, start, count }) => <div key={face}>
        <h4>{face}</h4><div className="cube-photo-color-grid">{recognition.samples.slice(start, start + count).map((sample, offset) => <CompactSelect key={offset}
          className={`cube-photo-color${sample.reliable ? '' : ' is-uncertain'}${sample.corrected ? ' is-corrected' : ''}`}
          value={sample.color} items={colorOptions} ariaLabel={`${face}${offset + 1} ${tr(COLOR_NAMES[sample.color])}`}
          label={<Swatch color={sample.color} />} onChange={color => adjustColor(start + offset, color)} />)}</div>
      </div>)}</div>
      <p className="cube-photo-note">{tr({ zh: 'U 按远到近逐行排列；F、R 按照片从左到右排列。', en: 'U rows run from back to front; F and R run left to right in the photo.' })}</p>
      <CompactSelect<CubeColor | 'auto'> showArrow value={request.front ?? 'auto'}
        ariaLabel={tr({ zh: '照片左侧面中心色', en: 'Center color of the left face in the photo' })}
        label={<>{tr({ zh: 'F 中心', en: 'F center' })} · {request.front ? tr(COLOR_NAMES[request.front]) : tr({ zh: '自动', en: 'Auto' })}</>}
        items={[{ value: 'auto', label: tr({ zh: '自动', en: 'Auto' }) }, ...colorOptions]}
        onChange={value => setAdjustments({ corners, colors: request.corrections, front: value === 'auto' ? undefined : value })} />
      {(request.front || Object.keys(request.corrections).length > 0) && <button onClick={() => setAdjustments(null)}>{tr({ zh: '恢复自动取色', en: 'Restore sampled colors' })}</button>}
      {recovered && <p className="cube-photo-note">{tr({ zh: '合法状态唯一匹配。前两层按已复原补全；不可见中心按标准配色推导。', en: 'One legal state matches. F2L is assumed solved; hidden centers follow the standard color scheme.' })}</p>}
    </details>}
  </section>;
}
