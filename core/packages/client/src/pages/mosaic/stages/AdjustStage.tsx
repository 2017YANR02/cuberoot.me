import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMosaicStore } from '../state/store';
import { applyEffects } from '../engine/effects';
import { applyMethod, drawMosaicToCanvas } from '../engine/render';
import { generatePdf } from '../pdf/composer';
import type { ImageEffects, RGB } from '../state/types';

const FX_RANGES: Record<keyof ImageEffects, { min: number; max: number; step: number; def: number; labelKey: string }> = {
  sharpenAmount: { min: 0, max: 3, step: 0.05, def: 0, labelKey: 'mosaic.fx.sharpen' },
  brightness:    { min: -0.8, max: 0.8, step: 0.05, def: 0, labelKey: 'mosaic.fx.brightness' },
  contrast:      { min: -0.8, max: 0.8, step: 0.05, def: 0, labelKey: 'mosaic.fx.contrast' },
  saturation:    { min: 0, max: 0.9, step: 0.02, def: 0, labelKey: 'mosaic.fx.saturation' },
  vibrance:      { min: -1, max: 1, step: 0.02, def: 0, labelKey: 'mosaic.fx.vibrance' },
  hue:           { min: -1, max: 1, step: 0.02, def: 0, labelKey: 'mosaic.fx.hue' },
  noise:         { min: 0, max: 0.5, step: 0.01, def: 0, labelKey: 'mosaic.fx.noise' },
};

export default function AdjustStage() {
  const { t } = useTranslation();
  const base = useMosaicStore(s => s.baseImageData);
  const selection = useMosaicStore(s => s.selection);
  const origImgSrc = useMosaicStore(s => s.origImgSrc);
  const effects = useMosaicStore(s => s.effects);
  const pdfConfig = useMosaicStore(s => s.pdfConfig);
  const plasticColor = useMosaicStore(s => s.plasticColor);
  const palette = useMosaicStore(s => s.palette);
  const fileName = useMosaicStore(s => s.fileName);
  const cubeDimen = useMosaicStore(s => s.cropConfig.cubeDimen);
  const pdfProgress = useMosaicStore(s => s.pdfProgress);
  const setEffect = useMosaicStore(s => s.setEffect);
  const resetEffects = useMosaicStore(s => s.resetEffects);
  const setPdfConfig = useMosaicStore(s => s.setPdfConfig);
  const setPlasticColor = useMosaicStore(s => s.setPlasticColor);
  const setPdfProgress = useMosaicStore(s => s.setPdfProgress);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [gradRanges, setGradRanges] = useState<number[] | null>(null);
  const [ditherRatio, setDitherRatio] = useState<number>(0);
  const [showFx, setShowFx] = useState(false);
  const [showPdfOpts, setShowPdfOpts] = useState(false);

  // Initialize param inputs from selection
  useEffect(() => {
    if (!selection) return;
    if (selection.chooseSet.method === 'gradient') {
      setGradRanges((selection.opt as number[]).map(Math.ceil));
    } else {
      setDitherRatio(selection.opt as number);
    }
  }, [selection]);

  // Last rendered mosaic ImageData (for PDF export)
  const mosaicRef = useRef<ImageData | null>(null);
  const rafRef = useRef<number | null>(null);

  // Recompute preview whenever inputs change — throttled via rAF so slider drags stay smooth.
  useEffect(() => {
    if (!base || !selection || !canvasRef.current) return;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (!canvasRef.current) return;
      const base2 = applyEffects(base, effects);
      const param: number | number[] = selection.chooseSet.method === 'gradient'
        ? (gradRanges ?? (selection.opt as number[]))
        : ditherRatio;
      const mosaic = applyMethod(base2, selection.chooseSet.palette, selection.chooseSet.method, param);
      mosaicRef.current = mosaic;
      drawMosaicToCanvas(canvasRef.current, mosaic, 'stickers', plasticColor);
      rafRef.current = null;
    });
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [base, selection, effects, gradRanges, ditherRatio, plasticColor]);

  const handleExport = async () => {
    if (!mosaicRef.current || !canvasRef.current) return;
    setPdfProgress(0);
    try {
      await generatePdf({
        mosaic: mosaicRef.current,
        miniatureDataUrl: canvasRef.current.toDataURL('image/png'),
        cubeDimen,
        palette,
        config: pdfConfig,
        fileName: fileName || 'mosaic',
        onProgress: setPdfProgress,
      });
    } finally {
      setPdfProgress(null);
    }
  };

  const downloadHighRes = (heightPx: number) => {
    if (!mosaicRef.current) return;
    const src = mosaicRef.current;
    const outH = heightPx;
    const outW = Math.round(src.width * outH / src.height);
    const step = outW / src.width;
    const cv = document.createElement('canvas');
    cv.width = outW;
    cv.height = outH;
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const d = src.data;
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const i = (x + y * src.width) * 4;
        ctx.fillStyle = `rgb(${d[i]},${d[i + 1]},${d[i + 2]})`;
        ctx.fillRect(x * step, y * step, step, step);
        if (plasticColor) {
          ctx.strokeStyle = plasticColor;
          ctx.lineWidth = 1;
          ctx.strokeRect(x * step, y * step, step, step);
        }
      }
    }
    const url = cv.toDataURL('image/jpeg', 0.92);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName || 'mosaic'}_${outW}x${outH}px.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const totalCubes = useMemo(() => {
    if (!base) return 0;
    return (base.width * base.height) / (cubeDimen * cubeDimen);
  }, [base, cubeDimen]);

  if (!base || !selection) return null;

  const isGradient = selection.chooseSet.method === 'gradient';

  return (
    <div className="mosaic-adjust">
      <div className="mosaic-adjust-preview">
        <div className="mosaic-adjust-preview-row">
          <img src={origImgSrc ?? ''} alt="" />
          <canvas ref={canvasRef} />
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          {totalCubes} {cubeDimen === 1 ? t('mosaic.crop.pixels') : t('mosaic.crop.cubes')}
        </div>
      </div>

      <div className="mosaic-panel">
        <button className="mosaic-btn mosaic-btn-success" onClick={handleExport} disabled={pdfProgress !== null}>
          {pdfProgress === null ? '📄 ' + t('mosaic.adjust.exportPdf') : `⏳ ${Math.round(pdfProgress * 100)}%`}
        </button>
        {pdfProgress !== null && (
          <div className="mosaic-progress"><div style={{ width: `${pdfProgress * 100}%` }} /></div>
        )}

        <h4>{t('mosaic.adjust.params')}</h4>
        {isGradient && gradRanges && (
          <div className="mosaic-range-row">
            {gradRanges.map((v, i) => {
              const col = selection.chooseSet.palette[i] as RGB;
              return (
                <label key={i} style={{ display: 'flex', alignItems: 'center' }}>
                  <span className="mosaic-range-swatch" style={{ background: `rgb(${col[0]},${col[1]},${col[2]})` }} />
                  <input
                    type="number"
                    min={0}
                    max={255}
                    value={v}
                    onChange={e => {
                      const nv = Number(e.target.value);
                      if (!Number.isFinite(nv)) return;
                      const arr = [...gradRanges];
                      arr[i] = nv;
                      setGradRanges(arr);
                    }}
                  />
                </label>
              );
            })}
          </div>
        )}
        {!isGradient && (
          <div className="mosaic-range-row">
            <label>G</label>
            <input
              type="number"
              min={-50}
              max={1500}
              step={0.1}
              value={ditherRatio}
              onChange={e => setDitherRatio(parseFloat(e.target.value) || 0)}
              style={{ width: 80 }}
            />
          </div>
        )}

        <button className="mosaic-btn" onClick={() => setShowFx(v => !v)}>
          🎨 {t('mosaic.adjust.effects')} {showFx ? '▴' : '▾'}
        </button>
        {showFx && (
          <div>
            {(Object.entries(FX_RANGES) as Array<[keyof ImageEffects, typeof FX_RANGES[keyof ImageEffects]]>).map(([k, r]) => (
              <div key={k} className="mosaic-fx-row">
                <span className="fx-label">{t(r.labelKey)}</span>
                <span className="fx-val">{effects[k].toFixed(2)}</span>
                <input
                  type="range"
                  min={r.min}
                  max={r.max}
                  step={r.step}
                  value={effects[k]}
                  onChange={e => setEffect(k, parseFloat(e.target.value))}
                />
                <button className="fx-reset" onClick={() => setEffect(k, r.def as ImageEffects[typeof k])}>↺</button>
              </div>
            ))}
            <button
              className="mosaic-btn"
              style={{ width: '100%', marginTop: 6 }}
              onClick={resetEffects}
            >
              {t('mosaic.adjust.resetEffects')}
            </button>
          </div>
        )}

        <button className="mosaic-btn" onClick={() => setShowPdfOpts(v => !v)}>
          ⚙️ {t('mosaic.adjust.pdfOptions')} {showPdfOpts ? '▴' : '▾'}
        </button>
        {showPdfOpts && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              {t('mosaic.adjust.blockSize')} ({cubeDimen > 1 ? t('mosaic.crop.cubes') : t('mosaic.crop.pixels')}):
            </div>
            <div className="mosaic-range-row">
              <label>W</label>
              <input
                type="number" min={1} max={20}
                value={pdfConfig.blockWidthCubes}
                onChange={e => setPdfConfig({ blockWidthCubes: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })}
              />
              <label>H</label>
              <input
                type="number" min={1} max={20}
                value={pdfConfig.blockHeightCubes}
                onChange={e => setPdfConfig({ blockHeightCubes: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })}
              />
            </div>
            <label className="mosaic-checkbox-row">
              <input
                type="checkbox"
                checked={pdfConfig.bottomToTop}
                onChange={e => setPdfConfig({ bottomToTop: e.target.checked })}
              />
              {t('mosaic.adjust.bottomToTop')}
            </label>
            <label className="mosaic-checkbox-row">
              <input
                type="checkbox"
                checked={pdfConfig.drawLetters}
                onChange={e => {
                  const v = e.target.checked;
                  setPdfConfig({ drawLetters: v, ...(v ? {} : { bwPrinter: false }) });
                }}
              />
              {t('mosaic.adjust.drawLetters')}
            </label>
            <label className="mosaic-checkbox-row">
              <input
                type="checkbox"
                checked={pdfConfig.bwPrinter}
                onChange={e => {
                  const v = e.target.checked;
                  setPdfConfig({ bwPrinter: v, ...(v ? { drawLetters: true } : {}) });
                }}
              />
              {t('mosaic.adjust.bwPrinter')}
            </label>
          </div>
        )}

        <hr />
        <h4>{t('mosaic.adjust.preview')}</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <label>{t('mosaic.adjust.plastic')}</label>
          <select
            value={plasticColor ?? ''}
            onChange={e => setPlasticColor(e.target.value || null)}
            style={{ flex: 1, padding: '4px 6px', borderRadius: 4, border: '1px solid var(--border)' }}
          >
            <option value="">{t('mosaic.adjust.plasticColor')}</option>
            <option value="#eee">{t('mosaic.adjust.plasticWhite')}</option>
            <option value="#111">{t('mosaic.adjust.plasticBlack')}</option>
          </select>
        </div>
        <button className="mosaic-btn" onClick={() => downloadHighRes(4000)}>
          ⬇ {t('mosaic.adjust.downloadPreview', { size: '4K' })}
        </button>
        <button className="mosaic-btn" onClick={() => downloadHighRes(8000)}>
          ⬇ {t('mosaic.adjust.downloadPreview', { size: '8K' })}
        </button>
      </div>
    </div>
  );
}
