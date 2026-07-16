'use client';

/**
 * TimerFontPicker — 计时数字字体下拉选择器。原生 <select> 的 option 无法跨浏览器
 * 按字体渲染,故用自定义 trigger + popup(交互同 ListSelect:点击外部关闭),
 * 每个菜单项直接用对应字体渲染 0123456789,所见即所得。
 * 共享于 /timer 设置面板与 /alg 训练器 run 页;四档 id 与两边的持久化字段一致。
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { tr } from '@/i18n/tr';
import './timer-font-picker.css';

export type TimerFontOptionId = 'lcd' | 'mono' | 'liberation' | 'sans';

const OPTIONS: ReadonlyArray<{
  id: TimerFontOptionId;
  label: () => string;
  fontFamily: string;
  fontWeight: number;
}> = [
  { id: 'lcd', label: () => tr({ zh: 'LCD 七段', en: 'LCD' }), fontFamily: "'Segment7Standard', monospace", fontWeight: 700 },
  { id: 'mono', label: () => 'Roboto Mono', fontFamily: 'var(--font-mono)', fontWeight: 600 },
  { id: 'liberation', label: () => 'Liberation Mono', fontFamily: "'LiberationMono', var(--font-mono)", fontWeight: 600 },
  { id: 'sans', label: () => 'Inter', fontFamily: 'var(--font-sans)', fontWeight: 700 },
];

export default function TimerFontPicker({
  value,
  onChange,
  ariaLabel,
  preview = '0123456789',
  options,
  previewWeight,
}: {
  value: TimerFontOptionId;
  onChange: (id: TimerFontOptionId) => void;
  ariaLabel?: string;
  /** 预览文本(默认数字;选打乱字体时传打乱记号,如 "R U R' F2")。 */
  preview?: string;
  /** 档位子集(默认全部四档;打乱字体没有七段的用法,传 ['sans','mono','liberation'])。 */
  options?: readonly TimerFontOptionId[];
  /** 预览字重。默认按各档计时数字的字重(600/700);打乱字体按实际渲染字重传(如 400)。 */
  previewWeight?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const shown = options ? OPTIONS.filter(o => options.includes(o.id)) : OPTIONS;
  const current = shown.find(o => o.id === value) ?? shown[0];

  return (
    <div ref={ref} className="tfp">
      <button
        type="button"
        className="tfp-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel ?? tr({ zh: '计时器字体', en: 'Timer font' })}
        onClick={() => setOpen(o => !o)}
      >
        <span className="tfp-digits" style={{ fontFamily: current.fontFamily, fontWeight: previewWeight ?? current.fontWeight }}>
          {preview}
        </span>
        <span className="tfp-name">{current.label()}</span>
        <ChevronDown size={14} className="tfp-chevron" />
      </button>
      {open && (
        <div className="tfp-popup" role="listbox">
          {shown.map(o => (
            <button
              key={o.id}
              type="button"
              role="option"
              aria-selected={value === o.id}
              className={`tfp-item${value === o.id ? ' is-active' : ''}`}
              onClick={() => { onChange(o.id); setOpen(false); }}
            >
              <span className="tfp-digits" style={{ fontFamily: o.fontFamily, fontWeight: previewWeight ?? o.fontWeight }}>
                {preview}
              </span>
              <span className="tfp-name">{o.label()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
