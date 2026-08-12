'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import { persistItem } from '@/lib/safe-storage';
import { useT } from '@/hooks/useT';
import {
  DRAW_FONT_COLOR,
  DRAW_NEUTRAL_STICKER,
  DRAW_STICKER_PALETTE,
  DRAW_STROKE_COLOR,
  DRAW_TRANSPARENT,
} from './palettes';
import type {
  DrawCanvasProps,
  DrawColorDocument,
  DrawElement,
  RenderDrawSvgOptions,
} from './types';
import './draw-canvas.css';

export type {
  DrawCanvasProps,
  DrawColorDocument,
  DrawElement,
  DrawExport,
  DrawLine,
  RenderDrawSvgOptions,
} from './types';

const DEFAULT_SIZE = 400;
const MAX_HISTORY = 14;
const DEFAULT_HISTORY_KEY = 'puzzle-draw.color-history.v1';

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function safeDimension(value: number | undefined, fallback = DEFAULT_SIZE): number {
  return Number.isFinite(value) && (value ?? 0) > 0 ? Math.max(1, Math.round(value!)) : fallback;
}

function safeViewBox(viewBox: string, width: number, height: number): string {
  const values = viewBox.trim().split(/[\s,]+/).map(Number);
  if (values.length === 4 && values.every(Number.isFinite) && values[2] > 0 && values[3] > 0) {
    return values.join(' ');
  }
  return `0 0 ${width} ${height}`;
}

function clampStrokeWidth(value: number | undefined): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(10, Math.max(1, Math.round(value!)));
}

function buildTransform(element: DrawElement): string {
  if (element.transform) return element.transform;
  if (element.transformStr) return element.transformStr;
  const parts: string[] = [];
  if (element.translate?.length) parts.push(`translate(${element.translate.join(' ')})`);
  if (element.rotatePoint) {
    const angle = (element.baseRotate ?? 0) + (element.rotate ?? 0);
    parts.push(`rotate(${angle} ${element.rotatePoint})`);
  }
  return parts.join(' ');
}

function defaultFill(element: DrawElement): string {
  if (element.defaultFill) return element.defaultFill;
  if (element.text !== undefined || element.type === 'text' || element.key.includes('fonts')) {
    return DRAW_FONT_COLOR;
  }
  return DRAW_NEUTRAL_STICKER;
}

function elementKind(element: DrawElement): 'path' | 'polygon' | 'line' | 'text' | null {
  if (element.type === 'text' || element.text !== undefined) return 'text';
  if (element.type === 'path' || element.d) return element.d ? 'path' : null;
  if (element.type === 'polygon' || element.points) return element.points ? 'polygon' : null;
  if (element.type === 'line' || element.line) return element.line ? 'line' : null;
  return null;
}

/**
 * Pure, DOM-free emitter used by both the live preview and every downstream
 * download. `data-draw-*` attributes are harmless in exported files and give
 * the React shell stable hit targets without maintaining a second SVG tree.
 */
export function renderDrawSvg(options: RenderDrawSvgOptions): string {
  const width = safeDimension(options.width);
  const height = safeDimension(options.height);
  const viewBox = safeViewBox(options.viewBox, width, height);
  const strokeWidth = clampStrokeWidth(options.strokeWidth);
  const strokeScale = Number.isFinite(options.strokeWidthScale) && (options.strokeWidthScale ?? 0) > 0
    ? options.strokeWidthScale!
    : 1;
  const colors = options.colors ?? {};
  const cellIdByKey = new Map(options.elements.map((element) => [element.key, element.cellId ?? element.key]));

  const body = options.elements.map((element) => {
    const kind = elementKind(element);
    if (!kind) return '';
    const cellId = element.cellId ?? element.key;
    const fill = colors[cellId] ?? defaultFill(element);
    const transform = buildTransform(element);
    const attrs: string[] = [`data-draw-key="${escapeAttr(element.key)}"`];
    if (!element.disableDrawing) {
      attrs.push(`data-draw-cell="${escapeAttr(cellId)}"`);
      if (element.unColorBindKey) {
        const bound = cellIdByKey.get(element.unColorBindKey) ?? element.unColorBindKey;
        attrs.push(`data-draw-unbind="${escapeAttr(bound)}"`);
      }
    }
    if (transform) attrs.push(`transform="${escapeAttr(transform)}"`);
    if (element.disShow) attrs.push('opacity="0"');
    const common = attrs.join(' ');
    const lineWidth = element.disableStrokeWidth ? 0 : strokeWidth * strokeScale;

    if (kind === 'text') {
      const textX = element.textPoint?.[0] ?? 0;
      const textY = element.textPoint?.[1] ?? 0;
      const resetX = element.textRouteResetPoint?.[0] ?? 0;
      const resetY = element.textRouteResetPoint?.[1] ?? 0;
      const angle = (element.baseRotate ?? 0) + (element.rotate ?? 0);
      const textTransform = [
        transform,
        angle ? `rotate(${-angle} ${textX + resetX} ${textY + resetY})` : '',
      ].filter(Boolean).join(' ');
      const textAttrs = attrs
        .filter((attr) => !attr.startsWith('transform='))
        .concat(textTransform ? [`transform="${escapeAttr(textTransform)}"`] : [])
        .join(' ');
      const size = Number.isFinite(element.textSize) && (element.textSize ?? 0) > 0 ? element.textSize! : 5;
      return `<text ${textAttrs} x="${textX}" y="${textY}" fill="${escapeAttr(fill)}" font-size="${size}" text-anchor="start" font-family="sans-serif">${escapeText(element.text ?? '')}</text>`;
    }

    if (kind === 'path') {
      return `<path ${common} d="${escapeAttr(element.d!)}" fill="${escapeAttr(fill)}" stroke="${DRAW_STROKE_COLOR}" stroke-width="${lineWidth}" stroke-linejoin="round"/>`;
    }
    if (kind === 'polygon') {
      return `<polygon ${common} points="${escapeAttr(element.points!)}" fill="${escapeAttr(fill)}" stroke="${DRAW_STROKE_COLOR}" stroke-width="${lineWidth}" stroke-linejoin="round"/>`;
    }
    const line = element.line!;
    return `<line ${common} x1="${line.x1 ?? 0}" y1="${line.y1 ?? 0}" x2="${line.x2 ?? 0}" y2="${line.y2 ?? 0}" fill="none" stroke="${DRAW_STROKE_COLOR}" stroke-width="${lineWidth}" stroke-linejoin="round"/>`;
  }).filter(Boolean).join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" class="puzzle-draw-svg" width="${width}" height="${height}" viewBox="${escapeAttr(viewBox)}" preserveAspectRatio="xMidYMid meet">\n  ${body}\n</svg>`;
}

function cleanColorDocument(value: Readonly<DrawColorDocument> | undefined): DrawColorDocument {
  const out: DrawColorDocument = {};
  if (!value) return out;
  for (const [key, color] of Object.entries(value)) {
    if (key && typeof color === 'string' && color.trim()) out[key] = color.trim();
  }
  return out;
}

function cleanHistory(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !item.trim() || item.length > 64) continue;
    const color = item.trim();
    if (!out.includes(color)) out.push(color);
    if (out.length === MAX_HISTORY) break;
  }
  return out;
}

function invertColor(color: string): string {
  if (color === 'transparent' || color === DRAW_TRANSPARENT) return DRAW_TRANSPARENT;
  const match = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (!match) return color;
  let hex = match[1];
  if (hex.length === 3) hex = hex.split('').map((part) => part + part).join('');
  const alpha = hex.length === 8 ? hex.slice(6) : '';
  const rgb = hex.slice(0, 6);
  const inverted = [0, 2, 4]
    .map((start) => (255 - parseInt(rgb.slice(start, start + 2), 16)).toString(16).padStart(2, '0'))
    .join('');
  return `#${inverted}${alpha}`;
}

function dedupeColors(colors: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of colors) {
    const color = raw.trim();
    const key = color.toLowerCase();
    if (!color || seen.has(key)) continue;
    seen.add(key);
    out.push(color);
  }
  return out;
}

export function cleanFilenameBase(value: string): string {
  return value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '-')
    .replace(/\.[^.]+$/, '')
    .replace(/[. ]+$/g, '')
    .trim();
}

export function DrawCanvas({
  elements,
  viewBox,
  width: widthProp = DEFAULT_SIZE,
  height: heightProp = DEFAULT_SIZE,
  filenameBase = 'puzzle-drawing',
  presetColors = DRAW_STICKER_PALETTE,
  historyStorageKey = DEFAULT_HISTORY_KEY,
  colors: controlledColors,
  defaultColors,
  onColorsChange,
  onDocumentChange,
  controls,
  strokeWidthScale = 1,
  className,
}: DrawCanvasProps) {
  const t = useT();
  const controlId = useId();
  const width = safeDimension(widthProp);
  const height = safeDimension(heightProp);
  const resetColors = useMemo(() => cleanColorDocument(defaultColors), [defaultColors]);
  const [localColors, setLocalColors] = useState<DrawColorDocument>(() => cleanColorDocument(defaultColors));
  const colors = controlledColors ?? localColors;
  const [strokeWidth, setStrokeWidth] = useState(1);
  const [customFilename, setCustomFilename] = useState('');
  const normalizedPresets = useMemo(
    () => dedupeColors([DRAW_TRANSPARENT, ...presetColors]),
    [presetColors],
  );
  const initialColor = normalizedPresets.find((color) => color !== DRAW_TRANSPARENT) ?? DRAW_NEUTRAL_STICKER;
  const [selectedColor, setSelectedColor] = useState(initialColor);
  const [customColor, setCustomColor] = useState('#0046ad');
  const [historyColors, setHistoryColors] = useState<string[]>([]);
  const resolvedFilenameBase = cleanFilenameBase(customFilename)
    || cleanFilenameBase(filenameBase)
    || 'puzzle-drawing';
  const canvasStyle = {
    '--draw-canvas-preview-width': `${width}px`,
  } as CSSProperties;

  useEffect(() => {
    try {
      setHistoryColors(cleanHistory(JSON.parse(localStorage.getItem(historyStorageKey) ?? '[]')));
    } catch {
      setHistoryColors([]);
    }
  }, [historyStorageKey]);

  const svg = useMemo(() => renderDrawSvg({
    elements,
    colors,
    viewBox,
    width,
    height,
    strokeWidth,
    strokeWidthScale,
  }), [elements, colors, viewBox, width, height, strokeWidth, strokeWidthScale]);

  useEffect(() => {
    onDocumentChange?.({ svg, width, height, filenameBase: resolvedFilenameBase });
  }, [svg, width, height, resolvedFilenameBase, onDocumentChange]);

  const commitColors = useCallback((next: DrawColorDocument) => {
    if (controlledColors === undefined) setLocalColors(next);
    onColorsChange?.(next);
  }, [controlledColors, onColorsChange]);

  const paintCell = useCallback((cellId: string, color: string, unbind?: string | null) => {
    if (!cellId) return;
    const next = { ...colors, [cellId]: color };
    if (unbind && unbind !== cellId) next[unbind] = invertColor(color);
    commitColors(next);
  }, [colors, commitColors]);

  const findPaintTarget = (target: EventTarget | null): HTMLElement | SVGElement | null => {
    if (!(target instanceof Element)) return null;
    return target.closest<HTMLElement | SVGElement>('[data-draw-cell]');
  };

  const handlePaint = (event: PointerEvent<HTMLDivElement>) => {
    const target = findPaintTarget(event.target);
    if (!target) return;
    const cellId = target.getAttribute('data-draw-cell');
    if (!cellId) return;
    if (event.button === 2) event.preventDefault();
    paintCell(
      cellId,
      event.button === 2 ? DRAW_TRANSPARENT : selectedColor,
      target.getAttribute('data-draw-unbind'),
    );
  };

  const rememberCustomColor = () => {
    setSelectedColor(customColor);
    const next = cleanHistory([customColor, ...historyColors]);
    setHistoryColors(next);
    persistItem(historyStorageKey, JSON.stringify(next));
  };

  const reset = () => commitColors({ ...resetColors });

  const renderSwatch = (color: string, source: 'preset' | 'history') => {
    const transparent = color === DRAW_TRANSPARENT || color === 'transparent';
    const label = transparent ? t('透明', 'Transparent') : color;
    return (
      <button
        key={`${source}-${color}`}
        type="button"
        className={`draw-canvas-swatch${transparent ? ' is-transparent' : ''}${selectedColor === color ? ' is-active' : ''}`}
        style={transparent ? undefined : { backgroundColor: color }}
        onClick={() => setSelectedColor(color)}
        title={label}
        aria-label={label}
        aria-pressed={selectedColor === color}
      />
    );
  };

  return (
    <div className={`draw-canvas${className ? ` ${className}` : ''}`} style={canvasStyle}>
      <div className="draw-canvas-main">
        <div
          className="draw-canvas-preview"
          onPointerDown={handlePaint}
          onContextMenu={(event) => event.preventDefault()}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        {controls && <div className="draw-canvas-controls">{controls}</div>}
      </div>

      <div className="draw-canvas-tools">
        <div className="draw-canvas-tool-section">
          <label className="draw-canvas-tool-label" htmlFor={`${controlId}-filename`}>
            {t('文件名', 'Filename')}
          </label>
          <input
            id={`${controlId}-filename`}
            className="draw-canvas-text-input"
            type="text"
            value={customFilename}
            placeholder={filenameBase}
            onChange={(event) => setCustomFilename(event.target.value)}
          />
        </div>

        <div className="draw-canvas-tool-section">
          <label className="draw-canvas-tool-label" htmlFor={`${controlId}-stroke`}>
            {t('线宽', 'Line width')}
          </label>
          <div className="draw-canvas-range-row">
            <input
              id={`${controlId}-stroke`}
              type="range"
              min={1}
              max={10}
              step={1}
              value={strokeWidth}
              onChange={(event) => setStrokeWidth(clampStrokeWidth(Number(event.target.value)))}
            />
            <output htmlFor={`${controlId}-stroke`}>{strokeWidth}</output>
          </div>
        </div>

        <div className="draw-canvas-tool-section">
          <div className="draw-canvas-tool-label">{t('颜色', 'Colors')}</div>
          <div className="draw-canvas-swatches">
            {normalizedPresets.map((color) => renderSwatch(color, 'preset'))}
          </div>
        </div>

        {historyColors.length > 0 && (
          <div className="draw-canvas-tool-section">
            <div className="draw-canvas-tool-label">{t('历史颜色', 'Recent colors')}</div>
            <div className="draw-canvas-swatches">
              {historyColors.map((color) => renderSwatch(color, 'history'))}
            </div>
          </div>
        )}

        <div className="draw-canvas-tool-section">
          <label className="draw-canvas-tool-label" htmlFor={`${controlId}-custom-color`}>
            {t('自定义颜色', 'Custom color')}
          </label>
          <div className="draw-canvas-custom-row">
            <input
              id={`${controlId}-custom-color`}
              type="color"
              value={customColor}
              onChange={(event) => setCustomColor(event.target.value)}
              aria-label={t('选择自定义颜色', 'Choose custom color')}
            />
            <button type="button" className="draw-canvas-button" onClick={rememberCustomColor}>
              {t('使用', 'Use')}
            </button>
          </div>
        </div>

        <button type="button" className="draw-canvas-button" onClick={reset}>
          {t('重置颜色', 'Reset colors')}
        </button>
      </div>
    </div>
  );
}

export default DrawCanvas;
