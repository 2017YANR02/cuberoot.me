'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { applyAlg, cycleStructure, identity, CubieState } from '../cube_state';
import { tr } from '@/i18n/tr';
import { TwistyMini } from '../TwistyMini';
import { formatCycle } from '../gt-helpers';

function CubeStateInspector() {
  const lang = useLang();
  const [alg, setAlg] = useState("R U R' U'");
  const state = useMemo<CubieState>(() => {
    try { return applyAlg(identity(), alg); } catch { return identity(); }
  }, [alg]);
  const prevState = useRef<CubieState>(identity());
  useEffect(() => { prevState.current = state; }, [state]);

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">{tr({ zh: '互动 § 状态张量分解', en: 'Interactive § State tensor'
    })}</div>
      <p className="gt-panel-sub">
        {tr({ zh: '魔方状态 = (cp, co, ep, eo) 四元组。输入任意公式,看四个数组随之变化。', en: 'A cube state is the 4-tuple (cp, co, ep, eo). Type any alg, watch the four arrays mutate.'
        })}
      </p>
      <div className="gt-panel-input-row">
        <label>alg</label>
        <input className="gt-input" value={alg} onChange={e => setAlg(e.target.value)} placeholder="R U R' U' …" />
        <button className="gt-btn-ghost gt-btn" onClick={() => setAlg('')}>{tr({ zh: '清空', en: 'reset' })}</button>
      </div>

      <div className="gt-twisty-inline"><TwistyMini alg={alg} /></div>

      <div className="gt-state-grid">
        <div className="gt-state-box">
          <div className="gt-state-box-title">cp ∈ S₈ — corner permutation</div>
          <div className="gt-state-cells">
            {state.cp.map((v, i) => (
              <div className={`gt-state-cell ${v !== i ? 'gt-state-cell-changed' : ''}`} key={i}>
                <span className="gt-state-idx">{i}</span>
                {v}
              </div>
            ))}
          </div>
        </div>
        <div className="gt-state-box">
          <div className="gt-state-box-title">co ∈ (ℤ/3)⁸ — corner twist</div>
          <div className="gt-state-cells">
            {state.co.map((v, i) => (
              <div className={`gt-state-cell ${v !== 0 ? 'gt-state-cell-twisted' : ''}`} key={i}>
                <span className="gt-state-idx">{i}</span>
                {v}
              </div>
            ))}
          </div>
        </div>
        <div className="gt-state-box">
          <div className="gt-state-box-title">ep ∈ S₁₂ — edge permutation</div>
          <div className="gt-state-cells">
            {state.ep.map((v, i) => (
              <div className={`gt-state-cell ${v !== i ? 'gt-state-cell-changed' : ''}`} key={i}>
                <span className="gt-state-idx">{i}</span>
                {v}
              </div>
            ))}
          </div>
        </div>
        <div className="gt-state-box">
          <div className="gt-state-box-title">eo ∈ (ℤ/2)¹² — edge flip</div>
          <div className="gt-state-cells">
            {state.eo.map((v, i) => (
              <div className={`gt-state-cell ${v !== 0 ? 'gt-state-cell-flipped' : ''}`} key={i}>
                <span className="gt-state-idx">{i}</span>
                {v}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="gt-panel-result">
        <div className="gt-result-row">
          <div className="gt-result-label">{tr({ zh: '角块循环型', en: 'corner cycle type'
        })}</div>
          <div className="gt-result-val">{formatCycle(cycleStructure(state.cp), lang)}</div>
        </div>
        <div className="gt-result-row">
          <div className="gt-result-label">{tr({ zh: '棱块循环型', en: 'edge cycle type'
        })}</div>
          <div className="gt-result-val">{formatCycle(cycleStructure(state.ep), lang)}</div>
        </div>
      </div>
    </div>
  );
}

function UnfoldedCubeMap() {
  // 9-row, 12-col grid; only certain cells are face stickers.
  // Layout:
  //         | U U U |
  //         | U U U |
  //         | U U U |
  // | L L L | F F F | R R R | B B B |
  // | L L L | F F F | R R R | B B B |
  // | L L L | F F F | R R R | B B B |
  //         | D D D |
  //         | D D D |
  //         | D D D |
  const cells: Array<{ row: number; col: number; face: 'U' | 'D' | 'L' | 'R' | 'F' | 'B'; idx: number }> = [];
  // U (rows 1-3, cols 4-6)
  for (let r = 1; r <= 3; r++) for (let c = 4; c <= 6; c++) cells.push({ row: r, col: c, face: 'U', idx: (r - 1) * 3 + (c - 4) });
  // L (rows 4-6, cols 1-3)
  for (let r = 4; r <= 6; r++) for (let c = 1; c <= 3; c++) cells.push({ row: r, col: c, face: 'L', idx: (r - 4) * 3 + (c - 1) });
  // F (rows 4-6, cols 4-6)
  for (let r = 4; r <= 6; r++) for (let c = 4; c <= 6; c++) cells.push({ row: r, col: c, face: 'F', idx: (r - 4) * 3 + (c - 4) });
  // R (rows 4-6, cols 7-9)
  for (let r = 4; r <= 6; r++) for (let c = 7; c <= 9; c++) cells.push({ row: r, col: c, face: 'R', idx: (r - 4) * 3 + (c - 7) });
  // B (rows 4-6, cols 10-12)
  for (let r = 4; r <= 6; r++) for (let c = 10; c <= 12; c++) cells.push({ row: r, col: c, face: 'B', idx: (r - 4) * 3 + (c - 10) });
  // D (rows 7-9, cols 4-6)
  for (let r = 7; r <= 9; r++) for (let c = 4; c <= 6; c++) cells.push({ row: r, col: c, face: 'D', idx: (r - 7) * 3 + (c - 4) });
  return (
    <div className="gt-unfold">
      {Array.from({ length: 9 }, (_, r) => Array.from({ length: 12 }, (_, c) => {
        const cell = cells.find(x => x.row === r + 1 && x.col === c + 1);
        if (!cell) return <div key={`${r}-${c}`} className="gt-unfold-cell gt-unfold-cell-blank" style={{ gridRow: r + 1, gridColumn: c + 1 }} />;
        const label = cell.idx === 4 ? cell.face : '';
        return <div key={`${r}-${c}`} className={`gt-unfold-cell gt-unfold-cell-${cell.face}`} style={{ gridRow: r + 1, gridColumn: c + 1 }}>{label}</div>;
      })).flat()}
    </div>
  );
}

export default function StateVector() {
  return (
      <GTSec id="state-vector" className="gt-sec">
        <div className="gt-sec-num">§3</div>
        <h2 className="gt-sec-title">
          <L zh="状态向量 (cp, co, ep, eo)" en="State vector: (cp, co, ep, eo)" />
        </h2>
        <p>
          <L
            zh={<>一个 3×3×3 魔方有 <strong>8 个角块</strong> 和 <strong>12 个棱块</strong>。中心块固定 (它们决定颜色对应)。状态完全由下面四个量描述:</>}
            en={<>A 3×3×3 cube has <strong>8 corners</strong> and <strong>12 edges</strong>. Centres are fixed (they define the colour scheme). The full state is captured by four arrays:</>}
          />
        </p>
        <div className="gt-statevec">
          <div className="gt-statevec-row">
            <TeX src={`c_p \\in S_8`} />
            <span className="gt-statevec-desc">{tr({ zh: '8 个角块的位置 (置换)', en: 'positions of the 8 corners (permutation)'
            })}</span>
          </div>
          <div className="gt-statevec-row">
            <TeX src={`c_o \\in (\\mathbb{Z}/3)^8`} />
            <span className="gt-statevec-desc">{tr({ zh: '每个角块的方向 (拧角)', en: 'orientation of each corner (twist)'
            })}</span>
          </div>
          <div className="gt-statevec-row">
            <TeX src={`e_p \\in S_{12}`} />
            <span className="gt-statevec-desc">{tr({ zh: '12 个棱块的位置', en: 'positions of the 12 edges'
            })}</span>
          </div>
          <div className="gt-statevec-row">
            <TeX src={`e_o \\in (\\mathbb{Z}/2)^{12}`} />
            <span className="gt-statevec-desc">{tr({ zh: '每个棱块的翻面 (好/坏)', en: 'orientation of each edge (flip)'
            })}</span>
          </div>
        </div>
        <p>
          <L
            zh={<>这是 Kociemba 在 1990 年代为 two-phase solver 选定的标准坐标 [<a href="#ref-kociemba">7</a>]。整个魔方代数都在这个 4 元组上展开:每一个生成元都是一个固定的「在 cp 上做某个置换 + 在 co/ep/eo 上加某个偏移」的复合操作。</>}
            en={<>These are the standard coordinates Kociemba chose in the 1990s for his two-phase solver [<a href="#ref-kociemba">7</a>]. All of cube algebra is built on this 4-tuple: each generator is a fixed "permute cp + add offsets to co/ep/eo" combination.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="3.1  展开图与小块编号" en="3.1  Unfolded layout & cubie indexing" />
        </h3>
        <p>
          <L
            zh={<>下面是 3×3×3 展开图。54 个色块,但只有 26 个小块 (cubie):8 个角(3 个色块各)、12 个棱(2 个色块各)、6 个中心(1 个色块)。中心固定 (不可移动) 所以只需描述 8 + 12 = 20 个可动小块的状态。</>}
            en={<>The 3×3×3 unfolded: 54 stickers but only 26 cubies (8 corners × 3 stickers each, 12 edges × 2, 6 centres × 1). Centres are immobile, so the state needs only describe the 8 + 12 = 20 movable cubies.</>}
          />
        </p>
        <UnfoldedCubeMap />
        <p>
          <L
            zh={<>本文采用的小块编号 (沿用 Kociemba):</>}
            en={<>The cubie indexing used throughout (following Kociemba):</>}
          />
        </p>
        <div className="gt-math-display" style={{ textAlign: 'left', fontSize: '.95em' }}>
          <span style={{ display: 'block', marginBottom: 4 }}>
            corners: &nbsp; <span className="gt-mono">0:URF</span> &nbsp; <span className="gt-mono">1:UFL</span> &nbsp; <span className="gt-mono">2:ULB</span> &nbsp; <span className="gt-mono">3:UBR</span> &nbsp; <span className="gt-mono">4:DFR</span> &nbsp; <span className="gt-mono">5:DLF</span> &nbsp; <span className="gt-mono">6:DBL</span> &nbsp; <span className="gt-mono">7:DRB</span>
          </span>
          <span style={{ display: 'block' }}>
            edges: &nbsp; <span className="gt-mono">0:UR 1:UF 2:UL 3:UB 4:DR 5:DF 6:DL 7:DB 8:FR 9:FL 10:BL 11:BR</span>
          </span>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="3.2  方向 (orientation) 的约定" en="3.2  Orientation convention" />
        </h3>
        <p>
          <L
            zh={<>每个角块在自己的位置有 <strong>3 种方向</strong>(它的「U/D 色块」可以面向上下、前后、左右三个轴中的某一个)。每个棱块有 <strong>2 种方向</strong>(它的「U/D 色块」可以朝外或朝内,以 F/B-轴为基准)。所以:</>}
            en={<>Each corner at a fixed position has <strong>3 possible orientations</strong> (its "U/D-coloured sticker" can face one of three axes). Each edge has <strong>2 orientations</strong> ("good" or "flipped" relative to the F/B-axis convention). So:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L zh="角块朝向 ∈ ℤ/3 = {0, 1, 2} (0 = 正常, +1 = 顺时针拧, +2 = 逆时针拧)" en="corner orientation ∈ ℤ/3 = {0, 1, 2} (0 = aligned, +1 = CW, +2 = CCW)" /></li>
          <li><L zh="棱块朝向 ∈ ℤ/2 = {0, 1} (0 = good, 1 = flipped)" en="edge orientation ∈ ℤ/2 = {0, 1} (0 = good, 1 = flipped)" /></li>
        </ul>
        <div className="gt-aside">
          <L
            zh={<>方向的具体定义依赖于约定 (有多家流派)。本文用 Kociemba 派:角朝向以「U/D 颜色」是否在 U/D 面为基准;棱朝向以「F 或 B 颜色」是否在 F/B 面为基准。其它流派 (如 Singmaster) 用稍不同的基准,但代数结构等价。</>}
            en={<>The exact definition depends on convention. Here we use Kociemba's: corner orientation tracked by the U/D sticker; edge orientation by the F/B sticker. Singmaster and others use slightly different bases — the algebraic structure is unchanged.</>}
          />
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="3.3  生成元的张量表示" en="3.3  Tensor representation of generators" />
        </h3>
        <p>
          <L
            zh={<>每个面转都对应一个 「位置置换 + 方向偏移」对。例如 R 转面:</>}
            en={<>Each face turn corresponds to a (permutation, orientation offset) pair. For example, R:</>}
          />
        </p>
        <div className="gt-rgen">
          <div className="gt-rgen-row"><TeX src={`R_{c_p} = (0\\;4\\;7\\;3)`} /><span className="gt-rgen-desc">{tr({ zh: '4-循环角块', en: '4-cycle on corners'
        })}</span></div>
          <div className="gt-rgen-row"><TeX src={`R_{c_o} = (+2, 0, 0, +1, +1, 0, 0, +2)`} /><span className="gt-rgen-desc">{tr({ zh: '角块拧角偏移', en: 'corner twist deltas'
        })}</span></div>
          <div className="gt-rgen-row"><TeX src={`R_{e_p} = (0\\;8\\;11\\;4)`} /><span className="gt-rgen-desc">{tr({ zh: '4-循环棱块', en: '4-cycle on edges'
        })}</span></div>
          <div className="gt-rgen-row"><TeX src={`R_{e_o} = 0`} /><span className="gt-rgen-desc">{tr({ zh: 'R 不改变 EO (因 R 是 RL-轴)', en: 'R does not affect EO (since R is on the RL-axis)'
        })}</span></div>
        </div>
        <p>
          <L
            zh={<>类似地:F 转面会翻转 4 个棱块的 EO (UF, DF, FR, FL 各 +1 mod 2)。U/D 转面 既不改 CO 也不改 EO,只置换位置。这种「细分一面到底改什么」的清晰结构,使得状态压缩与解法搜索都极其高效:</>}
            en={<>Similarly: F flips the EO of 4 edges (UF, DF, FR, FL each +1 mod 2). U/D turns change neither CO nor EO — only positions. This clear axis-specific structure makes both state compression and solver search highly efficient:</>}
          />
        </p>
        <TeXBlock src={`\\text{state size} \\;\\approx\\; \\underbrace{(8\\text{ perm} + 8\\text{ ori bits})}_{\\text{corners}} + \\underbrace{(12\\text{ perm} + 12\\text{ ori bits})}_{\\text{edges}} \\;\\approx\\; 10 \\text{ bytes}`} />
        <p>
          <L
            zh={<>对比一下: 直接存 54 个色块的颜色,需要 54 × 3 = 162 bit ≈ 21 字节,且没有压缩。结构化编码省一半内存,还自动剔除非法状态。</>}
            en={<>Compare: naively storing colours for all 54 stickers takes 162 bits ≈ 21 bytes, with no compression. The structured encoding halves memory and intrinsically excludes illegal states.</>}
          />
        </p>
        <CubeStateInspector />
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="3.4  自由度推导 — 8! · 3⁸ · 12! · 2¹² vs |G|" en="3.4  Counting degrees of freedom" />
        </h3>
        <p>
          <L
            zh={<>把 cp / co / ep / eo 看成 4 个独立坐标, 它们各自的取值空间:</>}
            en={<>Treat cp / co / ep / eo as four independent coordinates. Their raw cardinalities:</>}
          />
        </p>
        <table className="gt-compare">
          <thead>
            <tr><th>{tr({ zh: '坐标', en: 'Coord'
            })}</th><th>{tr({ zh: '取值空间', en: 'Codomain'
            })}</th><th>{tr({ zh: '大小', en: 'Size' })}</th></tr>
          </thead>
          <tbody>
            <tr><td><TeX src={`c_p`} /></td><td><TeX src={`S_8`} /></td><td className="num">8! = 40,320</td></tr>
            <tr><td><TeX src={`c_o`} /></td><td><TeX src={`(\\mathbb{Z}/3)^8`} /></td><td className="num">3⁸ = 6,561</td></tr>
            <tr><td><TeX src={`e_p`} /></td><td><TeX src={`S_{12}`} /></td><td className="num">12! = 479,001,600</td></tr>
            <tr><td><TeX src={`e_o`} /></td><td><TeX src={`(\\mathbb{Z}/2)^{12}`} /></td><td className="num">2¹² = 4,096</td></tr>
            <tr><td>{tr({ zh: '乘积 (自由空间)', en: 'product (free space F)'
            })}</td><td colSpan={2} className="num"><TeX src={`|F| = 5.19 \\times 10^{20}`} /></td></tr>
            <tr><td>{tr({ zh: '魔方群 G', en: 'cube group G' })}</td><td colSpan={2} className="num"><TeX src={`|G| = |F|/12 \\approx 4.33 \\times 10^{19}`} /></td></tr>
          </tbody>
        </table>
        <p>
          <L
            zh={<>因此 「位置 + 朝向」 共有 <TeX src={`\\log_2 |F| \\approx 69.1`} /> bit 信息, 但 G 只占其中 <TeX src={`\\log_2 |G| \\approx 65.2`} /> bit。 差出来的 <TeX src={`\\log_2 12 \\approx 3.58`} /> bit 就是 §5 的三守恒律 (ℤ/3 × ℤ/2 × ℤ/2)。</>}
            en={<>So "position + orientation" carries <TeX src={`\\log_2 |F| \\approx 69.1`} /> bits of information, but G only sits in <TeX src={`\\log_2 |G| \\approx 65.2`} /> of those. The missing <TeX src={`\\log_2 12 \\approx 3.58`} /> bits are precisely the three invariants of §5 (ℤ/3 × ℤ/2 × ℤ/2).</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="3.5  ℓ₁ 与 ℓ∞ 距离到原点" en="3.5  ℓ₁ and ℓ∞ distances to the origin" />
        </h3>
        <p>
          <L
            zh={<>把状态向量映射为 |R^{`{40}`}| 中的点 (8 + 12 = 20 个位置 index + 8 个 mod-3 + 12 个 mod-2),可以问 「到原点的距离」 怎么算。两种自然范数:</>}
            en={<>Embed state vectors into <TeX src={`\\mathbb{R}^{40}`} /> (20 position indices + 8 mod-3 + 12 mod-2) and ask "distance to origin." Two natural norms:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L
            zh={<><TeX src={`\\ell_1`} /> <strong>错位数</strong> = ∑ (cubies 不在正位) + ∑ (orientation 偏移)。 最大值约 36 (8 + 12 + 8 + 12 - 几个组合限制)。 这就是 §22 Korf solver 的 「简易启发式」 的雏形。</>}
            en={<><TeX src={`\\ell_1`} /> <strong>mismatch count</strong> = #(cubies off-position) + #(orientation deltas). Max ≈ 36 (8 + 12 + 8 + 12 minus a few combinatorial constraints) — the seed of Korf's simple admissible heuristic in §22.</>}
          /></li>
          <li><L
            zh={<><TeX src={`\\ell_\\infty`} /> <strong>最远偏移</strong> = max over all cubies。 对随机状态几乎总等于 1 (因为至少一个块错位)。 对 HTM 距离, 这是非常宽松的下界。</>}
            en={<><TeX src={`\\ell_\\infty`} /> <strong>worst-cubie offset</strong> = max over all cubies. For a random state this is almost always 1 (at least one cubie misplaced). A very loose lower bound on HTM distance.</>}
          /></li>
        </ul>
        <p>
          <L
            zh={<>关键事实:这些范数 <em>不</em> 等价于 HTM 度量 <TeX src={`|g|_S`} /> (§2.2)。 它们只是 G 中 d_S(e, g) 的弱下界, 在 §22 求解器中作为启发式使用。 真正的 d_S(e, g) 只能由 Korf IDA* 或 Kociemba two-phase 算出, 它是「群的 Cayley 图距离」, 没有闭式。</>}
            en={<>Crucial: these norms are <em>not</em> equivalent to the HTM metric <TeX src={`|g|_S`} /> (§2.2). They are weak lower bounds on d_S(e, g), used as heuristics by §22's solvers. The true d_S(e, g) is the Cayley-graph distance — no closed form; computed only by Korf IDA* or Kociemba two-phase.</>}
          />
        </p>
      </GTSec>
  );
}
