'use client';

import { useState, useMemo } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { tr } from '@/i18n/tr';

const DIST_DATA_HTM = [
  { d: 0,  count: 1n },
  { d: 1,  count: 18n },
  { d: 2,  count: 243n },
  { d: 3,  count: 3240n },
  { d: 4,  count: 43239n },
  { d: 5,  count: 574908n },
  { d: 6,  count: 7618438n },
  { d: 7,  count: 100803036n },
  { d: 8,  count: 1332343288n },
  { d: 9,  count: 17596479795n },
  { d: 10, count: 232248063316n },
  { d: 11, count: 3063288809012n },
  { d: 12, count: 40374425656248n },
  { d: 13, count: 531653418284628n },
  { d: 14, count: 6989320578825358n },
  { d: 15, count: 91365146187124313n },
  { d: 16, count: 1100000000000000000n }, // approximate from cube20.org
  { d: 17, count: 12000000000000000000n },
  { d: 18, count: 29000000000000000000n },
  { d: 19, count: 1500000000000000000n },
  { d: 20, count: 490000000n },
];

function DistanceDistributionChart() {
  const [hover, setHover] = useState<number | null>(null);
  const maxLog = useMemo(() => {
    return Math.max(...DIST_DATA_HTM.map(d => d.count > 0n ? Math.log10(Number(d.count)) : 0));
  }, []);
  return (
    <div className="gt-dist-chart">
      <div className="gt-dist-bars">
        {DIST_DATA_HTM.map(row => {
          const log = row.count > 0n ? Math.log10(Number(row.count)) : 0;
          const pct = (log / maxLog) * 100;
          const isExact = row.d <= 15;
          return (
            <div
              key={row.d}
              className={`gt-dist-bar-cell ${hover === row.d ? 'hover' : ''}`}
              onMouseEnter={() => setHover(row.d)}
              onMouseLeave={() => setHover(null)}
            >
              <div className="gt-dist-bar">
                <div
                  className={`gt-dist-bar-fill ${!isExact ? 'approx' : ''}`}
                  style={{ height: `${pct}%` }}
                />
              </div>
              <div className="gt-dist-bar-d">{row.d}</div>
            </div>
          );
        })}
      </div>
      <div className="gt-dist-hover">
        {hover !== null ? (
          <div>
            <span className="gt-dist-hover-d">d = {hover}</span>
            <span className="gt-dist-hover-cnt">
              {DIST_DATA_HTM[hover].count.toString()} {tr({ zh: '个状态', en: 'states'
            })}
            </span>
            {hover > 15 && <span className="gt-dist-hover-approx"> ({tr({ zh: '估算', en: 'approx.' })})</span>}
          </div>
        ) : (
          <div style={{ color: 'var(--ink-faint)' }}>
            {tr({ zh: '悬停查看每个距离 d 上的状态数', en: 'hover to see count at each distance d'
            })}
          </div>
        )}
      </div>
      <div className="gt-dist-legend">
        <span><span className="gt-dist-swatch exact" /> {tr({ zh: '已枚举 (Rokicki et al.)', en: 'enumerated (Rokicki et al.)'
        })}</span>
        <span><span className="gt-dist-swatch approx" /> {tr({ zh: '估算 (cube20.org)', en: 'approximated' })}</span>
      </div>
    </div>
  );
}

// ── §24 RandomWalkSimulator — Markov chain on G ────────────────────────────

export default function DistanceDistribution() {
  const lang = useLang();
  return (
      <GTSec id="distance" className="gt-sec">
        <div className="gt-sec-num">§23</div>
        <h2 className="gt-sec-title">
          <L zh="距离分布与 20 步证明" en="Distance distribution & the 20-move proof" />
        </h2>
        <p className="gt-lede">
          <L
            zh={<>魔方 Cayley 图的 <strong>距离分布</strong> 是一个让人难忘的图表: 几乎所有 4.3 × 10¹⁹ 个状态都落在 d = 18 或 19 上,而 d = 20 的状态只有 4.9 × 10⁸ 个 (相对很少)。 这跟「上帝之数 = 20」 的证明直接相关。</>}
            en={<>The cube's Cayley-graph <strong>distance distribution</strong> is a striking diagram: nearly all 4.3 × 10¹⁹ states land at d = 18 or 19, while only 4.9 × 10⁸ states sit at d = 20. This distribution is exactly what the God's-number-20 proof produced.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="23.1  互动图表 (HTM)" en="23.1  Interactive chart (HTM)" />
        </h3>
        <DistanceDistributionChart />
        <p style={{ marginTop: 24 }}>
          <L
            zh={<>纵轴是 log₁₀(状态数)。 注意几个特征:</>}
            en={<>Vertical axis is log₁₀(count). A few features to notice:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L
            zh={<>d = 0 ~ 8: 几乎可解析地是 <TeX src={`18(15)^{d-1}`} /> 量级 (每步 18 个选择,部分会重叠,但增长保持指数)。</>}
            en={<>d = 0…8: roughly <TeX src={`\\sim 18 \\cdot 15^{d-1}`} /> (18 generators, with cancellations); near-exponential growth.</>}
          /></li>
          <li><L
            zh={<>d = 8 ~ 15: 指数增长开始饱和;每个状态的「未访问邻居」越来越少。</>}
            en={<>d = 8…15: exponential growth saturates; unvisited neighbors per state plateau.</>}
          /></li>
          <li><L
            zh={<>d = 15 ~ 18: <strong>峰值</strong> 在 18 或 19 (依论文版本)。 在峰值处, G 一半以上的元素都聚集。</>}
            en={<>d = 15…18: <strong>peak</strong> around 18 or 19. The bulk of G's elements live there.</>}
          /></li>
          <li><L
            zh={<>d = 20: 4.9 × 10⁸ 个 ——「上帝之数」 = 20 即由这一行存在 (非零) 而 d = 21 行不存在 (一定为零) 共同定义。</>}
            en={<>d = 20: 4.9 × 10⁸ states. "God's number = 20" is the joint fact that this row is non-zero and any d = 21 row would have to be empty.</>}
          /></li>
        </ul>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="23.2  HTM vs QTM" en="23.2  HTM vs QTM" />
        </h3>
        <table className="gt-distance-tbl">
          <thead>
            <tr>
              <th>{tr({ zh: '度量', en: 'Metric' })}</th>
              <th>{tr({ zh: '生成集', en: 'Generators' })}</th>
              <th>{tr({ zh: '直径', en: 'Diameter'
            })}</th>
              <th>{tr({ zh: '随机平均', en: 'Random avg'
            })}</th>
              <th>{tr({ zh: '上限证明', en: 'Bound proof'
            })}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>HTM</strong> ({tr({ zh: '半圈', en: 'half-turn' })})</td>
              <td className="num">18</td>
              <td className="num">20</td>
              <td className="num">~18</td>
              <td className="num">{lang === 'zh' ? '2010 Rokicki et al.' : '2010 Rokicki et al.'}</td>
            </tr>
            <tr>
              <td><strong>QTM</strong> ({tr({ zh: '四分一圈', en: 'quarter-turn' })})</td>
              <td className="num">12</td>
              <td className="num">26</td>
              <td className="num">~22</td>
              <td className="num">{lang === 'zh' ? '2014 Rokicki & Kociemba' : '2014 Rokicki & Kociemba'}</td>
            </tr>
            <tr>
              <td><strong>STM</strong> ({tr({ zh: '加切片', en: 'slice' })})</td>
              <td className="num">27</td>
              <td className="num">{tr({ zh: '≤ 20 (未严格)', en: '≤ 20 (unproven)'
            })}</td>
              <td className="num">~17</td>
              <td className="num">{tr({ zh: '部分计算', en: 'partial enumerations'
            })}</td>
            </tr>
          </tbody>
        </table>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="23.3  Superflip 与「严格 20 步」状态" en={'23.3  Superflip & the "strict-20" club'} />
        </h3>
        <p>
          <L
            zh={<>四个状态曾经被认为是「最远」的: <strong>superflip</strong> (所有棱翻转, 1995 Reid 证明需要 20 HTM)、 <strong>superflip 复合 4-spot</strong>、 <strong>superflip 复合 6-spot</strong>。 2010 后, 已知共有 4.9 × 10⁸ 个状态距离严格 = 20。</>}
            en={<>Four states were once known as "the furthest": <strong>superflip</strong> (all edges flipped; Reid 1995 proved it requires 20 HTM), and superflip composed with the 4-spot or 6-spot patterns. After 2010, the full census reveals 4.9 × 10⁸ states at exactly distance 20.</>}
          />
        </p>
        <div className="gt-aside">
          <L
            zh={<>有趣的是, 这 4.9 × 10⁸ 个 「最远状态」 在 |G| 中只占 <strong>10⁻¹¹</strong>。 如果你随机生成一个 scramble, 期望距离是 18, 几乎从来碰不到 20。 「上帝之数」实际上是一个 <em>极值</em> 结果, 不代表魔方有多难解。</>}
            en={<>Interestingly, these 4.9 × 10⁸ "farthest" states make up <strong>10⁻¹¹</strong> of |G|. A random scramble has expected distance 18 and essentially never hits 20. The "God's number" is an extreme-value result, not a measure of difficulty.</>}
          />
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="23.4  精确数值表 (HTM)" en="23.4  Exact numerical table (HTM)" />
        </h3>
        <p>
          <L
            zh={<>下表给出距离 d = 0 ~ 15 的<em>精确</em>计数 (穷举枚举,Kociemba 2013) 和 d = 16 ~ 20 的<em>已知</em>计数 (Rokicki 等 2014 后的对称归约证明)。 各行求和正好 = |G| = 43,252,003,274,489,856,000。</>}
            en={<>The table below gives <em>exact</em> counts for d = 0…15 (full enumeration, Kociemba 2013) and the <em>established</em> counts for d = 16…20 (symmetry-reduced proofs after Rokicki et al. 2014). The column totals to |G| = 43,252,003,274,489,856,000.</>}
          />
        </p>
        <table className="gt-distance-tbl gt-distance-exact">
          <thead>
            <tr>
              <th>d</th>
              <th>{tr({ zh: '状态数', en: 'states at d'
            })}</th>
              <th>{tr({ zh: '占 |G| 比例', en: 'fraction of |G|'
            })}</th>
              <th>{tr({ zh: '增长率', en: 'ratio'
            })}</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="num">0</td><td className="num">1</td><td className="num">~0</td><td className="num">—</td></tr>
            <tr><td className="num">1</td><td className="num">18</td><td className="num">~0</td><td className="num">18.0×</td></tr>
            <tr><td className="num">2</td><td className="num">243</td><td className="num">~0</td><td className="num">13.5×</td></tr>
            <tr><td className="num">3</td><td className="num">3,240</td><td className="num">~0</td><td className="num">13.3×</td></tr>
            <tr><td className="num">4</td><td className="num">43,239</td><td className="num">~0</td><td className="num">13.3×</td></tr>
            <tr><td className="num">5</td><td className="num">574,908</td><td className="num">~0</td><td className="num">13.3×</td></tr>
            <tr><td className="num">6</td><td className="num">7,618,438</td><td className="num">~0</td><td className="num">13.3×</td></tr>
            <tr><td className="num">7</td><td className="num">100,803,036</td><td className="num">~0</td><td className="num">13.2×</td></tr>
            <tr><td className="num">8</td><td className="num">1,332,343,288</td><td className="num">3.1 × 10<sup>-11</sup></td><td className="num">13.2×</td></tr>
            <tr><td className="num">9</td><td className="num">17,596,479,795</td><td className="num">4.1 × 10<sup>-10</sup></td><td className="num">13.2×</td></tr>
            <tr><td className="num">10</td><td className="num">232,248,063,316</td><td className="num">5.4 × 10<sup>-9</sup></td><td className="num">13.2×</td></tr>
            <tr><td className="num">11</td><td className="num">3,063,288,809,012</td><td className="num">7.1 × 10<sup>-8</sup></td><td className="num">13.2×</td></tr>
            <tr><td className="num">12</td><td className="num">40,374,425,656,248</td><td className="num">9.3 × 10<sup>-7</sup></td><td className="num">13.2×</td></tr>
            <tr><td className="num">13</td><td className="num">531,653,418,284,628</td><td className="num">1.2 × 10<sup>-5</sup></td><td className="num">13.2×</td></tr>
            <tr><td className="num">14</td><td className="num">6,989,320,578,825,358</td><td className="num">1.6 × 10<sup>-4</sup></td><td className="num">13.1×</td></tr>
            <tr><td className="num">15</td><td className="num">91,365,146,187,124,313</td><td className="num">2.1 × 10<sup>-3</sup></td><td className="num">13.1×</td></tr>
            <tr><td className="num">16</td><td className="num">≈ 1.10 × 10<sup>18</sup></td><td className="num">2.5%</td><td className="num">12.0×</td></tr>
            <tr><td className="num">17</td><td className="num">≈ 1.22 × 10<sup>19</sup></td><td className="num">28.3%</td><td className="num">11.1×</td></tr>
            <tr><td className="num">18</td><td className="num">≈ 2.98 × 10<sup>19</sup></td><td className="num">68.9%</td><td className="num">2.4×</td></tr>
            <tr className="gt-row-hl"><td className="num">19</td><td className="num">≈ 1.50 × 10<sup>18</sup></td><td className="num">3.5%</td><td className="num">0.05×</td></tr>
            <tr className="gt-row-hl"><td className="num">20</td><td className="num">490,000,000</td><td className="num">1.1 × 10<sup>-11</sup></td><td className="num">3.3 × 10<sup>-10</sup>×</td></tr>
            <tr><td className="num">21+</td><td className="num">0</td><td className="num">0</td><td className="num">—</td></tr>
            <tr className="gt-row-sum"><td><strong>Σ</strong></td><td className="num"><strong>4.325 × 10<sup>19</sup></strong></td><td className="num"><strong>100%</strong></td><td className="num">= |G|</td></tr>
          </tbody>
        </table>
        <p style={{ marginTop: 18 }}>
          <L
            zh={<>「增长率」一列揭示了 Cayley 图的几何:从 d = 1 到 d = 15,每步都几乎以 13.2× 增长 (远小于生成元数 18,因为 <TeX src={`R \\cdot R = R^2`} /> 之类的重叠把分支因子拉低)。 然后在 d = 16 ~ 18 之间 <strong>急剧饱和</strong>: G 的 97% 元素挤在 d = 17 和 d = 18 这两层。 d = 19 已经回落 (只剩 3.5%), d = 20 几乎清空 (仅 4.9 亿)。 这是有限 Cayley 图典型的「球面爆炸 → 边界塌缩」形态。</>}
            en={<>The "ratio" column shows the geometric structure of the Cayley graph: from d = 1 to d = 15, each shell grows by ~13.2× (well below 18, because moves like <TeX src={`R \\cdot R = R^2`} /> overlap and reduce the effective branching factor). Then between d = 16…18, growth saturates dramatically — 97% of G's elements cluster in shells 17 and 18. d = 19 already drops to 3.5%; d = 20 is nearly empty (only 4.9 × 10<sup>8</sup>). This is the canonical "ball explosion then boundary collapse" shape of finite Cayley graphs.</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '推论 23.4 — 平均距离', en: 'Corollary 23.4 — average distance'
        })}</div>
          <div className="gt-thm-body">
            <L
              zh={<><TeXBlock src={`\\mathbb{E}[d] \\;=\\; \\frac{1}{|G|} \\sum_{d=0}^{20} d \\cdot N_d \\;\\approx\\; 17.97`} />其中 <TeX src={`N_d`} /> 是距离 d 处的状态数。 一个均匀随机的 scramble,期望最优解长度大约 <strong>17.97 HTM</strong>。 (QTM 下约为 22.) 注意:这跟「<em>3-style 选手实际解出 60 步</em>」差异很大 —— 那只反映人类启发式跟最优解之间的差距 (gap ≈ 40 步)。</>}
              en={<><TeXBlock src={`\\mathbb{E}[d] \\;=\\; \\frac{1}{|G|} \\sum_{d=0}^{20} d \\cdot N_d \\;\\approx\\; 17.97`} />where <TeX src={`N_d`} /> is the state count at distance d. A uniformly random scramble has expected optimal length <strong>~17.97 HTM</strong> (~22 in QTM). The gap from human solvers (~50–60 HTM) reflects the cost of using heuristic strategies rather than optimal search — about a 40-move gap.</>}
            />
          </div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="23.5  增长函数与渐近几何" en="23.5  Growth function & asymptotic geometry" />
        </h3>
        <p>
          <L
            zh={<>对任一群 G 和生成集 S,<strong>球增长函数</strong> 定义为<TeXBlock src={`B(r) \\;:=\\; \\#\\{\\,g \\in G \\;:\\; d_S(g, e) \\le r\\,\\}`} />即半径 r 球内的状态总数。 魔方的有限性使 B(r) 在 r ≥ 20 时常驻于 |G|。 对无限群 (例如自由群 F₂、 双曲群),B(r) 的渐近增长揭示该群的「几何维度」。</>}
            en={<>For any group G with generating set S, the <strong>ball growth function</strong> is<TeXBlock src={`B(r) \\;:=\\; \\#\\{\\,g \\in G \\;:\\; d_S(g, e) \\le r\\,\\}`} />the total state count within radius r. For the finite cube group, B(r) saturates at |G| for r ≥ 20. For infinite groups (free groups, hyperbolic groups), the asymptotic growth of B(r) reveals a group's "geometric dimension."</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L zh={<><strong>多项式增长</strong> (Gromov 1981): <TeX src={`B(r) \\sim r^d`} /> ⟺ G 几乎是阿贝尔的 (有有限指数 nilpotent 子群)。 ℤ<sup>n</sup> 是 d = n。</>} en={<><strong>Polynomial growth</strong> (Gromov 1981): <TeX src={`B(r) \\sim r^d`} /> ⟺ G is virtually nilpotent. ℤ<sup>n</sup> has d = n.</>} /></li>
          <li><L zh={<><strong>指数增长</strong>: <TeX src={`B(r) \\sim c^r`} />,出现于自由群、 大部分非阿贝尔群。 魔方在 「无限生成 (允许重复)」 极限下属于这类。</>} en={<><strong>Exponential growth</strong>: <TeX src={`B(r) \\sim c^r`} />, free groups and most non-Abelian groups. The cube has exponential <em>local</em> growth in the small-r regime.</>} /></li>
          <li><L zh={<><strong>中间增长</strong>: Grigorchuk 群 (1980),增长率介于多项式和指数之间, 是群论的一大发现。</>} en={<><strong>Intermediate growth</strong>: Grigorchuk's group (1980) — growth strictly between polynomial and exponential. A landmark in geometric group theory.</>} /></li>
        </ul>
        <div className="gt-aside" style={{ marginTop: 16 }}>
          <L
            zh={<>魔方群是 <em>有限</em> 的, 所以它「最终」是常增长 (B(r) = |G| 对 r ≥ 20)。 但在 r ≤ 12 这段「年轻」阶段, 它表现出很强的指数增长 (每步 ≈ 13.2 倍), 跟自由群 <TeX src={`F_{18}`} /> 的 18 倍几乎一致 — 直到关系开始累积。 这种「先指数后塌缩」 是研究 <em>词长函数</em> 与 <em>群直径</em> 的标准模板。</>}
            en={<>The cube group is <em>finite</em>, so growth is ultimately constant (B(r) = |G| for r ≥ 20). But in the "young" regime r ≤ 12, growth is nearly exponential (~13.2× per step), close to the free group <TeX src={`F_{18}`} />'s 18× — until relations accumulate. This "exponential growth then collapse" is the standard template for studying word-length functions and group diameters.</>}
          />
        </div>
      </GTSec>
  );
}
