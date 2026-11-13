'use client';

import { RotateCcw } from '@app-foundation/icons/lucide';
import BoolToggle from '@/components/BoolToggle';
import { useT } from '@/hooks/useT';
import { isQrCardTextElement, QR_CARD_FONTS, type PlatformQrCard, type QrCardElement, type QrCardFont } from '@/lib/platform-qr-card';
import styles from './PlatformQrCardStudio.module.css';
import { type EditableElement, ELEMENT_SIDE, elementName, fontName, getPosition, getScale, withPosition, withScale, patchStyle } from './PlatformQrCardEditing';

export function ElementInspector({
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
              <input className={styles.fieldRange} type="range" min={selected === 'qr' ? 0.01 : selected === 'front' || selected === 'back' ? 0.5 : 0.3} max={3} step={0.01} value={getScale(card, selected)} onChange={(event) => update((current) => withScale(current, selected, Number(event.target.value)))} />
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
