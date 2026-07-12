'use client';

/**
 * Gen222StepsConfig — 2×2「按步数生成」子面板(仅 event=222 + 随机生成来源时出现)。
 *
 * 从 2×2 完整状态空间(3,674,160 态,固定一个角块)里**均匀采样**、按所选度量的最优步数过滤后
 * 生成打乱 —— 不是案例库(77,801 去重态),而是真实的全空间条件分布。度量:底面步数(拼好任一面)
 * / 首层步数 / 整解 HTM / 整解 QTM。算法见 lib/cube222-metric.ts(拒绝采样 + 最优解逆序)。
 */

import { useEffect } from 'react';
import { RangeSlider } from '@/components/RangeSlider/RangeSlider';
import { VariantSelect } from '@/components/VariantSelect';
import PillToggle from '@/components/PillToggle/PillToggle';
import { CUBE222_METRIC_RANGE, type Cube222Metric } from '@/lib/cube222-metric';
import { tr } from '@/i18n/tr';

interface Settings {
  genByStepsOn: boolean;
  genStepsMetric: Cube222Metric;
  genSteps: number[];
}
interface Props {
  isZh: boolean;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
}

const METRIC_ORDER: Cube222Metric[] = ['face', 'layer', 'htm', 'qtm'];
const metricLabel = (key: string, zh: boolean): string => {
  const m: Record<string, { zh: string; en: string }> = {
    face: { zh: '底面步数', en: 'Bottom face' },
    layer: { zh: '首层步数', en: 'First layer' },
    htm: { zh: '整解 HTM', en: 'Full solve (HTM)' },
    qtm: { zh: '整解 QTM', en: 'Full solve (QTM)' },
  };
  return zh ? m[key].zh : m[key].en;
};
// 每个度量首开时的默认区间(中偏难),夹进各自 [min,max]。
const DEFAULT_BAND: Record<Cube222Metric, [number, number]> = {
  face: [3, 4], layer: [4, 6], htm: [8, 10], qtm: [10, 12],
};
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const clamp = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), hi);

export default function Gen222StepsConfig({ isZh, settings, updateSettings }: Props) {
  const metric = settings.genStepsMetric;
  const [mMin, mMax] = CUBE222_METRIC_RANGE[metric];

  // 当前区间:优先用已存 genSteps,否则用该度量默认带;始终夹进 [mMin, mMax]。
  const stored = settings.genSteps;
  const rawLo = stored.length ? stored[0] : DEFAULT_BAND[metric][0];
  const rawHi = stored.length ? stored[stored.length - 1] : DEFAULT_BAND[metric][1];
  const lo = clamp(Math.min(rawLo, rawHi), mMin, mMax);
  const hi = clamp(Math.max(rawLo, rawHi), mMin, mMax);

  // 开启但步数为空(首开 / 切度量后越界)→ 落该度量默认带,保证滑块与过滤口径一致。
  useEffect(() => {
    if (!settings.genByStepsOn) return;
    if (stored.length === 0 || stored[0] < mMin || stored[stored.length - 1] > mMax) {
      const [a, b] = DEFAULT_BAND[metric];
      updateSettings({ genSteps: range(clamp(a, mMin, mMax), clamp(b, mMin, mMax)) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.genByStepsOn, metric]);

  return (
    <div className="wca-src-config">
      <div className="settings-row wca-src-toprow">
        <span className="settings-row-tight-group">
          <span className="settings-row-label">{tr({ zh: '按步数', en: 'By steps' })}</span>
          <PillToggle
            value={settings.genByStepsOn}
            onChange={(v) => updateSettings({ genByStepsOn: v })}
          />
        </span>
        {settings.genByStepsOn && (
          <VariantSelect
            className="settings-row-control-select"
            value={metric}
            options={METRIC_ORDER}
            onChange={(m) => updateSettings({ genStepsMetric: m as Cube222Metric, genSteps: [] })}
            isZh={isZh}
            label={metricLabel}
            ariaLabel={tr({ zh: '度量', en: 'Metric' })}
          />
        )}
      </div>

      {settings.genByStepsOn && (
        <>
          <div className="wca-src-steps-range">
            <RangeSlider
              min={mMin}
              max={mMax}
              value={[lo, hi]}
              onChange={([a, b]) => updateSettings({ genSteps: range(a, b) })}
              marks={range(mMin, mMax)}
              ariaLabel={tr({ zh: '步数范围', en: 'Step range' })}
            />
          </div>
          <p className="wca-src-hint">
            {tr({
              zh: `从 2×2 完整状态空间(3,674,160 态)均匀采样,只出所选度量最优步数在此范围内的打乱(非案例库)。`,
              en: `Uniformly sampled from the full 2×2 state space (3,674,160 states); only scrambles whose optimal move count (for the chosen metric) falls in this range — not the case library.`,
            })}
          </p>
        </>
      )}
    </div>
  );
}
