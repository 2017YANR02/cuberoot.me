'use client';

/**
 * tnoodle-style per-part color picker for the clock event.
 * Mirrors `EventPicker.tsx` + `SchemeColorPicker.tsx` from tnoodle/client.
 * 12 chips (one per ClockColorKey), each opens a native color input;
 * a "Reset to default" button restores DEFAULT_CLOCK_COLORS.
 *
 * The native `<input type="color">` is good enough for this and avoids
 * pulling in `react-color`.
 */
import { useMemo } from 'react';
import {
  CLOCK_COLOR_KEYS, DEFAULT_CLOCK_COLORS,
  applyClockScramble, renderClockSvg,
  type ClockColorKey,
} from './_svg/clock_svg';

interface Props {
  colors: Record<string, string> | undefined;
  onChange: (colors: Record<string, string> | undefined) => void;
  t: (zh: string, en: string, zhHant?: string) => string;
}

const ZH_LABEL: Record<ClockColorKey, string> = {
  Front:           '正面',
  FrontClock:      '正面表盘',
  FrontTopClock:   '正面 12 点',
  FrontHand:       '正面指针',
  FrontHandBorder: '正面指针描边',
  FrontPin:        '正面立柱',
  Back:            '背面',
  BackClock:       '背面表盘',
  BackTopClock:    '背面 12 点',
  BackHand:        '背面指针',
  BackHandBorder: '背面指针描边',
  BackPin:         '背面立柱',
};

/** Pick black/white text foreground based on luminance. */
function textForBg(hex: string): string {
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return '#000';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 140 ? '#000' : '#fff';
}

export default function ClockColorPicker({ colors, onChange, t }: Props) {
  const effective = useMemo<Record<ClockColorKey, string>>(() => {
    return { ...DEFAULT_CLOCK_COLORS, ...(colors ?? {}) };
  }, [colors]);

  const previewSvg = useMemo(
    () => renderClockSvg(applyClockScramble(''), effective),
    [effective],
  );

  const isDefault = useMemo(
    () => CLOCK_COLOR_KEYS.every((k) => effective[k].toLowerCase() === DEFAULT_CLOCK_COLORS[k].toLowerCase()),
    [effective],
  );

  const update = (key: ClockColorKey, val: string) => {
    const next = { ...effective, [key]: val };
    // If the new state matches default exactly, drop the override entirely
    const allDefault = CLOCK_COLOR_KEYS.every((k) => next[k].toLowerCase() === DEFAULT_CLOCK_COLORS[k].toLowerCase());
    onChange(allDefault ? undefined : next);
  };

  const isZh = t('zh', 'en') === 'zh';

  return (
    <div className="gen-tn-clock-colors">
      {/* Preview + reset on top so the native color picker (pops downward
          from the clicked chip) never covers them. */}
      <div className="gen-tn-clock-actions">
        <div
          className="gen-tn-clock-preview"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: previewSvg }}
        />
        <button
          type="button"
          className="gen-tn-clock-reset"
          onClick={() => onChange(undefined)}
          disabled={isDefault}
        >
          {t('恢复默认配色', 'Reset to default', "恢復預設配色")}
        </button>
      </div>
      <details className="gen-tn-clock-details">
        <summary>{t('自定义配色', 'Customize colors', "自定義配色")}</summary>
        <div className="gen-tn-clock-chips">
          {CLOCK_COLOR_KEYS.map((k) => (
            <label
              key={k}
              className="gen-tn-clock-chip"
              style={{ backgroundColor: effective[k], color: textForBg(effective[k]) }}
              title={k}
            >
              {isZh ? ZH_LABEL[k] : k}
              <input
                type="color"
                value={effective[k]}
                onChange={(e) => update(k, e.target.value)}
              />
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}
