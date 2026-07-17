'use client';

import { useState, useMemo } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { applyAlg, orderOf, invertAlg, conjugate, tokenize, cycleStructure, permSign, identity } from '../cube_state';
import { tr } from '@/i18n/tr';
import { TwistyMini } from '../TwistyMini';
import { formatCycle } from '../gt-helpers';

function ConjugateViewer() {
  const [a, setA] = useState('U');
  const [b, setB] = useState('R E R');
  // For visualization clarity, we let user choose. Show the full alg A B A'.
  const full = useMemo(() => conjugate(a, b), [a, b]);
  const validA = useMemo(() => safeTok(a), [a]);
  const validB = useMemo(() => safeTok(b), [b]);
  return (
    <div className="gt-panel">
      <div className="gt-panel-title">{tr({ zh: '互动 § 共轭 A B A⁻¹', en: 'Interactive § Conjugate A B A⁻¹'
    })}</div>
      <p className="gt-panel-sub">
        {tr({ zh: '共轭 = 把 B 这个操作「搬到另一个位置去做」。先用 A 把目标移过来,执行 B,再 A 撤回。', en: 'A conjugate moves operation B "to another location": A sets up, B acts, A⁻¹ undoes the setup.'
        })}
      </p>
      <div className="gt-panel-input-row">
        <label>A (setup)</label>
        <input className="gt-input" value={a} onChange={e => setA(e.target.value)} />
      </div>
      <div className="gt-panel-input-row">
        <label>B (insert)</label>
        <input className="gt-input" value={b} onChange={e => setB(e.target.value)} />
      </div>
      <div className="gt-panel-input-row" style={{ marginTop: 4 }}>
        {[
          ["U", "F2"],          // moves F2 to U layer
          ["R'", "U2"],
          ["U'", "R U R' U'"],
        ].map(([ax, bx], i) => (
          <span key={i} className="gt-chip" onClick={() => { setA(ax); setB(bx); }}>
            {ax} {bx} ({ax})⁻¹
          </span>
        ))}
      </div>

      <div className="gt-twisty-inline" style={{ maxWidth: 280, margin: '24px auto 12px' }}>
        <TwistyMini key={full} alg={validA && validB ? full : ''} />
      </div>

      <div className="gt-panel-result">
        <div className="gt-result-row">
          <div className="gt-result-label">A</div>
          <div className="gt-result-val">{a}</div>
        </div>
        <div className="gt-result-row">
          <div className="gt-result-label">A⁻¹</div>
          <div className="gt-result-val">{tryInvert(a)}</div>
        </div>
        <div className="gt-result-row">
          <div className="gt-result-label">A B A⁻¹</div>
          <div className="gt-result-val-strong">{full}</div>
        </div>
      </div>
    </div>
  );
}

function safeTok(s: string): boolean {
  try { tokenize(s); return true; } catch { return false; }
}

function tryInvert(s: string): string {
  try { return invertAlg(s) || '(empty)'; } catch { return '(invalid)'; }
}

// ── §9 CommutatorViewer ────────────────────────────────────────────────────

// ── §8.2 ConjugacyClassTable — cycle types of common algs ──────────────────
function ConjugacyClassTable() {
  const lang = useLang();
  const samples: { alg: string; nameZh: string; nameEn: string
 }[] = [
    { alg: 'R',                                       nameZh: '单面转',          nameEn: 'single face turn'
    },
    { alg: "R U R' U'",                                nameZh: '小鱼起手 (sexy)',    nameEn: 'sexy move'
    },
    { alg: 'R L',                                      nameZh: '对面同时转',       nameEn: 'opposite-face pair'
    },
    { alg: "R U R' U R U2 R'",                         nameZh: '小鱼 (Sune)',     nameEn: 'Sune'
    },
    { alg: "F R U' R' U' R U R' F'",                   nameZh: 'OLL 26',            nameEn: 'OLL 26' },
    { alg: "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2", nameZh: 'superflip', nameEn: 'superflip' },
    { alg: 'U2 D2 F2 B2 L2 R2',                        nameZh: '棋盘 checker',      nameEn: 'checkerboard'
    },
    { alg: "R U2 R' U' R U' R'",                       nameZh: '反 Sune',           nameEn: 'anti-Sune' },
  ];
  const rows = useMemo(() => samples.map(s => {
    try {
      const state = applyAlg(identity(), s.alg);
      return {
        ...s,
        cornerCycle: cycleStructure(state.cp),
        edgeCycle: cycleStructure(state.ep),
        order: orderOf(s.alg),
        sign: permSign(state.cp),
      };
    } catch {
      return null;
    }
  }).filter(Boolean) as Array<typeof samples[number] & { cornerCycle: number[]; edgeCycle: number[]; order: number; sign: 1 | -1 }>, []);
  return (
    <table className="gt-compare">
      <thead>
        <tr>
          <th>{tr({ zh: '公式', en: 'Alg' })}</th>
          <th>{tr({ zh: '角块循环型', en: 'Corner cycle type'
        })}</th>
          <th>{tr({ zh: '棱块循环型', en: 'Edge cycle type'
        })}</th>
          <th>{tr({ zh: '阶', en: 'Order'
        })}</th>
          <th>{tr({ zh: '奇偶', en: 'sgn' })}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>
              <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{lang === 'zh' ? r.nameZh : r.nameEn}</div>
              <div className="gt-mono" style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>{r.alg || '(empty)'}</div>
            </td>
            <td className="num">{formatCycle(r.cornerCycle, lang)}</td>
            <td className="num">{formatCycle(r.edgeCycle, lang)}</td>
            <td className="num">{r.order}</td>
            <td className="num" style={{ color: r.sign === 1 ? 'var(--green)' : 'var(--accent)' }}>
              {r.sign === 1 ? '+1' : '−1'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ConjugationGallery() {
  const lang = useLang();
  const examples: { title: string; titleZh: string; a: string; b: string; desc: string; descZh: string }[] = [
    { title: 'Move U-layer 3-cycle to D-layer', titleZh: '把 U 层 3-循环搬到 D 层',
      a: 'x2', b: "R U R' U R U' R'",
      desc: 'flip whole cube, do A-perm-ish, flip back', descZh: '整体翻转 → 操作 → 翻回' },
    { title: 'Insert F2 from the right',         titleZh: '从右侧插入 F2',
      a: 'R', b: 'F2',
      desc: 'set up, swap edges, undo', descZh: '设置 → 换棱 → 撤销' },
    { title: 'BLD edge cycle setup',              titleZh: '盲拧棱循环 setup',
      a: 'L', b: "R U' R'",
      desc: 'a typical Beginner BLD edge insertion', descZh: '典型的盲拧棱块插入' },
    { title: 'Sledgehammer reposition',           titleZh: '小锤子定位',
      a: 'U', b: "R' F R F'",
      desc: 'shift the sledgehammer one U-turn over', descZh: '把小锤往 U 方向挪一格' },
  ];
  return (
    <div className="gt-conj-gallery">
      {examples.map((ex, i) => {
        const full = conjugate(ex.a, ex.b);
        return (
          <div key={i} className="gt-conj-card">
            <div className="gt-conj-title">{lang === 'zh' ? ex.titleZh : ex.title}</div>
            <div className="gt-conj-row">
              <div className="gt-conj-step">
                <div className="gt-conj-step-label">A</div>
                <div className="gt-conj-step-host"><TwistyMini alg={ex.a} /></div>
              </div>
              <div className="gt-conj-step">
                <div className="gt-conj-step-label">A · B</div>
                <div className="gt-conj-step-host"><TwistyMini alg={`${ex.a} ${ex.b}`} /></div>
              </div>
              <div className="gt-conj-step">
                <div className="gt-conj-step-label">A · B · A⁻¹</div>
                <div className="gt-conj-step-host"><TwistyMini alg={full} /></div>
              </div>
            </div>
            <div className="gt-conj-formula">{full}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-dim)', marginTop: 6, textAlign: 'center' }}>
              {lang === 'zh' ? ex.descZh : ex.desc}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Commutator-as-3-cycle gallery (§9) ────────────────────────────────────

export default function Conjugation() {
  return (
      <GTSec id="conjugation" className="gt-sec">
        <div className="gt-sec-num">§8</div>
        <h2 className="gt-sec-title">
          <L zh="共轭 — 把操作搬到别的位置" en="Conjugation — relocating operations" />
        </h2>
        <p>
          <L
            zh={<>已知一招 <TeX src={`B`} /> 能搞定 <em>某一块</em>,但你想让它作用在 <em>别的位置</em>。 最优雅的办法是 <strong>共轭</strong>:</>}
            en={<>You know an alg <TeX src={`B`} /> that fixes <em>this</em> spot, but the piece you want is <em>there</em>. The elegant fix is <strong>conjugation</strong>:</>}
          />
        </p>
        <TeXBlock src={`A \\, B \\, A^{-1}`} />
        <p>
          <L
            zh={<>先用 <TeX src={`A`} /> 把目标块「带过来」, 执行 <TeX src={`B`} /> (B 作用在它熟悉的位置), 再 <TeX src={`A^{-1}`} /> 把所有别的东西放回原位 —— 但被 B 改过的部分被「带回去」到 A 之前对应的另一个位置。 这是高级解法 (BLD, FMC, ZBLL setup) 的核心技巧。</>}
            en={<>First <TeX src={`A`} /> "brings" the target piece to where B works. Then <TeX src={`B`} /> acts in its native location. Finally <TeX src={`A^{-1}`} /> puts everything else back — but the part B touched gets carried <em>back</em> to where it really wanted to go. This is the bread and butter of advanced solving (BLD, FMC, ZBLL setups).</>}
          />
        </p>
        <ConjugateViewer />
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="8.1  共轭画廊 — 同一个 B 用不同 A 搬到不同位置" en="8.1  Conjugation gallery — same B relocated by different A's" />
        </h3>
        <p>
          <L
            zh={<>四个共轭例子。每行展示 A → A·B → A·B·A⁻¹ 三步,你能看到 B 的「净效应」如何被 A 重定位。</>}
            en={<>Four conjugation examples. Each row shows the three steps A → A·B → A·B·A⁻¹, illustrating how A relocates B's net effect.</>}
          />
        </p>
        <ConjugationGallery />
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '共轭与「同态阶」', en: 'Conjugation preserves order'
        })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>共轭操作满足: <TeX src={`(aba^{-1})^n = a \\cdot b^n \\cdot a^{-1}`} />。 所以 b 和 <TeX src={`aba^{-1}`} /> 阶相同。 在魔方上的意义:你可以把任意操作搬到任何「等价位置」上, 它的次数、 还原性、 所有内在性质都不变。</>}
              en={<>Conjugation respects powers: <TeX src={`(aba^{-1})^n = a \\cdot b^n \\cdot a^{-1}`} />. So b and <TeX src={`aba^{-1}`} /> share the same order. On the cube: you can relocate any operation (a PLL, an F2L insertion, a commutator) to an equivalent location — its order and all internal properties are preserved.</>}
            />
          </div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="8.2  共轭类" en="8.2  Conjugacy classes" />
        </h3>
        <p>
          <L
            zh={<>所有彼此共轭的元素组成一个 <strong>共轭类</strong>。同一个共轭类内的元素在 G 内部「形状相同」 —— 它们的阶相同、循环型相同、操作的「拓扑效果」相同。两个魔方状态如果共轭,那它们解起来本质上是同一个问题,只是「视角不同」。</>}
            en={<>Elements that are conjugate to each other form a <strong>conjugacy class</strong>. All elements within a class share the same order, the same cycle type, and the same "topological action" — only the viewpoint differs. Two cube states in the same conjugacy class are essentially the same problem.</>}
          />
        </p>
        <p>
          <L
            zh={<>G 的共轭类数共有约 81,120 个 (基于 Burnside lemma 在魔方对称群下的精确化)。每个共轭类对应一种「魔方状态的形态」,这是基本组合学事实。Rokicki 的上帝之数证明 (§11) 正是利用了这些对称等价类把 4.3 × 10¹⁹ 状态归约到约 20 亿个等价类来处理。</>}
            en={<>G has about 81,120 conjugacy classes (refined by Burnside's lemma under the cube's symmetry group). Each class is one "shape" of cube state. Rokicki's God's-number proof (§11) exploits exactly this structure to compress 4.3 × 10¹⁹ states to roughly 2 billion symmetry-equivalence classes.</>}
          />
        </p>
        <p style={{ marginTop: 18 }}>
          <L
            zh={<>同共轭类元素的「循环型」(cycle type) 完全相同。下表列出几个常见公式的循环型 — 注意 superflip 在角块上是恒等、棱块上也是恒等 (它只翻 EO,不动位置),所以它在共轭类「e (no perm)」 — 跟身份置换是同类,但靠 EO 区分。</>}
            en={<>Conjugate elements share the same cycle type. The table lists cycle types of a few common algs — note that superflip has identity perm on both corners and edges (it only flips EO without moving anything). Its "perm" cycle type is empty, the same as identity — they are distinguished only by orientation data.</>}
          />
        </p>
        <ConjugacyClassTable />
        <div className="gt-aside">
          <L
            zh={<>魔方还有 48 个外部对称变换 (24 个旋转 × 2 个镜像)。Burnside lemma 在 G 与对称群联合作用下计算「真正不同的」状态数,这是更精细的等价化。详 §18。</>}
            en={<>The cube also has 48 outer symmetries (24 rotations × 2 mirror reflections). Burnside's lemma applied jointly with G gives the count of "truly distinct" states up to symmetry — see §18.</>}
          />
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="8.3  共轭类大小 — 轨道–稳定子定理" en="8.3  Conjugacy-class size — orbit–stabilizer" />
        </h3>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '定义 8.3 — 中心化子', en: 'Definition 8.3 — centralizer'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>给定 <TeX src={`g \\in G`} />,中心化子 <TeX src={`C_G(g) := \\{\\, x \\in G \\;:\\; xg = gx\\,\\}`} /> 是 <em>与 g 交换的所有元素</em> 构成的子群。 它度量 g 在 G 中「跟谁交换得起来」。</>}
              en={<>For <TeX src={`g \\in G`} />, its centralizer <TeX src={`C_G(g) := \\{\\, x \\in G \\;:\\; xg = gx\\,\\}`} /> is the subgroup of elements <em>that commute with g</em>. It measures how much of G commutes with g.</>}
            />
          </div>
        </div>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 8.4 — 轨道–稳定子', en: 'Theorem 8.4 — orbit–stabilizer'
        })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>g 所在共轭类 <TeX src={`[g] := \\{\\,xgx^{-1} \\;:\\; x \\in G\\,\\}`} /> 的大小满足<TeXBlock src={`|[g]| \\;=\\; \\frac{|G|}{|C_G(g)|}`} />即「轨道大小 × 稳定子大小 = G 的阶」。 因此 <TeX src={`|[g]|`} /> 必整除 <TeX src={`|G|`} />。</>}
              en={<>The size of g's conjugacy class <TeX src={`[g] := \\{\\,xgx^{-1} \\;:\\; x \\in G\\,\\}`} /> satisfies<TeXBlock src={`|[g]| \\;=\\; \\frac{|G|}{|C_G(g)|}`} />i.e. "orbit size × stabilizer size = |G|". Hence <TeX src={`|[g]|`} /> divides <TeX src={`|G|`} />.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>这个公式把「共轭类有多大」翻译成「g 跟多少元素交换」。 极端情况:</>}
            en={<>This formula translates "how big is the conjugacy class" into "how many elements commute with g." Extremes:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L zh={<><strong>中心元素</strong> (z ∈ Z(G)):跟所有元素都交换,<TeX src={`C_G(z) = G`} />,所以 <TeX src={`|[z]| = 1`} />。 它独占一个共轭类。 魔方上 <TeX src={`Z(G) = \\{e,\\,\\textsc{superflip}\\}`} /> (见 §13),所以恰好 <strong>2 个 size-1 类</strong>。</>} en={<><strong>Central elements</strong> (z ∈ Z(G)) commute with everything: <TeX src={`C_G(z) = G`} />, so <TeX src={`|[z]| = 1`} />. Each owns a singleton class. For the cube, <TeX src={`Z(G) = \\{e,\\,\\textsc{superflip}\\}`} /> (see §13), giving exactly <strong>two size-1 classes</strong>.</>} /></li>
          <li><L zh={<><strong>「最不平凡」元素</strong>:仅与 ⟨g⟩ 自身交换,<TeX src={`|C_G(g)| = \\operatorname{ord}(g)`} />,所以共轭类大小 <TeX src={`|[g]| = |G| / \\operatorname{ord}(g)`} />。 对 |g| = 1260 (最大阶) 的元素,<TeX src={`|[g]| \\le 4.3\\times10^{19}/1260 \\approx 3.4\\times10^{16}`} />。</>} en={<><strong>"Most non-trivial" elements</strong>: commute only with ⟨g⟩ itself, <TeX src={`|C_G(g)| = \\operatorname{ord}(g)`} />, so the class size is <TeX src={`|[g]| = |G| / \\operatorname{ord}(g)`} />. For order-1260 elements, <TeX src={`|[g]| \\le 4.3\\times10^{19}/1260 \\approx 3.4\\times10^{16}`} />.</>} /></li>
        </ul>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '类方程 (class equation)', en: 'The class equation'
        })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>把 G 按共轭类分解,得<TeXBlock src={`|G| \\;=\\; |Z(G)| \\;+\\; \\sum_{[g]\\,\\not\\subset\\,Z(G)} \\frac{|G|}{|C_G(g)|}`} />前一项是中心 (大小 1 的类), 后面是大小 ≥ 2 的类。 这是有限群论里最深的恒等式之一: 它把 |G| 的素因子结构、 中心、 与「非平凡共轭」 三者绑在同一行。</>}
              en={<>Decomposing G into conjugacy classes gives<TeXBlock src={`|G| \\;=\\; |Z(G)| \\;+\\; \\sum_{[g]\\,\\not\\subset\\,Z(G)} \\frac{|G|}{|C_G(g)|}`} />where the first term counts central elements (size-1 classes) and the rest are larger classes. This is one of the deepest identities in finite group theory: it ties together the prime structure of |G|, the centre, and the non-trivial conjugation orbits in one line.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>对魔方:<TeX src={`|Z(G)| = 2`} />,共轭类总数 ≈ 81,120 (Burnside 在镜对称作用下),因此<em>平均</em> 类大小 ≈ <TeX src={`|G| / 81{,}120 \\approx 5.3 \\times 10^{14}`} />。 但实际分布极不均匀: 少数大类 (随机 scramble 状态) 几乎独吞 |G|, 而很多类却只有几百个元素。</>}
            en={<>For the cube, <TeX src={`|Z(G)| = 2`} /> and the total number of conjugacy classes is ≈ 81,120 (under joint Burnside with mirror symmetries), giving an <em>average</em> class size of <TeX src={`|G| / 81{,}120 \\approx 5.3 \\times 10^{14}`} />. But the actual distribution is extremely uneven: a few huge classes (typical scrambles) account for almost all of |G|, while many small classes contain only hundreds of elements.</>}
          />
        </p>
      </GTSec>
  );
}
