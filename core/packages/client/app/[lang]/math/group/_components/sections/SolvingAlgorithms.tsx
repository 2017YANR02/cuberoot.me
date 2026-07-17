'use client';

import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { tr } from '@/i18n/tr';

function AlgorithmCompareTable() {
  const rows = [
    {
      name: 'Thistlethwaite (1981)',
      avgMoves: '~52',
      bestMoves: '45',
      worstMoves: '~52',
      tableSize: '< 100 KB',
      runtime: 'milliseconds',
      type: tr({ zh: '4-阶段子群链', en: '4-stage subgroup chain'
    }),
      note: tr({ zh: '最早的有限存储次优解', en: 'first finite-memory suboptimal'
    }),
    },
    {
      name: 'Kociemba (1992)',
      avgMoves: '~21',
      bestMoves: '<20 typical',
      worstMoves: '~30',
      tableSize: '~50 MB',
      runtime: 'ms-seconds',
      type: tr({ zh: '两阶段', en: 'Two-phase'
    }),
      note: tr({ zh: '现代速求解器主流', en: 'modern fast-suboptimal standard'
    }),
    },
    {
      name: 'Korf IDA* (1997)',
      avgMoves: '17.34',
      bestMoves: '20',
      worstMoves: '20',
      tableSize: '~80 MB',
      runtime: 'sec-min',
      type: tr({ zh: '最优 IDA* + 模式 DB', en: 'Optimal IDA* + pattern DBs'
    }),
      note: tr({ zh: '首个可比较的最优解', en: 'first truly optimal solver'
    }),
    },
    {
      name: 'Rokicki cosets (2010)',
      avgMoves: '17.7',
      bestMoves: '20',
      worstMoves: '20',
      tableSize: '~3 GB cosets',
      runtime: 'CPU-years',
      type: tr({ zh: '对称压缩枚举', en: 'symmetry-reduced enumeration'
    }),
      note: tr({ zh: '20 步证明用此方法', en: 'used to prove God\'s # = 20'
    }),
    },
  ];
  return (
    <table className="gt-algo-compare">
      <thead>
        <tr>
          <th>{tr({ zh: '算法', en: 'Algorithm'
        })}</th>
          <th>{tr({ zh: '类型', en: 'Type'
        })}</th>
          <th>avg HTM</th>
          <th>max HTM</th>
          <th>{tr({ zh: '表', en: 'Tables' })}</th>
          <th>{tr({ zh: '运行', en: 'Runtime'
        })}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.name}>
            <td>
              <div style={{ fontWeight: 600 }}>{r.name}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-dim)' }}>{r.note}</div>
            </td>
            <td><span style={{ fontSize: 13 }}>{r.type}</span></td>
            <td className="num">{r.avgMoves}</td>
            <td className="num">{r.worstMoves}</td>
            <td className="num">{r.tableSize}</td>
            <td className="num">{r.runtime}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── §22 ThistlethwaitePhaseChart — depths per stage ────────────────────────

// ── §22 ThistlethwaitePhaseChart — depths per stage ────────────────────────
function ThistlethwaitePhaseChart() {
  // Known stage maxima (HTM) from Thistlethwaite, Reid, et al. (1981–95).
  const stages = [
    { name: 'G₀ → G₁',  zh: '修 EO',                    en: 'fix edge orientation',     maxDepth: 7,  bound: 'EO = 0' },
    { name: 'G₁ → G₂',  zh: '修 CO + UD slice',         en: 'fix CO + UD slice',         maxDepth: 10, bound: 'CO = 0, FR/FL/BL/BR in slice' },
    { name: 'G₂ → G₃',  zh: '达成 domino',              en: 'reach domino orbits',       maxDepth: 13, bound: 'corner & edge orbit parity'
    },
    { name: 'G₃ → e',   zh: '完成 (仅 180° 转)',         en: 'solve (only 180° turns)',   maxDepth: 15, bound: 'identity'
    },
  ];
  const totalMax = stages.reduce((s, r) => s + r.maxDepth, 0);
  const maxD = Math.max(...stages.map(s => s.maxDepth));
  return (
    <div className="gt-thistle-chart">
      {stages.map((s, i) => (
        <div className="gt-thistle-stage" key={i}>
          <div className="gt-thistle-stage-name">{s.name}</div>
          <div className="gt-thistle-stage-bar">
            <div className="gt-thistle-stage-fill" style={{ width: `${(s.maxDepth / maxD) * 100}%` }} />
            <div className="gt-thistle-stage-depth">{s.maxDepth}</div>
          </div>
          <div className="gt-thistle-stage-desc">{tr(s)}</div>
          <div className="gt-thistle-stage-bound"><span className="gt-mono">{s.bound}</span></div>
        </div>
      ))}
      <div className="gt-thistle-total">
        {tr({ zh: '理论最大深度合计:', en: 'theoretical max depth sum:'
        })}{' '}
        <strong>{totalMax}</strong> {tr({ zh: '步 (HTM)。后续的 45 步上界来自启发式 IDA* 在每一阶段的最优搜索。', en: ' moves (HTM). The improved 45-move bound comes from optimal IDA* within each stage.'
        })}
      </div>
    </div>
  );
}

// ── §23 DistanceDistributionChart — bar chart of |{ g ∈ G : d(g) = k }| ───

export default function SolvingAlgorithms() {
  const lang = useLang();
  return (
      <GTSec id="algorithms" className="gt-sec">
        <div className="gt-sec-num">§22</div>
        <h2 className="gt-sec-title">
          <L zh="解魔方的算法" en="Solving algorithms" />
        </h2>
        <p className="gt-lede">
          <L
            zh={<>从 §10 的 Thistlethwaite 子群链开始,到 Kociemba 两阶段、 Korf 最优 IDA*、 Rokicki 对称压缩枚举 —— 每一个 solver 都把不同的群论概念翻译成具体算法。 这是「群论的工程化」最干净的例子之一。</>}
            en={<>Starting from §10's Thistlethwaite subgroup chain, through Kociemba's two-phase, Korf's optimal IDA*, and Rokicki's coset enumeration — each solver translates a different group-theoretic idea into running code. Group theory rendered as engineering, in one of its cleanest forms.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="22.1  比较表" en="22.1  Comparison table" />
        </h3>
        <AlgorithmCompareTable />
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="22.2  Thistlethwaite 算法:子群链 + 阶段搜索" en="22.2  Thistlethwaite: subgroup chain + per-stage search" />
        </h3>
        <p>
          <L
            zh={<>核心想法:把 G 的解分解为 <em>4 个独立子问题</em>,每个子问题在子群 <TeX src={`G_i/G_{i+1}`} /> 上做有限制的 BFS/IDA*。 因为每个商小很多 (最大约 10⁶),BFS 可以存全表。</>}
            en={<>Core idea: decompose the solve into <em>4 independent subproblems</em>, each a bounded BFS/IDA* on the quotient <TeX src={`G_i/G_{i+1}`} />. The quotients are small (≤ 10⁶), so each stage has a complete pruning table.</>}
          />
        </p>
        <TeXBlock src={`G_0 = G \\;\\supset\\; G_1 \\;\\supset\\; G_2 \\;\\supset\\; G_3 \\;\\supset\\; \\{e\\}`} />
        <ThistlethwaitePhaseChart />
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="22.3  Kociemba 两阶段算法" en="22.3  Kociemba's two-phase algorithm" />
        </h3>
        <p>
          <L
            zh={<>Kociemba 把 4 阶段合并成 <strong>2 阶段</strong>:阶段 1 把状态搬进 <TeX src={`G_2 = \\langle U, D, L^2, R^2, F^2, B^2 \\rangle`} />,阶段 2 在 G₂ 内部解开。 两阶段都用 IDA* + 模式数据库。</>}
            en={<>Kociemba collapsed 4 stages into <strong>2</strong>: Phase 1 moves the state into <TeX src={`G_2 = \\langle U, D, L^2, R^2, F^2, B^2 \\rangle`} />, Phase 2 solves within G₂. Both phases run IDA* with pruning tables.</>}
          />
        </p>
        <div className="gt-algo-flow">
          <div className="gt-algo-flow-step">
            <div className="gt-algo-flow-num">Phase 1</div>
            <div className="gt-algo-flow-title">{lang === 'zh' ? 'G → G₂' : 'G → G₂'}</div>
            <div className="gt-algo-flow-body">
              {tr({ zh: '坐标:(co, eo, slice). 表大小:2187 × 2048 × 495 ≈ 2.2 × 10⁹。 用 IDA*, 启发式 max(co-depth, eo-depth, slice-depth)。', en: 'Coords: (co, eo, slice). Table sizes 2187 × 2048 × 495 ≈ 2.2 × 10⁹. IDA* with heuristic max(co, eo, slice).'
            })}
            </div>
          </div>
          <div className="gt-algo-flow-arrow">→</div>
          <div className="gt-algo-flow-step">
            <div className="gt-algo-flow-num">Phase 2</div>
            <div className="gt-algo-flow-title">{lang === 'zh' ? 'G₂ → e' : 'G₂ → e'}</div>
            <div className="gt-algo-flow-body">
              {tr({ zh: '坐标:(cp, ep_UD, ep_slice). 表大小 40320 × 40320 × 24 ≈ 4 × 10¹⁰. 但每个状态只有 10 个允许 generator (U, D, L², R², F², B²)。', en: 'Coords: (cp, ep_UD, ep_slice). Table 40320 × 40320 × 24 ≈ 4 × 10¹⁰. Only 10 generators allowed in this phase.'
            })}
            </div>
          </div>
        </div>
        <p style={{ marginTop: 16 }}>
          <L
            zh={<>2 阶段算法不一定最优 (会过冲一些步数),但 <strong>毫秒级 + 平均 ~21 HTM</strong>,工业用 solver 几乎都是它的变体 (cube20 用 Reid 优化版,kociemba.org 用 N=18 切换)。</>}
            en={<>Two-phase is not optimal (overshoots a few moves) but runs in <strong>milliseconds at ~21 HTM avg.</strong>; nearly every production solver is a variant (cube20 uses Reid's tweaks; kociemba.org uses Phase-2 lookup with N=18).</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="22.4  Korf IDA*:第一个最优 solver" en="22.4  Korf's IDA*: the first optimal solver" />
        </h3>
        <p>
          <L
            zh={<>1997 年 Richard Korf 用 IDA* (Iterative Deepening A*) + 大小约 80 MB 的 <strong>pattern database</strong> 第一次得到了 Rubik's Cube 的 <em>最优解</em>。 关键想法:对单独子集 (8 角的 ep+eo, 或 6 棱) 预计算 <em>最短解</em>;启发式 h(s) = max(各子集的最短解距离)。这个 h 总是 admissible (不高估),保证 IDA* 找到最优。</>}
            en={<>In 1997 Richard Korf delivered the first <em>optimal</em> Rubik's Cube solver via IDA* (Iterative Deepening A*) plus an ~80 MB <strong>pattern database</strong>. Key idea: precompute exact distances on chosen subsets (8 corners, or 6 edges) and use h(s) = max of subset distances. The h is admissible (never overestimates), so IDA* yields the optimum.</>}
          />
        </p>
        <div className="gt-algo-pseudo">
      {`function IDAstar(start):
          bound = h(start)
          while True:
        t = search(start, 0, bound)
        if t == FOUND: return path
        bound = t

      function search(node, g, bound):
          f = g + h(node)
          if f > bound: return f
          if isGoal(node): return FOUND
          min = ∞
          for child in successors(node):
        t = search(child, g + 1, bound)
        if t == FOUND: return FOUND
        if t < min: min = t
          return min`}
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="22.5  Rokicki 对称压缩:20-步证明" en="22.5  Rokicki coset enumeration: the 20-move proof" />
        </h3>
        <p>
          <L
            zh={<>Tomas Rokicki 等人 (2010) 用了一个 <strong>不解魔方</strong> 的算法:把 G 划分为 G/H 的陪集 (H 是 Kociemba 的 G₂),对每个陪集证明「20 步内可解」。 关键:</>}
            en={<>Tomas Rokicki et al. (2010) used an algorithm that does <strong>not solve cubes</strong>: partition G into cosets G/H (H = Kociemba's G₂), and for each coset prove "solvable in ≤ 20 moves." Key ingredients:</>}
          />
        </p>
        <ol style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L
            zh={<><strong>对称减:</strong> 用 48 阶 Oₕ 对称群把 |G/H| ≈ 2 × 10⁹ 个陪集压到 ~5 × 10⁷ 个对称等价类。</>}
            en={<><strong>Symmetry reduction:</strong> use the order-48 Oₕ symmetry group to collapse |G/H| ≈ 2 × 10⁹ cosets down to ~5 × 10⁷ equivalence classes.</>}
          /></li>
          <li><L
            zh={<><strong>每个陪集 ≤ 20 步:</strong> 对每个等价类的代表跑一次「19 步内可解吗?」 IDA*。 如果可以,这个陪集所有 (4 × 10¹⁰) 个元素都「19 步内解」。 如果不能,降到 20 步 ——必然成功。</>}
            en={<><strong>Each coset ≤ 20 moves:</strong> for each representative, IDA* asks "solvable in ≤ 19 moves?" If yes, all 4 × 10¹⁰ states in that coset are. If not, try 20 — must succeed.</>}
          /></li>
          <li><L
            zh={<><strong>总 CPU 时间:</strong> Google 捐了大约 35 CPU-年。 2010 年宣布:Rubik's Cube 直径 = 20 HTM。</>}
            en={<><strong>Total CPU time:</strong> Google donated ~35 CPU-years. Announced 2010: the cube's diameter is exactly 20 HTM.</>}
          /></li>
        </ol>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="22.6  Korf IDA* — admissibility 严格证明" en="22.6  Korf IDA* — proving admissibility" />
        </h3>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 22.1 — admissibility', en: 'Theorem 22.1 — admissibility' })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>设 <TeX src={`h_1, h_2, h_3 : G \\to \\mathbb{N}`} /> 是 G 中三个 「子问题距离」 (角块距离、 棱块 1 距离、 棱块 2 距离)。 取 <TeX src={`h(g) = \\max(h_1, h_2, h_3)`} />, 则 <TeX src={`h(g) \\leq d_S(g, e)`} /> 对所有 g 成立 (admissible)。</>}
              en={<>Let <TeX src={`h_1, h_2, h_3 : G \\to \\mathbb{N}`} /> be three "subproblem distances" (corners, edge subset 1, edge subset 2). Define <TeX src={`h(g) = \\max(h_1, h_2, h_3)`} />. Then <TeX src={`h(g) \\leq d_S(g, e)`} /> for every g (admissible).</>}
            />
          </div>
        </div>
        <div className="gt-proof">
          <div className="gt-proof-title">{tr({ zh: '证明', en: 'Proof'
        })}</div>
          <L
            zh={<>
              <p style={{ margin: '0 0 12px' }}>设 g ∈ G, <TeX src={`d_S(g, e) = k`} /> (即 g 可由 k 个生成元乘出)。 把 g 投到 「子集 X_i」 (例如 8 角块) 上, 得 <TeX src={`\\pi_i(g) \\in \\pi_i(G)`} />, 其 「子集 distance」 <TeX src={`h_i(g) = d_S(\\pi_i(g), e)`} />。</p>
              <p style={{ margin: '0 0 12px' }}>由 π_i 是同态, 把 「g 的 k-步表示」 投下来给出 π_i(g) 的一个 k-步表示, 故 <TeX src={`h_i(g) \\leq k`} />。 取 max 仍 ≤ k。 ∎</p>
              <p style={{ margin: '0 0 12px' }}>关键: 每个 <TeX src={`h_i`} /> 在自己的 「pattern database」 里被预计算为 <strong>精确 BFS 距离</strong>, 即在 X_i 上的最短解 — 这才是 admissibility 成立的根本。 若 <TeX src={`h_i`} /> 是一个近似 (例如 「错位数」), 就只是 「弱启发式」, IDA* 不再保证最优。</p>
            </>}
            en={<>
              <p style={{ margin: '0 0 12px' }}>Let g ∈ G with <TeX src={`d_S(g, e) = k`} />. Project g via the homomorphism <TeX src={`\\pi_i`} /> onto subset i; then <TeX src={`h_i(g) = d_S(\\pi_i(g), e)`} />.</p>
              <p style={{ margin: '0 0 12px' }}>Since π_i is a homomorphism, a k-step word for g pushes forward to a k-step word for π_i(g). So <TeX src={`h_i(g) \\leq k`} />, and the max of admissible heuristics is admissible. ∎</p>
              <p style={{ margin: '0 0 12px' }}>Key point: each <TeX src={`h_i`} /> in Korf's pattern database is the <strong>exact BFS distance</strong> in subset i — this is what makes admissibility hold. A loose heuristic (e.g. "mismatch count") gives no optimality guarantee.</p>
            </>}
          />
          <div className="gt-proof-end">∎</div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="22.7  复杂度对比" en="22.7  Complexity comparison" />
        </h3>
        <table className="gt-compare">
          <thead>
            <tr><th>{tr({ zh: '算法', en: 'Algorithm'
            })}</th><th>{tr({ zh: '最优?', en: 'Optimal?'
            })}</th><th>{tr({ zh: '时间', en: 'Time'
            })}</th><th>{tr({ zh: '空间', en: 'Space'
            })}</th><th>{tr({ zh: '典型步数', en: 'Typical len'
            })}</th></tr>
          </thead>
          <tbody>
            <tr><td>{tr({ zh: '朴素 BFS', en: 'Naive BFS'
            })}</td><td>{tr({ zh: '是', en: 'yes' })}</td><td className="num"><TeX src={`O(|G|)`} /></td><td className="num"><TeX src={`O(|G|)`} /></td><td className="num">{tr({ zh: '不可行', en: 'infeasible' })}</td></tr>
            <tr><td>Korf IDA* (1997)</td><td>{tr({ zh: '是', en: 'yes' })}</td><td className="num"><TeX src={`O(b^d)`} /> {lang === 'zh' ? ',b ≈ 13.34, d ≤ 20' : ', b ≈ 13.34, d ≤ 20'}</td><td className="num">~80 MB</td><td className="num">{tr({ zh: '最优 18–20 HTM', en: 'opt. 18–20 HTM'
            })}</td></tr>
            <tr><td>Kociemba two-phase (1992)</td><td>{tr({ zh: '否 (近似)', en: 'no (suboptimal)' })}</td><td className="num">~ms</td><td className="num">~100 MB</td><td className="num">~21 HTM</td></tr>
            <tr><td>Thistlethwaite (1981)</td><td>{tr({ zh: '否', en: 'no' })}</td><td className="num">~ms</td><td className="num">~10 MB</td><td className="num">~50 HTM</td></tr>
            <tr><td>Rokicki 2010</td><td>{tr({ zh: '验证而非 solver', en: 'verifier, not solver'
            })}</td><td className="num">35 CPU-yr</td><td className="num">~2 GB</td><td className="num">{tr({ zh: '不输出 alg', en: 'no alg output'
            })}</td></tr>
            <tr><td>DeepCubeA (2019)</td><td>{tr({ zh: '否', en: 'no' })}</td><td className="num">~s</td><td className="num">~GB</td><td className="num">~21 HTM</td></tr>
          </tbody>
        </table>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="22.8  DeepCubeA — 深度强化学习 (2019)" en="22.8  DeepCubeA — deep reinforcement learning (2019)" />
        </h3>
        <p>
          <L
            zh={<>2019 年 UC Irvine 团队 (McAleer, Agostinelli, Shmakov, Baldi) 在 Nature Machine Intelligence 发表 <strong>DeepCubeA</strong>: 用神经网络近似 「cost-to-go」 函数 h(s), 替代 Korf 的 pattern database。 网络在 「scramble → 逐步逆向 BFS」 上自监督训练 (autodidactic iteration), 配 A* 搜索。</>}
            en={<>In 2019 a UC Irvine team (McAleer, Agostinelli, Shmakov, Baldi) published <strong>DeepCubeA</strong> in Nature Machine Intelligence: a neural network approximates the cost-to-go function h(s), replacing Korf's pattern database. The net is trained "autodidactically" on scrambles solved by reverse BFS, then combined with A* search.</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L
            zh={<><strong>h 不再 admissible</strong> — 神经网络只是近似, 偶有低估或高估, 故输出 <em>不</em> 最优 (但接近: 平均约 21 HTM, 与 Kociemba 相当)。</>}
            en={<><strong>h is no longer admissible</strong> — the network is approximate, occasionally over- or underestimating, so output is <em>not</em> guaranteed optimal (but typically close: ~21 HTM avg, comparable to Kociemba).</>}
          /></li>
          <li><L
            zh={<><strong>泛化到其它拼图</strong>: 同一架构在 4×4、 5×5、 24-puzzle (sliding tiles)、 Lights Out 都能学到接近最优的解 — 这是 Korf solver 做不到的, 因为 pattern database 是手工 per-puzzle 设计。</>}
            en={<><strong>Generalises across puzzles</strong>: the same architecture learned near-optimal heuristics for 4×4, 5×5, the 24-puzzle, and Lights Out — something Korf-style PDBs cannot, since they are hand-crafted per puzzle.</>}
          /></li>
          <li><L
            zh={<><strong>训练成本</strong>: 数百 GPU-小时 (相对 Rokicki 的 35 CPU-年, 已是数量级降本)。 但 worst-case 保证仍然只有 Rokicki 给出的 20 HTM 严格证明。</>}
            en={<><strong>Training cost</strong>: hundreds of GPU-hours (orders of magnitude cheaper than Rokicki's 35 CPU-years). Yet the only worst-case guarantee remains Rokicki's exact 20 HTM proof.</>}
          /></li>
        </ul>
      </GTSec>
  );
}
