'use client';

import {
  type ChangeEvent,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Check, Copy, Download, ExternalLink, FileImage, ImageDown, Magnet, Move, Pencil, Plus, Printer, RotateCcw, Save, Trash2 } from 'lucide-react';
import { parseAsString, useQueryState } from 'nuqs';
import AppLink from '@/components/AppLink';
import BoolToggle from '@/components/BoolToggle';
import SearchInput from '@/components/SearchInput';
import { useT } from '@/hooks/useT';
import {
  DEFAULT_QR_CARD,
  getPlatformQrCard,
  isQrCardTextElement,
  normalizeQrCard,
  QR_CARD_ELEMENTS,
  QR_CARD_FACE_COLORS,
  QR_CARD_FONTS,
  QR_CARD_FRONT_ARTS,
  qrCardFaceletSpots,
  qrCardFormulaRow,
  qrCardArtworkDownload,
  qrCardFontStack,
  qrCardPublicUrl,
  qrCardVisualCubeUrl,
  qrCodeSvgUrl,
  resolveQrCardContent,
  savePlatformQrCard,
  snapQrCardPosition,
  type PlatformQrCard,
  type QrCardCustomText,
  type QrCardElement,
  type QrCardFont,
  type QrCardTextStyle,
} from '@/lib/platform-qr-card';
import {
  assembleQrArtPrompt,
  composeQrArtPrompt,
  FALLBACK_QR_PROMPT_LIBRARY,
  getQrPromptLibrary,
  QR_PROMPT_DIMENSIONS,
  type QrPromptDimension,
  type QrPromptLibrary,
} from '@/lib/platform-qr-prompt';
import type { PlatformEntity } from '@/lib/platform-types';
import { PlatformState } from './PlatformState';
import styles from './PlatformQrCardStudio.module.css';

type EditableElement = QrCardElement | `ct:${string}`;
type Translate = ReturnType<typeof useT>;

const MAX_ART_BYTES = 1_500_000;

const ELEMENT_SIDE: Record<QrCardElement, 'front' | 'back'> = {
  quote: 'front',
  brand: 'front',
  front: 'front',
  backText: 'back',
  term: 'back',
  qr: 'back',
  alg: 'back',
  back: 'back',
};

function codeOf(entity: PlatformEntity): string {
  const code = entity.data?.code;
  return typeof code === 'string' && code.trim() ? code.trim() : entity.id;
}

function cloneCard(card: PlatformQrCard): PlatformQrCard {
  return normalizeQrCard(card);
}

function positionStyle(x = 0, y = 0, scale = 1): CSSProperties {
  return { transform: `translate(calc(-50% + ${x}mm), calc(-50% + ${y}mm)) scale(${scale})` };
}

function shiftStyle(x = 0, y = 0, scale = 1): CSSProperties {
  return { transform: `translate(${x}mm, ${y}mm) scale(${scale})` };
}

function printedTextStyle(style: QrCardTextStyle | undefined, baseSize: number, fallbackColor: string): CSSProperties {
  const size = style?.size ?? 1;
  const strokeWidth = style?.strokeW ?? 0;
  return {
    color: style?.color ?? fallbackColor,
    fontFamily: qrCardFontStack(style?.font),
    fontSize: `${baseSize * size}mm`,
    WebkitTextStroke: strokeWidth ? `${strokeWidth}mm ${style?.stroke ?? '#ffffff'}` : undefined,
    paintOrder: strokeWidth ? 'stroke' : undefined,
  };
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function elementName(t: Translate, key: EditableElement): string {
  if (key.startsWith('ct:')) return t('自定义文字', 'Custom text');
  return {
    quote: t('正面文案', 'Front copy'),
    brand: t('品牌名', 'Brand'),
    front: t('正面艺术图', 'Front artwork'),
    backText: t('背面介绍', 'Back introduction'),
    term: t('短标题', 'Short title'),
    qr: t('二维码', 'QR code'),
    alg: t('公式', 'Algorithm'),
    back: t('背面艺术图', 'Back artwork'),
  }[key as QrCardElement];
}

function fontName(t: Translate, font: QrCardFont): string {
  return {
    sans: t('黑体', 'Sans'),
    serif: t('宋体', 'Serif'),
    kai: t('楷体', 'Kai'),
    round: t('圆体', 'Rounded'),
    mono: t('等宽', 'Mono'),
  }[font];
}

function selectableProps(key: EditableElement, selected: EditableElement | null) {
  return {
    'data-card-el': key,
    'data-selected': selected === key ? 'true' : undefined,
  };
}

function QrCardUnit({
  card,
  code,
  title,
  selected,
  index,
  cropMarks = false,
  onInlineEdit,
}: {
  card: PlatformQrCard;
  code: string;
  title: string;
  selected: EditableElement | null;
  index: number;
  cropMarks?: boolean;
  onInlineEdit?: (key: EditableElement) => void;
}) {
  const t = useT();
  const frontArt = card.frontArt || QR_CARD_FRONT_ARTS[index % QR_CARD_FRONT_ARTS.length].src;
  const backArt = card.backArt;
  const visualCube = qrCardVisualCubeUrl(card.alg);
  const content = resolveQrCardContent(card, title, index);
  const layout = card.layout;
  const textStyles = card.textStyles;
  const artStyle = (side: 'front' | 'back'): CSSProperties => {
    const placement = layout[side];
    const contain = placement?.fit !== 'cover';
    const scale = contain ? placement?.s ?? 1 : Math.max(1, placement?.s ?? 1);
    return {
      left: contain ? '1mm' : '-3mm',
      top: contain ? '1mm' : '-3mm',
      width: contain ? '18mm' : '26mm',
      height: contain ? '38mm' : '46mm',
      objectFit: contain ? 'contain' : 'cover',
      transformOrigin: contain ? '9mm 19mm' : '13mm 23mm',
      transform: `translate(${placement?.x ?? 0}mm, ${placement?.y ?? 0}mm) scale(${scale})`,
    };
  };
  const editableProps = (key: EditableElement) => ({
    ...selectableProps(key, selected),
    onDoubleClick: onInlineEdit ? (event: ReactMouseEvent) => {
      event.stopPropagation();
      onInlineEdit(key);
    } : undefined,
  });

  return (
    <div className={styles.cardUnit} aria-label={`${title} (${code})`}>
      <section className={`${styles.cardFace} ${styles.cardFront}`} aria-label={t('正面', 'Front')}>
        <div className={styles.artClip} aria-hidden>
          <img className={styles.artImage} src={frontArt} alt="" draggable={false} style={artStyle('front')} {...editableProps('front')} />
          <span className={styles.frontShade} />
        </div>
        {card.customTexts.filter((item) => item.side === 'front').map((item) => (
          <p
            key={item.id}
            className={`${styles.printText} ${styles.customText}`}
            style={{ ...positionStyle(item.x, item.y), ...printedTextStyle(item.style, 2.4, '#ffffff') }}
            {...editableProps(`ct:${item.id}`)}
          >{item.text}</p>
        ))}
        {!textStyles.quote?.hidden ? (
          <div
            className={`${styles.printText} ${styles.quote}`}
            style={shiftStyle(layout.quote?.x, layout.quote?.y)}
            {...editableProps('quote')}
          >
            <strong style={printedTextStyle(textStyles.quote, 2.6, '#ffffff')}>{content.quoteMain}</strong>
            {content.quoteSubs.map((line, lineIndex) => <span key={`${line}-${lineIndex}`} style={printedTextStyle(textStyles.quote, 1.4, 'rgba(255,255,255,0.85)')}>{line}</span>)}
          </div>
        ) : null}
        {!textStyles.brand?.hidden ? (
          <p
            className={`${styles.printText} ${styles.brand}`}
            style={{ ...shiftStyle(layout.brand?.x, layout.brand?.y), ...printedTextStyle(textStyles.brand, 1.4, 'rgba(255,255,255,0.92)') }}
            {...editableProps('brand')}
          >{content.brand}</p>
        ) : null}
      </section>

      <section className={`${styles.cardFace} ${styles.cardBack}`} aria-label={t('背面', 'Back')}>
        <div className={styles.artClip} aria-hidden>
          {backArt ? <img className={styles.artImage} src={backArt} alt="" draggable={false} style={artStyle('back')} {...editableProps('back')} /> : (
            <>
              <span className={styles.backGlow} {...editableProps('back')} />
              <span className={styles.formulaPattern}>{Array.from({ length: 16 }, (_, row) => <span key={row}>{qrCardFormulaRow(row)}</span>)}</span>
              <span className={styles.faceletPattern}>{qrCardFaceletSpots().map((spot, spotIndex) => <i key={spotIndex} style={{ left: `${1 + spot.x * 17}mm`, top: `${1 + spot.y * 37}mm`, width: `${spot.size}mm`, height: `${spot.size}mm`, background: QR_CARD_FACE_COLORS[spot.colorIndex], opacity: spot.opacity, transform: `rotate(${spot.rotation}deg)` }} />)}</span>
            </>
          )}
        </div>
        {card.customTexts.filter((item) => item.side === 'back').map((item) => (
          <p
            key={item.id}
            className={`${styles.printText} ${styles.customText}`}
            style={{ ...positionStyle(item.x, item.y), ...printedTextStyle(item.style, 2.4, '#11111a') }}
            {...editableProps(`ct:${item.id}`)}
          >{item.text}</p>
        ))}
        {!textStyles.backText?.hidden ? (
          <div
            className={`${styles.printText} ${styles.backText}`}
            style={shiftStyle(layout.backText?.x, layout.backText?.y)}
            {...editableProps('backText')}
          >
            <strong style={printedTextStyle(textStyles.backText, 1.6, '#1e4acb')}>{content.backMain}</strong>
            {content.backSub ? <span style={printedTextStyle(textStyles.backText, 1.2, '#6b7280')}>{content.backSub}</span> : null}
          </div>
        ) : null}
        <div className={styles.backStack}>
          {content.term && !textStyles.term?.hidden ? (
            <p
              className={`${styles.printText} ${styles.term}`}
              style={{ ...shiftStyle(layout.term?.x, layout.term?.y), ...printedTextStyle(textStyles.term, 1.1, '#1e4acb') }}
              {...editableProps('term')}
            >{content.term}</p>
          ) : null}
          <div
            className={styles.qr}
            style={shiftStyle(layout.qr?.x, layout.qr?.y, layout.qr?.s)}
            {...editableProps('qr')}
          >
            {/* The public SVG endpoint is the canonical QR renderer. */}
            <img src={qrCodeSvgUrl(code)} alt="" draggable={false} />
          </div>
          {content.hasAlgorithm ? (
            <div
              className={styles.algorithm}
              style={shiftStyle(layout.alg?.x, layout.alg?.y)}
              {...editableProps('alg')}
            >
              {visualCube ? <img src={visualCube} alt={t('魔方案例', 'Cube case')} draggable={false} /> : null}
              <span style={printedTextStyle(textStyles.alg, 1.1, '#2a5df4')}>{content.algorithmMoves}</span>
            </div>
          ) : null}
        </div>
        <span className={styles.foldMark} aria-hidden />
      </section>
      {cropMarks ? <div className={styles.cropMarks} aria-hidden>{Array.from({ length: 8 }, (_, mark) => <i key={mark} />)}</div> : null}
    </div>
  );
}

function getPosition(card: PlatformQrCard, key: EditableElement): { x: number; y: number } {
  if (key.startsWith('ct:')) {
    const item = card.customTexts.find((entry) => entry.id === key.slice(3));
    return { x: item?.x ?? 0, y: item?.y ?? 0 };
  }
  const element = key as QrCardElement;
  return { x: card.layout[element]?.x ?? 0, y: card.layout[element]?.y ?? 0 };
}

function getScale(card: PlatformQrCard, key: EditableElement): number {
  if (key.startsWith('ct:')) return card.customTexts.find((entry) => entry.id === key.slice(3))?.style?.size ?? 1;
  if (isQrCardTextElement(key)) return card.textStyles[key]?.size ?? 1;
  return card.layout[key as QrCardElement]?.s ?? 1;
}

function withPosition(card: PlatformQrCard, key: EditableElement, x: number, y: number): PlatformQrCard {
  if (key.startsWith('ct:')) {
    const id = key.slice(3);
    return { ...card, customTexts: card.customTexts.map((item) => item.id === id ? { ...item, x, y } : item) };
  }
  const element = key as QrCardElement;
  return { ...card, layout: { ...card.layout, [element]: { ...card.layout[element], x, y } } };
}

function withScale(card: PlatformQrCard, key: EditableElement, scale: number): PlatformQrCard {
  const next = Math.max(key === 'front' || key === 'back' ? 0.5 : 0.3, Math.min(3, Math.round(scale * 100) / 100));
  if (key.startsWith('ct:')) {
    const id = key.slice(3);
    return {
      ...card,
      customTexts: card.customTexts.map((item) => item.id === id
        ? { ...item, style: { ...item.style, size: next } }
        : item),
    };
  }
  if (isQrCardTextElement(key)) {
    return { ...card, textStyles: { ...card.textStyles, [key]: { ...card.textStyles[key], size: next } } };
  }
  const element = key as QrCardElement;
  return { ...card, layout: { ...card.layout, [element]: { ...card.layout[element], x: card.layout[element]?.x ?? 0, y: card.layout[element]?.y ?? 0, s: next } } };
}

function patchStyle(card: PlatformQrCard, key: EditableElement, patch: Partial<QrCardTextStyle>): PlatformQrCard {
  if (key.startsWith('ct:')) {
    const id = key.slice(3);
    return {
      ...card,
      customTexts: card.customTexts.map((item) => item.id === id ? { ...item, style: { ...item.style, ...patch } } : item),
    };
  }
  if (!isQrCardTextElement(key)) return card;
  return { ...card, textStyles: { ...card.textStyles, [key]: { ...card.textStyles[key], ...patch } } };
}

function patchAlgorithm(card: PlatformQrCard, field: 'name' | 'moves' | 'url', value: string): PlatformQrCard {
  const next = { moves: '', ...card.alg, [field]: value };
  return { ...card, alg: next.moves || next.name || next.url ? next : null };
}

interface Gesture {
  key: EditableElement;
  originX: number;
  originY: number;
  firstX: number;
  firstY: number;
  distance: number;
  scale: number;
  pxPerMm: number;
  baseCenterX: number;
  baseCenterY: number;
  targetsX: number[];
  targetsY: number[];
}

interface InlineEdit {
  key: EditableElement;
  value: string;
}

function ElementInspector({
  card,
  selected,
  update,
}: {
  card: PlatformQrCard;
  selected: EditableElement;
  update: (updater: (card: PlatformQrCard) => PlatformQrCard) => void;
}) {
  const t = useT();
  const customId = selected.startsWith('ct:') ? selected.slice(3) : null;
  const custom = customId ? card.customTexts.find((item) => item.id === customId) : undefined;
  const position = getPosition(card, selected);
  const style = custom?.style ?? (!selected.startsWith('ct:') && isQrCardTextElement(selected) ? card.textStyles[selected] : undefined);
  const isText = Boolean(custom) || (!selected.startsWith('ct:') && isQrCardTextElement(selected));
  const hasScale = isText || selected === 'front' || selected === 'back' || selected === 'qr';

  const setNumber = (field: 'x' | 'y', value: string) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) update((current) => withPosition(current, selected, field === 'x' ? parsed : position.x, field === 'y' ? parsed : position.y));
  };

  const reset = () => update((current) => {
    if (selected.startsWith('ct:')) {
      return {
        ...current,
        customTexts: current.customTexts.map((item) => item.id === customId ? { ...item, x: 0, y: 0, style: {} } : item),
      };
    }
    const layout = { ...current.layout };
    delete layout[selected as QrCardElement];
    if (!isQrCardTextElement(selected)) return { ...current, layout };
    const textStyles = { ...current.textStyles };
    delete textStyles[selected];
    return { ...current, layout, textStyles };
  });

  return (
    <section className={styles.inspector} aria-labelledby="qr-element-title">
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.kicker}>{t('选中元素', 'Selected element')}</span>
          <h3 id="qr-element-title">{elementName(t, selected)}</h3>
        </div>
        <button type="button" className={styles.iconButton} onClick={reset} aria-label={t('重置当前元素', 'Reset selected element')} title={t('重置位置和样式', 'Reset position and style')}>
          <RotateCcw aria-hidden />
        </button>
      </div>
      {custom ? (
        <>
          <label className={styles.fieldWide}>
            <span>{t('文字', 'Text')}</span>
            <textarea className={`${styles.fieldControl} ${styles.fieldTextarea}`} value={custom.text} maxLength={200} rows={3} onChange={(event) => update((current) => ({ ...current, customTexts: current.customTexts.map((item) => item.id === custom.id ? { ...item, text: event.target.value } : item) }))} />
          </label>
          <label>
            <span>{t('卡片面', 'Card side')}</span>
            <select className={styles.fieldControl} value={custom.side} onChange={(event) => update((current) => ({ ...current, customTexts: current.customTexts.map((item) => item.id === custom.id ? { ...item, side: event.target.value === 'front' ? 'front' : 'back' } : item) }))}>
              <option value="front">{t('正面', 'Front')}</option>
              <option value="back">{t('背面', 'Back')}</option>
            </select>
          </label>
        </>
      ) : null}
      <div className={styles.controlGrid}>
        <label>
          <span>{t('水平位置 mm', 'Horizontal position mm')}</span>
          <input className={styles.fieldControl} type="number" min={-40} max={40} step={0.5} value={position.x} onChange={(event) => setNumber('x', event.target.value)} />
        </label>
        <label>
          <span>{t('垂直位置 mm', 'Vertical position mm')}</span>
          <input className={styles.fieldControl} type="number" min={-40} max={40} step={0.5} value={position.y} onChange={(event) => setNumber('y', event.target.value)} />
        </label>
        {hasScale ? (
          <label className={styles.fieldWide}>
            <span>{isText ? t('字号倍率', 'Text scale') : t('缩放倍率', 'Scale')}</span>
            <span className={styles.rangeRow}>
              <input className={styles.fieldRange} type="range" min={selected === 'front' || selected === 'back' ? 0.5 : 0.3} max={3} step={0.05} value={getScale(card, selected)} onChange={(event) => update((current) => withScale(current, selected, Number(event.target.value)))} />
              <output>{getScale(card, selected).toFixed(2)}×</output>
            </span>
          </label>
        ) : null}
        {(selected === 'front' || selected === 'back') ? (
          <label>
            <span>{t('图片填充', 'Image fit')}</span>
            <select className={styles.fieldControl} value={card.layout[selected]?.fit ?? 'contain'} onChange={(event) => update((current) => ({ ...current, layout: { ...current.layout, [selected]: { ...current.layout[selected], x: current.layout[selected]?.x ?? 0, y: current.layout[selected]?.y ?? 0, fit: event.target.value === 'cover' ? 'cover' : undefined } } }))}>
              <option value="contain">{t('完整显示', 'Contain')}</option>
              <option value="cover">{t('铺满裁切', 'Cover')}</option>
            </select>
          </label>
        ) : null}
        {isText ? (
          <>
            <label>
              <span>{t('字体', 'Font')}</span>
              <select className={styles.fieldControl} value={style?.font ?? 'sans'} onChange={(event) => update((current) => patchStyle(current, selected, { font: event.target.value as QrCardFont }))}>
                {QR_CARD_FONTS.map((font) => <option key={font} value={font}>{fontName(t, font)}</option>)}
              </select>
            </label>
            <label>
              <span>{t('文字颜色', 'Text color')}</span>
              <input className={styles.fieldColor} type="color" value={style?.color ?? (ELEMENT_SIDE[selected as QrCardElement] === 'front' || custom?.side === 'front' ? '#ffffff' : '#13203a')} onChange={(event) => update((current) => patchStyle(current, selected, { color: event.target.value }))} />
            </label>
            <label>
              <span>{t('描边颜色', 'Stroke color')}</span>
              <input className={styles.fieldColor} type="color" value={style?.stroke ?? '#ffffff'} onChange={(event) => update((current) => patchStyle(current, selected, { stroke: event.target.value, strokeW: style?.strokeW && style.strokeW > 0 ? style.strokeW : 0.1 }))} />
            </label>
            <label>
              <span>{t('描边强度', 'Stroke width')}</span>
              <input
                className={styles.fieldControl}
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={style?.strokeW ?? 0}
                onChange={(event) => {
                  const strokeW = Number(event.target.value);
                  update((current) => patchStyle(current, selected, strokeW > 0
                    ? { strokeW, stroke: style?.stroke ?? '#ffffff' }
                    : { strokeW: undefined, stroke: undefined }));
                }}
              />
            </label>
            {!custom && isQrCardTextElement(selected) ? (
              <div className={styles.fieldWide}>
                <BoolToggle value={Boolean(style?.hidden)} onChange={(hidden) => update((current) => patchStyle(current, selected, { hidden }))} label={t('隐藏这个元素', 'Hide this element')} />
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}

function PromptComposer({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useT();
  const [library, setLibrary] = useState<QrPromptLibrary>(FALLBACK_QR_PROMPT_LIBRARY);
  const [selected, setSelected] = useState<Partial<Record<QrPromptDimension, string>>>({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void getQrPromptLibrary(controller.signal).then(setLibrary).catch(() => undefined);
    return () => controller.abort();
  }, []);

  const pickBlock = (dimension: QrPromptDimension, id: string) => {
    const next = { ...selected, [dimension]: selected[dimension] === id ? undefined : id };
    setSelected(next);
    onChange(composeQrArtPrompt(next, library.blocks));
  };

  const usePreset = (body: string) => {
    setSelected({});
    onChange(assembleQrArtPrompt(body));
  };

  const copyPrompt = async () => {
    const prompt = value.trim();
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      const area = document.createElement('textarea');
      area.value = prompt;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className={styles.promptComposer} aria-labelledby="qr-prompt-title">
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.kicker}>{t('AI 艺术辅助', 'AI artwork helper')}</span>
          <h3 id="qr-prompt-title">{t('背景图提示词组合器', 'Artwork prompt composer')}</h3>
        </div>
        <AppLink className={styles.detailLink} href="/platform/admin/qr/prompts" target="_blank" rel="noreferrer" prefetch={false}>
          {t('管理提示词', 'Manage prompts')}<ExternalLink aria-hidden />
        </AppLink>
      </div>
      <p className={styles.promptIntro}>{t(
        '按维度各选一项，或直接套用整套模板；生成后仍可手动修改。复制到生图工具，下载竖版无水印原图，再上传到卡片。语录与品牌名由卡片单独叠加。',
        'Choose one block from each dimension or use a complete preset, then edit freely. Copy it into an image generator, download a vertical unwatermarked image, and upload it to the card. Copy and brand are overlaid separately.',
      )}</p>
      <div className={styles.promptWorkbench}>
        <div className={styles.promptBlocks}>
          {QR_PROMPT_DIMENSIONS.map((dimension) => {
            const options = library.blocks.filter((block) => block.dimension === dimension.key);
            if (!options.length) return null;
            return (
              <div key={dimension.key} className={styles.promptDimension}>
                <div><strong>{t(dimension.zh, dimension.en)}</strong><span>{t(dimension.hintZh, dimension.hintEn)}</span></div>
                <div className={styles.promptChoices}>
                  {options.map((block) => (
                    <button
                      className={styles.promptChoice}
                      key={block.id}
                      type="button"
                      aria-pressed={selected[dimension.key] === block.id}
                      title={block.body}
                      onClick={() => pickBlock(dimension.key, block.id)}
                    >{t(block.nameZh, block.nameEn)}</button>
                  ))}
                </div>
              </div>
            );
          })}
          <details className={styles.promptPresets}>
            <summary>{t('整套现成模板', 'Complete presets')}</summary>
            <div className={styles.promptChoices}>
              {library.presets.map((preset) => (
                <button className={styles.promptChoice} key={preset.id} type="button" title={preset.body} onClick={() => usePreset(preset.body)}>{t(preset.nameZh, preset.nameEn)}</button>
              ))}
            </div>
          </details>
        </div>
        <div className={styles.promptEditor}>
          <label>
            <span>{t('可编辑提示词', 'Editable prompt')}</span>
            <textarea
              className={styles.promptTextarea}
              value={value}
              maxLength={4000}
              rows={12}
              placeholder={t('从左边选择积木或模板，也可以直接在这里编写。', 'Choose blocks or a preset on the left, or write directly here.')}
              onChange={(event) => onChange(event.target.value)}
            />
          </label>
          <div className={styles.promptActions}>
            <button type="button" className="platform-button platform-button-primary" disabled={!value.trim()} onClick={() => { void copyPrompt(); }}>
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}{copied ? t('已复制', 'Copied') : t('复制提示词', 'Copy prompt')}
            </button>
            {value.trim() ? <button type="button" className={styles.textButton} onClick={() => { setSelected({}); onChange(''); }}>{t('清空', 'Clear')}</button> : null}
          </div>
          <p>{t('提示词会随“保存设计”写入当前二维码，方便下次复刻或微调。', 'The prompt is stored with this QR code when you save the design, so it can be reproduced or refined later.')}</p>
        </div>
      </div>
    </section>
  );
}

export function PlatformQrCardStudio({
  entities,
  query,
  onQueryChange,
}: {
  entities: PlatformEntity[];
  query: string;
  onQueryChange: (value: string) => void;
}) {
  const t = useT();
  const [codesParam, setCodes] = useQueryState('codes', parseAsString);
  const [edit, setEdit] = useQueryState('edit', parseAsString);
  const [cards, setCards] = useState<Record<string, PlatformQrCard>>({});
  const [drafts, setDrafts] = useState<Record<string, PlatformQrCard>>({});
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(() => new Set());
  const [loadingIds, setLoadingIds] = useState<Set<string>>(() => new Set());
  const [loadErrors, setLoadErrors] = useState<Record<string, string>>({});
  const [loadNonce, setLoadNonce] = useState(0);
  const [selectedElement, setSelectedElement] = useState<EditableElement>('quote');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const [artError, setArtError] = useState('');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({});
  const [inlineEdit, setInlineEdit] = useState<InlineEdit | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);

  const usableEntities = useMemo(() => entities.filter((entity) => codeOf(entity)), [entities]);
  const allCodes = useMemo(() => usableEntities.map(codeOf), [usableEntities]);
  const requestedCodes = useMemo(() => {
    if (codesParam == null || codesParam === '') return new Set(allCodes);
    if (codesParam === '-') return new Set<string>();
    const valid = new Set(allCodes.map((code) => code.toLowerCase()));
    return new Set(codesParam.split(',').map((code) => code.trim()).filter((code) => valid.has(code.toLowerCase())));
  }, [allCodes, codesParam]);
  const selectedEntities = useMemo(() => usableEntities.filter((entity) => {
    const code = codeOf(entity);
    return [...requestedCodes].some((selectedCode) => selectedCode.toLowerCase() === code.toLowerCase());
  }), [requestedCodes, usableEntities]);
  const visibleEntities = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return usableEntities;
    return usableEntities.filter((entity) => `${codeOf(entity)} ${entity.title} ${entity.summary ?? ''}`.toLocaleLowerCase().includes(needle));
  }, [query, usableEntities]);
  const activeEntity = useMemo(() => {
    if (edit) return usableEntities.find((entity) => entity.id === edit || codeOf(entity).toLowerCase() === edit.toLowerCase())
      ?? selectedEntities[0]
      ?? usableEntities[0];
    return selectedEntities[0] ?? usableEntities[0];
  }, [edit, selectedEntities, usableEntities]);
  const activeId = activeEntity?.id;
  const activeCode = activeEntity ? codeOf(activeEntity) : '';
  const activeCard = activeId ? drafts[activeId] ?? cards[activeId] : undefined;
  const wantedIds = useMemo(() => Array.from(new Set([...selectedEntities.map((item) => item.id), ...(activeId ? [activeId] : [])])), [activeId, selectedEntities]);
  const wantedKey = wantedIds.join('\u0000');

  useEffect(() => {
    const missing = wantedIds.filter((id) => !cards[id] && !loadingIds.has(id));
    if (!missing.length) return;
    const controller = new AbortController();
    setLoadingIds((current) => new Set([...current, ...missing]));
    void Promise.allSettled(missing.map((id) => getPlatformQrCard(id, controller.signal))).then((results) => {
      if (controller.signal.aborted) return;
      setCards((current) => {
        const next = { ...current };
        results.forEach((result, index) => { if (result.status === 'fulfilled') next[missing[index]] = result.value.card; });
        return next;
      });
      setDrafts((current) => {
        const next = { ...current };
        results.forEach((result, index) => { if (result.status === 'fulfilled' && !next[missing[index]]) next[missing[index]] = cloneCard(result.value.card); });
        return next;
      });
      setLoadErrors((current) => {
        const next = { ...current };
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') delete next[missing[index]];
          else next[missing[index]] = result.reason instanceof Error ? result.reason.message : String(result.reason);
        });
        return next;
      });
    }).finally(() => {
      if (!controller.signal.aborted) setLoadingIds((current) => {
        const next = new Set(current);
        missing.forEach((id) => next.delete(id));
        return next;
      });
    });
    return () => controller.abort();
    // wantedKey and loadNonce deliberately retrigger card hydration without duplicating loaded cards.
  }, [cards, loadNonce, wantedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedElement.startsWith('ct:')) return;
    if (!activeCard?.customTexts.some((item) => item.id === selectedElement.slice(3))) setSelectedElement('quote');
  }, [activeCard, selectedElement]);

  if (!usableEntities.length) {
    return (
      <div className={styles.empty}>
        <PlatformState kind="empty" message={t('还没有可制作卡片的二维码。先创建一枚二维码，再回到这里设计和打印。', 'There are no QR codes to turn into cards yet. Create a QR code, then return here to design and print it.')} />
        <AppLink className="platform-button platform-button-primary" href="/platform/admin/qr" prefetch={false}>{t('创建二维码', 'Create a QR code')}</AppLink>
      </div>
    );
  }

  const updateDraft = (updater: (card: PlatformQrCard) => PlatformQrCard) => {
    if (!activeId) return;
    setDrafts((current) => ({ ...current, [activeId]: updater(current[activeId] ?? cards[activeId] ?? DEFAULT_QR_CARD) }));
    setDirtyIds((current) => new Set(current).add(activeId));
    setSaveState('idle');
    setSaveMessage('');
  };

  const setSelectedCodes = (next: Set<string>) => {
    if (next.size === allCodes.length) void setCodes(null);
    else if (next.size === 0) void setCodes('-');
    else void setCodes(allCodes.filter((code) => next.has(code)).join(','));
  };

  const toggleCode = (code: string, value: boolean) => {
    const next = new Set(selectedEntities.map(codeOf));
    if (value) next.add(code);
    else next.delete(code);
    setSelectedCodes(next);
  };

  const save = async (): Promise<boolean> => {
    if (!activeId || !activeCard) return false;
    setSaveState('saving');
    setSaveMessage('');
    try {
      const result = await savePlatformQrCard(activeId, activeCard);
      setCards((current) => ({ ...current, [activeId]: result.card }));
      setDrafts((current) => ({ ...current, [activeId]: cloneCard(result.card) }));
      setDirtyIds((current) => {
        const next = new Set(current);
        next.delete(activeId);
        return next;
      });
      setSaveState('saved');
      setSaveMessage(t('已保存这枚二维码的卡片设计。', 'This QR card design has been saved.'));
      return true;
    } catch (reason) {
      setSaveState('error');
      setSaveMessage(reason instanceof Error ? reason.message : t('保存失败。', 'Save failed.'));
      return false;
    }
  };

  const addCustomText = () => {
    if (!activeCard || activeCard.customTexts.length >= 30) return;
    const id = crypto.randomUUID().slice(0, 12);
    const item: QrCardCustomText = { id, side: 'front', text: t('新文字', 'New text'), x: 0, y: 0 };
    updateDraft((card) => ({ ...card, customTexts: [...card.customTexts, item] }));
    setSelectedElement(`ct:${id}`);
  };

  const deleteCustomText = (id: string) => {
    updateDraft((card) => ({ ...card, customTexts: card.customTexts.filter((item) => item.id !== id) }));
    setSelectedElement('quote');
  };

  const uploadArt = (side: 'front' | 'back') => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > MAX_ART_BYTES) {
      setArtError(t('PNG、JPEG 或 WebP 图片不能超过 1.5 MB。', 'PNG, JPEG, or WebP artwork must be no larger than 1.5 MB.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      updateDraft((card) => ({ ...card, [side === 'front' ? 'frontArt' : 'backArt']: reader.result }));
      setSelectedElement(side);
      setArtError('');
    };
    reader.onerror = () => setArtError(t('无法读取这张图片。', 'This image could not be read.'));
    reader.readAsDataURL(file);
  };

  const downloadArtworkPng = async (side: 'front' | 'back') => {
    if (!activeCard) return;
    const download = qrCardArtworkDownload(activeCard, side, activeCode, activeIndex);
    if (!download) return;
    try {
      const image = new Image();
      image.decoding = 'async';
      image.src = download.source;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('canvas');
      context.drawImage(image, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('blob');
      triggerBrowserDownload(blob, download.filename);
    } catch {
      setArtError(t('无法导出这张艺术图。', 'This artwork could not be exported.'));
    }
  };

  const downloadQrOnly = async () => {
    if (!activeCode) return;
    try {
      const response = await fetch(qrCodeSvgUrl(activeCode));
      if (!response.ok) throw new Error(String(response.status));
      triggerBrowserDownload(await response.blob(), `qr-${activeCode}.svg`);
    } catch {
      setSaveState('error');
      setSaveMessage(t('无法下载二维码 SVG。', 'The QR SVG could not be downloaded.'));
    }
  };

  const openInlineEdit = (key: EditableElement) => {
    if (!activeCard) return;
    let value = '';
    if (key.startsWith('ct:')) value = activeCard.customTexts.find((item) => item.id === key.slice(3))?.text ?? '';
    else if (key === 'quote') value = activeCard.quote;
    else if (key === 'brand') value = activeCard.brand;
    else if (key === 'backText') value = activeCard.intro;
    else if (key === 'term') value = activeCard.term;
    else if (key === 'alg') value = activeCard.alg?.moves ?? '';
    else return;
    setSelectedElement(key);
    setInlineEdit({ key, value });
  };

  const commitInlineEdit = () => {
    if (!inlineEdit) return;
    const { key, value } = inlineEdit;
    if (key.startsWith('ct:')) {
      const id = key.slice(3);
      updateDraft((card) => ({ ...card, customTexts: card.customTexts.map((item) => item.id === id ? { ...item, text: value.slice(0, 200) } : item) }));
    } else if (key === 'quote') updateDraft((card) => ({ ...card, quote: value.slice(0, 500) }));
    else if (key === 'brand') updateDraft((card) => ({ ...card, brand: value.slice(0, 160) }));
    else if (key === 'backText') updateDraft((card) => ({ ...card, intro: value.slice(0, 1000) }));
    else if (key === 'term') updateDraft((card) => ({ ...card, term: value.slice(0, 160) }));
    else if (key === 'alg') updateDraft((card) => patchAlgorithm(card, 'moves', value.slice(0, 500)));
    setInlineEdit(null);
  };

  const beginGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = (event.target as Element).closest<HTMLElement>('[data-card-el]');
    const rawKey = target?.dataset.cardEl;
    if (!rawKey) return;
    const key = rawKey as EditableElement;
    setSelectedElement(key);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    const position = getPosition(activeCard ?? DEFAULT_QR_CARD, key);
    const points = [...pointers.current.values()];
    const cardNode = event.currentTarget.querySelector<HTMLElement>(`.${styles.cardUnit}`);
    const cardRect = cardNode?.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const pxPerMm = (cardRect?.width ?? 1) / 40;
    const baseCenterX = targetRect.left + targetRect.width / 2 - position.x * pxPerMm;
    const baseCenterY = targetRect.top + targetRect.height / 2 - position.y * pxPerMm;
    const targetsX = [baseCenterX];
    const targetsY = [baseCenterY];
    if (cardRect) {
      targetsX.push(cardRect.left + cardRect.width / 4, cardRect.left + cardRect.width * 3 / 4);
      targetsY.push(cardRect.top + cardRect.height / 2);
    }
    cardNode?.querySelectorAll<HTMLElement>('[data-card-el]').forEach((other) => {
      if (other === target || other.contains(target) || target.contains(other)) return;
      const rect = other.getBoundingClientRect();
      targetsX.push(rect.left + rect.width / 2);
      targetsY.push(rect.top + rect.height / 2);
    });
    gesture.current = {
      key,
      originX: position.x,
      originY: position.y,
      firstX: event.clientX,
      firstY: event.clientY,
      distance: points.length > 1 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0,
      scale: getScale(activeCard ?? DEFAULT_QR_CARD, key),
      pxPerMm,
      baseCenterX,
      baseCenterY,
      targetsX,
      targetsY,
    };
  };

  const moveGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId) || !gesture.current || !activeCard) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.current.values()];
    const currentGesture = gesture.current;
    if (points.length > 1 && currentGesture.distance > 0) {
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      updateDraft((card) => withScale(card, currentGesture.key, currentGesture.scale * distance / currentGesture.distance));
      setGuides({});
      return;
    }
    const deltaX = (event.clientX - currentGesture.firstX) / currentGesture.pxPerMm;
    const deltaY = (event.clientY - currentGesture.firstY) / currentGesture.pxPerMm;
    const snapped = snapQrCardPosition({
      originX: currentGesture.originX,
      originY: currentGesture.originY,
      deltaX,
      deltaY,
      baseCenterX: currentGesture.baseCenterX,
      baseCenterY: currentGesture.baseCenterY,
      targetsX: currentGesture.targetsX,
      targetsY: currentGesture.targetsY,
      pxPerMm: currentGesture.pxPerMm,
      enabled: snapEnabled,
      altKey: event.altKey,
    });
    const stageRect = event.currentTarget.getBoundingClientRect();
    setGuides({
      x: snapped.guideX == null ? undefined : snapped.guideX - stageRect.left,
      y: snapped.guideY == null ? undefined : snapped.guideY - stageRect.top,
    });
    updateDraft((card) => withPosition(
      card,
      currentGesture.key,
      Math.round(snapped.x * 20) / 20,
      Math.round(snapped.y * 20) / 20,
    ));
  };

  const endGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (pointers.current.size === 0) {
      gesture.current = null;
      setGuides({});
    }
  };

  const zoomSelected = (event: WheelEvent<HTMLDivElement>) => {
    if (!activeCard || !selectedElement) return;
    event.preventDefault();
    updateDraft((card) => withScale(card, selectedElement, getScale(card, selectedElement) + (event.deltaY < 0 ? 0.05 : -0.05)));
  };

  const resetDraft = () => {
    if (!activeId || !cards[activeId]) return;
    setDrafts((current) => ({ ...current, [activeId]: cloneCard(cards[activeId]) }));
    setDirtyIds((current) => {
      const next = new Set(current);
      next.delete(activeId);
      return next;
    });
    setSaveState('idle');
    setInlineEdit(null);
  };

  const activeLoading = Boolean(activeId && loadingIds.has(activeId));
  const activeError = activeId ? loadErrors[activeId] : undefined;
  const activeIndex = Math.max(0, selectedEntities.findIndex((entity) => entity.id === activeId));

  const downloadAfterSave = async (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (!activeId || !dirtyIds.has(activeId)) return;
    event.preventDefault();
    const href = event.currentTarget.href;
    if (await save()) window.location.assign(href);
  };

  return (
    <div className={styles.studio}>
      <section className={styles.selector} aria-labelledby="qr-card-list-title">
        <div className={styles.selectorTop}>
          <div>
            <span className={styles.kicker}>{t('印刷队列', 'Print queue')}</span>
            <h2 id="qr-card-list-title">{t('选择二维码', 'Choose QR codes')}</h2>
          </div>
          <span className={styles.count}>{t(`${selectedEntities.length} / ${usableEntities.length} 张`, `${selectedEntities.length} / ${usableEntities.length} cards`)}</span>
        </div>
        <div className={styles.selectorTools}>
          <SearchInput
            value={query}
            onChange={onQueryChange}
            placeholder={t('搜索编码或标题', 'Search code or title')}
            ariaLabel={t('搜索编码或标题', 'Search code or title')}
            className={styles.search}
            inputClassName={styles.searchInput}
          />
          <button type="button" className={styles.textButton} onClick={() => setSelectedCodes(new Set(allCodes))}>{t('全选', 'Select all')}</button>
          <button type="button" className={styles.textButton} onClick={() => setSelectedCodes(new Set())}>{t('清空', 'Clear')}</button>
        </div>
        <div className={styles.codeList}>
          {visibleEntities.map((entity) => {
            const code = codeOf(entity);
            const checked = selectedEntities.some((item) => item.id === entity.id);
            const active = activeEntity?.id === entity.id;
            return (
              <div key={entity.id} className={styles.codeRow} data-active={active ? 'true' : undefined}>
                <BoolToggle
                  value={checked}
                  onChange={(value) => toggleCode(code, value)}
                  ariaLabel={t(`选择 ${code}`, `Select ${code}`)}
                  label={<span className={styles.codeIdentity}><strong>{entity.title}</strong><code>{code}</code></span>}
                />
                <button type="button" className={styles.iconButton} onClick={() => { void setEdit(code); }} aria-label={t(`编辑 ${code}`, `Edit ${code}`)} title={t('编辑卡片', 'Edit card')}>
                  <Pencil aria-hidden />
                </button>
              </div>
            );
          })}
          {!visibleEntities.length ? <p className={styles.listEmpty}>{t('没有匹配的二维码。', 'No QR codes match this search.')}</p> : null}
        </div>
      </section>

      {!selectedEntities.length ? (
        <div className={styles.noSelection}>
          <p>{t('打印队列是空的。选择至少一枚二维码后，即可编辑和排版。', 'The print queue is empty. Select at least one QR code to edit and lay out its card.')}</p>
          <button type="button" className="platform-button platform-button-primary" onClick={() => setSelectedCodes(new Set(allCodes))}>{t('全选并开始制作', 'Select all and start')}</button>
        </div>
      ) : (
        <div className={styles.workbench}>
          <section className={styles.previewColumn} aria-labelledby="qr-card-preview-title">
            <div className={styles.previewHeading}>
              <div>
                <span className={styles.kicker}>{activeCode}</span>
                <h2 id="qr-card-preview-title">{t('实时打样', 'Live proof')}</h2>
              </div>
              {activeId && dirtyIds.has(activeId) ? <span className={styles.dirty}>{t('未保存', 'Unsaved')}</span> : null}
            </div>
            {activeLoading && !activeCard ? <PlatformState kind="loading" /> : activeError && !activeCard ? (
              <PlatformState kind="error" message={activeError} onRetry={() => { setLoadErrors((current) => { const next = { ...current }; if (activeId) delete next[activeId]; return next; }); setLoadNonce((value) => value + 1); }} />
            ) : activeCard && activeEntity ? (
              <>
                <div
                  className={styles.previewStage}
                  onPointerDown={beginGesture}
                  onPointerMove={moveGesture}
                  onPointerUp={endGesture}
                  onPointerCancel={endGesture}
                  onWheel={zoomSelected}
                >
                  <QrCardUnit card={activeCard} code={activeCode} title={activeEntity.title} selected={selectedElement} index={activeIndex} cropMarks onInlineEdit={openInlineEdit} />
                  {guides.x != null ? <span className={`${styles.snapGuide} ${styles.snapGuideX}`} style={{ left: guides.x }} aria-hidden /> : null}
                  {guides.y != null ? <span className={`${styles.snapGuide} ${styles.snapGuideY}`} style={{ top: guides.y }} aria-hidden /> : null}
                  {inlineEdit ? (
                    <textarea
                      autoFocus
                      className={styles.inlineEditor}
                      value={inlineEdit.value}
                      maxLength={inlineEdit.key.startsWith('ct:') ? 200 : inlineEdit.key === 'quote' ? 500 : inlineEdit.key === 'backText' ? 1000 : inlineEdit.key === 'alg' ? 500 : 160}
                      rows={inlineEdit.key === 'brand' || inlineEdit.key === 'term' ? 1 : 3}
                      aria-label={t(`就地编辑${elementName(t, inlineEdit.key)}`, `Edit ${elementName(t, inlineEdit.key)} in place`)}
                      onPointerDown={(event) => event.stopPropagation()}
                      onChange={(event) => setInlineEdit((current) => current ? { ...current, value: event.target.value } : current)}
                      onBlur={commitInlineEdit}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          setInlineEdit(null);
                        } else if (event.key === 'Enter' && (inlineEdit.key === 'brand' || inlineEdit.key === 'term' || event.ctrlKey || event.metaKey)) {
                          event.preventDefault();
                          commitInlineEdit();
                        }
                      }}
                    />
                  ) : null}
                </div>
                <div className={styles.gestureBar}>
                  <p className={styles.gestureHelp}><Move aria-hidden />{t('拖动移位，滚轮调大小，双击文字就地修改；手机可拖动和双指缩放。', 'Drag to move, use the wheel to resize, and double-click text to edit in place. On mobile, drag or pinch.')}</p>
                  <BoolToggle value={snapEnabled} onChange={setSnapEnabled} label={<span className={styles.snapLabel}><Magnet aria-hidden />{t('磁吸对齐（按住 Alt 暂时关闭）', 'Snap alignment (hold Alt to disable)')}</span>} />
                </div>
                <div className={styles.previewActions}>
                  <button type="button" className="platform-button platform-button-primary" disabled={saveState === 'saving' || !dirtyIds.has(activeId)} onClick={() => { void save(); }}><Save aria-hidden />{saveState === 'saving' ? t('保存中…', 'Saving…') : t('保存设计', 'Save design')}</button>
                  <button type="button" className="platform-button" disabled={!dirtyIds.has(activeId)} onClick={resetDraft}><RotateCcw aria-hidden />{t('撤销未保存修改', 'Discard unsaved changes')}</button>
                  <AppLink className={styles.detailLink} href={`/platform/admin/qr/${encodeURIComponent(activeCode)}`} prefetch={false}>{t('编辑跳转目标', 'Edit QR destination')}</AppLink>
                </div>
                {saveMessage ? <p className={saveState === 'error' ? styles.errorText : styles.statusText} role={saveState === 'error' ? 'alert' : 'status'}>{saveMessage}</p> : null}
                <div className={styles.outputActions}>
                  <a className="platform-button" href={qrCardPublicUrl(activeCode, 'press', activeIndex)} onClick={(event) => { void downloadAfterSave(event); }}><Download aria-hidden />{t('下载印刷版 SVG', 'Download press SVG')}</a>
                  <a className="platform-button" href={qrCardPublicUrl(activeCode, 'clean', activeIndex)} onClick={(event) => { void downloadAfterSave(event); }}><Download aria-hidden />{t('下载无裁切线 SVG', 'Download clean SVG')}</a>
                  <button type="button" className="platform-button" onClick={() => { void downloadQrOnly(); }}><Download aria-hidden />{t('单独下载二维码', 'Download QR only')}</button>
                  <AppLink className="platform-button" href={`/platform/qr/${encodeURIComponent(activeCode)}?stay=1`} target="_blank" rel="noreferrer" prefetch={false}><ExternalLink aria-hidden />{t('预览落地页', 'Preview landing page')}</AppLink>
                  <button type="button" className="platform-button" disabled={selectedEntities.some((entity) => loadingIds.has(entity.id) || !drafts[entity.id])} onClick={() => window.print()}><Printer aria-hidden />{t(`A4 打印 ${selectedEntities.length} 张`, `Print ${selectedEntities.length} on A4`)}</button>
                </div>
                <p className={styles.outputHint}>{t('印刷版带 3 mm 出血和裁切线；无裁切线版是 40 mm 方形成品。A4 打印使用浏览器的 100% 缩放。', 'The press file includes 3 mm bleed and crop marks; the clean file is a 40 mm square. Print A4 at 100% browser scale.')}</p>
              </>
            ) : null}
          </section>

          {activeCard ? (
            <section className={styles.editorColumn} aria-labelledby="qr-card-editor-title">
              <div className={styles.sectionHeading}>
                <div>
                  <span className={styles.kicker}>{t('内容与艺术', 'Content and artwork')}</span>
                  <h2 id="qr-card-editor-title">{t('编辑卡片', 'Edit card')}</h2>
                </div>
              </div>
              <div className={styles.contentFields}>
                <label>
                  <span>{t('正面文案', 'Front copy')}</span>
                  <textarea className={`${styles.fieldControl} ${styles.fieldTextarea}`} rows={3} maxLength={500} value={activeCard.quote} placeholder={resolveQrCardContent(DEFAULT_QR_CARD, activeEntity?.title ?? '', activeIndex).quote} onFocus={() => setSelectedElement('quote')} onChange={(event) => updateDraft((card) => ({ ...card, quote: event.target.value }))} />
                </label>
                <label>
                  <span>{t('品牌名', 'Brand')}</span>
                  <input className={styles.fieldControl} maxLength={160} value={activeCard.brand} placeholder={t('魔方开放社群', 'CubeRoot Cubing Community')} onFocus={() => setSelectedElement('brand')} onChange={(event) => updateDraft((card) => ({ ...card, brand: event.target.value }))} />
                </label>
                <label>
                  <span>{t('短标题', 'Short title')}</span>
                  <input className={styles.fieldControl} maxLength={160} value={activeCard.term} placeholder={activeEntity?.title} onFocus={() => setSelectedElement('term')} onChange={(event) => updateDraft((card) => ({ ...card, term: event.target.value }))} />
                </label>
                <label className={styles.fieldWide}>
                  <span>{t('背面介绍', 'Back introduction')}</span>
                  <textarea className={`${styles.fieldControl} ${styles.fieldTextarea}`} rows={4} maxLength={1000} value={activeCard.intro} onFocus={() => setSelectedElement('backText')} onChange={(event) => updateDraft((card) => ({ ...card, intro: event.target.value }))} />
                </label>
                <label>
                  <span>{t('公式名称', 'Algorithm name')}</span>
                  <input className={styles.fieldControl} maxLength={160} value={activeCard.alg?.name ?? ''} placeholder="PLL T" onFocus={() => setSelectedElement('alg')} onChange={(event) => updateDraft((card) => patchAlgorithm(card, 'name', event.target.value))} />
                </label>
                <label>
                  <span>{t('公式链接', 'Algorithm link')}</span>
                  <input className={styles.fieldControl} type="url" maxLength={2000} value={activeCard.alg?.url ?? ''} placeholder="https://…" onFocus={() => setSelectedElement('alg')} onChange={(event) => updateDraft((card) => patchAlgorithm(card, 'url', event.target.value))} />
                </label>
                <label className={styles.fieldWide}>
                  <span>{t('公式', 'Algorithm moves')}</span>
                  <textarea className={`${styles.fieldControl} ${styles.fieldTextarea}`} rows={2} maxLength={500} value={activeCard.alg?.moves ?? ''} placeholder="R U R' U' R' F R2 U' R' U' R U R' F'" onFocus={() => setSelectedElement('alg')} onChange={(event) => updateDraft((card) => patchAlgorithm(card, 'moves', event.target.value))} spellCheck={false} autoCapitalize="off" />
                </label>
              </div>

              <div className={styles.artGallery} aria-label={t('内置正面图库', 'Built-in front artwork gallery')}>
                <div className={styles.artGalleryHeading}>
                  <span>{t('内置正面图库', 'Built-in front artwork gallery')}</span>
                  <button type="button" className={styles.textButton} aria-pressed={!activeCard.frontArt} onClick={() => updateDraft((card) => ({ ...card, frontArt: '' }))}>{t('按卡片顺序自动轮换', 'Rotate automatically by card order')}</button>
                </div>
                <div className={styles.artGalleryItems}>
                  {QR_CARD_FRONT_ARTS.map((art) => (
                    <button className={styles.artChoice} key={art.src} type="button" aria-pressed={activeCard.frontArt === art.src} onClick={() => { updateDraft((card) => ({ ...card, frontArt: art.src })); setSelectedElement('front'); }}>
                      <img src={art.src} alt="" draggable={false} /><span>{t(art.nameZh, art.nameEn)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.artControls}>
                {(['front', 'back'] as const).map((side) => {
                  const field = side === 'front' ? 'frontArt' : 'backArt';
                  return (
                    <div key={side} className={styles.artControl}>
                      <span>{side === 'front' ? t('正面艺术图', 'Front artwork') : t('背面艺术图', 'Back artwork')}</span>
                      <label className="platform-button">
                        <FileImage aria-hidden />{t('选择图片', 'Choose image')}
                        <input className={styles.fileInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadArt(side)} />
                      </label>
                      {(field === 'frontArt' || activeCard[field]) ? <button type="button" className="platform-button" onClick={() => { void downloadArtworkPng(side); }}><ImageDown aria-hidden />{t('下载 PNG 原图', 'Download source PNG')}</button> : null}
                      {activeCard[field] ? <button type="button" className={styles.textButton} onClick={() => updateDraft((card) => ({ ...card, [field]: '' }))}>{t('移除', 'Remove')}</button> : null}
                    </div>
                  );
                })}
              </div>
              {artError ? <p className={styles.errorText} role="alert">{artError}</p> : null}

              <PromptComposer value={activeCard.frontArtPrompt} onChange={(frontArtPrompt) => updateDraft((card) => ({ ...card, frontArtPrompt }))} />

              <section className={styles.elementSection} aria-labelledby="qr-elements-title">
                <div className={styles.sectionHeading}>
                  <div>
                    <span className={styles.kicker}>{t('精细排版', 'Fine layout')}</span>
                    <h3 id="qr-elements-title">{t('选择要调整的元素', 'Choose an element to adjust')}</h3>
                  </div>
                  <button type="button" className={styles.addButton} disabled={activeCard.customTexts.length >= 30} onClick={addCustomText}><Plus aria-hidden />{t('添加文字', 'Add text')}</button>
                </div>
                <div className={styles.elementPicker}>
                  {QR_CARD_ELEMENTS.map((key) => (
                    <button className={styles.elementChoice} key={key} type="button" aria-pressed={selectedElement === key} onClick={() => setSelectedElement(key)}>{elementName(t, key)}</button>
                  ))}
                  {activeCard.customTexts.map((item) => (
                    <span key={item.id} className={styles.customChip} data-active={selectedElement === `ct:${item.id}` ? 'true' : undefined}>
                      <button type="button" className={`${styles.customAction} ${styles.customTextButton}`} aria-pressed={selectedElement === `ct:${item.id}`} onClick={() => setSelectedElement(`ct:${item.id}`)}>{item.text || t('空文字', 'Empty text')}</button>
                      <button type="button" className={`${styles.customAction} ${styles.customRemoveButton}`} onClick={() => deleteCustomText(item.id)} aria-label={t(`删除 ${item.text}`, `Delete ${item.text}`)}><Trash2 aria-hidden /></button>
                    </span>
                  ))}
                </div>
              </section>

              <ElementInspector card={activeCard} selected={selectedElement} update={updateDraft} />
            </section>
          ) : null}
        </div>
      )}

      <div className={styles.printSheet} aria-hidden="true">
        {selectedEntities.map((entity, index) => {
          const card = drafts[entity.id] ?? cards[entity.id];
          return card ? (
            <div key={entity.id} className={styles.printCard}>
              <QrCardUnit card={card} code={codeOf(entity)} title={entity.title} selected={null} index={index} />
            </div>
          ) : null;
        })}
      </div>
    </div>
  );
}
