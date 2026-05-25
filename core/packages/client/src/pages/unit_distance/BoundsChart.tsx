/**
 * BoundsChart — visualises the four bounds on ν(n) by plotting the *exponent*
 * α(n) = log ν(n) / log n, with x = log₁₀(n). On this scale:
 *   ● the trivial lower bound is α = 1                       (flat baseline)
 *   ● Erdős 1946 conjectured upper:   α ≤ 1 + C/log log n     (decays to 1)
 *   ● Spencer–Szemerédi–Trotter 1984: α ≤ 4/3                 (flat ceiling)
 *   ● Erdős 1946 grid lower:          α ≥ 1 + c/log log n     (decays to 1)
 *   ● OpenAI 2026 NEW lower:          α ≥ 1 + δ               (flat — disproof!)
 *
 * The flat NEW lower eventually crosses the decaying conjectured upper.
 * That crossing is the disproof. A slider for δ moves it.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

const W = 700, H = 380;
const M = { top: 24, right: 18, bottom: 44, left: 56 };
const PW = W - M.left - M.right;
const PH = H - M.top - M.bottom;

// Plot domain
const X_MAX = 100;          // log₁₀(n) ∈ [1, 100]
const Y_MIN = 0.96;
const Y_MAX = 1.42;
const C_CONJ = 0.5;         // constant in Erdős's conjectured upper (visualisation)
const C_GRID = 0.45;        // constant in grid lower (just slightly below conj)

function xPx(logN: number) { return M.left + ((logN - 1) / (X_MAX - 1)) * PW; }
function yPx(alpha: number) { return M.top + (1 - (alpha - Y_MIN) / (Y_MAX - Y_MIN)) * PH; }

// α(n) = 1 + C/log log n, expressed in log₁₀(n)
function alphaErdosForm(logN: number, C: number): number | null {
  const lnN = logN * Math.LN10;
  if (lnN <= Math.E) return null;            // log log n must be positive
  const llN = Math.log(lnN);
  return 1 + C / llN;
}

function buildPath(samples: Array<[number, number | null]>): string {
  let d = '';
  let pen = false;
  for (const [x, y] of samples) {
    if (y === null) { pen = false; continue; }
    const px = xPx(x), py = yPx(y);
    d += (pen ? ' L ' : ' M ') + px.toFixed(1) + ' ' + py.toFixed(1);
    pen = true;
  }
  return d;
}

export default function BoundsChart() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const [delta, setDelta] = useState(0.10);

  // Build sample arrays for each curve
  const xSamples = useMemo(() => {
    const xs: number[] = [];
    for (let i = 0; i <= 400; i++) xs.push(1 + (X_MAX - 1) * (i / 400));
    return xs;
  }, []);

  const pathGrid = useMemo(() => buildPath(xSamples.map(x => [x, alphaErdosForm(x, C_GRID)])), [xSamples]);

  // Crossing of new lower (α = 1+δ) and Erdős conjectured upper (α = 1 + C/log log n)
  // happens when C/log log n = δ ⟹ ln n = e^(C/δ).
  const crossLogN = useMemo(() => {
    const lnLnN = C_CONJ / delta;
    if (lnLnN > 230) return Infinity;
    const lnN = Math.exp(lnLnN);
    return lnN / Math.LN10;
  }, [delta]);

  // Path for conj upper after the crossing — "disproved" segment, drawn dashed/red
  const pathConjDisproved = useMemo(() => {
    return buildPath(xSamples.filter(x => x >= crossLogN).map(x => [x, alphaErdosForm(x, C_CONJ)]));
  }, [xSamples, crossLogN]);
  const pathConjValid = useMemo(() => {
    return buildPath(xSamples.filter(x => x <= crossLogN).map(x => [x, alphaErdosForm(x, C_CONJ)]));
  }, [xSamples, crossLogN]);

  // X-axis ticks at log10(n) = 1, 5, 10, 20, 40, 60, 80, 100
  const xTicks = [1, 5, 10, 20, 40, 60, 80, 100];
  const yTicks = [1.0, 1.1, 1.2, 1.3, 4 / 3, 1.4];

  return (
    <div className="ud-chart">
      <div className="ud-chart-controls">
        <div className="ud-sandbox-slider">
          <label>{t('新下界指数', 'new lower exponent')} 1 + δ = {(1 + delta).toFixed(3)}, &nbsp;δ = {delta.toFixed(3)}</label>
          <input
            type="range" min={0.01} max={0.30} step={0.005}
            value={delta}
            onChange={e => setDelta(parseFloat(e.target.value))}
          />
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="ud-chart-svg">
        {/* axes */}
        <rect x={M.left} y={M.top} width={PW} height={PH}
          fill="var(--ud-surface-2)" stroke="var(--ud-border)" />

        {/* x grid */}
        {xTicks.map(xv => (
          <g key={`x${xv}`}>
            <line x1={xPx(xv)} y1={M.top} x2={xPx(xv)} y2={M.top + PH}
              stroke="var(--ud-grid)" strokeWidth="0.6" />
            <text x={xPx(xv)} y={M.top + PH + 14}
              fontSize="10.5" fill="var(--ud-text-sub)" textAnchor="middle">
              10^{xv}
            </text>
          </g>
        ))}
        {/* y grid */}
        {yTicks.map(yv => (
          <g key={`y${yv.toFixed(3)}`}>
            <line x1={M.left} y1={yPx(yv)} x2={M.left + PW} y2={yPx(yv)}
              stroke="var(--ud-grid)" strokeWidth="0.6" />
            <text x={M.left - 8} y={yPx(yv) + 3.5}
              fontSize="10.5" fill="var(--ud-text-sub)" textAnchor="end">
              {Math.abs(yv - 4 / 3) < 1e-3 ? '4/3' : yv.toFixed(2)}
            </text>
          </g>
        ))}

        {/* axis labels */}
        <text x={M.left + PW / 2} y={H - 8}
          fontSize="12" fill="var(--ud-text)" textAnchor="middle"
          fontFamily="var(--ud-mono)">
          {t('点数 n (对数刻度)', 'n  (log scale)')}
        </text>
        <text x={14} y={M.top + PH / 2}
          fontSize="12" fill="var(--ud-text)" textAnchor="middle"
          fontFamily="var(--ud-mono)"
          transform={`rotate(-90 14 ${M.top + PH / 2})`}>
          {t('指数 α = log ν / log n', 'exponent α = log ν / log n')}
        </text>

        {/* SST upper: α = 4/3 */}
        <line x1={M.left} y1={yPx(4 / 3)} x2={M.left + PW} y2={yPx(4 / 3)}
          stroke="var(--ud-sst)" strokeWidth="2"
          strokeDasharray="6 4" />
        <text x={M.left + PW - 6} y={yPx(4 / 3) - 6}
          fontSize="11" fill="var(--ud-sst)" textAnchor="end"
          fontWeight="600">
          SST 1984: ν ≤ n^4/3
        </text>

        {/* Erdős grid lower */}
        <path d={pathGrid}
          fill="none" stroke="var(--ud-grid-curve)" strokeWidth="2" />
        <text x={xPx(95)} y={yPx(alphaErdosForm(95, C_GRID)!) + 14}
          fontSize="11" fill="var(--ud-grid-curve)" textAnchor="end"
          fontWeight="600">
          Erdős 1946 grid: ν ≥ n · n^(c / log log n)
        </text>

        {/* Erdős conjectured upper — valid segment (above is consistent) */}
        <path d={pathConjValid}
          fill="none" stroke="var(--ud-conj)" strokeWidth="2.2" />
        {/* Disproved segment — dashed and labelled */}
        <path d={pathConjDisproved}
          fill="none" stroke="var(--ud-disproved)" strokeWidth="2.2"
          strokeDasharray="3 3" />

        {/* Highlight the disproved region as a soft band */}
        {Number.isFinite(crossLogN) && crossLogN <= X_MAX && (
          <>
            <rect
              x={xPx(crossLogN)}
              y={yPx(1 + delta)}
              width={Math.max(0, M.left + PW - xPx(crossLogN))}
              height={Math.max(0, yPx(alphaErdosForm(X_MAX, C_CONJ) ?? 1) - yPx(1 + delta))}
              fill="var(--ud-disproved)"
              opacity="0.07"
            />
            <line
              x1={xPx(crossLogN)} y1={M.top}
              x2={xPx(crossLogN)} y2={M.top + PH}
              stroke="var(--ud-disproved)" strokeWidth="1.2"
              strokeDasharray="2 3"
            />
            <text x={xPx(crossLogN) + 4} y={M.top + 14}
              fontSize="10.5" fill="var(--ud-disproved)"
              fontFamily="var(--ud-mono)" fontWeight="600">
              n ≈ 10^{crossLogN.toFixed(crossLogN < 10 ? 1 : 0)}
            </text>
          </>
        )}

        {/* OpenAI new lower: α = 1 + δ */}
        <line x1={M.left} y1={yPx(1 + delta)} x2={M.left + PW} y2={yPx(1 + delta)}
          stroke="var(--ud-new)" strokeWidth="2.6" />
        <text x={xPx(2)} y={yPx(1 + delta) - 6}
          fontSize="11.5" fill="var(--ud-new)" fontWeight="700">
          {t('OpenAI 2026: ν ≥ n^(1+δ)', 'OpenAI 2026: ν ≥ n^(1+δ)')}
        </text>

        {/* trivial baseline */}
        <line x1={M.left} y1={yPx(1)} x2={M.left + PW} y2={yPx(1)}
          stroke="var(--ud-text-mute)" strokeWidth="1" strokeDasharray="1 4" />
        <text x={xPx(2)} y={yPx(1) - 4}
          fontSize="10" fill="var(--ud-text-mute)">
          α = 1 (trivial)
        </text>

        {/* Conjecture label */}
        <text x={xPx(15)} y={yPx(alphaErdosForm(15, C_CONJ)!) - 8}
          fontSize="11.5" fill="var(--ud-conj)" fontWeight="600">
          {t('Erdős 1946 猜想上界', 'Erdős 1946 conjectured upper')}
        </text>
        <text x={xPx(15)} y={yPx(alphaErdosForm(15, C_CONJ)!) + 5}
          fontSize="10" fill="var(--ud-conj)">
          {t('ν ≤ n^(1+C/log log n)', 'ν ≤ n^(1+C/log log n)')}
        </text>
      </svg>

      <p className="ud-sandbox-hint">
        {isZh ? (
          <>
            <strong className="ud-disproved-text">{t('为什么是反驳:', 'Why this is a disproof:')}</strong>
            {' '}Erdős 1946 猜想上界 <span className="ud-mono">1 + C/log log n</span> 随 n 增长是<em>下降</em>到 1 的曲线;OpenAI 2026 的新下界 <span className="ud-mono">1 + δ</span> 是一条<em>水平直线</em>。任何水平直线最终会穿过任何下降到 1 的曲线 — 穿越之后,猜想就破了。改 δ 滑块看穿越点 <span className="ud-mono">n ≈ exp(exp(C/δ))</span>。<br/>
            <span className="ud-text-mute">(图中 C、δ 取夸张值以让穿越在 n ≈ 10^{Math.min(crossLogN, X_MAX).toFixed(0)} 处可见;论文中真实 δ 可能极小,穿越点是天文数字 — 但只要 δ &gt; 0,定理依然成立。)</span>
          </>
        ) : (
          <>
            <strong className="ud-disproved-text">Why this disproves Erdős:</strong>
            {' '}the conjectured upper <span className="ud-mono">1 + C/log log n</span> is a curve <em>decaying</em> to 1; the new lower <span className="ud-mono">1 + δ</span> is a <em>horizontal</em> line. Any flat line eventually crosses any curve decaying to 1 — past the crossing the conjecture fails. Move the δ slider; the crossing sits at <span className="ud-mono">n ≈ exp(exp(C/δ))</span>.<br/>
            <span className="ud-text-mute">(C and δ are exaggerated so the crossover lands at n ≈ 10^{Math.min(crossLogN, X_MAX).toFixed(0)}; the real δ in the paper may be tiny and the crossing astronomical — but δ &gt; 0 is enough.)</span>
          </>
        )}
      </p>
    </div>
  );
}
