/**
 * /math/kernel — an accessible-but-rigorous explainer of the /sim "group-theory kernel":
 * how the simulator turns a twisty puzzle on screen into its real permutation group G,
 * and what that buys (exact |G|, orbit structure, uniform random-state scrambles,
 * constructive solves). Two engines: the cubing.js PuzzleGeometry compiler (PG path) and
 * an in-house permutation backbone (perm path) for puzzles PG cannot represent faithfully.
 *
 * Every |G| / orbit / index on this page is READ FROM the baked facts table
 * (engine/pgFacts.generated.ts) so it always matches what the simulator shows — nothing
 * is hand-typed. Keys: PG puzzles by cubing.js name, perm puzzles by bridge key; the
 * Mirror Cube reuses the 3x3x3 entry (it is mechanically a 3x3x3).
 */
'use client';

import { Fragment, useState } from 'react';
import Link from '@/components/AppLink';
import { ArrowLeft, Boxes, Cpu, Eye, ShieldCheck, Sparkles, Wand2, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { TeX } from '@/components/math/Tex';
import { useT } from '@/hooks/useT';
import { tr } from '@/i18n/tr';
import { PRECOMPUTED_PG_FACTS } from '../../sim/engine/pgFacts.generated';
import type { SerializedPgFacts } from '../../sim/engine/pgFacts';
import './kernel.css';

const SUB = '₀₁₂₃₄₅₆₇₈₉';
const sub = (n: number): string => String(n).split('').map((d) => SUB[+d]).join('');
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (n: number): string => String(n).split('').map((d) => SUP[+d]).join('');

/** KaTeX source for a puzzle's orbit embedding, e.g. ℤ₃≀S₈ × ℤ₂≀S₁₂ × S₆. */
function embedTeX(f: SerializedPgFacts): string {
  return f.orbits
    .map((o) => (o.oriMod > 1 ? `\\mathbb{Z}_{${o.oriMod}} \\wr S_{${o.pieces}}` : `S_{${o.pieces}}`))
    .join(' \\times ');
}
/** Thousands-grouped decimal. */
const grouped = (s: string): string => BigInt(s).toLocaleString('en-US');
/** Compact 3-significant-figure scientific label, e.g. "4.95×10²⁷" (rounded, not truncated). */
function sci(s: string): string {
  if (s.length <= 9) return grouped(s);
  let exp = s.length - 1;
  let m = Math.round(Number(s.slice(0, 4)) / 10); // first 3 sig figs, rounded on the 4th
  if (m >= 1000) { m = Math.round(m / 10); exp += 1; } // 9.99…→10.0 carry
  const d = String(m);
  return `${d[0]}.${d.slice(1)}×10${sup(exp)}`;
}

type Path = 'pg' | 'perm';
interface Puz {
  key: string;            // facts-table key
  sim: string;            // /sim?puzzle= value
  zh: string; en: string;
  path: Path;
  solvable: boolean;
  note?: { zh: string; en: string };
}

// Architectural metadata (path / solvable / sim id). |G| itself is never hard-coded —
// it is read live from PRECOMPUTED_PG_FACTS[key] below.
const PUZZLES: Puz[] = [
  { key: '2x2x2', sim: '2', zh: '二阶', en: '2×2×2', path: 'pg', solvable: true },
  { key: '3x3x3', sim: '3', zh: '三阶', en: '3×3×3', path: 'pg', solvable: false },
  { key: '3x3x3', sim: 'mirror', zh: '镜面魔方', en: 'Mirror Cube', path: 'pg', solvable: false,
    note: { zh: '机械上就是三阶,复用其群', en: 'mechanically a 3×3×3 — reuses its group' } },
  { key: '4x4x4', sim: '4', zh: '四阶', en: '4×4×4', path: 'pg', solvable: false },
  { key: '5x5x5', sim: '5', zh: '五阶', en: '5×5×5', path: 'pg', solvable: false },
  { key: 'pyraminx', sim: 'pyraminx', zh: '金字塔', en: 'Pyraminx', path: 'pg', solvable: true },
  { key: 'skewb', sim: 'skewb', zh: '斜转', en: 'Skewb', path: 'pg', solvable: true },
  { key: 'dino', sim: 'dino', zh: 'Dino', en: 'Dino', path: 'pg', solvable: true },
  { key: 'compy cube', sim: 'redi', zh: 'Redi', en: 'Redi', path: 'pg', solvable: true,
    note: { zh: '= Compy 魔方', en: '= the Compy cube' } },
  { key: 'helicopter', sim: 'heli', zh: '直升机', en: 'Helicopter', path: 'pg', solvable: false },
  { key: 'megaminx', sim: 'megaminx', zh: '五魔方', en: 'Megaminx', path: 'pg', solvable: false },
  { key: 'FTO', sim: 'fto', zh: '面转八面体', en: 'FTO', path: 'pg', solvable: false },
  { key: 'ivy', sim: 'ivy', zh: '枫叶魔方', en: 'Ivy', path: 'perm', solvable: true,
    note: { zh: '只转 4 个角 — 非对称切割', en: 'only 4 corners turn — asymmetric cut' } },
  { key: 'rex', sim: 'rex', zh: 'Rex', en: 'Rex', path: 'perm', solvable: false,
    note: { zh: '中心隐藏朝向 — PG 会多算', en: 'hidden centre orientation — PG over-counts' } },
];

export default function KernelPage() {
  useTranslation();
  const t = useT();
  useDocumentTitle('群论内核', 'Group-theory kernel');
  const [openKey, setOpenKey] = useState<string | null>('ivy');

  const rex = PRECOMPUTED_PG_FACTS['rex'];
  const ivy = PRECOMPUTED_PG_FACTS['ivy'];
  const c333 = PRECOMPUTED_PG_FACTS['3x3x3'];
  const mega = PRECOMPUTED_PG_FACTS['megaminx'];

  return (
    <div className="kernel-page">
      <header className="kn-header">
        <Link href="/math" className="kn-back" prefetch={false}><ArrowLeft size={16} /><span>{t('返回 数学', 'Back to Math')}</span></Link>
      </header>

      <main className="kn-main">
        {/* ── HERO ── */}
        <section className="kn-hero">
          <div className="kn-eyebrow">{t('魔方模拟器 · 群论 · 计算代数', 'Cube simulator · Group theory · Computational algebra')}</div>
          <h1 className="kn-title">
            {t('群论内核', 'The group-theory kernel')}
            <span className="kn-title-sub">
              {t('让模拟器真正"读懂"一个扭计魔方 —— 从屏幕上的像素,到它背后的群 G',
                'How the simulator actually "understands" a twisty puzzle — from pixels on screen to its underlying group G')}
            </span>
          </h1>
          <p className="kn-lede">
            {t('每个转法都是一个置换,转法相乘就得到这个魔方的群。给定这个群,还原、均匀打乱、状态计数就不再是逐题手写的启发式,而是一次性的代数结果。这一页讲我们怎么把任意 /sim 魔方变成它的群,以及为什么要分两条路。',
              'Every move is a permutation; composing moves gives the puzzle its group. Once you have that group, solving, uniform scrambling and counting states stop being per-puzzle heuristics and become one algebraic result. This page explains how any /sim puzzle becomes its group — and why it takes two paths.')}
          </p>
          <div className="kn-links">
            <Link href="/sim" className="kn-chip" prefetch={false}><Boxes size={14} />{t('打开模拟器', 'Open the simulator')}</Link>
            <Link href="/math/group" className="kn-chip" prefetch={false}><Sparkles size={14} />{t('魔方与群 (长文)', 'Cube as a group (essay)')}</Link>
          </div>
        </section>

        {/* ── 1. pixels → group ── */}
        <section className="kn-sec">
          <h2><span className="kn-num">1</span>{t('从像素到群', 'From pixels to a group')}</h2>
          <p>{t('模拟器有两个半边。一半是 Three.js 引擎:它画出方块、转动、响应拖拽 —— 它只管"看起来对不对"。另一半就是群论内核:它维护一个抽象的群元素,和屏幕上完全同步地跟着每一步转动走,回答几何答不了的问题 —— 这个状态到底距离还原有多远?整个魔方一共有多少个状态?哪些排列是永远拼不出来的?',
            'The simulator has two halves. One is a Three.js engine that draws the cubies, animates turns and handles drags — it only cares whether things look right. The other is the group-theory kernel: it maintains an abstract group element that tracks every turn in lock-step with the screen, and answers what geometry cannot — how far is this state from solved, how many states exist at all, which arrangements can never be reached?')}</p>
          <p className="kn-aside">{t('两半共用同一份"转法表"。这一点后面很关键:它让群论内核顺便成了引擎的自动校验器。',
            'Both halves are driven by the same move tables. That matters later: it turns the kernel into an automatic correctness check on the engine.')}</p>
        </section>

        {/* ── 2. two paths ── */}
        <section className="kn-sec">
          <h2><span className="kn-num">2</span>{t('两条路:PG 与置换', 'Two engines: PG and permutation')}</h2>
          <div className="kn-two">
            <div className="kn-card">
              <div className="kn-card-h"><Cpu size={16} />{t('第一条路 · PuzzleGeometry', 'Path 1 · PuzzleGeometry')}</div>
              <p>{t('cubing.js 的 PuzzleGeometry 是一个"多面体 + 平面切割"的编译器:告诉它一个立方体/十二面体/八面体/四面体,再给几刀对称的平面切割,它就吐出这个魔方的块、转法和群,并用 Schreier-Sims 精确数出 |G|。',
                'cubing.js\'s PuzzleGeometry is a compiler for "a polytope plus symmetric plane cuts": hand it a cube / dodecahedron / octahedron / tetrahedron and a few symmetric slicing planes, and it produces the pieces, moves and group — counting |G| exactly via Schreier-Sims.')}</p>
              <p className="kn-card-note">{t('二阶到七阶、金字塔、斜转、Dino、五魔、直升机、FTO,以及 Redi(= Compy 魔方)全走这条路 —— 基本是"接线到 cubing.js"。',
                '2×2 through 7×7, Pyraminx, Skewb, Dino, Megaminx, Helicopter, FTO, and Redi (= the Compy cube) all ride this — essentially "wire it to cubing.js".')}</p>
            </div>
            <div className="kn-card">
              <div className="kn-card-h"><Boxes size={16} />{t('第二条路 · 置换内核', 'Path 2 · Permutation backbone')}</div>
              <p>{t('有些魔方 PG 表示不了。枫叶(Ivy)只有 4 个角能转,是正四面体子集 —— 破坏了立方体的对称,不是一刀平面切。Rex 的 6 个中心带着看不见的 4 重朝向,PG 会把它当作八面体(FTO)重新贴标签、把状态数多算好几个数量级。',
                'Some puzzles PG cannot express. The Ivy turns only 4 corners (a tetrahedral subset) — it breaks the cube\'s symmetry, so it is not a symmetric plane cut. The Rex\'s 6 centres carry an invisible 4-fold orientation, so PG would model it as an octahedron (FTO), relabel the pieces, and over-count the states by orders of magnitude.')}</p>
              <p className="kn-card-note">{t('这些魔方我们直接从引擎自己的转法表把群"抬"出来:每个转法读成一个置换,喂进我们自建的置换群内核。不依赖 cubing.js 的几何模型。',
                'For these we lift the group straight from the engine\'s own move tables: read each move as a permutation and feed it to our own permutation-group backbone — no cubing.js geometry needed.')}</p>
            </div>
          </div>
        </section>

        {/* ── 3. BSGS ── */}
        <section className="kn-sec">
          <h2><span className="kn-num">3</span>{t('BSGS:又数又解的骨架', 'BSGS: the skeleton that both counts and solves')}</h2>
          <p>{t('两条路最后都落到同一个结构 —— 带词的 BSGS(基 + 强生成集,Schreier-Sims)。直观地说:选一串"基点",逐层记录"把某一块搬到某个位置"的所有走法,并为每一条走法记住它对应的转法序列。这条稳定子链一旦建好,两件事同时到手:',
            'Both paths land on the same structure — a BSGS with words (base + strong generating set, Schreier-Sims). Intuitively: pick a chain of "base points", and at each level record every way to move a given piece into a given slot, remembering for each the move sequence that achieves it. Once that stabiliser chain is built, two things come for free:')}</p>
          <ul className="kn-list">
            <li>{t('数状态:|G| = 每一层可达位置数的乘积 —— 精确、无近似。',
              'Counting: |G| = the product of the reachable-position counts per level — exact, no approximation.')}</li>
            <li>{t('还原:任意打乱都能沿着链"筛"回原点,拼出一条真正的解法(纯群论,不靠专门写的求解器)。',
              'Solving: any scramble can be sifted back down the chain into a genuine solution (pure group theory, no bespoke solver).')}</li>
          </ul>
          <p className="kn-aside">{t('对小群(2 阶、金字塔、斜转、Dino、Redi、Ivy)我们把词也存下来,当场就能解;对巨群(三阶及以上、五魔、直升机、Rex)只数不解 —— 存词会撑爆内存,而 |G| 用不带词的 Schreier-Sims 几毫秒就数完。',
            'For small groups (2×2, Pyraminx, Skewb, Dino, Redi, Ivy) we keep the words too and solve on the spot; for giant groups (3×3 and up, Megaminx, Helicopter, Rex) we only count — storing words would exhaust memory, whereas a word-free Schreier-Sims counts |G| in milliseconds.')}</p>
        </section>

        {/* ── 4. free capabilities ── */}
        <section className="kn-sec">
          <h2><span className="kn-num">4</span>{t('绑定之后,白得的能力', 'What you get for free once bound')}</h2>
          <div className="kn-caps">
            <div className="kn-cap"><Wand2 size={15} /><b>{t('真·随机态打乱', 'True random-state scramble')}</b><span>{t('在群上均匀采样一个状态,而不是"随机转 N 步"(后者有偏、够不到均匀分布)。',
              'Sample a state uniformly from the group — not "N random turns", which is biased and cannot reach a uniform distribution.')}</span></div>
            <div className="kn-cap"><Sparkles size={15} /><b>{t('构造性求解', 'Constructive solve')}</b><span>{t('把当前状态的逆分解成转法。免费,不用逐题写解法。',
              'Factor the inverse of the current state into moves. Free — no per-puzzle solver to write.')}</span></div>
            <div className="kn-cap"><Boxes size={15} /><b>{t('轨道 / 花圈结构', 'Orbit / wreath structure')}</b><span>{t('每一类块的 Zₒ≀Sₙ 分解、无约束总数、以及约束指数。',
              'The Zₒ≀Sₙ decomposition per piece type, the unconstrained total, and the constraint index.')}</span></div>
            <div className="kn-cap"><Cpu size={15} /><b>{t('元素阶', 'Element order')}</b><span>{t('把当前打乱重复多少遍会回到还原 —— 就是这个群元素的阶。',
              'How many repeats of the current scramble return to solved — the order of the group element.')}</span></div>
          </div>
        </section>

        {/* ── 5. faithfulness ── */}
        <section className="kn-sec">
          <h2><span className="kn-num">5</span><Eye size={18} className="kn-h-ic" />{t('忠实性:显示的 |G| 必须等于你看到的魔方', 'Faithfulness: the displayed |G| must equal the puzzle you see')}</h2>
          <p>{t('这是内核的第一原则。有两处很容易算出"漂亮但错误"的数字,我们都特意绕开了:',
            'This is the kernel\'s first principle. Two places invite a "clean but wrong" number; we deliberately avoid both:')}</p>

          <div className="kn-worked">
            <div className="kn-worked-h">{t('Rex —— 不数看不见的朝向', 'Rex — do not count invisible orientation')}</div>
            <p>{t('把每一块都当作可区分的,Rex 的转法生成的群正好是',
              'Treating every piece as distinguishable, the group generated by the Rex\'s moves is exactly')}
              {' '}<TeX src="A_6 \times A_{12} \times A_{12} \times A_{12}" />{' = '}
              <span className="kn-mono">{grouped(rex.order)}</span>{t(',约束指数 ', ', constraint index ')}
              <TeX src={`${rex.index} = 2^4`} />{t('。为什么这么整齐?每个转法在每一类块上都是偶置换(三循环),所以每一类块都被限制在它的交错群里 —— 四个独立的偶性约束,刚好 2⁴。',
                '. Why so clean? Every move is an even permutation (a product of 3-cycles) on each orbit, so each orbit is confined to its alternating group — four independent parity constraints, exactly 2⁴.')}</p>
            <p className="kn-aside">{t('如果只数"肉眼能分辨"的摆放(同一面的四片花瓣同色、视作相同),会得到一个更小的常见数字。这就是"群"和"你看到的"之间的差别 —— 我们显示的是与屏幕上魔方一致的那个。若走 PG 的八面体路线,它还会把中心那看不见的 4 重朝向也数进去,反而更大。',
              'If you count only visually-distinct arrangements (the four same-colour petals on a face treated as identical), you get a smaller, commonly-quoted figure. That is the gap between "the group" and "what you see" — we display the one consistent with the cube on screen. Going through PG\'s octahedron instead would additionally count the centres\' invisible 4-fold orientation, making it larger still.')}</p>
          </div>

          <div className="kn-worked">
            <div className="kn-worked-h">{t('Megaminx / Redi —— 只数真实转法', 'Megaminx / Redi — count only the real turns')}</div>
            <p>{t('PG 的切割会顺带暴露一些"深层切片",它们并不是这个魔方真正的转法,却会把 |G| 灌水(Redi 正好 ×12,五魔更多)。我们在真实的面/角转法上重新计数,得到干净的整数约束指数 —— 五魔的 |G| 是',
              'PG\'s cut also exposes some "deep slices" that are not real moves of the puzzle, yet they inflate |G| (redi by exactly ×12, megaminx by much more). We recount over the real face/corner turns, giving a clean integer constraint index — the Megaminx |G| is')}
              {' '}<span className="kn-mono">{sci(mega.order)}</span>{t(',而不是灌水后的值。', ', not the inflated value.')}</p>
          </div>
        </section>

        {/* ── 6. oracle ── */}
        <section className="kn-sec">
          <h2><span className="kn-num">6</span><ShieldCheck size={18} className="kn-h-ic" />{t('内核顺便是引擎的校验器', 'The kernel is also a check on the engine')}</h2>
          <p>{t('因为群是从引擎自己的转法表建出来的,同一份表其实被"独立地"用了两遍:一遍画像素,一遍算群。于是闭环测试能抓出人眼看不出的 bug —— 打乱后两边"还原了没"必须一致;打乱再逆序必须回到还原;群论解法套回去必须真的还原。符号/手性/贴标签只要错一点,测试立刻变红。这正是当初把 NxN 的切片命名、各魔方的手性一个个钉死的方式。',
            'Because the group is built from the engine\'s own move tables, the same tables get used twice, independently: once to draw pixels, once to compute the group. Closed-loop tests then catch bugs the eye misses — after a scramble both halves must agree on "solved or not"; a scramble followed by its inverse must return to solved; a group-theoretic solution must actually solve it. One wrong sign, chirality or label and the test goes red. This is exactly how the NxN slice naming and each puzzle\'s chirality got pinned down.')}</p>
        </section>

        {/* ── 7. coverage explorer ── */}
        <section className="kn-sec">
          <h2><span className="kn-num">7</span>{t('覆盖一览 (点开看结构)', 'Coverage (click a row for its structure)')}</h2>
          <p className="kn-aside">{t('数字实时取自模拟器烘焙的群论数据,和 /sim 里显示的完全一致。',
            'Numbers are read live from the simulator\'s baked group data — identical to what /sim shows.')}</p>
          <div className="kn-table-wrap">
            <table className="kn-table">
              <thead>
                <tr>
                  <th>{t('魔方', 'Puzzle')}</th>
                  <th>{t('路径', 'Path')}</th>
                  <th className="kn-r">{t('状态数 |G|', 'States |G|')}</th>
                  <th className="kn-c">{t('可解', 'Solve')}</th>
                </tr>
              </thead>
              <tbody>
                {PUZZLES.map((p) => {
                  const f = PRECOMPUTED_PG_FACTS[p.key];
                  const rowKey = p.sim; // /sim ids are unique across the list
                  const open = openKey === rowKey;
                  return (
                    <Fragment key={rowKey}>
                      <tr className={open ? 'kn-row-open' : ''}>
                        <td>
                          <button type="button" className="kn-row-btn" onClick={() => setOpenKey(open ? null : rowKey)}>
                            <ChevronRight size={13} className={open ? 'kn-caret kn-caret-open' : 'kn-caret'} />
                            {tr(p)}
                            {p.note && <span className="kn-row-note">{tr(p.note)}</span>}
                          </button>
                        </td>
                        <td><span className={`kn-tag kn-tag-${p.path}`}>{p.path === 'pg' ? 'PuzzleGeometry' : t('置换内核', 'permutation')}</span></td>
                        <td className="kn-r kn-mono">{sci(f.order)}</td>
                        <td className="kn-c">{p.solvable ? <span className="kn-yes">{t('可解', 'yes')}</span> : <span className="kn-no">{t('仅计数', 'facts')}</span>}</td>
                      </tr>
                      {open && (
                        <tr className="kn-detail-row">
                          <td colSpan={4}>
                            <div className="kn-detail">
                              <div className="kn-detail-row-item">
                                <span className="kn-detail-lbl">{t('群嵌入', 'Group embeds in')}</span>
                                <span className="kn-mono"><TeX src={`G \\le ${embedTeX(f)}`} /></span>
                              </div>
                              <div className="kn-detail-row-item">
                                <span className="kn-detail-lbl">{t('精确 |G|', 'exact |G|')}</span>
                                <span className="kn-mono kn-break">{grouped(f.order)}</span>
                              </div>
                              <div className="kn-detail-grid">
                                {f.orbits.map((o) => (
                                  <span key={o.name} className="kn-orbit">
                                    <b>{o.name}</b> {o.pieces}{t(' 块', ' pcs')}
                                    <span className="kn-dim"> · {o.oriMod > 1 ? <>{t('取向', 'orient')} ℤ{sub(o.oriMod)}</> : t('无取向', 'no orient')}</span>
                                  </span>
                                ))}
                              </div>
                              <div className="kn-detail-row-item">
                                <span className="kn-detail-lbl">{t('约束指数', 'constraint index')}</span>
                                <span className="kn-mono">{grouped(f.index)}</span>
                                <span className="kn-dim"> = {t('无约束', 'reassembly')} / |G|</span>
                              </div>
                              <Link href={`/sim?puzzle=${p.sim}`} className="kn-try" prefetch={false}><Boxes size={13} />{t('在模拟器里打开', 'Open in the simulator')}</Link>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── 8. sq1 out ── */}
        <section className="kn-sec">
          <h2><span className="kn-num">8</span>{t('一个例外:Square-1', 'One exception: Square-1')}</h2>
          <p>{t('Square-1 不在其中。它会变形 —— 可用的转法随当前形状改变,所以它是一个"群胚"(groupoid),而不是一个群:没有单一的 |G|,也没有作用在固定块集上的稳定子链。cubing.js 也是用一套单独的绑定式定义来处理它,而不是群论编译器。',
            'Square-1 is not covered. It shape-shifts — the available moves change with the current shape — so it is a groupoid, not a group: there is no single |G| and no stabiliser chain acting on a fixed set of pieces. cubing.js also handles it with a separate bandaged definition rather than the group-theory compiler.')}</p>
        </section>

        <footer className="kn-foot">
          {t('三阶群 ', '3×3×3: ')}<span className="kn-mono">{grouped(c333.order)}</span>{t(' · 枫叶 ', ' · Ivy ')}<span className="kn-mono">{grouped(ivy.order)}</span>
          {t(' · 全部由 Schreier-Sims 离线烘焙,运行时直接读表', ' · all baked offline via Schreier-Sims, read from a table at runtime')}
        </footer>
      </main>
    </div>
  );
}
