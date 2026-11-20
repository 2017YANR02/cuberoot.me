'use client';

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useT } from '@/hooks/useT';
import { TeX, MathProse } from './Math';
import styles from './explorer.module.css';

// LMFDB's first five positive ordinates, rounded to twelve decimal places.
// The lower half-plane has their conjugates since ζ(conj(s)) = conj(ζ(s)).
const heights = [14.134725141735, 21.022039638772, 25.010857580146, 30.424876125860, 32.935061587739];
const realZeros = [-2, -4, -6, -8];
const views = ['upper', 'lower', 'real'] as const;
type View = typeof views[number];
const plot = { left: 46, right: 414, top: 38, bottom: 246 };

// HTML inside a foreignObject shares the SVG viewBox coordinates and scales with its grid.
function PlotLabel({ x, y, width = 48, align = 'center', children }: {
  x: number; y: number; width?: number; align?: 'start' | 'center' | 'end'; children: ReactNode;
}) {
  const left = align === 'start' ? x : align === 'end' ? x - width : x - width / 2;
  return <foreignObject className={styles.plotLabel} x={left} y={y - 15} width={width} height={30}>
    <div className={styles.labelContent} data-align={align}>{children}</div>
  </foreignObject>;
}

export default function RiemannExplorer() {
  const t = useT();
  const id = useId();
  const [view, setView] = useState<View>('upper');
  const [index, setIndex] = useState(0);
  const markerRefs = useRef<Array<SVGGElement | null>>([]);
  const real = view === 'real';
  const count = real ? realZeros.length : heights.length;
  const points = real ? realZeros : heights;
  const modeNames: Record<View, string> = {
    upper: t('正虚部', 'Upper half'),
    lower: t('负虚部', 'Lower half'),
    real: t('实轴', 'Real axis'),
  };
  const xMin = real ? -9 : -0.25, xRange = real ? 11 : 1.5;
  const yMin = real ? -2 : view === 'upper' ? 0 : -36;
  const yRange = real ? 4 : 36;
  const x = (sigma: number) => plot.left + (sigma - xMin) / xRange * (plot.right - plot.left);
  const y = (height: number) => plot.bottom - (height - yMin) / yRange * (plot.bottom - plot.top);
  const height = (j: number) => real ? 0 : heights[j] * (view === 'upper' ? 1 : -1);
  const coordinate = (j: number) => real ? 's = −' + Math.abs(realZeros[j])
    : 's ≈ ½ ' + (view === 'upper' ? '+ ' : '− ') + heights[j].toFixed(9) + 'i';
  const coordinateTeX = (j: number) => real ? `s = ${realZeros[j]}`
    : String.raw`s \approx \tfrac{1}{2} ${view === 'upper' ? '+' : '-'} ${heights[j].toFixed(9)}\,i`;
  function changeView(next: View) {
    setView(next);
    setIndex(Math.min(index, next === 'real' ? realZeros.length - 1 : heights.length - 1));
  }
  function moveMarker(event: KeyboardEvent<SVGGElement>, selected: number) {
    let next = selected;
    switch (event.key) {
      case 'ArrowRight': case 'ArrowUp': next = Math.min(count - 1, selected + 1); break;
      case 'ArrowLeft': case 'ArrowDown': next = Math.max(0, selected - 1); break;
      case 'Home': next = 0; break;
      case 'End': next = count - 1; break;
      case 'Enter': case ' ': break;
      default: return;
    }
    event.preventDefault();
    setIndex(next);
    markerRefs.current[next]?.focus();
  }
  const yTicks = real ? [-2, -1, 0, 1, 2] : [0, 10, 20, 30].map(n => view === 'upper' ? n : -n);
  const xTicks = real ? [-8, -6, -4, -2, 0, 2] : [0, 0.5, 1];
  const detail = real
    ? t(String.raw`所有负偶数都是 \(\zeta\) 的零点，依次是 \(-2,-4,-6,\ldots\)。它们叫作平凡零点，位置可以精确写出。`,
        String.raw`Every negative even integer is a zero of \(\zeta\). These are the trivial zeros, at exactly \(-2,-4,-6,\ldots\).`)
    : view === 'upper'
      ? t(String.raw`这里画出虚部为正的前五个非平凡零点。它们的横坐标都是 \(\tfrac12\)，纵坐标给出它们离实轴的高度。`,
          String.raw`These are the first five nontrivial zeros above the real axis. Each has horizontal coordinate \(\tfrac12\). Its vertical coordinate is its height above the axis.`)
      : t(String.raw`\(\zeta\) 的零点关于实轴成对出现。选中的点是上半平面对应零点的镜像，实部相同，虚部正负相反。`,
          String.raw`Zeros of \(\zeta\) occur in conjugate pairs. This point mirrors its partner across the real axis. The real part stays the same and the imaginary part changes sign.`);

  return <section id="zeros" className={styles.explorer} aria-labelledby={id + '-heading'}>
    <h2 id={id + '-heading'}>{t('零点在哪里？', 'Where are the zeros?')}</h2>
    <p className={styles.intro}><MathProse>{t(
      String.raw`把复数 \(s\) 想成地图上的一个点。横坐标是实部，纵坐标是虚部。例如 \(\tfrac12+14i\) 表示向右半个单位、向上 \(14\) 个单位。黎曼 \(\zeta\) 函数为每个这样的输入算出一个值（\(s=1\) 是一个极点）。让 \(\zeta(s)=0\) 的输入，就叫作它的零点。`,
      String.raw`Think of a complex number \(s\) as a point on a map. Its real part tells you how far across and its imaginary part how far up. For example, \(\tfrac12+14i\) is half a unit to the right and \(14\) units up. The Riemann zeta function \(\zeta\) assigns a value to each input except at its pole \(s=1\). A zero is an input where \(\zeta(s)=0\).`
    )}</MathProse></p>
    <figure className={styles.figure} data-site-surface="panel">
      <div className={styles.toolbar}>
        <h3><MathProse>{t(String.raw`\(\zeta\) 零点的复平面图`, String.raw`Zeros of \(\zeta\) in the complex plane`)}</MathProse></h3>
        <div className={styles.switches} role="group" aria-label={t('图上显示的区域', 'Region shown')}>
          {views.map(mode => <button className={styles.viewButton} key={mode} type="button" aria-pressed={mode === view} onClick={() => changeView(mode)}>{modeNames[mode]}</button>)}
        </div>
      </div>
      <div className={styles.plotRow}>
        <svg className={styles.plot} viewBox="0 0 438 292" role="group" aria-labelledby={id + '-plot-title'} aria-describedby={id + '-plot-desc'}>
          <title id={id + '-plot-title'}>{t('复平面中的零点，可选择各点查看坐标', 'Zeros in the complex plane; select a point to inspect it')}</title>
          <desc id={id + '-plot-desc'}>{t('横轴表示实部，纵轴表示虚部。使用方向键选择零点。', 'The horizontal axis is the real part and the vertical axis is the imaginary part. Use the arrow keys to select a zero.')}</desc>
          {!real && <>
            <rect className={styles.strip} x={x(0)} y={plot.top} width={x(1) - x(0)} height={plot.bottom - plot.top} />
            <line className={styles.boundary} x1={x(1)} y1={plot.top} x2={x(1)} y2={plot.bottom} />
          </>}
          {yTicks.map(tick => <g key={tick}>
            <line className={tick === 0 ? styles.axis : styles.gridLine} x1={plot.left} y1={y(tick)} x2={plot.right} y2={y(tick)} />
            <PlotLabel x={plot.left - 8} y={y(tick)} width={36} align="end"><TeX src={String(tick)} /></PlotLabel>
          </g>)}
          <line className={styles.axis} x1={x(0)} y1={plot.top} x2={x(0)} y2={plot.bottom} />
          {!real && <>
            <line className={styles.critical} x1={x(.5)} y1={plot.top} x2={x(.5)} y2={plot.bottom} />
            <PlotLabel x={x(.5)} y={17} width={164}>{t('临界线', 'Critical line')} <TeX src={String.raw`\operatorname{Re}(s)=\tfrac12`} /></PlotLabel>
          </>}
          <PlotLabel x={plot.left} y={17} width={46} align="start"><TeX src={String.raw`\operatorname{Im}(s)`} /></PlotLabel>
          <PlotLabel x={plot.right} y={280} width={50} align="end"><TeX src={String.raw`\operatorname{Re}(s)`} /></PlotLabel>
          {xTicks.map(tick => <PlotLabel key={tick} x={x(tick)} y={plot.bottom + 16}><TeX src={tick === .5 ? String.raw`\tfrac12` : String(tick)} /></PlotLabel>)}
          {points.map((_, j) => {
            const cx = x(real ? realZeros[j] : .5), cy = y(height(j));
            return <g key={view + j} className={styles.marker} role="button" tabIndex={j === index ? 0 : -1}
              ref={el => { markerRefs.current[j] = el; }} aria-label={coordinate(j)} aria-pressed={j === index}
              onKeyDown={event => moveMarker(event, j)} onClick={() => setIndex(j)} transform={`translate(${cx} ${cy})`}>
              <circle className={styles.target} r="12" />
              <circle className={styles.ring} r="8.5" />
              <circle className={styles.dot} r="4.4" />
            </g>;
          })}
        </svg>
        <div className={styles.controls}>
          <label htmlFor={id + '-selector'}>{t('选择零点', 'Select a zero')}<span>{t(`第 ${index + 1} 个，共 ${count} 个`, `${index + 1} of ${count}`)}</span></label>
          <input className={styles.zeroSlider} id={id + '-selector'} type="range" min="1" max={count} step="1" value={index + 1}
            aria-valuetext={coordinate(index)} onChange={event => setIndex(Number(event.target.value) - 1)} />
          <output className={styles.coordinate} htmlFor={id + '-selector'} aria-live="polite"><TeX src={coordinateTeX(index)} /></output>
          <p><MathProse>{detail}</MathProse></p>
        </div>
      </div>
      <figcaption><MathProse>{real
        ? t('实轴上的这串零点可以一直向左延伸。黎曼猜想讨论的是其余的零点。切换到正虚部或负虚部即可查看例子。', 'This series of zeros extends indefinitely to the left along the real axis. The Riemann Hypothesis concerns the remaining zeros. Choose the upper or lower half to see examples.')
        : t(String.raw`阴影带是 \(0<\operatorname{Re}(s)<1\) 的区域，所有非平凡零点都在其中。黎曼猜想进一步断言，它们无一例外地位于正中间的临界线上。图上有限的几个点只能展示这个断言的含义。`,
            String.raw`The shaded strip is the region \(0<\operatorname{Re}(s)<1\). Every nontrivial zero lies inside it. The Riemann Hypothesis places every one of them on the line down the middle. A finite sample illustrates what that claim means.`)}</MathProse></figcaption>
    </figure>
    <p className={styles.source}>{t('纵坐标取自', 'The heights come from the')} <a href="https://www.lmfdb.org/zeros/zeta/list?N=1&amp;limit=5">{t('LMFDB 零点表', 'LMFDB zero table')}</a>{t('，图中按显示精度取近似值。', ' and are rounded for display.')} <a href="https://dlmf.nist.gov/25.10"><MathProse>{t(String.raw`NIST 的 \(\zeta\) 零点定义与性质`, String.raw`NIST on the zeros of \(\zeta\)`)}</MathProse></a></p>
  </section>;
}
