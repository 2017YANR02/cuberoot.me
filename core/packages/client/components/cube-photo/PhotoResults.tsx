'use client';

import PhotoAlgorithmCards, { Swatch } from './PhotoAlgorithmCards';
import PhotoLoading from './PhotoLoading';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { CompactSelect } from '@/components/CompactSelect';
import { tr } from '@/i18n/tr';
import { COLOR_NAMES, COLOR_ORDER, type CubeColor, type PhotoRecognition } from '@/lib/cube-photo/recognize';
import type { CubeCorners } from '@/lib/cube-photo/geometry';
import type { PhotoPixels } from '@/lib/cube-photo/detect';
import type { PhotoAnalysisInput } from '@cuberoot/shared/cube-photo/analyze';
import type { PhotoWorkers } from '@/lib/cube-photo/workers';
import { photoRecognitionSets, type PhotoAlgResult, type PhotoAlgSet } from '@/lib/cube-photo/lookup';

interface Snapshot { request: PhotoAnalysisInput; recognition?: PhotoRecognition; results: Partial<Record<PhotoAlgSet, PhotoAlgResult>>; done: boolean; error: boolean }
const STATUS = {
  'uncertain-colors': { zh: '标记的色块不确定，请校正颜色或调整网格。', en: 'Check the marked colors or adjust the grid.' },
  ambiguous: { zh: '状态不唯一，请指定照片左侧面的中心颜色。', en: 'The state is ambiguous. Specify the center color of the left face in the photo.' },
  invalid: { zh: '颜色无法组成合法顶层，请核对色块、持方与网格。', en: 'These colors do not form a legal last layer. Check the colors, orientation and grid.' },
};
const POCKET_STATUS = {
  ...STATUS,
  ambiguous: { zh: '状态不唯一，请核对完整顶面和两个完整侧面的颜色。', en: 'The state is ambiguous. Check the colors on the full top and both full side faces.' },
  invalid: { zh: '未找到符合底面同色条件的二阶状态。请确认底面同色，并核对色块与网格。', en: 'No 2×2 state matches a monochrome bottom face. Check that the bottom is one color, then verify the stickers and grid.' },
};

export default function PhotoResults({ workers, pixels, corners, width, height, puzzleSize = 3, pocketStage = 'eg', onRecognized }: { puzzleSize?: 2 | 3; pocketStage?: 'eg' | 'last-slot'; workers: PhotoWorkers; pixels: PhotoPixels; corners: CubeCorners; width: number; height: number; onRecognized?: (recognized: boolean) => void }) {
  useTranslation();
  const [adjustments, setAdjustments] = useState<{ corners: CubeCorners; colors: Record<number, CubeColor>; front?: CubeColor } | null>(null);
  const [retry, setRetry] = useState(0), [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const previousRequest = useRef<{ pixels: PhotoPixels; corners: CubeCorners; retry: number } | null>(null);
  const request = useMemo<PhotoAnalysisInput>(() => ({ pixels, puzzleSize, pocketStage, up: puzzleSize === 2 && adjustments?.corners === corners ? adjustments.front : undefined,
    corners: corners.map(p => ({ x: p.x * pixels.width / width, y: p.y * pixels.height / height })) as CubeCorners,
    corrections: adjustments?.corners === corners ? adjustments.colors : {},
    front: adjustments?.corners === corners ? adjustments.front : undefined,
  }), [pixels, corners, width, height, adjustments, puzzleSize, pocketStage]);
  // Never show an old state's algorithms while new geometry/colors are pending.
  const current = snapshot?.request === request ? snapshot : null;
  const recognition = current?.recognition;
  const recovered = recognition?.status === 'ok' ? recognition.candidates[0] : recognition?.status === 'corners-only' ? recognition.cornerCandidates?.[0] : null;
  const sets = recognition ? photoRecognitionSets(recognition).filter(set => (recognition.status !== 'partial' && puzzleSize !== 2) || current?.results[set]?.status !== 'missing') : [];
  const pending = !current?.done && !current?.error;
  const statusMessages = puzzleSize !== 2 ? STATUS : pocketStage === 'eg' ? POCKET_STATUS : {
    ...POCKET_STATUS,
    invalid: { zh: '未找到底面三格同色的二阶状态，请核对阶段、色块与网格。', en: 'No 2×2 state has three bottom stickers of one color. Check the stage, colors and grid.' },
    'uncertain-colors': { zh: '请核对标记的颜色；若颜色正确，请换个角度拍摄以确定隐藏角块。', en: 'Check the marked colors. If correct, take another angle to determine the hidden corners.' },
    ambiguous: { zh: '三面信息不足以确定状态，请核对颜色并换个角度拍摄。', en: 'These three faces do not determine the state. Check the colors and take another angle.' },
  };
  const recognized = !current?.error && (recognition?.status === 'ok' || recognition?.status === 'corners-only'
    || (recognition?.status === 'partial' && Object.values(current?.results ?? {}).some(result => result?.status === 'found')));

  useEffect(() => { onRecognized?.(recognized); }, [onRecognized, recognized]);

  useEffect(() => {
    let active = true, cancel: (() => void) | undefined;
    const previous = previousRequest.current;
    const debounceCorners = previous?.pixels === pixels && previous.corners !== corners;
    const fresh = retry !== (previous?.retry ?? 0);
    previousRequest.current = { pixels, corners, retry };
    const start = () => {
      setSnapshot({ request, results: {}, done: false, error: false });
      cancel = workers.analyze(request, message => {
        if (!active) return;
        setSnapshot(previous => {
          const base = previous?.request === request ? previous : { request, results: {}, done: false, error: false };
          if (message.type === 'error') return { ...base, done: true, error: true };
          if (message.type === 'state') return { ...base, recognition: message.recognition };
          if (message.type === 'alg') return { ...base, results: { ...base.results, [message.result.set]: message.result } };
          return { ...base, done: true };
        });
      }, fresh);
    };
    // Only continuous corner edits need settling time. First recognition, color
    // corrections and explicit retries start immediately.
    const debounce = debounceCorners ? setTimeout(start, 250) : undefined;
    if (!debounceCorners) start();
    return () => { active = false; clearTimeout(debounce); cancel?.(); };
  }, [request, pixels, corners, retry, workers]);

  const colorOptions = COLOR_ORDER.map(color => ({ value: color, label: <><Swatch color={color} />{tr(COLOR_NAMES[color])}</> }));
  function adjustColor(index: number, color: CubeColor) {
    setAdjustments({ corners, colors: { ...request.corrections, [index]: color }, front: request.front });
  }
  return <section className="cube-photo-results" aria-label={tr({ zh: '状态与公式', en: 'State and algorithms' })} aria-busy={pending}>
    {!recognition && pending ? <PhotoLoading /> : <div className="cube-photo-result-content">
    <div className="cube-photo-result-status" role="status" aria-live="polite">
      {recognition && recognition.status !== 'ok' && recognition.status !== 'corners-only'
        && (recognition.status !== 'partial' || !sets.length) && <p className="cube-photo-error">{tr(statusMessages[recognition.status === 'partial' ? 'uncertain-colors' : recognition.status])}</p>}
    </div>
    <PhotoAlgorithmCards stateKey={recognition?.status === 'partial' ? JSON.stringify(recognition.candidates) : recovered && ('facelet' in recovered ? recovered.facelet : JSON.stringify(recovered)) || undefined} sets={sets} results={current?.results ?? {}} error={current?.error} />
    {current?.error && !sets.length && <p className="cube-photo-error" role="alert">{tr({ zh: '识别未完成，请重试。', en: 'Analysis did not finish. Please retry.' })}</p>}
    {(current?.error || Object.values(current?.results ?? {}).some(r => r?.status === 'error')) && <button className="cube-photo-retry" onClick={() => setRetry(v => v + 1)}><RotateCcw size={15} />{tr({ zh: '重试检索', en: 'Retry lookup' })}</button>}
    {recognition && <details className="cube-photo-details" open={recognition.status !== 'ok' || undefined}>
      <summary><ChevronDown size={16} />{tr({ zh: '颜色校正', en: 'Color correction' })}</summary>
      <div className="cube-photo-color-grids">{(puzzleSize === 2 ? [{ face: 'U', start: 0, count: 4 }, { face: 'F', start: 4, count: 4 }, { face: 'R', start: 8, count: 4 }] : [{ face: 'U', start: 0, count: 9 }, { face: 'F', start: 9, count: 3 }, { face: 'R', start: 12, count: 3 }]).map(({ face, start, count }) => <div key={face}>
        <h4>{face}</h4><div className="cube-photo-color-grid" style={{ gridTemplateColumns: `repeat(${puzzleSize}, 28px)` }}>{recognition.samples.slice(start, start + count).map((sample, offset) => <CompactSelect key={offset}
          className={`cube-photo-color${sample.reliable ? '' : ' is-uncertain'}${sample.corrected ? ' is-corrected' : ''}`}
          value={sample.color} items={colorOptions} ariaLabel={`${face}${offset + 1} ${tr(COLOR_NAMES[sample.color])}${sample.inferred ? tr({ zh: ' · 由唯一状态推导', en: ' · inferred from the unique state' }) : ''}`}
          label={<span title={sample.inferred ? tr({ zh: '由唯一状态推导', en: 'Inferred from the unique state' }) : undefined}><Swatch color={sample.color} /></span>} onChange={color => adjustColor(start + offset, color)} />)}</div>
      </div>)}</div>
      <CompactSelect<CubeColor | 'auto'> showArrow value={request.front ?? 'auto'}
        ariaLabel={tr(puzzleSize === 2 ? { zh: '顶面目标颜色', en: 'Target top color' } : { zh: '照片左侧面中心色', en: 'Center color of the left face in the photo' })}
        label={<>{tr(puzzleSize === 2 ? { zh: '顶面颜色', en: 'Top color' } : { zh: 'F 中心', en: 'F center' })} · {request.front ? tr(COLOR_NAMES[request.front]) : tr({ zh: '自动', en: 'Auto' })}</>}
        items={[{ value: 'auto', label: tr({ zh: '自动', en: 'Auto' }) }, ...colorOptions]}
        onChange={value => setAdjustments({ corners, colors: request.corrections, front: value === 'auto' ? undefined : value })} />
      {(request.front || Object.keys(request.corrections).length > 0) && <button className="cube-photo-action" onClick={() => setAdjustments(null)}>{tr({ zh: '恢复自动取色', en: 'Restore sampled colors' })}</button>}
    </details>}
    </div>}
  </section>;
}
