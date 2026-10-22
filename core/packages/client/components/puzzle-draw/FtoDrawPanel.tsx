'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronRight, RotateCcw } from '@app-foundation/icons/lucide';
import { HexColorPicker } from 'react-colorful';
import DrawCanvas from './DrawCanvas';
import { DRAW_NEUTRAL_STICKER, FTO_STICKER_PALETTE } from './palettes';
import { FTO_DRAW_ELEMENTS } from '@/lib/fto-draw-elements';
import type { DrawColorDocument, DrawExport } from './types';
import '@/components/puzzle-image/puzzle-image.css';
import BoolToggle from '@/components/BoolToggle';
import { ClearButton } from '@/components/ClearButton';
import { useT } from '@/hooks/useT';
import {
  DEFAULT_FTO_EIF_PALETTE,
  FTO_EIF_FACE_KEYS,
  FTO_EIF_FACE_LABELS,
  invertFtoEifAlgorithm,
  parseFtoEifAlgorithm,
  ftoEifDrawElements,
  type FtoEifPalette,
} from '@/lib/fto-eif-image';
import { saveBlob, svgToRasterBlob } from '@/lib/puzzle-image/image-export';

const COLOR_KEYS = [...FTO_EIF_FACE_KEYS, 'stroke'] as const;
type ColorKey = (typeof COLOR_KEYS)[number];

const COLOR_LABELS: Record<ColorKey, string> = {
  ...FTO_EIF_FACE_LABELS,
  stroke: 'Stroke',
};

const BLANK_COLORS: DrawColorDocument = Object.fromEntries(
  FTO_DRAW_ELEMENTS.filter(element => !element.disableDrawing).map(element => [element.key, DRAW_NEUTRAL_STICKER]),
);

export interface FtoDrawPanelProps {
  algorithm?: string;
  onAlgorithmChange?: (algorithm: string) => void;
  inverse?: boolean;
  onInverseChange?: (inverse: boolean) => void;
  onDocumentChange?: (document: DrawExport | null) => void;
}

export function FtoDrawPanel({
  algorithm: controlledAlgorithm,
  onAlgorithmChange,
  inverse: controlledInverse,
  onInverseChange,
  onDocumentChange,
}: FtoDrawPanelProps) {
  const t = useT();
  const documentRef = useRef<DrawExport | null>(null);
  const [localAlgorithm, setLocalAlgorithm] = useState('');
  const [localInverse, setLocalInverse] = useState(false);
  const algorithm = controlledAlgorithm ?? localAlgorithm;
  const inverse = controlledInverse ?? localInverse;
  const [paint, setPaint] = useState<DrawColorDocument>({});
  const changeAlgorithm = (value: string) => {
    setPaint({});
    setLocalAlgorithm(value);
    onAlgorithmChange?.(value);
  };
  const changeInverse = (value: boolean) => {
    setPaint({});
    setLocalInverse(value);
    onInverseChange?.(value);
  };
  const [palette, setPalette] = useState<FtoEifPalette>({ ...DEFAULT_FTO_EIF_PALETTE });
  const [selected, setSelected] = useState<ColorKey>('f');
  const [hexText, setHexText] = useState(DEFAULT_FTO_EIF_PALETTE.f);
  const [status, setStatus] = useState('');

  const parsed = useMemo(() => parseFtoEifAlgorithm(algorithm), [algorithm]);
  const displayAlgorithm = inverse && parsed.invalid.length === 0
    ? invertFtoEifAlgorithm(algorithm)
    : algorithm;
  const elements = useMemo(() => ftoEifDrawElements(displayAlgorithm, palette), [displayAlgorithm, palette]);
  const valid = parsed.invalid.length === 0;
  const receiveDocument = useCallback((document: DrawExport) => {
    documentRef.current = document;
    onDocumentChange?.(valid ? document : null);
  }, [onDocumentChange, valid]);

  const selectColor = (key: ColorKey) => {
    setSelected(key);
    setHexText(palette[key]);
  };

  const setColor = (key: ColorKey, value: string) => {
    setPalette((current) => ({ ...current, [key]: value.toLowerCase() }));
    if (key === selected) setHexText(value.toLowerCase());
  };

  const commitHex = () => {
    const value = hexText.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(value)) setColor(selected, value);
    else setHexText(palette[selected]);
  };

  const resetColors = () => {
    setPalette({ ...DEFAULT_FTO_EIF_PALETTE });
    setHexText(DEFAULT_FTO_EIF_PALETTE[selected]);
  };


  const download = async () => {
    if (parsed.invalid.length > 0) {
      setStatus(t('请先修正不支持的记号', 'Fix the unsupported notation first.'));
      return;
    }
    setStatus(t('正在生成…', 'Generating…'));
    try {
      const document = documentRef.current;
      if (!document) return;
      const blob = await svgToRasterBlob(document.svg, { width: document.width, height: document.height, format: 'png', background: null });
      saveBlob(blob, `${document.filenameBase}.png`);
      setStatus(t('已下载 PNG', 'PNG downloaded'));
    } catch {
      setStatus(t('图片生成失败，请重试', 'Could not generate the image. Try again.'));
    }
  };

  return (
    <DrawCanvas
      elements={elements}
      viewBox="0 0 279.92 301.94"
      width={400}
      height={432}
      filenameBase={algorithm.trim() || 'fto'}
      presetColors={FTO_STICKER_PALETTE}
      historyStorageKey="sim.draw.fto"
      strokeWidthScale={2}
      strokeColor={palette.stroke}
      colors={paint}
      defaultColors={BLANK_COLORS}
      onColorsChange={setPaint}
      onDocumentChange={receiveDocument}
      controls={<div className="fto-draw-controls">
        <section className="fto-image-settings vc-studio">
          <label className="fto-image-alg-label" htmlFor="fto-image-alg">
            <span>{t('公式', 'Algorithm')}</span>
          </label>
          <div className="fto-image-alg-input-wrap">
            <input
              id="fto-image-alg"
              value={algorithm}
              onChange={(event) => changeAlgorithm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') { event.preventDefault(); void download(); }
              }}
              placeholder={t('在这里输入公式…', 'Type your algorithm here…')}
              spellCheck={false}
              autoComplete="off"
            />
            {algorithm && <ClearButton onClick={() => changeAlgorithm('')} preserveFocus />}
          </div>
          {parsed.invalid.length > 0 && (
            <p className="fto-image-error" role="alert">
              {t('无法识别：', 'Unsupported: ')}{parsed.invalid.join(' ')}
            </p>
          )}

          <div className="fto-image-actions">
            <BoolToggle
              value={inverse}
              onChange={changeInverse}
              label={t('逆公式', 'Inverse')}
            />
          </div>
        </section>

        <section className="fto-image-colors vc-studio" aria-label={t('配色', 'Colors')}>
          <div className="fto-image-colors-heading">
            <h3>{t('配色', 'Colors')}</h3>
            <button type="button" className="vc-btn" onClick={resetColors}>
              <RotateCcw size={14} />
              {t('重置', 'Reset')}
            </button>
          </div>
          <div className="fto-image-color-grid">
            {COLOR_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className={selected === key ? 'is-selected' : ''}
                onClick={() => selectColor(key)}
                aria-pressed={selected === key}
                aria-label={`${COLOR_LABELS[key]} ${t('颜色', 'color')}`}
              >
                <span className="fto-image-color-swatch" style={{ backgroundColor: palette[key] }} />
                <span>{COLOR_LABELS[key]}</span>
              </button>
            ))}
          </div>
          <HexColorPicker
            className="fto-image-picker"
            color={palette[selected]}
            onChange={(value) => setColor(selected, value)}
          />
          <label className="fto-image-hex">
            <span>{COLOR_LABELS[selected]}</span>
            <input
              value={hexText}
              onChange={(event) => setHexText(event.target.value)}
              onBlur={commitHex}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  commitHex();
                  event.currentTarget.blur();
                }
              }}
              spellCheck={false}
              inputMode="text"
              aria-label={t('十六进制颜色', 'Hex color')}
            />
          </label>
        </section>
        <span className="fto-image-status" role="status">{status}</span>
        <details className="fto-image-notation sim-settings-section">
          <summary><ChevronRight className="sim-puzzle-caret" size={14} aria-hidden /><BookOpen size={16} aria-hidden />{t('记号', 'Notation')}</summary>
          <div className="fto-image-notation-content">
            <p><strong>{t('基础转动', 'Simple')}</strong> F R L U D Bl Br B</p>
            <p><strong>{t('双层转动', 'Wide')}</strong> Fw Rw Lw Uw Dw Blw Brw Bw</p>
            <p><strong>{t('中层转动', 'Middle')}</strong> Fs Rs Ls Us</p>
            <p><strong>{t('转体', 'Rotation')}</strong> Fo Ro Lo Uo Rt Lt Ft</p>
            <p><strong>{t('组合公式', 'Macros')}</strong> S H</p>
            <p>{t("在转动后加 ' 表示逆时针。", "Add ' after a move for counter-clockwise turns.")}</p>
          </div>
        </details>
      </div>}
    />
  );
}

export default FtoDrawPanel;
