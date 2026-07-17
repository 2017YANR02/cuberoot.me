'use client';

import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { tr } from '@/i18n/tr';
import { TwistyMini } from '../TwistyMini';

// ── Pattern gallery (§13) ─────────────────────────────────────────────────
function PatternGallery() {
  const lang = useLang();
  const patterns: { name: string; nameZh: string; alg: string; order: number; descZh: string; descEn: string
 }[] = [
    { name: 'Superflip',        nameZh: '超翻',     alg: "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2",
      order: 2, descZh: '12 棱全翻 (cp=e, ep=e, co=0, eo=1)',  descEn: 'all 12 edges flipped'
    },
    { name: 'Checkerboard',     nameZh: '棋盘格', alg: 'U2 D2 F2 B2 L2 R2',
      order: 2, descZh: '6 面 ×3 半圈; |G| 中阶最小', descEn: 'all 6 axes half-turned'
    },
    { name: '4 dots',           nameZh: '四点',     alg: "U R2 L2 U2 R2 L2 U' D R2 L2 D2 R2 L2 D'",
      order: 2, descZh: '4 面中央色块互换', descEn: '4-face centre swap'
    },
    { name: 'Cube in cube',     nameZh: '回字',     alg: "F L F U' R U F2 L2 U' L' B D' B' L2 U",
      order: 4, descZh: '小立方体在大立方体里的视觉错觉',  descEn: 'classic Escher-style visual illusion'
    },
    { name: 'Cross pattern',    nameZh: '十字',     alg: "U F B' L2 U2 L2 F' B U2 L2 U",
      order: 2, descZh: '每面中央一个十字色',  descEn: 'a cross on every face'
    },
    { name: 'Anaconda',         nameZh: '蟒蛇',     alg: "L U B' U' R L' B R' F B' D R D' F'",
      order: 6, descZh: '环绕魔方的彩色带',     descEn: 'a winding band of colour'
    },
    { name: 'Six spots',        nameZh: '六点',     alg: "U D' R L' F B' U D'",
      order: 4, descZh: '中心翻 (U↔D, R↔L, F↔B)', descEn: 'each face centre swapped with opposite' },
    { name: 'Plus minus',       nameZh: '加减号', alg: "U2 R2 L2 U2 R2 L2",
      order: 2, descZh: '简短 6 步即得',         descEn: 'a 6-move classic'
    },
    { name: 'Pons Asinorum (6X)', nameZh: '驴桥定理 (6X)', alg: "R2 L2 F2 B2 U2 D2",
      order: 2, descZh: '所有 6 面 ×3 半圈; 直径距离 20 候选反点', descEn: 'all six faces half-turned; one of three antipode candidates'
    },
    { name: 'Six H-bars',       nameZh: '六 H 条', alg: "U2 B2 R2 D2 U2 R2 F2 U2",
      order: 2, descZh: '三对正交 H 条棱', descEn: 'three orthogonal H-bars on the equators'
    },
    { name: 'Stairs',           nameZh: '阶梯',     alg: "F D2 B R B' L' F D' L2 F2 R F' R' F2 L' F'",
      order: 6, descZh: '颜色顺台阶错位', descEn: 'colours staircase across the cube'
    },
    { name: 'Tetris',           nameZh: '俄罗斯方块', alg: "L R F B U' D' L' R'",
      order: 4, descZh: '8 步生成的中等阶图案', descEn: 'short 8-move medium-order pattern'
    },
    { name: 'Order-1260',       nameZh: '阶 1260',  alg: "R U2 D' B D'",
      order: 1260, descZh: 'Singmaster 经典: 一公式 1260 次才回到原点 = lcm(3,4,5,7)', descEn: "Singmaster's classic: this 5-move alg has order 1260 = lcm(3,4,5,7); repeat 1260× to return"
    },
    { name: '4 spots (90°)',    nameZh: '四点 (90°)', alg: "R F' L' U2 B' D' R B U2 L U F'",
      order: 4, descZh: '4 个中央色块 90° 错位 (≠ 6-spot 的 180°)', descEn: '4 face centres rotated 90° (≠ 6-spot 180°)'
    },
  ];
  return (
    <div className="gt-pattern-gallery">
      {patterns.map((p, i) => (
        <div key={i} className="gt-pattern">
          <div className="gt-pattern-host"><TwistyMini alg={p.alg} /></div>
          <div className="gt-pattern-name">{lang === 'zh' ? p.nameZh : p.name}</div>
          <div className="gt-pattern-meta">
            {lang === 'zh' ? p.descZh : p.descEn}<br />
            <span style={{ color: 'var(--accent)' }}>{tr({ zh: '阶', en: 'order'
            })} {p.order}</span>
          </div>
          <div className="gt-pattern-alg">{p.alg}</div>
        </div>
      ))}
    </div>
  );
}

// ── Conjugation gallery (§8) ──────────────────────────────────────────────

export default function Patterns() {
  const lang = useLang();
  return (
      <GTSec id="patterns" className="gt-sec">
        <div className="gt-sec-num">§13</div>
        <h2 className="gt-sec-title">
          <L zh="著名图案 — 群元素的具体面孔" en="Famous patterns — concrete faces of group elements" />
        </h2>
        <p className="gt-lede">
          <L
            zh={<>群元素是抽象对象, 但每一个魔方状态 (= 群元素) 都可以 <em>看见</em>。 下面这组家喻户晓的图案, 每一个都是 G 的一个具体元素 —— 配有它的阶、 定义公式、 循环结构、 以及它在群结构里的位置。 注意 「图案的视觉对称」 通常对应于 「群元素的代数对称」 —— 这是 §13 的主题。</>}
            en={<>Group elements are abstract, but every cube state is <em>visible</em>. Each celebrated pattern below is a specific element of G — with its order, defining alg, cycle structure, and place in G's architecture. Visual symmetry of a pattern usually corresponds to algebraic symmetry of its group element — that is the theme of §13.</>}
          />
        </p>
        <PatternGallery />

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="13.1  阶 + 循环结构表" en="13.1  Order + cycle structure table" />
        </h3>
        <p>
          <L
            zh={<>把每个图案翻译成代数语言, 它们的阶 (在多少次内回到 e) 和循环结构 (corner / edge 各自的置换分解) 一目了然:</>}
            en={<>Translated into algebra, each pattern's order (how many applications return to e) and cycle structure (corner / edge permutation decomposition) lays bare:</>}
          />
        </p>
        <div className="gt-pattern-table">
          <table className="gt-pattern-tbl">
            <thead>
              <tr>
                <th>{tr({ zh: '图案', en: 'pattern'
                })}</th>
                <th>{tr({ zh: '阶', en: 'order'
                })}</th>
                <th>{tr({ zh: '角循环', en: 'corner cycles'
                })}</th>
                <th>{tr({ zh: '棱循环', en: 'edge cycles'
                })}</th>
                <th>{tr({ zh: '类型', en: 'character'
                })}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>{tr({ zh: 'Superflip 超翻', en: 'Superflip' })}</strong></td>
                <td className="num">2</td>
                <td className="num">{tr({ zh: '全恒等', en: 'identity'
                })}</td>
                <td>{tr({ zh: '12 棱全翻', en: '12 edges flipped'
                })}</td>
                <td>{tr({ zh: '中心 Z(G)', en: 'centre Z(G)' })}</td>
              </tr>
              <tr>
                <td><strong>{tr({ zh: 'Checkerboard 棋盘', en: 'Checkerboard'
                })}</strong></td>
                <td className="num">2</td>
                <td>{tr({ zh: '4 个 2-循环', en: '4 transpositions'
                })}</td>
                <td>{tr({ zh: '6 个 2-循环', en: '6 transpositions'
                })}</td>
                <td>{tr({ zh: '6 半圈阿贝尔', en: 'Abelian 6-tuple'
                })}</td>
              </tr>
              <tr>
                <td><strong>{tr({ zh: '4 dots 四点', en: '4 dots'
                })}</strong></td>
                <td className="num">2</td>
                <td className="num">{tr({ zh: '全恒等', en: 'identity'
                })}</td>
                <td>{tr({ zh: '4 个 2-循环', en: '4 transpositions'
                })}</td>
                <td>{tr({ zh: '只移棱', en: 'edges only'
                })}</td>
              </tr>
              <tr>
                <td><strong>{tr({ zh: 'Cube in cube 回字', en: 'Cube in cube' })}</strong></td>
                <td className="num">4</td>
                <td>{tr({ zh: '8-循环', en: 'one 8-cycle'
                })}</td>
                <td>{tr({ zh: '复合', en: 'mixed'
                })}</td>
                <td>{tr({ zh: '非阿贝尔', en: 'non-Abelian'
                })}</td>
              </tr>
              <tr>
                <td><strong>{tr({ zh: '十字', en: 'Cross' })}</strong></td>
                <td className="num">2</td>
                <td className="num">{tr({ zh: '全恒等', en: 'identity'
                })}</td>
                <td>{tr({ zh: '6 个 2-循环', en: '6 transpositions'
                })}</td>
                <td>{tr({ zh: '对称', en: 'symmetric'
                })}</td>
              </tr>
              <tr>
                <td><strong>{tr({ zh: '蟒蛇 Anaconda', en: 'Anaconda' })}</strong></td>
                <td className="num">6</td>
                <td>{tr({ zh: '3-循环 + 朝向', en: '3-cycle + twists'
                })}</td>
                <td>{tr({ zh: '6-循环', en: '6-cycle'
                })}</td>
                <td>{tr({ zh: '阶 = lcm(2,3)', en: 'order = lcm(2,3)'
                })}</td>
              </tr>
              <tr>
                <td><strong>{tr({ zh: '六点 Six spots', en: 'Six spots'
                })}</strong></td>
                <td className="num">4</td>
                <td>{tr({ zh: '2 个 4-循环', en: '2 four-cycles'
                })}</td>
                <td>{tr({ zh: '4 个 2-循环', en: '4 transpositions'
                })}</td>
                <td>{tr({ zh: '90° 类', en: '90° type'
                })}</td>
              </tr>
              <tr>
                <td><strong>{tr({ zh: '加减号', en: 'Plus minus'
                })}</strong></td>
                <td className="num">2</td>
                <td className="num">{tr({ zh: '全恒等', en: 'identity'
                })}</td>
                <td>{tr({ zh: '6 个 2-循环', en: '6 transpositions'
                })}</td>
                <td>{tr({ zh: '6 步极简', en: '6-move minimum'
                })}</td>
              </tr>
            </tbody>
          </table>
          <div className="gt-aside" style={{ marginTop: 10 }}>
            {lang === 'zh'
              ? <>注:阶 = 角块循环阶 与棱块循环阶 的最小公倍数(若两边都有朝向也要乘进去)。 「蟒蛇」 的 6 是因为 lcm(2, 3) = 6 — 棱 2 步、 角 3 步。</>
              : <>Note: order = lcm of the corner-cycle order and the edge-cycle order (orientations multiplied in). Anaconda's 6 = lcm(2, 3) — edges loop in 2, corners in 3.</>}
          </div>
        </div>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="13.2  Superflip 的特殊地位" en="13.2  The special status of superflip" />
        </h3>
        <p>
          <L
            zh={<>Superflip 是阶 2 的元素 (做两次回到原点), 且它的 <TeX src={`c_p = e,\\; c_o = 0`} /> (角块完全归位), <TeX src={`e_p = e`} /> (棱位置归位), 只有 <TeX src={`e_o = (1,1,\\ldots,1)`} /> 12 个棱块全部翻面。 它在 G 里有三件事是 <em>独一无二</em> 的:</>}
            en={<>Superflip is an order-2 element, with <TeX src={`c_p = e,\\; c_o = 0`} /> (corners untouched) and <TeX src={`e_p = e`} /> (edges home), and only <TeX src={`e_o = (1,1,\\ldots,1)`} /> — all 12 edges flipped. It is <em>uniquely distinguished</em> in G by three facts:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li>
            <L
              zh={<><strong>Z(G) 的唯一非平凡元</strong> —— 跟 G 中每一个元素交换 (§9.4): <TeX src={`Z(G) = \\{e,\\; \\mathrm{superflip}\\} \\cong \\mathbb{Z}/2`} />。 这是 「为什么 G 不简单」的最具体证据。</>}
              en={<><strong>The unique non-identity element of Z(G)</strong> — commutes with every g ∈ G (§9.4): <TeX src={`Z(G) = \\{e,\\; \\mathrm{superflip}\\} \\cong \\mathbb{Z}/2`} />. The most concrete reason G is not simple.</>}
            />
          </li>
          <li>
            <L
              zh={<><strong>HTM 距离恰好 20</strong> —— 是 2010 年 Rokicki 等证明 「上帝之数 = 20」 时第一个被锁死的下界。 全 4.3 × 10¹⁹ 状态里只有 <strong>三个</strong> 状态需要满 20 步: superflip、 superflip ∘ (4-spot 一族), 以及 Reid 的对偶。</>}
              en={<><strong>HTM distance exactly 20</strong> — the first lower bound nailed down in Rokicki et al.'s 2010 proof that God's number = 20. Of 4.3 × 10¹⁹ states, only <strong>three</strong> require the full 20 moves: superflip, the superflip ∘ 4-spot family, and Reid's dual.</>}
            />
          </li>
          <li>
            <L
              zh={<><strong>对所有 48 个外部立方对称变换不变</strong> —— 把 superflip 投到 G 的轨道空间 G/Sym 上, 它仍然是单点轨道。 群论上 「最对称」 的非平凡状态。</>}
              en={<><strong>Invariant under all 48 outer cube symmetries</strong> — when projected to G/Sym, superflip is a singleton orbit. Group-theoretically the "most symmetric" non-identity state.</>}
            />
          </li>
        </ul>
        <TeXBlock src={`Z(G) \\;=\\; \\bigl\\{\\,g \\in G \\;:\\; \\forall h \\in G,\\; gh = hg\\,\\bigr\\} \\;=\\; \\{e,\\; \\mathrm{superflip}\\} \\;\\cong\\; \\mathbb{Z}/2`} />
        <div className="gt-pullquote">
          <L
            zh={<>「Superflip 是 4.3 × 10¹⁹ 状态里, 群论上 <em>最特殊</em> 的那一个。 它的特殊性不是巧合, 而是它在群中几何位置的代数后果。」</>}
            en={<>"Superflip is, group-theoretically, the most singular position among 43 quintillion. Its uniqueness is not coincidence — it is the algebraic consequence of its geometric place in G."</>}
          />
          <div className="gt-pullquote-cite">— Tomas Rokicki, <em>God's Number is 20</em> (2010)</div>
        </div>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="13.3  生成简单图案的代数学" en="13.3  Algebra of generating simple patterns" />
        </h3>
        <p>
          <L
            zh={<>有些图案有清晰的代数公式。 例如 「checkerboard 棋盘」 = U² D² F² B² L² R²。 这是 6 个 「半圈生成元」 的乘积, 它们两两可交换 (同轴半圈互换 U² ↔ D², 不同轴半圈在不同 cubies 上作用), 故它们生成的子群是阿贝尔的:</>}
            en={<>Some patterns have a clean algebraic origin. Example: <strong>checkerboard</strong> = U² D² F² B² L² R². These six half-turn generators mutually commute (same-axis half-turns commute, different-axis pairs act on disjoint cubies), so the subgroup they generate is Abelian:</>}
          />
        </p>
        <TeXBlock src={`\\langle U^2,\\, D^2,\\, F^2,\\, B^2,\\, L^2,\\, R^2 \\rangle \\;\\cong\\; (\\mathbb{Z}/2)^3 \\;\\;(\\text{after the 3 axis-fold relations})`} />
        <p>
          <L
            zh={<>(三个轴方向各自一对 U²/D² 等, 同轴半圈互为逆 — 减去 3 个独立关系, 剩 6 - 3 = 3 个独立 ℤ/2 因子。) Checkerboard 的阶因此必然 ≤ 2 ── 直接验证就是 2。 「Pons Asinorum」 (M² E² S²) 与 superflip 都属于这个阿贝尔小子群。</>}
            en={<>(Three axes give three pairs U²/D² etc.; same-axis half-turns invert each other, kicking 3 relations, leaving 6 − 3 = 3 independent ℤ/2 factors.) Checkerboard's order is therefore ≤ 2 — and direct check gives 2. The "Pons Asinorum" (M² E² S²) and superflip both live in this Abelian subgroup.</>}
          />
        </p>

        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '观察 13.1 — 图案视觉对称 ↔ 群代数对称', en: 'Observation 13.1 — visual ↔ algebraic symmetry'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>一个图案在所有 48 个外部立方对称下不变 ⇔ 它在共轭作用下是 G 的不动点 ⇔ 它在 <strong>Z(G)</strong> 里。 这是 「为什么 superflip 既视觉上完美对称又代数上独一」 的真正原因。 一个图案在 <em>子集</em> 对称下不变 ⇔ 它在那部分稳定子里 —— 例如 「三轴对称」 棋盘对 24 个旋转对称不变, 它不属于 Z(G) 但属于对称化子群。</>}
              en={<>A pattern fixed by all 48 outer cube symmetries ⇔ it is a fixed point of conjugation ⇔ it lies in <strong>Z(G)</strong>. That is why superflip is simultaneously the most visually symmetric and the algebraically unique non-trivial element. A pattern fixed by a <em>subset</em> of symmetries lies in the corresponding symmetrizing subgroup — e.g. the three-axis-symmetric checkerboard sits in a 24-element rotational stabilizer, not in Z(G).</>}
            />
          </div>
        </div>
      </GTSec>
  );
}
