/**
 * LuckyLimitPage — /wca/prediction/lucky
 *
 * 极限单次成绩 = "最幸运 scramble" 下界:
 *   - 每个 puzzle 有一个深度分布: 多少个状态恰好 k 步可解.
 *   - WCA 每年累计生成 N 个 scramble (含备用), 独立均匀采样.
 *   - 在 N 次采样中, 期望最小步数 m(N) = argmin k 满足 N · P(d ≤ k) ≥ 1.
 *   - 单次极限 T(N) = m(N) / TPS_ceil + setup_s.
 *
 * 当 N → ∞ (年份 → ∞): m → k_min_WCA, T → k_min_WCA / TPS_ceil + setup_s.
 * 对 3x3, k_min_WCA = 2, TPS_ceil = 17, setup_s = 0.15 → T_∞ ≈ 0.27 s.
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import ThemeToggle from '../../components/ThemeToggle';
import { EVENTS, formatVal } from './events';
import {
  LUCKY_EVENTS,
  cumScrambles,
  expectedLuckyDepth,
  sliderToYear,
  yearToSlider,
  formatYear,
  formatBigN,
} from './lucky_data';
import { LineChart, type Series } from './charts';
import './prediction.css';
import './lucky.css';

interface Row {
  ev: typeof EVENTS[number];
  N: number;
  depth: number;
  depthClamped: number;
  timeCeil: number;
  timeNow: number;
  k_min_wca: number;
  tps_ceil: number;
  tps_now: number;
  setup_s: number;
  source: 'exact' | 'partial' | 'approx';
  notes_zh?: string;
  notes_en?: string;
}

export default function LuckyLimitPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  // URL ?year= state
  const initialYear = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const y = parseFloat(params.get('year') ?? '');
    if (isFinite(y) && y >= 2003) return y;
    return new Date().getFullYear();
  }, []);

  const [sliderValue, setSliderValue] = useState<number>(() => yearToSlider(initialYear));
  const year = useMemo(() => sliderToYear(sliderValue), [sliderValue]);

  const setYearDirect = useCallback((y: number) => {
    setSliderValue(yearToSlider(y));
  }, []);

  // Persist year to URL
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('year', Math.round(year).toString());
    window.history.replaceState(null, '', url.toString());
  }, [year]);

  const toggleLang = () => {
    const n = isZh ? 'en' : 'zh';
    i18n.changeLanguage(n);
    localStorage.setItem('trainer-lang', n);
  };

  // Compute per-event rows
  const rows: Row[] = useMemo(() => {
    const list: Row[] = [];
    for (const ev of EVENTS) {
      const lucky = LUCKY_EVENTS[ev.id];
      if (!lucky) continue;
      const N = cumScrambles(ev.id, year);
      const depth = expectedLuckyDepth(lucky.dist, N);
      const depthClamped = Math.max(depth, lucky.dist.k_min_wca);
      const timeCeil = depthClamped / lucky.tps_ceil + lucky.setup_s;
      const timeNow = depthClamped / lucky.tps_now + lucky.setup_s;
      list.push({
        ev,
        N,
        depth,
        depthClamped,
        timeCeil,
        timeNow,
        k_min_wca: lucky.dist.k_min_wca,
        tps_ceil: lucky.tps_ceil,
        tps_now: lucky.tps_now,
        setup_s: lucky.setup_s,
        source: lucky.dist.source,
        notes_zh: lucky.notes_zh,
        notes_en: lucky.notes_en,
      });
    }
    return list;
  }, [year]);

  // Chart series: 3x3 lucky time over year (sampled along slider domain)
  // X 轴用 log10(year - 2002) 避免极大 year 让 LineChart 的 tick 循环爆栈.
  // xFormat 反算回 year 用于显示.
  const yearToLogX = (y: number) => Math.log10(Math.max(1, y - 2002));
  const logXToYear = (x: number) => 2002 + Math.pow(10, x);

  const chartSeries: Series[] = useMemo(() => {
    const sampleS = Array.from({ length: 120 }, (_, i) => i / 119);
    const eventIds = ['333', '222', '444', '555', 'pyram', 'skewb'];
    const colors: Record<string, string> = {
      '333': '#dc2626',
      '222': '#16a34a',
      '444': '#2563eb',
      '555': '#9333ea',
      'pyram': '#ea580c',
      'skewb': '#ca8a04',
    };
    return eventIds.map((id): Series => {
      const ev = EVENTS.find((e) => e.id === id);
      const lucky = LUCKY_EVENTS[id];
      if (!ev || !lucky) return { name: id, color: '#888', data: [] };
      const data = sampleS.map((s) => {
        const y = sliderToYear(s);
        const N = cumScrambles(id, y);
        const depth = Math.max(expectedLuckyDepth(lucky.dist, N), lucky.dist.k_min_wca);
        const time = depth / lucky.tps_ceil + lucky.setup_s;
        return { x: yearToLogX(y), y: time };
      });
      return {
        name: isZh ? ev.name_zh : ev.name_en,
        color: colors[id] ?? '#888',
        data,
      };
    });
  }, [isZh]);

  // Pick the 3x3 row for headline
  const row333 = rows.find((r) => r.ev.id === '333');
  const lucky333 = LUCKY_EVENTS['333'];

  return (
    <div className="pred-page">
      <header className="pred-header">
        <Link to="/wca/prediction" className="pred-back" aria-label="back">
          <ArrowLeft size={16} />
          <span>{isZh ? '极限预测' : 'Prediction Hub'}</span>
        </Link>
        <button className="pred-lang" onClick={toggleLang}>
          {isZh ? 'EN' : '中文'}
        </button>
        <ThemeToggle />
      </header>

      <article className="pred-article" style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 28px 80px' }}>
        <h1 className="pred-title">
          {isZh ? '运气极限: 数学上的"不可能更快"下界' : 'Lucky-Scramble Floor: The "Cannot Be Faster" Lower Bound'}
        </h1>
        <p className="pred-subtitle">
          {isZh
            ? '本页不是预测当年 WR. 给出的是"假设抽中最幸运 scramble + 手速顶到生理极限"两个独立极限叠加的数学下界. 真实 WR 仍受物理墙 (M/TPS+R ≈ 1.5–3 s)、scrambler 工程下界 (实际 17–25 步 scramble) 和识别/反应噪声约束 — 这条下界比真实 WR 低很多, 仅用于回答"理论上不可能更快是多少".'
            : 'Not a year-by-year WR prediction. This shows the math floor from combining two independent maxima: luckiest possible scramble AND TPS at the physiological ceiling. Real WRs are bounded by the physical floor (M/TPS+R ≈ 1.5–3 s), the scrambler engineering floor (real scrambles are 17–25 moves), and recognition/reaction noise — so this floor is far below real WRs and only answers "what is the absolute lower bound."'}
        </p>

        {/* Year slider */}
        <section className="lucky-slider-section">
          <div className="lucky-slider-row">
            <div className="lucky-year-display">
              <div className="lucky-year-label">{isZh ? '年份' : 'Year'}</div>
              <div className="lucky-year-value">{formatYear(year)}</div>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.001}
              value={sliderValue}
              onChange={(e) => setSliderValue(parseFloat(e.target.value))}
              className="lucky-slider"
              aria-label={isZh ? '年份滑条' : 'Year slider'}
            />
          </div>
          <div className="lucky-slider-ticks">
            {[2003, 2026, 2050, 2100, 1e4, 1e7, 1e12, 1e15].map((y) => (
              <button
                key={y}
                className="lucky-slider-tick"
                onClick={() => setYearDirect(y)}
              >
                {formatYear(y)}
              </button>
            ))}
          </div>
          <p className="lucky-slider-note">
            {isZh
              ? '滑条左半段 (0..40%) 线性映射 2003..2100, 右半段对数映射到 ~10^15 年后, 用于展示渐近极限.'
              : 'Slider left half (0–40%) linearly maps 2003–2100; right half is log-scale up to ~10^15 years, showing the asymptote.'}
          </p>
        </section>

        {/* Headline for 3x3 */}
        {row333 && lucky333 && (
          <section className="lucky-headline">
            <div className="lucky-headline-left">
              <div className="lucky-headline-eyebrow">
                {isZh ? '三阶 · 数学下界 (非预测)' : '3x3 · Math Floor (not a forecast)'}
              </div>
              <div className="lucky-headline-time">
                {formatVal(row333.timeCeil, row333.ev.scale)}
              </div>
              <div className="lucky-headline-sub">
                {isZh
                  ? `${row333.depthClamped.toFixed(1)} 步 / 17 TPS + 0.15 s · 实际 WR 受 ~1.5 s 物理墙约束`
                  : `${row333.depthClamped.toFixed(1)} moves / 17 TPS + 0.15 s · real WR bounded by ~1.5 s physical floor`}
              </div>
            </div>
            <div className="lucky-headline-right">
              <Stat
                label={isZh ? '累积 scramble 数' : 'Cumulative scrambles'}
                value={formatBigN(row333.N)}
                hint={isZh ? `${2003}–${Math.round(year)}` : `${2003}–${Math.round(year)}`}
              />
              <Stat
                label={isZh ? '期望最小步数' : 'Expected min depth'}
                value={row333.depthClamped.toFixed(2) + (isZh ? ' 步' : ' moves')}
                hint={isZh ? `WCA 下限 ${lucky333.dist.k_min_wca} 步` : `WCA min ${lucky333.dist.k_min_wca} moves`}
              />
              <Stat
                label={isZh ? '同 TPS 14.6 (王艺衡持续值)' : 'At TPS 14.6 (Wang sustained)'}
                value={formatVal(row333.timeNow, row333.ev.scale)}
                hint={isZh ? '现实可达下界' : 'Currently reachable floor'}
              />
            </div>
          </section>
        )}

        {/* Chart: time vs year for several events */}
        <section className="pred-section">
          <h2>{isZh ? '运气下界随年份' : 'Lucky Floor over Years'}</h2>
          <p>
            {isZh
              ? '每条线 = 假设 cuber 顶到 TPS 上界, 用当年累积 scramble 数算的期望最幸运成绩. 纵轴用 log 比较跨项目尺度.'
              : 'Each line assumes TPS at the physiological ceiling, using cumulative scramble count for that year. Y-axis log-scaled to compare across events.'}
          </p>
          <LineChart
            series={chartSeries}
            yLog
            xLabel={isZh ? '年 (log)' : 'Year (log)'}
            yLabel={isZh ? '运气极限 (秒)' : 'Lucky floor (s)'}
            xFormat={(v) => formatYear(logXToYear(v))}
            yFormat={(v) => v < 1 ? v.toFixed(2) : v.toFixed(1)}
            yMin={0.05}
            height={360}
          />
        </section>

        {/* Per-event grid */}
        <section className="pred-section">
          <h2>{isZh ? '各项目当前年份下的运气下界' : 'Per-Event Lucky Floor at Selected Year'}</h2>
          <p>
            {isZh
              ? '所有项目在所选年份下的"如果中了最幸运 scramble"理论成绩. 标 ★ 的项目深度分布完全精确; 其他为状态空间峰值模型近似.'
              : 'For every event, the theoretical "if you hit the luckiest scramble" floor at the selected year. ★ = exact depth distribution; others = peak-concentrated approximation.'}
          </p>
          <div className="lucky-grid">
            {rows.map((r) => (
              <EventCard key={r.ev.id} row={r} isZh={isZh} />
            ))}
          </div>
        </section>

        {/* Methodology */}
        <section className="pred-section">
          <h2>{isZh ? '方法' : 'Methodology'}</h2>
          <ol>
            <li>
              <strong>{isZh ? '状态空间.' : 'State space.'}</strong>{' '}
              {isZh
                ? '三阶 4.3252 × 10^19 状态, 二阶 3,674,160, Pyraminx 933,120 (modulo tips), Skewb 3,149,280. 这些 puzzle 的深度分布 (每个 d 上有多少状态) 完全已知.'
                : '3x3 has 4.3252 × 10^19 states, 2x2 has 3,674,160, Pyraminx has 933,120 (modulo tips), Skewb has 3,149,280. Depth distributions for these are fully known.'}
            </li>
            <li>
              <strong>{isZh ? '深度分布来源.' : 'Depth distribution sources.'}</strong>{' '}
              {isZh
                ? '3x3: cube20.org / Rokicki 2010 (d=0..15 精确, d=16..20 估计). 2x2: Korf / Pochmann. Pyraminx / Skewb: Jaap Scherphuis 完整枚举. 大魔方 / Megaminx / Sq1 / Clock 状态分布不可枚举, 用 "峰值集中" 近似 (大多数状态聚在 God\'s number 附近, 低深度按几何衰减).'
                : '3x3: cube20.org / Rokicki 2010 (exact d=0–15, est. d=16–20). 2x2: Korf / Pochmann. Pyraminx / Skewb: Jaap Scherphuis. Large cubes / Megaminx / Sq1 / Clock distributions are not enumerable; we use a peak-concentrated approximation (most states at God\'s-number, geometric decay below).'}
            </li>
            <li>
              <strong>{isZh ? '年比赛 / scramble 数.' : 'Comps and scrambles per year.'}</strong>{' '}
              {isZh
                ? '2003–2025 用 WCA 真实数据; 2026+ 用 5% 年复合增长外推, 封顶 30,000 场 / 年. 单场 3x3 scramble 数 (含备用) 用线性模型: 2003 ~30 / 场, 2026 ~250 / 场. 其他项目按经验份额 (e.g. 4x4 ≈ 0.70 × 3x3).'
                : '2003–2025 are real WCA counts; 2026+ extrapolated at 5% CAGR capped at 30 k comps/year. Per-comp 3x3 scrambles (incl. backups) linearly model 30 (2003) → 250 (2026). Other events use share factors (e.g. 4x4 ≈ 0.70 × 3x3).'}
            </li>
            <li>
              <strong>{isZh ? '期望最小步数.' : 'Expected minimum depth.'}</strong>{' '}
              {isZh
                ? 'N 次独立采样下, 出现至少 1 个 d ≤ k scramble 的期望 = N · ∑_{i≤k} N(i) / |S|. 我们取 argmin k 使该期望 ≥ 1, log-线性插值到浮点深度. 下限被 WCA 接受规则约束 (3x3: ≥2 步).'
                : 'Expected count of d ≤ k scrambles in N draws = N · ∑_{i≤k} N(i) / |S|. We take argmin k where this ≥ 1, log-linearly interpolated to a float. Floor clamped to WCA-acceptable minimum (3x3: ≥ 2 moves).'}
            </li>
            <li>
              <strong>{isZh ? '执行时间.' : 'Execution time.'}</strong>{' '}
              {isZh
                ? 'T = depth / TPS_ceil + setup_s. TPS_ceil: 3x3=17 (击鼓双手 22 Hz, 50% 二次损耗), OH=10, 大魔方 8–12, 2x2=16. setup_s: 单次启动 + StackMat 触发 + 收尾噪声 0.10–2.00 s, 越大魔方越多.'
                : 'T = depth / TPS_ceil + setup_s. TPS_ceil: 3x3=17 (dual-hand 22 Hz drum × 50 % loss), OH=10, big cubes 8–12, 2x2=16. setup_s: trigger + final-move tap 0.10–2.00 s, larger cubes bigger.'}
            </li>
            <li>
              <strong>{isZh ? '极限 (年份 → ∞).' : 'Asymptote (year → ∞).'}</strong>{' '}
              {isZh
                ? '3x3: 2 步 / 17 TPS + 0.15 s = 0.27 s. 2x2 / Pyraminx / Skewb: 1 步 / TPS_ceil + setup ≈ 0.16–0.20 s. 这是把"运气压满 + 手速压满"的合并极限, 远低于物理墙 (1.5 s, 见主页 §生物力学极限).'
                : '3x3: 2 moves / 17 TPS + 0.15 s = 0.27 s. 2x2 / Pyraminx / Skewb: 1 move / TPS_ceil + setup ≈ 0.16–0.20 s. This combines "luck maxed" with "TPS maxed" and sits well below the biomech floor (1.5 s, see main page §Biomech).'}
            </li>
          </ol>
        </section>

        {/* Caveats */}
        <section className="pred-section">
          <h2>{isZh ? '局限' : 'Caveats'}</h2>
          <ul>
            <li>
              {isZh
                ? '"运气下界"假设 scramble 均匀采样自整个状态空间 (TNoodle 实际做的). 但 WCA 规则文档要求 scramble 长度足够"打乱可见": 真实生成的 scramble 极少出现 < 5 步可解状态, 因为 TNoodle 的输出 scramble 长 17–25 步, 实际几乎不会停在 d ≤ 5 的状态. 本页假设的 "随年份累积命中"是数学下界, 不是工程上观察到的现实.'
                : '"Lucky floor" assumes uniform state-space sampling (which TNoodle does). But the WCA reg requires "visibly scrambled" output: TNoodle outputs 17–25-move scrambles, so reaching a d ≤ 5 state in practice almost never happens. This page reports a mathematical lower bound, not what cubers actually see.'}
            </li>
            <li>
              {isZh
                ? '当 N 接近 |S| (e.g. 2x2 已超出), 公式仍成立但用处不大: 你已经"扫了全部状态"; 真正限制是 WCA 接受规则 (k_min_wca).'
                : 'When N approaches |S| (e.g. 2x2 already has), the formula still holds but is uninteresting: you have effectively swept the state space, and the binding constraint becomes the WCA-acceptable minimum k_min_wca.'}
            </li>
            <li>
              {isZh
                ? '现实里"最快单次"还会被识别 + 切换 + 反应时间 + 执行噪声拉高. 物理下界 (M/TPS + R, 见主页) 通常 ≥ 1.5 s 而非 0.27 s. "运气下界"是另一个角度的"还有多少压缩空间不来自训练"的上界.'
                : "Real WRs also bound by recognition + switching + reaction + execution noise — the physical floor (M/TPS + R, main page) is ≥ 1.5 s, not 0.27 s. The 'lucky floor' is an orthogonal upper bound on \"how much room exists beyond training.\""}
            </li>
            <li>
              {isZh
                ? '大魔方 (4x4+) / Megaminx / Sq1 / Clock 的深度分布未公开, 用"峰值集中"模型. 结果只在数量级意义上可靠.'
                : 'Big cubes / Megaminx / Sq1 / Clock have no published depth distribution; we use a peak-concentrated approximation. Results are order-of-magnitude only.'}
            </li>
            <li>
              {isZh
                ? 'FMC / 盲拧 项目此页不建模 (FMC 输出 = 步数本身, 非速度; 盲拧受记忆速度而非 TPS 限制).'
                : 'FMC and blindfold events are not modeled here (FMC time = move count itself; blindfold is memo-bound, not TPS-bound).'}
            </li>
          </ul>
        </section>

        <footer className="pred-footer">
          <div>
            {isZh
              ? '深度分布: cube20.org / Rokicki / Korf / Pochmann / Scherphuis · WCA 比赛数: WCA results dump'
              : 'Depth distributions: cube20.org / Rokicki / Korf / Pochmann / Scherphuis · Comp counts: WCA results dump'}
          </div>
        </footer>
      </article>
    </div>
  );
}

/** Small stat cell */
function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="lucky-stat">
      <div className="lucky-stat-label">{label}</div>
      <div className="lucky-stat-value">{value}</div>
      {hint && <div className="lucky-stat-hint">{hint}</div>}
    </div>
  );
}

function EventCard({ row, isZh }: { row: Row; isZh: boolean }) {
  const ev = row.ev;
  return (
    <div className="lucky-card">
      <div className="lucky-card-header">
        <span className="lucky-card-name">{isZh ? ev.name_zh : ev.name_en}</span>
        <span className="lucky-card-id">{ev.id}</span>
        {row.source === 'exact' && <span className="lucky-card-badge" title={isZh ? '深度分布精确' : 'Exact depth distribution'}>★</span>}
        {row.source === 'partial' && <span className="lucky-card-badge" title={isZh ? '部分精确, 高深度估计' : 'Partial: exact at low depth, estimated at high'}>◐</span>}
        {row.source === 'approx' && <span className="lucky-card-badge lucky-card-badge-approx" title={isZh ? '近似分布' : 'Approximate distribution'}>~</span>}
      </div>
      <div className="lucky-card-stats">
        <div>
          <div className="lucky-card-stat-label">{isZh ? '累积 scramble' : 'Cum. scrambles'}</div>
          <div className="lucky-card-stat-value">{formatBigN(row.N)}</div>
        </div>
        <div>
          <div className="lucky-card-stat-label">{isZh ? '期望最小步数' : 'Exp. min depth'}</div>
          <div className="lucky-card-stat-value">{row.depthClamped.toFixed(2)}</div>
        </div>
        <div>
          <div className="lucky-card-stat-label">{isZh ? '运气下界' : 'Lucky floor'}</div>
          <div className="lucky-card-stat-value lucky-card-stat-time">
            {formatVal(row.timeCeil, ev.scale)}
          </div>
          <div className="lucky-card-stat-hint">
            {isZh ? `${row.depthClamped.toFixed(1)}步 / ${row.tps_ceil} TPS + ${row.setup_s}s` :
              `${row.depthClamped.toFixed(1)}m / ${row.tps_ceil} TPS + ${row.setup_s}s`}
          </div>
        </div>
      </div>
      {(row.notes_zh || row.notes_en) && (
        <div className="lucky-card-note">
          {isZh ? (row.notes_zh ?? row.notes_en) : (row.notes_en ?? row.notes_zh)}
        </div>
      )}
    </div>
  );
}
