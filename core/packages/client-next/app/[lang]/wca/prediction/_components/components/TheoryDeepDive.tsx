// 数学 / 信息论 / 生物力学的"深挖"段
// 包括: God's number 历史 / optimal HTM 分布 / Big-cube scaling 修正
import { LineChart, type Series } from '../charts';
import { GODS_NUMBER_HISTORY, GODS_NUMBER_FACTS, OPTIMAL_HTM_DISTRIBUTION, NXN_REDUCTION_STM } from '../theory_data';
import { tr } from '@/i18n/tr';
import i18n from "@/i18n/i18n-client";

interface Props { isZh: boolean }

export function TheoryDeepDive({ isZh }: Props) {
  // log-log fit on STM-vs-N (steps only, no time): expected slope ~1.8
  const stmPts = NXN_REDUCTION_STM.map((d) => ({ x: d.N, y: d.typical_stm }));
  const timePts = NXN_REDUCTION_STM.map((d) => ({ x: d.N, y: d.current_wr_s }));
  const slope = loglogSlope(NXN_REDUCTION_STM.map((d) => [d.N, d.typical_stm] as [number, number]));
  const slopeTime = loglogSlope(
    NXN_REDUCTION_STM
      .map((d) => [d.N, d.current_wr_s ?? NaN] as [number, number])
      .filter((p) => isFinite(p[1])),
  );

  const distMax = Math.max(...OPTIMAL_HTM_DISTRIBUTION.map((d) => d.fraction));
  const distSeries: Series[] = [
    { name: 'P(optimal HTM = n)', color: '#2f6fd8', data: OPTIMAL_HTM_DISTRIBUTION.map((d) => ({ x: d.htm, y: d.fraction })) },
  ];

  const fitStmSeries: Series[] = [
    { name: tr({ zh: 'STM 实测', en: 'STM observed',
        zhHant: "STM 實測"
    }), color: '#0a8a6b', data: stmPts },
    { name: tr({ zh: '时间实测 (秒)', en: 'Time observed (s)',
        zhHant: "時間實測 (秒)"
    }), color: '#c2410c', data: timePts },
  ];

  return (
    <section className="pred-section" id="theory-deep">
      <h2>{tr({ zh: '数学, 信息论, 生物力学下的硬墙', en: 'Hard Walls from Math, Information, Biomech',
          zhHant: "數學, 資訊理論, 生物力學下的硬牆"
    })}</h2>

      <h3>{tr({ zh: "God's number 的演化 (3x3, HTM)", en: "God's Number Progression (3x3, HTM)" })}</h3>
      <p>
        {i18n.language === 'zh-Hant' ? ((
                        <>
                          最早一版上界是 Thistlethwaite 1981 年給的 52 HTM,用四階段群約簡法。29 年後 Rokicki / Kociemba / Davidson / Dethridge (2010)
                          藉助 ~35 CPU-年的 Google 算力,把 20 HTM 證成最終值: <strong>所有 4.3×10¹⁹ 個 3x3 狀態都能在 ≤ 20 HTM 內還原,而且至少存在一個 (superflip composite) 需要正好 20 HTM</strong>。
                        </>
                      )) : (isZh ? (
                        <>
                          最早一版上界是 Thistlethwaite 1981 年给的 52 HTM,用四阶段群约简法。29 年后 Rokicki / Kociemba / Davidson / Dethridge (2010)
                          借助 ~35 CPU-年的 Google 算力,把 20 HTM 证成最终值: <strong>所有 4.3×10¹⁹ 个 3x3 状态都能在 ≤ 20 HTM 内还原,而且至少存在一个 (superflip composite) 需要正好 20 HTM</strong>。
                        </>
                      ) : (
                        <>
                          Thistlethwaite (1981) gave 52 HTM via four-stage group reduction. 29 years later Rokicki / Kociemba / Davidson / Dethridge (2010), with ~35 CPU-years of donated Google compute,
                          <strong> proved that all 4.3×10¹⁹ 3x3 states are solvable in ≤20 HTM, and at least one (superflip composite) requires exactly 20</strong>.
                        </>
                      ))}
      </p>
      <div className="pred-method-table-wrap">
        <table className="pred-fit-table">
          <thead>
            <tr>
              <th>{tr({ zh: '年份', en: 'Year' })}</th>
              <th>{tr({ zh: '上界 (HTM)', en: 'Bound (HTM)' })}</th>
              <th>{tr({ zh: '证明者', en: 'By',
                  zhHant: "證明者"
            })}</th>
              <th>{tr({ zh: '方法', en: 'Method' })}</th>
            </tr>
          </thead>
          <tbody>
            {GODS_NUMBER_HISTORY.map((g) => (
              <tr key={g.year}>
                <td>{g.year}</td>
                <td className="pred-num"><strong>{g.bound_htm}</strong></td>
                <td>{g.who}</td>
                <td>{isZh ? g.note_zh : g.note_en}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="pred-note">
        {i18n.language === 'zh-Hant' ? ((
                        <>
                          <strong>跨度量約束:</strong> HTM = {GODS_NUMBER_FACTS.htm.value} (Rokicki 2010)  /  QTM = {GODS_NUMBER_FACTS.qtm.value} (Rokicki & Davidson 2014,只有 superflip × 4-spot 一個等價類需要 26)  /  STM 至今未證 (16 ≤ ? ≤ 20,superflip 在 STM 中可 16 步內解)。
                          NxN 漸近: <strong>{GODS_NUMBER_FACTS.bigCube.value}</strong> (Demaine et al. 2011, arXiv:1106.5736);
                          最優解 NxN <strong>NP-complete</strong> (Demaine, Eisenstat, Rudoy 2017, STACS)。
                        </>
                      )) : (isZh ? (
                        <>
                          <strong>跨度量约束:</strong> HTM = {GODS_NUMBER_FACTS.htm.value} (Rokicki 2010)  /  QTM = {GODS_NUMBER_FACTS.qtm.value} (Rokicki & Davidson 2014,只有 superflip × 4-spot 一个等价类需要 26)  /  STM 至今未证 (16 ≤ ? ≤ 20,superflip 在 STM 中可 16 步内解)。
                          NxN 渐近: <strong>{GODS_NUMBER_FACTS.bigCube.value}</strong> (Demaine et al. 2011, arXiv:1106.5736);
                          最优解 NxN <strong>NP-complete</strong> (Demaine, Eisenstat, Rudoy 2017, STACS)。
                        </>
                      ) : (
                        <>
                          <strong>Across metrics:</strong> HTM = {GODS_NUMBER_FACTS.htm.value} (Rokicki 2010) · QTM = {GODS_NUMBER_FACTS.qtm.value} (Rokicki & Davidson 2014; only superflip × four-spot composites need 26) · STM unsettled (16 ≤ ? ≤ 20, superflip is 16-STM-solvable).
                          NxN asymptotic: <strong>{GODS_NUMBER_FACTS.bigCube.value}</strong> (Demaine et al. 2011, arXiv:1106.5736);
                          optimal NxN solving is <strong>NP-complete</strong> (Demaine, Eisenstat, Rudoy 2017, STACS).
                        </>
                      ))}
      </p>

      <h3>{tr({ zh: '最优 HTM 步数的分布', en: 'Distribution of Optimal HTM Depth',
          zhHant: "最優 HTM 步數的分佈"
    })}</h3>
      <p>
        {i18n.language === 'zh-Hant' ? ((
                        <>
                          隨機均勻打亂的最優 HTM 步數分佈 <em>極度集中在 18</em>: 約 67% 的打亂需要正好 18 HTM,26.6% 是 17,2.6% 是 16,
                          而 20 步深度的位置只有約 <strong>490 萬個 (3.4×10⁶ / 4.3×10¹⁹ ≈ 10⁻¹³)</strong>。這是 cube20.org 全狀態列舉得出的。
                          FMC 16 步 WR (Tronto 2019) 其實就是<strong>抽到 2.6% 機率的 16 步可達打亂後把它解掉</strong> — sub-15 需要 0.05% 量級的稀有打亂,沒法常態化。
                        </>
                      )) : (isZh ? (
                        <>
                          随机均匀打乱的最优 HTM 步数分布 <em>极度集中在 18</em>: 约 67% 的打乱需要正好 18 HTM,26.6% 是 17,2.6% 是 16,
                          而 20 步深度的位置只有约 <strong>490 万个 (3.4×10⁶ / 4.3×10¹⁹ ≈ 10⁻¹³)</strong>。这是 cube20.org 全状态枚举得出的。
                          FMC 16 步 WR (Tronto 2019) 其实就是<strong>抽到 2.6% 概率的 16 步可达打乱后把它解掉</strong> — sub-15 需要 0.05% 量级的稀有打乱,没法常态化。
                        </>
                      ) : (
                        <>
                          Optimal HTM depth on uniformly random scrambles is <em>extremely concentrated at 18</em>: 67% of scrambles need exactly 18 HTM, 26.6% are 17, 2.6% are 16,
                          and only ~4.9M positions out of 4.3×10¹⁹ (≈ 10⁻¹³) require 20. From cube20.org's full state enumeration.
                          The FMC 16-move WR (Tronto 2019) is therefore equivalent to <strong>landing on a 16-or-less optimal scramble (2.6% probability) and solving it</strong> — sub-15 needs a 0.05%-level rarity, not repeatable.
                        </>
                      ))}
      </p>
      <LineChart
        series={distSeries}
        yLabel={isZh ? 'P (random scramble)' : 'P (random scramble)'}
        xLabel="optimal HTM depth"
        yMin={0}
        yMax={distMax * 1.05}
        yFormat={(v) => (v >= 0.01 ? (v * 100).toFixed(1) + '%' : (v * 100).toExponential(0) + '%')}
      />

      <h3>{tr({ zh: 'NxN 立方尺度律', en: 'NxN Cube-Size Scaling' })}</h3>
      <p>
        {i18n.language === 'zh-Hant' ? ((
                        <>
                          「時間隨 N 多快增長」和「步數隨 N 多快增長」是兩個不同的問題,容易混淆。
                          <strong>步數: STM ∝ N^{slope.toFixed(2)}</strong> (經驗),漸近上界 <em>Θ(N² / log N)</em> (Demaine et al. 2011)。222 用 ~9 步,777 ~250 步。
                          <strong>時間: t ∝ N^{slopeTime.toFixed(2)}</strong>,因為大魔方 TPS 顯著下降 (222 持續 11,777 持續 5.5),時間增長比步數快。
                          過去常說的「時間 ∝ N^4.4」其實是把這兩件事混在一起的產物,本節把它們拆開。
                        </>
                      )) : (isZh ? (
                        <>
                          「时间随 N 多快增长」和「步数随 N 多快增长」是两个不同的问题,容易混淆。
                          <strong>步数: STM ∝ N^{slope.toFixed(2)}</strong> (经验),渐近上界 <em>Θ(N² / log N)</em> (Demaine et al. 2011)。222 用 ~9 步,777 ~250 步。
                          <strong>时间: t ∝ N^{slopeTime.toFixed(2)}</strong>,因为大魔方 TPS 显著下降 (222 持续 11,777 持续 5.5),时间增长比步数快。
                          过去常说的「时间 ∝ N^4.4」其实是把这两件事混在一起的产物,本节把它们拆开。
                        </>
                      ) : (
                        <>
                          "How fast does time grow with N" and "how fast does move count grow with N" are different questions — easy to conflate.
                          <strong>STM count: STM ∝ N^{slope.toFixed(2)}</strong> empirically; asymptotic upper bound <em>Θ(N² / log N)</em> (Demaine et al. 2011). 222 takes ~9 STM, 777 takes ~250.
                          <strong>Time: t ∝ N^{slopeTime.toFixed(2)}</strong> because sustained TPS drops sharply on big cubes (222 sustains 11, 777 sustains 5.5), so time scales faster than moves.
                          The often-cited "time ∝ N^4.4" conflates both effects — this section separates them.
                        </>
                      ))}
      </p>
      <LineChart
        series={fitStmSeries}
        yLabel="STM / time (s)"
        xLabel="N"
        yLog
        xFormat={(v) => v.toString()}
      />
      <p className="pred-note">
        {tr({ zh: '左轴对数刻度。两条曲线斜率差就是「TPS 随 N 下降」的视觉化 — 大魔方花时间,不只是因为步数多,更因为每步更慢。', en: 'Log y-axis. The slope gap visualizes TPS decay with N — big cubes are slow not just because of more moves, but because every move is slower.',
            zhHant: "左軸對數刻度。兩條曲線斜率差就是「TPS 隨 N 下降」的視覺化 — 大魔方花時間,不只是因為步數多,更因為每步更慢。"
        })}
      </p>
    </section>
  );
}

function loglogSlope(pairs: Array<[number, number]>): number {
  const xs = pairs.map((p) => Math.log(p[0]));
  const ys = pairs.map((p) => Math.log(p[1]));
  const n = xs.length;
  const xbar = xs.reduce((a, b) => a + b, 0) / n;
  const ybar = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - xbar) * (ys[i] - ybar); den += (xs[i] - xbar) ** 2; }
  return den === 0 ? 0 : num / den;
}
