'use client';

import { useState } from 'react';
import { X, Boxes, AlertTriangle } from 'lucide-react';
import { tr } from '@/i18n/tr';
import { useT } from '@/hooks/useT';
import CubeShorthand from '@/components/CubeShorthand';
import { usePaint } from '../_lib/store';
import { shorthandToShapes } from '../_lib/shorthand-shapes';

interface Props {
  open: boolean;
  onClose: () => void;
  viewport: { w: number; h: number };
}

const SIZES = [
  { key: 'sm', px: 48 },
  { key: 'md', px: 72 },
  { key: 'lg', px: 100 },
] as const;

const LEGEND: { alg: string; zh: string; en: string }[] = [
  {
    alg: 'R',
    zh: '三竖条 = 三列;带箭头那条 = 要转的列 + 方向(右列↑ = R)',
    en: 'Three vertical bars = the 3 columns; the arrowed one = which column turns (right ↑ = R)',
  },
  {
    alg: 'U',
    zh: '三横条 = 三行;带箭头那条 = 要转的行(顶行← = U)',
    en: 'Three horizontal bars = the 3 rows; the arrowed one = which row turns (top ← = U)',
  },
  {
    alg: "S'",
    zh: '叠放方块 = 面转动(F/B/S);左侧扫掠箭头 = 顺/逆(↓ = 逆 = S′)',
    en: 'Stacked squares = a face turn (F/B/S); the left sweep arrow = CW/CCW (↓ = CCW = S′)',
  },
  { alg: 'R2', zh: '双箭头 = 180°(2)', en: 'Double arrowhead = 180° (a 2 turn)' },
];

export default function ShorthandPanel({ open, onClose, viewport }: Props) {
  const t = useT();
  const [alg, setAlg] = useState("R U R' U'");
  const [size, setSize] = useState(72);
  const [labels, setLabels] = useState(false);
  const [bad, setBad] = useState<string[]>([]);

  const insert = () => {
    const st = usePaint.getState();
    const { camera } = st;
    // Pre-measure to size the strip, then center it on the viewport.
    const probe = shorthandToShapes(alg, { size, originX: 0, originY: 0, labels });
    if (!probe.shapes.length) {
      setBad(probe.badTokens);
      return;
    }
    const gap = size * 0.18;
    const glyphCols = Math.max(1, probe.glyphCount);
    const stripW = glyphCols * size + (glyphCols - 1) * gap;
    const stripH = size + (labels ? size * 0.3 : 0);
    const centerX = camera.x + viewport.w / 2 / camera.zoom;
    const centerY = camera.y + viewport.h / 2 / camera.zoom;
    const originX = centerX - stripW / 2;
    const originY = centerY - stripH / 2;

    const { shapes, badTokens } = shorthandToShapes(alg, { size, originX, originY, labels });
    if (!shapes.length) {
      setBad(badTokens);
      return;
    }
    st.addShapes(shapes, true);
    st.setSelection(shapes.map((s) => s.id));
    st.setTool('select');
    setBad(badTokens);
  };

  if (!open) return null;

  return (
    <div className="paint-sh-panel" role="dialog" aria-label={tr({ zh: '魔方速记插入', en: 'Cube shorthand insert' })}>
      <div className="paint-sh-head">
        <Boxes size={15} />
        <span className="paint-sh-title">{t('魔方速记', 'Cube Shorthand')}</span>
        <button
          type="button"
          className="paint-btn paint-sh-close"
          onClick={onClose}
          aria-label={tr({ zh: '关闭', en: 'Close' })}
        >
          <X size={15} />
        </button>
      </div>

      <div className="paint-sh-body">
        <p className="paint-sh-hint">
          {t(
            '输入标准记号,每个转动转成一组可编辑的矢量符号插到画布。',
            'Type standard notation; each move becomes an editable vector glyph on the canvas.',
          )}
        </p>

        <textarea
          className="paint-sh-input"
          value={alg}
          onChange={(e) => setAlg(e.target.value)}
          spellCheck={false}
          rows={2}
          placeholder="R U R' U'"
          aria-label={tr({ zh: '公式输入', en: 'Algorithm input' })}
        />

        <div className="paint-sh-row">
          <div className="paint-sh-sizes" role="group" aria-label={tr({ zh: '大小', en: 'Size' })}>
            {SIZES.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`paint-btn paint-sh-size${size === s.px ? ' is-active' : ''}`}
                onClick={() => setSize(s.px)}
              >
                {t({ sm: '小', md: '中', lg: '大' }[s.key], { sm: 'S', md: 'M', lg: 'L' }[s.key])}
              </button>
            ))}
          </div>
          <label className="paint-sh-toggle">
            <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} />
            <span>{t('标签', 'Labels')}</span>
          </label>
        </div>

        <button type="button" className="paint-btn paint-btn--accent paint-sh-insert" onClick={insert}>
          {t('插入', 'Insert')}
        </button>

        {bad.length > 0 && (
          <div className="paint-sh-warn">
            <AlertTriangle size={13} />
            <span>
              {t('跳过(宽层/无法解析):', 'Skipped (wide / unparseable): ')}
              {bad.join(' ')}
            </span>
          </div>
        )}

        <section className="paint-sh-legend">
          <h3 className="paint-sh-legend-title">{t('怎么读', 'How to read it')}</h3>
          <ul className="paint-sh-legend-list">
            {LEGEND.map((row) => (
              <li className="paint-sh-legend-row" key={row.alg}>
                <CubeShorthand alg={row.alg} size={34} />
                <span>{t(row.zh, row.en)}</span>
              </li>
            ))}
          </ul>
          <p className="paint-sh-note">
            {t(
              '箭头方向画的是这一层从你正面看到的实际移动方向。灵感来自 Derek Nash 的 CuSHan,但每个转动是独立符号(自有实现)。',
              "Arrows show how that layer visibly moves from your viewpoint. Inspired by Derek Nash's CuSHan, but each move is a standalone symbol (own implementation).",
            )}
          </p>
        </section>
      </div>
    </div>
  );
}
