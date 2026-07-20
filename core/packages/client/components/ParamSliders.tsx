'use client';

/**
 * ParamSliders — 一组「标签 + range 滑杆 + 当前值」参数行,带非默认时的
 * 「恢复默认」按钮。从 /scramble/mcc 的高级参数区提取,供 mcc / batch-solver /
 * sub-solver 等页共用;MCC 与增强 SQTM 的滑杆规格常量也在此维护。
 */
import { useT } from '@/hooks/useT';
import { tr } from '@/i18n/tr';
import type { EsqParams, MccParams } from '@/lib/mcc';
import './param-sliders.css';

export interface ParamSliderSpec<K extends string> {
  key: K;
  zh: string;
  en: string;
  min: number;
  max: number;
  step: number;
}

export const MCC_SLIDERS: ParamSliderSpec<keyof MccParams>[] = [
  { key: 'wristMult', zh: '手腕转系数', en: 'Wrist turn ×', min: 0, max: 1, step: 0.05 },
  { key: 'pushMult', zh: '推转系数', en: 'Push turn ×', min: 1, max: 3, step: 0.05 },
  { key: 'ringMult', zh: '无名指拨系数', en: 'Ring turn ×', min: 1, max: 3, step: 0.05 },
  { key: 'destabilize', zh: '失稳惩罚', en: 'Destabilize penalty', min: 0, max: 2, step: 0.05 },
  { key: 'addRegrip', zh: '软换手惩罚', en: 'Soft regrip penalty', min: 0, max: 4, step: 0.05 },
  { key: 'double', zh: '180° 转系数', en: 'Half turn ×', min: 1, max: 2, step: 0.05 },
  { key: 'sesliceMult', zh: 'S/E 中层系数', en: 'S/E slice ×', min: 1, max: 2, step: 0.05 },
  { key: 'overWorkMult', zh: '过劳惩罚', en: 'Overwork penalty', min: 0, max: 5, step: 0.05 },
  { key: 'moveblock', zh: '前步阻挡惩罚', en: 'Move block penalty', min: 0, max: 3, step: 0.05 },
  { key: 'rotation', zh: 'y/z 转身代价', en: 'y/z rotation', min: 1, max: 7, step: 0.1 },
];

export const ESQ_SLIDERS: ParamSliderSpec<keyof EsqParams>[] = [
  { key: 'wristQuarter', zh: '手腕 90°', en: 'Wrist quarter', min: 0, max: 5, step: 0.1 },
  { key: 'flickQuarter', zh: '手指 90°', en: 'Flick quarter', min: 0, max: 5, step: 0.1 },
  { key: 'wristHalf', zh: '手腕 180°', en: 'Wrist half', min: 0, max: 5, step: 0.1 },
  { key: 'flickHalf', zh: '手指 180°', en: 'Flick half', min: 0, max: 5, step: 0.1 },
];

const fmt = (n: number) => String(Math.round(n * 100) / 100);

export function ParamSliders<K extends string>({
  specs,
  values,
  defaults,
  onChange,
  className,
}: {
  specs: readonly ParamSliderSpec<K>[];
  values: Record<K, number>;
  defaults: Record<K, number>;
  onChange: (next: Record<K, number>) => void;
  className?: string;
}) {
  const t = useT();
  const isDefault = specs.every((s) => values[s.key] === defaults[s.key]);
  return (
    <div className={`param-sliders${className ? ` ${className}` : ''}`}>
      {specs.map((s) => (
        <label key={s.key} className="param-slider">
          <span className="param-slider-label">{tr(s)}</span>
          <input
            type="range"
            min={s.min}
            max={s.max}
            step={s.step}
            value={values[s.key]}
            onChange={(e) => onChange({ ...values, [s.key]: Number(e.target.value) })}
          />
          <span className="param-slider-value">{fmt(values[s.key])}</span>
        </label>
      ))}
      {!isDefault && (
        <button type="button" className="param-sliders-reset" onClick={() => onChange({ ...defaults })}>
          {t('恢复默认', 'Reset to defaults')}
        </button>
      )}
    </div>
  );
}
