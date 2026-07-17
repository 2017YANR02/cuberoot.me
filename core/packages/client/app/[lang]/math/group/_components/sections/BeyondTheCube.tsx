'use client';

import Link from '@/components/AppLink';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { tr } from '@/i18n/tr';

// §beyond — self-contained prose section, lazy-loaded per slug from page.tsx's
// EXT_COMPONENTS map (see the section-extraction note there).
export default function BeyondTheCube() {
  const lang = useLang();
  return (
      <GTSec id="beyond" className="gt-sec">
        <div className="gt-sec-num">§12</div>
        <h2 className="gt-sec-title">
          <L zh="走得更远 — 魔方群在数学版图上的位置" en="Beyond the cube — locating G on the mathematical map" />
        </h2>
        <p className="gt-lede">
          <L
            zh={<>把魔方放在「<strong>有限群分类</strong>」的全景图里看一眼,你会发现它不是一个孤立的代数玩具,而是一个 <em>具体得能摸到</em> 的样本,被 19–21 世纪的几条主线同时穿过 —— 置换群、 Cayley 几何、 解的复杂度、 随机游走、 表示论、 量子算法。 每一条线都从这里出发能走很远。</>}
            en={<>Place the cube on the full map of <strong>finite group theory</strong> and it stops looking like an isolated puzzle. It is a <em>tactile</em> sample that several 19th–21st-century threads pass through at once — permutation groups, Cayley geometry, complexity of solving, random walks, representation theory, even quantum algorithms. Each thread extends much further from here.</>}
          />
        </p>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="12.1  魔方在「有限群版图」上" en="12.1  G on the map of finite groups" />
        </h3>
        <p>
          <L
            zh={<>有限简单群的 <strong>分类定理</strong> (CFSG, 1983 完成) 把所有非阿贝尔有限简单群分成四大族 + 26 个零散群 (sporadic groups,最大者 「Monster」 阶约 <TeX src={`8 \\times 10^{53}`} />)。 魔方群 <em>G 不是简单群</em> —— 它有非平凡正规子群 (§20)。 但 G 的两个商因子 <TeX src={`A_8`} /> 和 <TeX src={`A_{12}`} /> 是 <em>交错群</em>, 都属于 CFSG 中最大的一族。 这是为什么 G 的「骨架」 (structure descriptor) 看起来像</>}
            en={<>The <strong>Classification of Finite Simple Groups</strong> (CFSG, completed 1983) partitions all non-Abelian finite simple groups into four big families plus 26 sporadic groups (the largest, the Monster, has order ≈ <TeX src={`8 \\times 10^{53}`} />). The cube group <em>G is not simple</em> — it has non-trivial normal subgroups (§20). But two of G's quotient factors, <TeX src={`A_8`} /> and <TeX src={`A_{12}`} />, are <em>alternating groups</em>, sitting in CFSG's largest family. That is why G's structure-descriptor looks like</>}
          />
        </p>
        <TeXBlock src={`G \\;\\cong\\; \\bigl(\\mathbb{Z}/3^{\\,7} \\rtimes \\mathbb{Z}/2^{\\,11}\\bigr) \\rtimes \\bigl(S_8 \\times S_{12}\\bigr) / \\mathbb{Z}/2`} />
        <p>
          <L
            zh={<>—— 一个由 <em>阿贝尔朝向部分</em> (角向 + 棱向) 与 <em>非阿贝尔置换部分</em> (角排 + 棱排) 半直积组成,再除以一个 <TeX src={`\\mathbb{Z}/2`} /> (奇偶约束) 的结构。 它正好处在「有结构、可分解、但不简单」 这一类 —— 对学习半直积、 短正合列、商群的初学者来说,是 <em>教科书级别</em> 的样本。</>}
            en={<>— a semidirect product of an <em>Abelian orientation piece</em> (corner + edge twists) with a <em>non-Abelian permutation piece</em> (corner + edge perms), quotiented by a <TeX src={`\\mathbb{Z}/2`} /> parity. It sits exactly at "structured, decomposable, but not simple" — a textbook example for first-time students of semidirect products, short exact sequences, and quotients.</>}
          />
        </p>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="12.2  七条从 G 出发的数学线" en="12.2  Seven threads departing from G" />
        </h3>
        <div className="gt-beyond-threads">
          <div className="gt-beyond-thread">
            <div className="gt-beyond-thread-head"><span className="gt-beyond-thread-tag">1</span><L zh="组合 / 置换群" en="Combinatorics / permutation groups" /></div>
            <div className="gt-beyond-thread-body">
              <L
                zh={<>G 视作 <TeX src={`S_{48}`} /> (48 张贴纸) 的子群。 Cayley 1854 的「每个群同构于某个置换群的子群」 是出发点。 从这里走向 <em>BSGS / Schreier–Sims</em> (§25)、 <em>群表示</em> (§26)、 <em>组合枚举</em> (Pólya 1937)。</>}
                en={<>View G as a subgroup of <TeX src={`S_{48}`} /> (the 48 stickers). Cayley's 1854 theorem ("every group embeds into some symmetric group") is the launching pad. From here: <em>BSGS / Schreier–Sims</em> (§25), <em>representations</em> (§26), <em>combinatorial enumeration</em> (Pólya 1937).</>}
              />
            </div>
          </div>
          <div className="gt-beyond-thread">
            <div className="gt-beyond-thread-head"><span className="gt-beyond-thread-tag">2</span><L zh="Cayley 图与图论" en="Cayley graphs & graph theory" /></div>
            <div className="gt-beyond-thread-body">
              <L
                zh={<>G + 生成集 → <TeX src={`\\Gamma(G, S)`} /> 是一个 18-正则图。 直径 = 上帝之数 = 20。 这把魔方接到 <em>expander graphs</em>、 <em>Ramanujan graphs</em>、 <em>random regular graphs</em> 的现代研究。 G 的 Cayley 图就是一个具体的 expander 候选样本。</>}
                en={<>G + a generating set yields <TeX src={`\\Gamma(G, S)`} />, an 18-regular graph. Diameter = God's number = 20. This connects the cube to modern work on <em>expander graphs</em>, <em>Ramanujan graphs</em>, and <em>random regular graphs</em>. The cube's Cayley graph is a concrete expander-candidate.</>}
              />
            </div>
          </div>
          <div className="gt-beyond-thread">
            <div className="gt-beyond-thread-head"><span className="gt-beyond-thread-tag">3</span><L zh="复杂度与可解性" en="Complexity & solvability" /></div>
            <div className="gt-beyond-thread-body">
              <L
                zh={<>「求 n×n×n 的最短解」 在 n ≥ 2 时 <strong>NP-完备</strong> (Demaine et al. 2018)。 但「<em>字问题</em>」 在 G 上是 <em>线性</em> 时间可解 —— 因为 G 有限。 这两件事并行存在: G 的代数 (字问题) 简单, 它的几何 (Cayley 图距离) 困难。</>}
                en={<>Solving the <em>shortest-alg</em> problem on n×n×n is <strong>NP-complete</strong> for n ≥ 2 (Demaine et al. 2018). But the <em>word problem</em> on G is solvable in linear time — because G is finite. These coexist: G's algebra (word problem) is easy, while G's geometry (Cayley distance) is hard.</>}
              />
            </div>
          </div>
          <div className="gt-beyond-thread">
            <div className="gt-beyond-thread-head"><span className="gt-beyond-thread-tag">4</span><L zh="随机游走 / 马尔可夫链" en="Random walks / Markov chains" /></div>
            <div className="gt-beyond-thread-body">
              <L
                zh={<>「均匀随机选 18 步之一」 是 G 上的 Markov 链。 Diaconis–Shahshahani 框架 (§24) 把 <em>混合时间</em> 翻译成不可约表示的 Fourier 衰减。 G 上的精确 cutoff 还是 open。</>}
                en={<>"Uniform choice of one of 18 moves" is a Markov chain on G. The Diaconis–Shahshahani framework (§24) converts <em>mixing time</em> into Fourier decay over irreducibles. The exact cutoff for G is open.</>}
              />
            </div>
          </div>
          <div className="gt-beyond-thread">
            <div className="gt-beyond-thread-head"><span className="gt-beyond-thread-tag">5</span><L zh="表示论 + Fourier 分析" en="Representation theory + Fourier" /></div>
            <div className="gt-beyond-thread-body">
              <L
                zh={<>G 的不可约表示数 = 共轭类数 ≈ 81,120 (§8.2)。 G 的 abelianization <TeX src={`G^{\\mathrm{ab}} = \\mathbb{Z}/2`} /> 给出 <strong>恰好两个 1 维表示</strong> (平凡 + sgn)。 其余全部 ≥ 2 维 —— 反映 G 的强烈非阿贝尔性 (§26)。</>}
                en={<>G has # irreducibles = # conjugacy classes ≈ 81,120 (§8.2). The abelianization <TeX src={`G^{\\mathrm{ab}} = \\mathbb{Z}/2`} /> yields <strong>exactly two 1-dim irreducibles</strong> (trivial + sign). All others have dimension ≥ 2 — a sharp marker of how non-Abelian G is (§26).</>}
              />
            </div>
          </div>
          <div className="gt-beyond-thread">
            <div className="gt-beyond-thread-head"><span className="gt-beyond-thread-tag">6</span><L zh="计算代数 (CAS)" en="Computer algebra systems" /></div>
            <div className="gt-beyond-thread-body">
              <L
                zh={<>GAP、 Magma、 SageMath 都把 G 作为基准测试。 GAP 一行命令 <span className="gt-mono">StructureDescription(G);</span> 给出 G 的半直积分解, 用的就是 Schreier–Sims 的 BSGS (§25.2)。</>}
                en={<>GAP, Magma, SageMath all use G as a benchmark. A single GAP command <span className="gt-mono">StructureDescription(G);</span> returns its semidirect decomposition — driven by Schreier–Sims and BSGS (§25.2).</>}
              />
            </div>
          </div>
          <div className="gt-beyond-thread">
            <div className="gt-beyond-thread-head"><span className="gt-beyond-thread-tag">7</span><L zh="量子计算" en="Quantum computing" /></div>
            <div className="gt-beyond-thread-body">
              <L
                zh={<>「非阿贝尔 Hidden Subgroup Problem」 (HSP) 在量子上 <em>没有</em> 已知的多项式算法。 G 是一个具体、 可触摸的非阿贝尔 HSP 测试对象 —— 未来量子算法的实证基准。</>}
                en={<>The <em>non-Abelian Hidden Subgroup Problem</em> has no known polynomial-time quantum algorithm. G is a concrete, tactile non-Abelian HSP instance — a benchmark for future quantum-algorithmic progress.</>}
              />
            </div>
          </div>
        </div>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="12.3  一个有用的尺度感:G 在哪里?" en="12.3  A useful sense of scale: where does G sit?" />
        </h3>
        <div className="gt-beyond-scale">
          <div className="gt-beyond-scale-row">
            <span className="gt-beyond-scale-name">{tr({ zh: '2×2 口袋', en: '2×2 Pocket' })}</span>
            <span className="gt-beyond-scale-val">3.67 × 10⁶</span>
            <span className="gt-beyond-scale-cmp">{tr({ zh: '只是 G 的角块部分', en: 'just the corner sector of G'
            })}</span>
          </div>
          <div className="gt-beyond-scale-row">
            <span className="gt-beyond-scale-name">{lang === 'zh' ? 'Pyraminx' : 'Pyraminx'}</span>
            <span className="gt-beyond-scale-val">75,582,720</span>
            <span className="gt-beyond-scale-cmp">{tr({ zh: '8 顶 × 8! / 部分约束', en: '8 tips × 8!/ constrained'
            })}</span>
          </div>
          <div className="gt-beyond-scale-row gt-beyond-scale-row-self">
            <span className="gt-beyond-scale-name">{lang === 'zh' ? '3×3 (G)' : '3×3 (G)'}</span>
            <span className="gt-beyond-scale-val">4.33 × 10<sup>19</sup></span>
            <span className="gt-beyond-scale-cmp">{tr({ zh: '本文主题', en: 'the subject of this essay'
            })}</span>
          </div>
          <div className="gt-beyond-scale-row">
            <span className="gt-beyond-scale-name">{lang === 'zh' ? '4×4 Revenge' : '4×4 Revenge'}</span>
            <span className="gt-beyond-scale-val">7.40 × 10<sup>45</sup></span>
            <span className="gt-beyond-scale-cmp">{tr({ zh: '没有固定中心 → 状态空间 × 24', en: 'no fixed centres → state space × 24'
            })}</span>
          </div>
          <div className="gt-beyond-scale-row">
            <span className="gt-beyond-scale-name">{lang === 'zh' ? 'Megaminx' : 'Megaminx'}</span>
            <span className="gt-beyond-scale-val">1.01 × 10<sup>68</sup></span>
            <span className="gt-beyond-scale-cmp">{tr({ zh: '12 面 · 30 棱 · 20 角', en: '12 faces · 30 edges · 20 corners'
            })}</span>
          </div>
          <div className="gt-beyond-scale-row">
            <span className="gt-beyond-scale-name">{tr({ zh: '魔方 100×100', en: 'Cube 100×100' })}</span>
            <span className="gt-beyond-scale-val">≈ 10<sup>33,000</sup></span>
            <span className="gt-beyond-scale-cmp">{tr({ zh: '比可观宇宙原子数 (10⁸²) 高 400 数量级', en: '400 orders of magnitude beyond cosmic atom count (10⁸²)'
            })}</span>
          </div>
          <div className="gt-beyond-scale-row gt-beyond-scale-row-out">
            <span className="gt-beyond-scale-name">{tr({ zh: 'Monster 群', en: 'Monster group' })}</span>
            <span className="gt-beyond-scale-val">8.08 × 10<sup>53</sup></span>
            <span className="gt-beyond-scale-cmp">{tr({ zh: 'CFSG 最大零散群,不来自任何拼图', en: 'largest sporadic in CFSG — no puzzle source'
            })}</span>
          </div>
        </div>

        <div className="gt-pullquote">
          <L
            zh={<>「魔方让群论变得可以 <em>看见</em>、 <em>摸到</em>、 <em>反复实验</em>。 这是教学上几乎独一无二的特权。」</>}
            en={<>"The cube lets group theory be <em>seen</em>, <em>touched</em>, <em>experimented on</em>. As pedagogy it is almost unique."</>}
          />
          <div className="gt-pullquote-cite">— David Joyner, <em>Adventures in Group Theory</em> (Johns Hopkins, 2008)</div>
        </div>

        <p>
          <L
            zh={<>本站还有几个具体工具供深入探索:<Link href="/scramble/solver">最短解求解器</Link>、 <Link href="/alg/commutator">换位子分解工具</Link>、 <Link href="/scramble/analyzer">分析器</Link>、 <Link href="/nemesizer">nemesizer (反求最坏 setup)</Link>。 学魔方的群论, 没有什么比拿真的物件来反复试验更直观。</>}
            en={<>For further hands-on exploration: the <Link href="/scramble/solver">optimal solver</Link>, the <Link href="/alg/commutator">commutator decomposer</Link>, the <Link href="/scramble/analyzer">scramble analyzer</Link>, and <Link href="/nemesizer">nemesizer (worst-setup search)</Link>. Group theory of the cube is learned fastest by handling the physical object.</>}
          />
        </p>
      </GTSec>
  );
}
