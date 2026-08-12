'use client';

import { useMemo, useRef, useState } from 'react';
import { Download, RotateCcw } from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import BoolToggle from '@/components/BoolToggle';
import { ClearButton } from '@/components/ClearButton';
import { useT } from '@/hooks/useT';
import {
  DEFAULT_FTO_EIF_PALETTE,
  FTO_EIF_FACE_KEYS,
  FTO_EIF_FACE_LABELS,
  invertFtoEifAlgorithm,
  parseFtoEifAlgorithm,
  renderFtoEifSvg,
  type FtoEifPalette,
} from '@/lib/fto-eif-image';
import { saveBlob, svgToRasterBlob } from '@/lib/puzzle-image/image-export';

const COLOR_KEYS = [...FTO_EIF_FACE_KEYS, 'stroke'] as const;
type ColorKey = (typeof COLOR_KEYS)[number];

const COLOR_LABELS: Record<ColorKey, string> = {
  ...FTO_EIF_FACE_LABELS,
  stroke: 'Stroke',
};

function pngFilename(algorithm: string): string {
  const stem = algorithm.trim() || 'fto';
  return `${stem.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')}.png`;
}

export default function FtoImageGenerator({
  algorithm,
  onAlgorithmChange,
  inverse,
  onInverseChange,
}: {
  algorithm: string;
  onAlgorithmChange: (algorithm: string) => void;
  inverse: boolean;
  onInverseChange: (inverse: boolean) => void;
}) {
  const t = useT();
  const previewRef = useRef<HTMLDivElement>(null);
  const [palette, setPalette] = useState<FtoEifPalette>({ ...DEFAULT_FTO_EIF_PALETTE });
  const [selected, setSelected] = useState<ColorKey>('f');
  const [hexText, setHexText] = useState(DEFAULT_FTO_EIF_PALETTE.f);
  const [status, setStatus] = useState('');

  const parsed = useMemo(() => parseFtoEifAlgorithm(algorithm), [algorithm]);
  const displayAlgorithm = inverse && parsed.invalid.length === 0
    ? invertFtoEifAlgorithm(algorithm)
    : algorithm;
  const svg = useMemo(
    () => renderFtoEifSvg(displayAlgorithm, palette, { title: t('FTO 公式图片', 'FTO algorithm image') }),
    [displayAlgorithm, palette, t],
  );

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
      const width = Math.max(240, Math.round(previewRef.current?.clientWidth || 400)) * 2;
      const height = Math.round(width * 301.94 / 279.92);
      const blob = await svgToRasterBlob(svg, { width, height, format: 'png', background: null });
      saveBlob(blob, pngFilename(algorithm));
      setStatus(t('已下载 PNG', 'PNG downloaded'));
    } catch {
      setStatus(t('图片生成失败，请重试', 'Could not generate the image. Try again.'));
    }
  };

  return (
    <main className="fto-image-generator">
      <div className="fto-image-heading">
        <h2>{t('FTO 图片生成器', 'FTO Image Generator')}</h2>
        <p>{t('输入任意 EIF 记号的 FTO 公式，预览并下载透明背景 PNG。', 'Preview and download a transparent PNG for any FTO algorithm in EIF notation.')}</p>
      </div>

      <div className="fto-image-layout">
        <section className="fto-image-main" aria-label={t('图片预览与公式', 'Image preview and algorithm')}>
          <div
            ref={previewRef}
            className="fto-image-preview puzzle-art"
            dangerouslySetInnerHTML={{ __html: svg }}
          />

          <label className="fto-image-alg-label" htmlFor="fto-image-alg">
            <span>{t('公式', 'Algorithm')}</span>
            <details className="fto-image-notation">
              <summary>{t('记号', 'Notation')}</summary>
              <div className="fto-image-notation-content">
                <p><strong>{t('基础转动', 'Simple')}</strong> F R L U D Bl Br B</p>
                <p><strong>{t('双层转动', 'Wide')}</strong> Fw Rw Lw Uw Dw Blw Brw Bw</p>
                <p><strong>{t('中层转动', 'Middle')}</strong> Fs Rs Ls Us</p>
                <p><strong>{t('转体', 'Rotation')}</strong> Fo Ro Lo Uo Rt Lt Ft</p>
                <p><strong>{t('组合公式', 'Macros')}</strong> S H</p>
                <p>{t("在转动后加 ' 表示逆时针。", "Add ' after a move for counter-clockwise turns.")}</p>
              </div>
            </details>
          </label>
          <div className="fto-image-alg-input-wrap">
            <input
              id="fto-image-alg"
              value={algorithm}
              onChange={(event) => onAlgorithmChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void download();
                }
              }}
              placeholder={t('在这里输入公式…', 'Type your algorithm here…')}
              spellCheck={false}
              autoComplete="off"
            />
            {algorithm && <ClearButton onClick={() => onAlgorithmChange('')} preserveFocus />}
          </div>
          {parsed.invalid.length > 0 && (
            <p className="fto-image-error" role="alert">
              {t('无法识别：', 'Unsupported: ')}{parsed.invalid.join(' ')}
            </p>
          )}

          <div className="fto-image-actions">
            <BoolToggle
              value={inverse}
              onChange={onInverseChange}
              label={t('逆公式', 'Inverse')}
            />
            <button
              type="button"
              className="fto-image-download"
              onClick={() => void download()}
              disabled={parsed.invalid.length > 0}
            >
              <Download size={16} />
              {t('下载图片', 'Download image')}
            </button>
            <span className="fto-image-status" role="status">{status}</span>
          </div>
        </section>

        <aside className="fto-image-colors" aria-label={t('配色', 'Colors')}>
          <div className="fto-image-colors-heading">
            <h3>{t('配色', 'Colors')}</h3>
            <button type="button" onClick={resetColors}>
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
        </aside>
      </div>
    </main>
  );
}
