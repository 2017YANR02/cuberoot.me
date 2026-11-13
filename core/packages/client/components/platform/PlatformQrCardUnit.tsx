'use client';

import { type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import { useT } from '@/hooks/useT';
import { QR_CARD_FACE_COLORS, QR_CARD_FRONT_ARTS, qrCardFaceletSpots, qrCardFormulaRow, qrCardFontStack, qrCardVisualCubeUrl, qrCodeSvgUrl, resolveQrCardContent, type PlatformQrCard, type QrCardTextStyle } from '@/lib/platform-qr-card';
import styles from './PlatformQrCardStudio.module.css';
import { type EditableElement } from './PlatformQrCardEditing';

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

function selectableProps(key: EditableElement, selected: EditableElement | null) {
  return {
    'data-card-el': key,
    'data-selected': selected === key ? 'true' : undefined,
  };
}

export function QrCardUnit({
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
