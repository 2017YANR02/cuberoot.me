'use client';

import { useMemo, useState } from 'react';
import BackHome from '@/components/BackHome';
import HeaderToggles from '@/components/HeaderToggles';
import { VisualCube } from '@/components/VisualCube';
import { CUBE_COLOR_NAMES, CUBE_FILL, type CubeFace } from '@/lib/cube-colors';
import { tr, useLang } from '@/i18n/tr';
import './lettering.css';

const GLYPHS = {
  '王': ['11111', '00100', '11111', '00100', '11111'],
  '中': ['00100', '11111', '10101', '11111', '00100'],
  '十': ['00100', '00100', '11111', '00100', '00100'],
  '山': ['00100', '10101', '10101', '10101', '11111'],
  '田': ['11111', '10101', '11111', '10101', '11111'],
  '口': ['11111', '10001', '10001', '10001', '11111'],
  '工': ['11111', '00100', '00100', '00100', '11111'],
} as const;

type Glyph = keyof typeof GLYPHS;
type CubeOrder = 5 | 7;

const GLYPH_OPTIONS = Object.keys(GLYPHS) as Glyph[];
const ORDER_OPTIONS: CubeOrder[] = [5, 7];
const PALETTE: CubeFace[] = ['U', 'D', 'F', 'B', 'L', 'R'];
const FACELET_ORDER: CubeFace[] = ['U', 'R', 'F', 'D', 'L', 'B'];

function createPreview(glyph: Glyph, order: CubeOrder, foreground: CubeFace, background: CubeFace) {
  const faceArea = order * order;
  const stickerColors = FACELET_ORDER.flatMap(face => Array<string>(faceArea).fill(CUBE_FILL[face]));
  const frontStart = faceArea * 2;
  const offset = (order - 5) / 2;
  const frontColors = Array<string>(faceArea).fill(CUBE_FILL[background]);

  GLYPHS[glyph].forEach((row, rowIndex) => {
    [...row].forEach((pixel, columnIndex) => {
      if (pixel !== '1') return;
      const index = (rowIndex + offset) * order + columnIndex + offset;
      frontColors[index] = CUBE_FILL[foreground];
    });
  });

  stickerColors.splice(frontStart, faceArea, ...frontColors);
  return { stickerColors, frontColors };
}

export default function LetteringPage() {
  useLang();
  const [glyph, setGlyph] = useState<Glyph>('王');
  const [order, setOrder] = useState<CubeOrder>(5);
  const [foreground, setForeground] = useState<CubeFace>('R');
  const [background, setBackground] = useState<CubeFace>('U');
  const preview = useMemo(
    () => createPreview(glyph, order, foreground, background),
    [glyph, order, foreground, background],
  );

  const chooseForeground = (next: CubeFace) => {
    setForeground(next);
    if (next === background) setBackground(foreground);
  };

  const chooseBackground = (next: CubeFace) => {
    setBackground(next);
    if (next === foreground) setForeground(background);
  };

  return (
    <div className="lettering-page">
      <header className="lettering-header lettering-shell">
        <div className="lettering-heading">
          <BackHome />
          <div>
            <p className="lettering-eyebrow">{tr({ zh: '创作工具', en: 'Creative tool' })}</p>
            <h1>{tr({ zh: '魔方拼字', en: 'Cube Lettering' })}</h1>
          </div>
        </div>
        <HeaderToggles />
      </header>

      <main className="lettering-shell lettering-main">
        <p className="lettering-intro">
          {tr({
            zh: '选择一个字、魔方阶数和配色，生成正面像素效果图。',
            en: 'Choose a character, cube size, and colours to generate a front-face pixel preview.',
          })}
        </p>

        <div className="lettering-workspace">
          <section className="lettering-controls" aria-label={tr({ zh: '拼字设置', en: 'Lettering settings' })}>
            <fieldset>
              <legend>{tr({ zh: '汉字', en: 'Character' })}</legend>
              <div className="lettering-character-grid">
                {GLYPH_OPTIONS.map(option => (
                  <button
                    key={option}
                    type="button"
                    className="lettering-character"
                    aria-pressed={glyph === option}
                    onClick={() => setGlyph(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>{tr({ zh: '魔方阶数', en: 'Cube size' })}</legend>
              <div className="lettering-segmented">
                {ORDER_OPTIONS.map(option => (
                  <button
                    key={option}
                    className="lettering-order-button"
                    type="button"
                    aria-pressed={order === option}
                    onClick={() => setOrder(option)}
                  >
                    {option}×{option}
                  </button>
                ))}
              </div>
            </fieldset>

            <ColorPicker
              label={tr({ zh: '文字颜色', en: 'Character colour' })}
              value={foreground}
              onChange={chooseForeground}
            />
            <ColorPicker
              label={tr({ zh: '底色', en: 'Background colour' })}
              value={background}
              onChange={chooseBackground}
            />
          </section>

          <section className="lettering-preview" aria-labelledby="lettering-preview-title">
            <div className="lettering-preview-heading">
              <div>
                <p>{order}×{order}</p>
                <h2 id="lettering-preview-title">{glyph}</h2>
              </div>
              <span>{tr({ zh: '拖动可旋转', en: 'Drag to rotate' })}</span>
            </div>

            <div className="lettering-preview-grid">
              <div className="lettering-cube-card">
                <VisualCube
                  view="iso"
                  puzzleSize={order}
                  stickerColors={preview.stickerColors}
                  local
                  interactive
                  enlargeable
                  size={260}
                  alt={tr({ zh: `${order} 阶魔方“${glyph}”效果图`, en: `${order}×${order} cube preview for ${glyph}` })}
                />
              </div>

              <div
                className="lettering-face-grid"
                style={{ gridTemplateColumns: `repeat(${order}, 1fr)` }}
                role="img"
                aria-label={tr({ zh: `正面“${glyph}”像素图`, en: `Front-face pixel preview for ${glyph}` })}
              >
                {preview.frontColors.map((color, index) => (
                  <span key={index} style={{ backgroundColor: color }} />
                ))}
              </div>
            </div>

            <p className="lettering-note">
              {tr({
                zh: '当前仅生成视觉效果图，不表示该状态可以通过转动得到。',
                en: 'This version creates a visual preview only; the state is not guaranteed to be reachable by turns.',
              })}
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}

function ColorPicker({ label, value, onChange }: {
  label: string;
  value: CubeFace;
  onChange: (face: CubeFace) => void;
}) {
  return (
    <fieldset>
      <legend>{label}</legend>
      <div className="lettering-colors">
        {PALETTE.map(face => {
          const name = tr(CUBE_COLOR_NAMES[face]);
          return (
            <button
              key={face}
              type="button"
              className="lettering-color"
              aria-label={name}
              aria-pressed={value === face}
              title={name}
              style={{ backgroundColor: CUBE_FILL[face] }}
              onClick={() => onChange(face)}
            />
          );
        })}
      </div>
    </fieldset>
  );
}
