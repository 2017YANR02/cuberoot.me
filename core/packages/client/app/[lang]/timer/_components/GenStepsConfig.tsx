'use client';

/**
 * GenStepsConfig — 「按步数」子面板(event ∈ {2×2, 金字塔} 时出现,随机生成 + WCA 真题两种来源都用)。
 *
 * 随机生成:从该魔方完整状态空间均匀采样、按所选度量的最优步数过滤后生成打乱(滑条走完整范围)。
 * WCA 真题:把拉到的真实比赛打乱按同一度量过滤(滑条只给语料实际出现的步数 wcaRange,不出必空的低步数)。
 * 度量表见 _lib/scramble/step-metrics.ts;2×2 生成算法见 lib/cube222-metric,金字塔见 _lib/scramble/pyram-metric。
 */

import { useEffect } from 'react';
import { RangeSlider } from '@/components/RangeSlider/RangeSlider';
import { VariantSelect } from '@/components/VariantSelect';
import PillToggle from '@/components/PillToggle/PillToggle';
import { stepMetricsFor, stepMetricSpec } from '../_lib/scramble/step-metrics';
import { tr } from '@/i18n/tr';

interface Settings {
  genByStepsOn: boolean;
  genStepsMetric: string;
  genSteps: number[];
}
interface Props {
  isZh: boolean;
  event: string;
  /** 'random' 均匀采样生成(滑条走完整 range);'wca' 过滤真实打乱(滑条收到语料实际出现的 wcaRange)。 */
  source: 'random' | 'wca';
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
}

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const clamp = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), hi);

export default function GenStepsConfig({ isZh, event, source, settings, updateSettings }: Props) {
  const metrics = stepMetricsFor(event);
  // 当前度量:存的值若不属于本魔方(切魔方后残留)→ 回退首个度量。
  const active = metrics?.find((m) => m.key === settings.genStepsMetric) ?? metrics?.[0];

  // 切魔方导致度量非法 → 复位到该魔方首个度量(并清空步数,交给下面的默认带 effect)。
  useEffect(() => {
    if (!metrics || !active) return;
    if (settings.genStepsMetric !== active.key) updateSettings({ genStepsMetric: active.key, genSteps: [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, settings.genStepsMetric]);

  const spec = active ? stepMetricSpec(event, active.key) : null;
  // 滑条范围随来源:WCA 真题只覆盖语料实际出现的步数(如 2×2 魔方 4–11),随机生成走完整状态空间。
  const [mMin, mMax] = spec ? (source === 'wca' ? (spec.wcaRange ?? spec.range) : spec.range) : [0, 0];

  // 当前区间:优先用已存 genSteps,否则用该度量默认带;始终夹进 [mMin, mMax]。
  const stored = settings.genSteps;
  const rawLo = stored.length ? stored[0] : (spec ? spec.band[0] : 0);
  const rawHi = stored.length ? stored[stored.length - 1] : (spec ? spec.band[1] : 0);
  const lo = clamp(Math.min(rawLo, rawHi), mMin, mMax);
  const hi = clamp(Math.max(rawLo, rawHi), mMin, mMax);

  // 步数为空(首开 / 切度量)→ 落默认带;越界(切度量或切来源使边界收窄)→ 夹回新边界,保证滑块与过滤口径一致。
  useEffect(() => {
    if (!settings.genByStepsOn || !spec) return;
    if (stored.length === 0) {
      updateSettings({ genSteps: range(clamp(spec.band[0], mMin, mMax), clamp(spec.band[1], mMin, mMax)) });
    } else if (stored[0] < mMin || stored[stored.length - 1] > mMax) {
      updateSettings({ genSteps: range(clamp(stored[0], mMin, mMax), clamp(stored[stored.length - 1], mMin, mMax)) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.genByStepsOn, settings.genStepsMetric, source, mMin, mMax]);

  if (!metrics || !active || !spec) return null;

  const metricLabel = (key: string, zh: boolean): string => {
    const m = stepMetricSpec(event, key);
    return m ? (zh ? m.zh : m.en) : key;
  };

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
            value={active.key}
            options={metrics.map((m) => m.key)}
            onChange={(k) => updateSettings({ genStepsMetric: k, genSteps: [] })}
            isZh={isZh}
            label={metricLabel}
            ariaLabel={tr({ zh: '度量', en: 'Metric' })}
          />
        )}
      </div>

      {settings.genByStepsOn && (
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
      )}
    </div>
  );
}
