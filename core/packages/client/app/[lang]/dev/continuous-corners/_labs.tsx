'use client';

import { useId, useState, type ReactNode } from 'react';
import { continuousCorners, concentricCornerRadii, continuousCornerRadii } from '@2017yanr02/continuous-corners';
import { useT } from '@/hooks/useT';
import { TeX } from '@/components/math/Tex';
import { T } from '@/i18n/tr';

function Slider({ label, value, min, max, step = 1, onChange }: {
  label: ReactNode; value: number; min: number; max: number; step?: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return <div className="cc-slider">
    <label htmlFor={id}>{label}<output htmlFor={id}>{value}</output></label>
    <input className="cc-range-input" id={id} type="range" min={min} max={max} step={step} value={value}
      onChange={event => onChange(Number(event.target.value))} />
  </div>;
}

export function CornerLab() {
  const t = useT();
  const [width, setWidth] = useState(280);
  const [height, setHeight] = useState(180);
  const [radius, setRadius] = useState(48);
  const [view, setView] = useState('overlay');
  const shape = continuousCorners({ width, height, radius });
  const [message, setMessage] = useState('');
  const id = useId();
  const code = `continuousCorners({ width: ${width}, height: ${height}, radius: ${radius} })`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><path d="${shape.d}" fill="currentColor"/></svg>`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(svg);
      setMessage(t('SVG 已复制', 'SVG copied'));
    } catch {
      setMessage(t('复制不可用，可展开下方 SVG 手动复制。', 'Copy unavailable. Expand the SVG below to copy it manually.'));
    }
  }
  return <div className="cc-lab" data-site-surface="panel">
    <div className="cc-stage">
      <svg viewBox="-40 -36 440 322" role="img" aria-label={t('实线是库的导出路径重建，虚线是圆弧圆角', 'Solid: reconstructed exported path. Dashed: circular corners.')}>
        <defs><pattern id={id} width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" className="cc-grid-dot" /></pattern></defs>
        <rect x="-40" y="-36" width="440" height="322" fill={`url(#${id})`} />
        <g transform={`translate(${(360 - width) / 2}, ${(250 - height) / 2})`}>
          {view !== 'circle' && <path d={shape.d} className="cc-path-fill" />}
          {view !== 'path' && <rect width={width} height={height} rx={shape.effectiveRadius} className="cc-circle-line" />}
          <path d={`M0 ${height + 15} v6 M0 ${height + 18} H${width} M${width} ${height + 15} v6`} className="cc-measure" />
          <text x={width / 2} y={height + 35} textAnchor="middle" className="cc-svg-caption">{width} × {height}</text>
        </g>
      </svg>
      <div className="cc-legend"><span><i className="cc-solid-key" />{t('路径重建', 'Path reconstruction')}</span><span><i className="cc-dash-key" />{t('圆弧圆角', 'Circular corners')}</span></div>
    </div>
    <div className="cc-controls">
      <p className="cc-eyebrow">{t('几何实验室', 'Geometry lab')}</p>
      <h3>{t('同一个半径，两种轮廓。', 'One radius. Two contours.')}</h3>
      <Slider label={t('宽度', 'Width')} value={width} min={100} max={360} onChange={setWidth} />
      <Slider label={t('高度', 'Height')} value={height} min={60} max={250} onChange={setHeight} />
      <Slider label={t('名义半径', 'Nominal radius')} value={radius} min={0} max={125} onChange={setRadius} />
      <label className="cc-select">{t('显示', 'Display')}<select className="cc-view-select" value={view} onChange={e => setView(e.target.value)}>
        <option value="overlay">{t('叠加对比', 'Overlay')}</option>
        <option value="path">{t('仅路径重建', 'Reconstructed path')}</option>
        <option value="circle">{t('仅圆弧', 'Circular only')}</option>
      </select></label>
      <p className="cc-caption">{t('有效半径', 'Effective radius')} = {shape.effectiveRadius} · {t('逻辑单位', 'logical units')}</p>
      <code className="cc-inline-code">{code}</code>
      <button className="cc-button cc-button-secondary" onClick={copy}>{t('复制当前 SVG', 'Copy SVG')}</button>
      <span className="cc-feedback" role="status">{message}</span>
    </div>
    <details className="cc-code-details"><summary>{t('查看当前 SVG 路径', 'Inspect the current SVG path')}</summary><pre><code>{svg}</code></pre></details>
  </div>;
}

type Point = readonly [number, number];
const lerp = (a: Point, b: Point, t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const points: readonly Point[] = [[44, 250], [44, 100], [160, 44], [300, 44]];
const pair = (p: Point) => `${p[0]},${p[1]}`;

export function BezierLab() {
  const t = useT();
  const [value, setValue] = useState(.45);
  const a = [lerp(points[0]!, points[1]!, value), lerp(points[1]!, points[2]!, value), lerp(points[2]!, points[3]!, value)];
  const b = [lerp(a[0]!, a[1]!, value), lerp(a[1]!, a[2]!, value)];
  const p = lerp(b[0]!, b[1]!, value);
  return <div className="cc-lab cc-bezier" data-site-surface="panel">
    <div className="cc-stage">
      <svg viewBox="0 0 350 300" role="img" aria-label={t('德卡斯特里奥插值示例', 'De Casteljau interpolation example')}>
        <polyline points={points.map(pair).join(' ')} className="cc-control-polygon" />
        <path d={`M${pair(points[0]!)} C${pair(points[1]!)} ${pair(points[2]!)} ${pair(points[3]!)}`} className="cc-bezier-line" />
        <polyline points={a.map(pair).join(' ')} className="cc-interpolate-one" />
        <line x1={b[0]![0]} y1={b[0]![1]} x2={b[1]![0]} y2={b[1]![1]} className="cc-interpolate-two" />
        {points.map(([x,y], i) => <g key={i}><circle cx={x} cy={y} r="5" className="cc-anchor" /><text x={x + 10} y={y + 20} className="cc-svg-caption">P{i}</text></g>)}
        {a.map(([x,y],i) => <circle key={i} cx={x} cy={y} r="4" className="cc-first-point" />)}
        {b.map(([x,y],i) => <circle key={i} cx={x} cy={y} r="4" className="cc-second-point" />)}
        <circle cx={p[0]} cy={p[1]} r="8" className="cc-moving-point" />
        <text x={p[0] + 13} y={p[1] - 13} className="cc-svg-caption">B(t)</text>
      </svg>
    </div>
    <div className="cc-controls">
      <p className="cc-eyebrow">DE CASTELJAU</p>
      <h3>{t('一条曲线，来自三次插值。', 'A curve from three rounds of interpolation.')}</h3>
      <p><T zh={<>四个点先变成三个点，再变成两个点，最后得到曲线上的一个点。拖动 <TeX src="t" />，观察构造过程。</>} en={<>Four points become three, then two, then one point on the curve. Move <TeX src="t" /> to follow the construction.</>} /></p>
      <Slider label={<T zh={<>参数 <TeX src="t" /></>} en={<>Parameter <TeX src="t" /></>} />} value={value} min={0} max={1} step={.01} onChange={setValue} />
      <p className="cc-caption"><T zh={<>参数 <TeX src="t" /> 均匀变化，并不代表沿曲线匀速移动。</>} en={<>Equal changes in <TeX src="t" /> do not imply equal distances along the curve.</>} /></p>
    </div>
  </div>;
}

export function ConcentricLab() {
  const t = useT();
  const [inset, setInset] = useState(20);
  const [top, setTop] = useState(32);
  const outer = { x: 0, y: 0, width: 320, height: 240, radii: [64, 64, 64, 64] as const };
  const frame = { x: inset, y: top, width: 320 - inset * 2, height: 240 - top * 2 };
  const radii = concentricCornerRadii(frame, outer)!;
  const parent = continuousCornerRadii(outer);
  const child = continuousCornerRadii({ ...frame, radii });
  return <div className="cc-lab" data-site-surface="panel">
    <div className="cc-stage">
      <svg viewBox="-25 -25 370 290" role="img" aria-label={t('根据矩形容器和子视图间距计算四角半径', 'Corner radii resolved from a rectangular container and child insets')}>
        <path d={parent.d} className="cc-container-fill" />
        <g transform={`translate(${inset},${top})`}><path d={child.d} className="cc-path-fill" />
          <text x={frame.width / 2} y={frame.height / 2 - 6} textAnchor="middle" className="cc-radius-label">r = {radii[0]}</text>
          <text x={frame.width / 2} y={frame.height / 2 + 21} textAnchor="middle" className="cc-svg-caption">{t('内层半径', 'Inner radius')}</text>
        </g>
      </svg>
    </div>
    <div className="cc-controls">
      <p className="cc-eyebrow">{t('容器实验室', 'Container lab')}</p>
      <h3>{t('圆角，也懂彼此的距离。', 'Corners that understand their surroundings.')}</h3>
      <Slider label={t('左右内缩', 'Horizontal inset')} value={inset} min={4} max={70} onChange={setInset} />
      <Slider label={t('上下内缩', 'Vertical inset')} value={top} min={4} max={70} onChange={setTop} />
      <p>{t('外层半径固定为 64。内层使用两条相邻边距离的较大值，再扣除、截断并限制到短边的一半。', 'The outer radius is 64. The inner radius subtracts the larger adjacent-edge distance, then clamps to zero and half the shorter side.')}</p>
      <code className="cc-inline-code">[{radii.join(', ')}]</code>
      <p className="cc-caption">{t('半径顺序：左上 → 右上 → 右下 → 左下。', 'Radius order: top-left → top-right → bottom-right → bottom-left.')}</p>
    </div>
  </div>;
}
