'use client';

import { GTSec, L, TeX, useLang } from '../primitives';
import { tr } from '@/i18n/tr';

function PuzzleComparison() {
  const lang = useLang();
  const rows: { name: string; nameZh: string; order: string; gen: string; diam: string; isCube?: boolean }[] = [
    { name: '2×2×2 Pocket', nameZh: '2×2×2 口袋', order: '3,674,160',                gen: '⟨U, F, R⟩ (3 faces enough)', diam: '11 (HTM)' },
    { name: '3×3×3 (this)', nameZh: '3×3×3 (本文)', order: '4.3 × 10¹⁹',              gen: '⟨U, D, L, R, F, B⟩',    diam: '20 (HTM)', isCube: true },
    { name: 'Skewb',         nameZh: 'Skewb',       order: '3,149,280',                gen: '4 corner cuts',          diam: '11' },
    { name: 'Pyraminx',      nameZh: 'Pyraminx',    order: '75,582,720',               gen: '4 tips + 4 axis turns', diam: '11 (excluding tips)' },
    { name: '4×4×4 Revenge', nameZh: '4×4×4',        order: '7.4 × 10⁴⁵',             gen: 'inner + outer slices',  diam: 'unknown (≥ 22, ≤ 36)' },
    { name: '5×5×5',         nameZh: '5×5×5',        order: '2.8 × 10⁷⁴',             gen: 'inner + outer slices',  diam: 'unknown' },
    { name: 'Megaminx',      nameZh: 'Megaminx',    order: '1.0 × 10⁶⁸',              gen: '12 pentagonal faces',   diam: 'unknown' },
    { name: 'Square-1',      nameZh: 'Square-1',    order: '6.7 × 10¹¹',              gen: '/ , (1, 0) , (0, 1) etc.', diam: '13 (turn metric)' },
  ];
  return (
    <table className="gt-compare">
      <thead>
        <tr>
          <th>{tr({ zh: '拼图', en: 'Puzzle'
        })}</th>
          <th>{tr({ zh: '阶', en: 'Order'
        })}</th>
          <th>{tr({ zh: '生成集', en: 'Generators' })}</th>
          <th>{tr({ zh: '直径', en: 'Diameter'
        })}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td className={r.isCube ? 'gt-compare-cube' : ''}>{lang === 'zh' ? r.nameZh : r.name}</td>
            <td className="num">{r.order}</td>
            <td><span className="gt-mono" style={{ fontSize: 11 }}>{r.gen}</span></td>
            <td className="num">{r.diam}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Order distribution table (§7 supplement) ──────────────────────────────

export default function OtherPuzzles() {
  return (
      <GTSec id="other-puzzles" className="gt-sec">
        <div className="gt-sec-num">§15</div>
        <h2 className="gt-sec-title">
          <L zh="其它拼图 — 同一框架, 不同舞台" en="Other puzzles — same framework, different stages" />
        </h2>
        <p className="gt-lede">
          <L
            zh={<>魔方的成功让群论成为研究 <em>所有</em> 扭转拼图的标准工具。 每一个拼图都有它自己的群、 自己的生成集、 自己的直径、 自己的开放问题。 拿同一套语言 (生成元、 共轭类、 子群链、 Cayley 图) 走过去, 你就能比较他们的「难度」、 「结构」、 「对称」。</>}
            en={<>The cube's success made group theory the standard tool for every twisting puzzle. Each puzzle has its own group, generators, diameter, and open questions. Walking through with the same language — generators, conjugacy classes, subgroup chains, Cayley graphs — you can compare their <em>difficulty</em>, <em>structure</em>, and <em>symmetry</em> on equal footing.</>}
          />
        </p>
        <PuzzleComparison />

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="15.1  阶 |G| 的闭式与 n × n × n 渐近" en="15.1  Closed-form |G| and the n × n × n asymptotic" />
        </h3>
        <p>
          <L
            zh={<>每一类常见拼图的群阶都能写成 「<em>排列</em> × <em>朝向</em> ÷ <em>奇偶/中心约束</em>」 的封闭式。 把 3×3 和它的近亲并排放着:</>}
            en={<>Each common puzzle's group order is a closed-form "<em>permutations</em> × <em>orientations</em> ÷ <em>parity/centre constraints</em>". Side by side with the 3×3:</>}
          />
        </p>
        <div className="gt-puzzle-formula-list">
          <div className="gt-puzzle-formula"><span>2×2×2</span><TeX src={`\\dfrac{7!\\,\\cdot\\,3^6}{3} = 3{,}674{,}160`} /></div>
          <div className="gt-puzzle-formula"><span>3×3×3 (G)</span><TeX src={`\\dfrac{8!\\,\\cdot\\,12!\\,\\cdot\\,3^7\\,\\cdot\\,2^{11}}{2} \\approx 4.33 \\times 10^{19}`} /></div>
          <div className="gt-puzzle-formula"><span>4×4×4</span><TeX src={`\\dfrac{8!\\,\\cdot\\,3^7\\,\\cdot\\,24!^{2}}{4!^{\\,6} \\cdot 24} \\approx 7.40 \\times 10^{45}`} /></div>
          <div className="gt-puzzle-formula"><span>5×5×5</span><TeX src={`\\dfrac{8!\\,\\cdot\\,3^7\\,\\cdot\\,24!^{2}\\,\\cdot\\,12!\\,\\cdot\\,24!}{4!^{6}\\,\\cdot\\,2} \\approx 2.83 \\times 10^{74}`} /></div>
          <div className="gt-puzzle-formula"><span>Pyraminx</span><TeX src={`3^4 \\cdot 3^4 \\cdot \\dfrac{6!}{2}\\,\\cdot\\,3^4 = 75{,}582{,}720`} /></div>
          <div className="gt-puzzle-formula"><span>Skewb</span><TeX src={`8!\\,\\cdot\\,3^4 \\cdot 2 = 3{,}149{,}280`} /></div>
          <div className="gt-puzzle-formula"><span>Megaminx</span><TeX src={`\\dfrac{(5!)^{12}\\,\\cdot\\,20!\\,\\cdot\\,3^{19}\\,\\cdot\\,30!\\,\\cdot\\,2^{29}}{\\text{constraints}} \\approx 1.01 \\times 10^{68}`} /></div>
          <div className="gt-puzzle-formula"><span>Square-1</span><TeX src={`\\sim 1.78 \\times 10^{14}\\;(\\text{shape-dep.\\ groupoid})`} /></div>
        </div>
        <div className="gt-aside">
          <L
            zh={<><strong>渐近行为</strong>:对一般 n × n × n, 群阶按 <TeX src={`|G_n| = \\Theta(n!^{\\,O(n^2)})`} /> 增长,但 「<em>God's number</em>」 (直径) 只增长成 <TeX src={`\\Theta(n^2 / \\log n)`} /> (Demaine et al. 2018)。 状态数 <em>双指数</em> 爆炸, 但路径长度只 <em>多项式</em> 增长 ── 这是 「Cayley 图越来越胖,但直径却几乎不变」的精确陈述。</>}
            en={<><strong>Asymptotic</strong>: for general n × n × n the order grows like <TeX src={`|G_n| = \\Theta(n!^{\\,O(n^2)})`} />, but the <em>God's number</em> (diameter) grows only as <TeX src={`\\Theta(n^2 / \\log n)`} /> (Demaine et al. 2018). The state count <em>double-exponentially</em> explodes while the path length grows only <em>polynomially</em> — the precise sense in which the Cayley graph keeps getting fatter without getting much wider.</>}
          />
        </div>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="15.2  已知 God's number 一览" en="15.2  Known God's numbers, at a glance" />
        </h3>
        <div className="gt-puzzle-godtbl">
          <table className="gt-pattern-tbl">
            <thead>
              <tr>
                <th>{tr({ zh: '拼图', en: 'puzzle'
                })}</th>
                <th>HTM</th>
                <th>QTM/STM</th>
                <th>{tr({ zh: '状态', en: 'status'
                })}</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>2×2×2</td><td className="num">11</td><td className="num">14 (QTM)</td><td>{tr({ zh: '已确证 (Reid 1995)', en: 'proven (Reid 1995)'
            })}</td></tr>
              <tr><td>3×3×3</td><td className="num">20</td><td className="num">26 (QTM)</td><td>{tr({ zh: '已确证 (Rokicki et al. 2010)', en: 'proven (Rokicki et al. 2010)'
            })}</td></tr>
              <tr><td>4×4×4</td><td className="num">[22, 36]</td><td className="num">[35, 53]</td><td>{tr({ zh: '开放 — 区间持续收紧', en: 'open — interval slowly tightening'
            })}</td></tr>
              <tr><td>5×5×5</td><td className="num">[20, 32]</td><td className="num">?</td><td>{tr({ zh: '开放', en: 'open'
            })}</td></tr>
              <tr><td>Pyraminx</td><td className="num">11</td><td className="num">11</td><td>{tr({ zh: '已确证 (Cubelovers, 1981)', en: 'proven (Cubelovers, 1981)'
            })}</td></tr>
              <tr><td>Skewb</td><td className="num">11</td><td className="num">11</td><td>{tr({ zh: '已确证', en: 'proven'
            })}</td></tr>
              <tr><td>Megaminx</td><td className="num">≈ 45</td><td className="num">?</td><td>{tr({ zh: '上界未严格证明', en: 'upper bound unproved'
            })}</td></tr>
              <tr><td>Square-1</td><td className="num">[31, 35]</td><td className="num">[26, 31]</td><td>{tr({ zh: '开放', en: 'open'
            })}</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          <L
            zh={<>有趣的对比:5×5×5 的 HTM 下界 <strong>反而比 3×3×3 还小</strong> ─ 因为有更多自由度可同时被一次转面影响。 直径不随群阶单调增长, 它跟生成集的「<em>覆盖效率</em>」相关 ── 一个本质性的图论问题。</>}
            en={<>A surprising point: the 5×5×5's HTM lower bound is <strong>smaller than the 3×3×3's</strong> — more degrees of freedom can be affected per turn. Diameter does not grow monotonically with group order; it tracks the <em>covering efficiency</em> of the generating set — a deep graph-theoretic question in its own right.</>}
          />
        </p>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="15.3  超出经典置换群" en="15.3  Beyond classical permutation groups" />
        </h3>
        <p>
          <L
            zh={<>有些拼图的 「状态空间」 不是经典群, 而是更弱的代数对象 — 通常因为状态依赖几何匹配。 它们提供了三个研究方向:</>}
            en={<>Some puzzles' state spaces are not classical groups but weaker algebraic structures — usually because legal states depend on geometric matching. They open three research directions:</>}
          />
        </p>
        <div className="gt-beyond-threads">
          <div className="gt-beyond-thread">
            <div className="gt-beyond-thread-head"><span className="gt-beyond-thread-tag">A</span><L zh="Groupoid (Square-1)" en="Groupoid (Square-1)" /></div>
            <div className="gt-beyond-thread-body">
              <L
                zh={<>Square-1 顶/底层可以切到 1/12 的非整数倍, 加上中间 / (flip) 操作。 合法状态依赖于切割的几何对齐, 不能仅用置换描述。 它形成一个 <em>groupoid</em> (带「对象」 类型的范畴化群)。 不同 「shape class」 (12 类) 各对应一个轨道, 总状态数 ≈ 1.78 × 10¹⁴。</>}
                en={<>Square-1's top and bottom can rotate at non-integer multiples of 1/12, plus a / (flip) operation. Legal states depend on geometric alignment — not pure permutations. The state space is a <em>groupoid</em> (a categorified group with object types). Each of 12 "shape classes" is an orbit; total state count ≈ 1.78 × 10¹⁴.</>}
              />
            </div>
          </div>
          <div className="gt-beyond-thread">
            <div className="gt-beyond-thread-head"><span className="gt-beyond-thread-tag">B</span><L zh="Submonoid (Bandaged)" en="Submonoid (Bandaged)" /></div>
            <div className="gt-beyond-thread-body">
              <L
                zh={<>Bandaged 魔方某些 cubies 被胶带绑成一组, 某些面转被禁掉。 结果是 G 的子群 (生成集变小), 但 <em>solver 算法必须重写</em> — Thistlethwaite / Kociemba 都依赖 「6 个生成元都能用」 的假设。 几个常见 bandage 配置都是公认的硬例。</>}
                en={<>In bandaged cubes, some cubies are glued, forbidding certain turns. The result is a proper subgroup of G (smaller generating set), but the <em>solver must be redesigned</em> — Thistlethwaite and Kociemba both assume "all 6 generators available." Many bandage configurations are notoriously hard.</>}
              />
            </div>
          </div>
          <div className="gt-beyond-thread">
            <div className="gt-beyond-thread-head"><span className="gt-beyond-thread-tag">C</span><L zh="Jumbling (Helicopter)" en="Jumbling (Helicopter)" /></div>
            <div className="gt-beyond-thread-body">
              <L
                zh={<>Helicopter 立方体在 「<em>jumbling</em>」 切割下能进入正常立方形状之外的连续位置。 它的 「群」 实际上是带 <em>无限</em> 几何分支的, 经典置换语言不够用 — 这类拼图被称作 「jumbling puzzles」, 它们的群结构是 21 世纪初才开始系统研究的话题。</>}
                en={<>The Helicopter cube admits <em>jumbling</em> cuts that enter geometric states outside the canonical cube shape. Its "group" effectively has <em>infinite</em> geometric branches; classical permutations don't suffice. Such "jumbling puzzles" are a 21st-century research topic.</>}
              />
            </div>
          </div>
        </div>

        <div className="gt-pullquote">
          <L
            zh={<>「Square-1 不是反例, 是 <em>新例</em> — 它告诉我们群论本身需要扩展。」</>}
            en={<>"Square-1 is not a counterexample. It is a <em>new example</em> — it tells us that group theory itself needs extending."</>}
          />
          <div className="gt-pullquote-cite">— Erik Demaine, on geometric puzzle complexity</div>
        </div>

        <p>
          <L
            zh={<>这些 「奇异拼图」 揭示群论真正的弹性: 一旦你接受 「群是对称的语言」, 几乎任何机械拼图都能拿来分析。 当群不够用时, 我们就扩展成 groupoid、 submonoid、 jumbling 流形 —— 数学接着往前推。</>}
            en={<>These exotic puzzles reveal the elasticity of the framework: once you accept "groups are the language of symmetry," nearly any mechanical puzzle becomes analysable. And when groups don't suffice, we extend into groupoids, submonoids, jumbling manifolds — the mathematics keeps moving forward.</>}
          />
        </p>
      </GTSec>
  );
}
