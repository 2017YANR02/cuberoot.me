'use client';

/**
 * Hoeffding 概率界互动:三个旋钮(样本量 |S|, 容差 t, 界限常数 C)
 *   Pr[|μ̂ - μ| ≥ t]  ≤  2 exp(-2|S|·t² / C²)
 *
 * 论文用 C=205 (Human's Number) 得到 |S|/1,541,939 那个系数;C=20 是
 * "close pair" 论证后的小常数,把样本量从 ~3e8 降到 5e5 级。
 */
import { useMemo } from 'react';
import { TeX } from '../../god/_components/Tex';
import { tr } from '@/i18n/tr';

type CMode = 'human' | 'close';

interface Props {
  isZh: boolean;
  sampleSize: number;
  tolerance: number;
  cMode: CMode;
  onSampleSize: (n: number) => void;
  onTolerance: (t: number) => void;
  onCMode: (m: CMode) => void;
}

function fmtSci(x: number): string {
  if (x === 0) return '0';
  if (x >= 1e-4 && x < 1e6) return x.toPrecision(4);
  const exp = Math.floor(Math.log10(Math.abs(x)));
  const mant = (x / 10 ** exp).toPrecision(3);
  return `${mant}×10^${exp}`;
}

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function fmtTime(sec: number, isZh: boolean): string {
  if (sec < 60) return `${sec.toFixed(1)} ${tr({ zh: '秒', en: 's' })}`;
  if (sec < 3600) return `${(sec / 60).toFixed(1)} ${tr({ zh: '分', en: 'min' })}`;
  if (sec < 86400) return `${(sec / 3600).toFixed(1)} ${tr({ zh: '小时', en: 'h',
      zhHant: "小時"
})}`;
  if (sec < 86400 * 365) return `${(sec / 86400).toFixed(1)} ${tr({ zh: '天', en: 'd' })}`;
  return `${(sec / 86400 / 365).toFixed(2)} ${tr({ zh: '年', en: 'yr' })}`;
}

export default function HoeffdingExplorer({
  isZh,
  sampleSize, tolerance, cMode,
  onSampleSize, onTolerance, onCMode,
}: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);

  // 样本量在 log 空间滑(1e3 .. 1e9)
  const sLog = Math.log10(sampleSize);

  const C = cMode === 'human' ? 205 : 20;

  const prob = useMemo(() => {
    return 2 * Math.exp(-2 * sampleSize * tolerance * tolerance / (C * C));
  }, [sampleSize, tolerance, C]);

  // 解算反向: 要达到 prob = p_target 需要的 |S|
  // 2 exp(-2 N t² / C²) ≤ p ⇒ N ≥ (C²/2t²) · ln(2/p)
  const sampleFor01 = Math.ceil((C * C / (2 * tolerance * tolerance)) * Math.log(2 / 0.01));
  const sampleFor1e7 = Math.ceil((C * C / (2 * tolerance * tolerance)) * Math.log(2 / 1e-7));

  // 计算时间估算: 论文 0.2 s/sample × 8 并行 = 0.025 s 等效 wall time/sample
  // 这里给两个版本: 现代笔记本(8 核, 0.025 s/sample); 单线程(0.2 s/sample)
  const secs8 = sampleSize * 0.2 / 8;
  const secs1 = sampleSize * 0.2;

  // 推出的 D 上界 (当 μ̂ = 18.3189 时): D ≤ 2μ̂ + 2t,向上取整
  const muHat = 18.3189;
  const dBound = Math.floor(2 * muHat + 2 * tolerance) + (Math.abs(2 * muHat + 2 * tolerance - Math.floor(2 * muHat + 2 * tolerance)) > 1e-9 ? 1 : 0);

  // 图表数据: 在 sLog 邻域绘制概率随 |S| 的衰减
  const chart = useMemo(() => {
    const W = 480, H = 180, PADL = 40, PADR = 12, PADT = 12, PADB = 28;
    const innerW = W - PADL - PADR;
    const innerH = H - PADT - PADB;
    // X 轴: log10 |S| from 3 to 9
    const xMin = 3, xMax = 9;
    // Y 轴: log10 prob, from 0 (p=1) down to -30
    const yMin = -30, yMax = 1;

    const xFor = (l: number) => PADL + ((l - xMin) / (xMax - xMin)) * innerW;
    const yFor = (l: number) => PADT + ((yMax - l) / (yMax - yMin)) * innerH;

    const makeCurve = (Cval: number, tol: number) => {
      const pts: Array<{ x: number; y: number }> = [];
      for (let l = xMin; l <= xMax; l += 0.1) {
        const N = 10 ** l;
        const p = Math.min(1, 2 * Math.exp(-2 * N * tol * tol / (Cval * Cval)));
        const lp = Math.log10(Math.max(p, 1e-31));
        pts.push({ x: xFor(l), y: yFor(lp) });
      }
      return pts.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ');
    };

    return {
      W, H, PADL, PADR, PADT, PADB, innerW, innerH,
      xFor, yFor,
      pathNaive: makeCurve(205, tolerance),
      pathClose: makeCurve(20, tolerance),
      markerNaive: { x: xFor(sLog), y: yFor(Math.log10(Math.max(2 * Math.exp(-2 * sampleSize * tolerance * tolerance / (205 * 205)), 1e-31))) },
      markerClose: { x: xFor(sLog), y: yFor(Math.log10(Math.max(2 * Math.exp(-2 * sampleSize * tolerance * tolerance / (20 * 20)), 1e-31))) },
      xMin, xMax, yMin, yMax,
    };
  }, [tolerance, sampleSize, sLog]);

  return (
    <div className="dg-interactive">
      <div className="dg-controls">
        <div className="dg-ctrl">
          <div className="dg-ctrl-label">
            <span>{t('样本量 ', 'Sample size ')}<TeX src="|S|" /></span>
            <span className="dg-ctrl-value">{fmtInt(sampleSize)}</span>
          </div>
          <input
            type="range"
            min={3} max={9} step={0.05}
            value={sLog}
            onChange={(e) => onSampleSize(10 ** parseFloat(e.target.value))}
          />
          <div className="dg-ctrl-label" style={{ fontSize: '0.7rem', marginTop: 2 }}>
            <span>10³</span><span>10⁹</span>
          </div>
        </div>

        <div className="dg-ctrl">
          <div className="dg-ctrl-label">
            <span>{t('容差 ', 'Tolerance ')}<TeX src="t" /></span>
            <span className="dg-ctrl-value">{tolerance.toFixed(3)}</span>
          </div>
          <input
            type="range"
            min={0.02} max={0.5} step={0.01}
            value={tolerance}
            onChange={(e) => onTolerance(parseFloat(e.target.value))}
          />
          <div className="dg-ctrl-label" style={{ fontSize: '0.7rem', marginTop: 2 }}>
            <span>0.02</span><span>0.50</span>
          </div>
        </div>

        <div className="dg-ctrl">
          <div className="dg-ctrl-label">
            <span>{t('上界常数 ', 'Bound constant ')}<TeX src="C" /></span>
          </div>
          <div className="dg-radio-row" role="tablist">
            <button
              type="button"
              className={cMode === 'human' ? 'is-active' : ''}
              onClick={() => onCMode('human')}
            >C = 205</button>
            <button
              type="button"
              className={cMode === 'close' ? 'is-active' : ''}
              onClick={() => onCMode('close')}
            >C = 20</button>
          </div>
          <div className="dg-ctrl-label" style={{ fontSize: '0.72rem', marginTop: 4, fontWeight: 400 }}>
            {cMode === 'human'
              ? t('朴素:Human\'s Number 给出 d(s) ∈ [0,205]', "Naive: Human's Number gives d(s) ∈ [0,205]")
              : t('精细:在「close pair」上 d(s) ∈ [0,20]', 'Refined: on "close pairs" d(s) ∈ [0,20]')}
          </div>
        </div>
      </div>

      {/* Decay chart */}
      <svg className="dg-chart" viewBox={`0 0 ${chart.W} ${chart.H}`} aria-hidden="true">
        {/* axis */}
        <line className="dg-chart-axis" x1={chart.PADL} y1={chart.PADT} x2={chart.PADL} y2={chart.H - chart.PADB} />
        <line className="dg-chart-axis" x1={chart.PADL} y1={chart.H - chart.PADB} x2={chart.W - chart.PADR} y2={chart.H - chart.PADB} />
        {/* y ticks */}
        {[1, -3, -7, -10, -20, -30].map((l) => (
          <g key={l}>
            <line className="dg-chart-tick"
                  x1={chart.PADL} x2={chart.W - chart.PADR}
                  y1={chart.yFor(l)} y2={chart.yFor(l)} />
            <text className="dg-chart-tick-label"
                  x={chart.PADL - 4} y={chart.yFor(l) + 3}
                  textAnchor="end">10{l < 0 ? `⁻${-l}` : l === 0 ? '⁰' : ''}</text>
          </g>
        ))}
        {/* x ticks */}
        {[3, 4, 5, 6, 7, 8, 9].map((l) => (
          <g key={l}>
            <text className="dg-chart-tick-label"
                  x={chart.xFor(l)} y={chart.H - chart.PADB + 14}
                  textAnchor="middle">10{['³','⁴','⁵','⁶','⁷','⁸','⁹'][l - 3]}</text>
          </g>
        ))}
        <text className="dg-chart-label" x={chart.W / 2} y={chart.H - 4} textAnchor="middle">|S|</text>
        <text className="dg-chart-label" x={10} y={chart.PADT + 6}>{t('失败概率', 'Pr[fail]')}</text>

        {/* paths */}
        <path className="dg-chart-line is-naive" d={chart.pathNaive} />
        <path className="dg-chart-line is-improved" d={chart.pathClose} />

        {/* current marker */}
        <line className="dg-chart-tick"
              x1={chart.xFor(sLog)} x2={chart.xFor(sLog)}
              y1={chart.PADT} y2={chart.H - chart.PADB}
              stroke="var(--dg-text-mute)" strokeDasharray="3 3" strokeWidth={1} />
        <circle
          className="dg-chart-marker is-naive"
          cx={chart.markerNaive.x} cy={chart.markerNaive.y} r={4}
          opacity={cMode === 'human' ? 1 : 0.35}
        />
        <circle
          className="dg-chart-marker is-improved"
          cx={chart.markerClose.x} cy={chart.markerClose.y} r={4}
          opacity={cMode === 'close' ? 1 : 0.35}
        />
      </svg>
      <div className="dg-chart-legend">
        <span className="dg-chart-legend-item">
          <span className="dg-chart-legend-swatch is-naive" />
          {t('Naive (C=205, 朴素 Hoeffding)', 'Naive (C=205, plain Hoeffding)')}
        </span>
        <span className="dg-chart-legend-item">
          <span className="dg-chart-legend-swatch is-improved" />
          {t('Refined (C=20, close-pair 论证后)', 'Refined (C=20, after close-pair argument)')}
        </span>
      </div>

      {/* readout */}
      <div className="dg-readout">
        <div className="dg-readout-item">
          <div className="dg-readout-label">{t('当前失败概率', 'Pr[fail] now')}</div>
          <div className={`dg-readout-val ${prob < 1e-4 ? 'is-good' : prob > 0.1 ? 'is-bad' : ''}`}>
            {fmtSci(prob)}
          </div>
        </div>
        <div className="dg-readout-item">
          <div className="dg-readout-label">{t('要 1% 失败需 |S|', 'Need |S| for 1% err')}</div>
          <div className="dg-readout-val">{fmtInt(sampleFor01)}</div>
        </div>
        <div className="dg-readout-item">
          <div className="dg-readout-label">{t('要 10⁻⁷ 失败需 |S|', 'Need |S| for 10⁻⁷ err')}</div>
          <div className="dg-readout-val">{fmtInt(sampleFor1e7)}</div>
        </div>
        <div className="dg-readout-item">
          <div className="dg-readout-label">{t('单核耗时 (0.2 s/sample)', 'Single-core (0.2 s/sample)')}</div>
          <div className="dg-readout-val">{fmtTime(secs1, isZh)}</div>
        </div>
        <div className="dg-readout-item">
          <div className="dg-readout-label">{t('8 核耗时', '8-core wall')}</div>
          <div className="dg-readout-val">{fmtTime(secs8, isZh)}</div>
        </div>
        <div className="dg-readout-item">
          <div className="dg-readout-label">{t('推出 D ≤', 'Implied D ≤')}</div>
          <div className="dg-readout-val">{dBound} HTM</div>
        </div>
      </div>

      <p className="dg-sampler-note">
        {isZh ? (
          <>读法:取 <TeX src={`|S| = ${fmtInt(sampleSize)}`} />、容差 <TeX src={`t = ${tolerance.toFixed(2)}`} /> 时,Hoeffding 给出 Pr[<TeX src="|\hat\mu - \mu|" /> ≥ <TeX src={`${tolerance.toFixed(2)}`} />] ≤ <span style={{ fontFamily: 'var(--dg-mono)' }}>{fmtSci(prob)}</span>。把 <TeX src="C" /> 从 205 换到 20 后,达到同精度只需 <TeX src="(205/20)^2 \approx 105" /> 倍更少的样本。</>
        ) : (
          <>How to read: at <TeX src={`|S| = ${fmtInt(sampleSize)}`} />, <TeX src={`t = ${tolerance.toFixed(2)}`} />, Hoeffding gives Pr[<TeX src="|\hat\mu - \mu|" /> ≥ <TeX src={`${tolerance.toFixed(2)}`} />] ≤ <span style={{ fontFamily: 'var(--dg-mono)' }}>{fmtSci(prob)}</span>. Dropping <TeX src="C" /> from 205 to 20 cuts the required samples by <TeX src="(205/20)^2 \approx 105" /> × for the same accuracy.</>
        )}
      </p>
    </div>
  );
}
