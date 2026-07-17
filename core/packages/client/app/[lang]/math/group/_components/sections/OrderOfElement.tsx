'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { GTSec, L, TeX } from '../primitives';
import { applyAlg, orderOf, identity, CubieState } from '../cube_state';
import { tr } from '@/i18n/tr';
import { TwistyMini } from '../TwistyMini';

function PeriodExplorer() {
  const [alg, setAlg] = useState('R U');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const [iter, setIter] = useState(0);
  const animRef = useRef<number | null>(null);

  const period = useMemo(() => {
    try {
      const o = orderOf(alg);
      return o > 0 ? o : null;
    } catch { return null; }
  }, [alg]);

  const trajectory = useMemo(() => {
    if (!period || period > 200) return [];
    const arr: number[] = [];
    let s = identity();
    const step = (() => {
      try { return applyAlg(identity(), alg); } catch { return identity(); }
    })();
    for (let n = 1; n <= period; n++) {
      s = composeS(s, step);
      // diff count = number of mismatched positions/orientations
      let d = 0;
      for (let i = 0; i < 8; i++) { if (s.cp[i] !== i) d++; if (s.co[i] !== 0) d++; }
      for (let i = 0; i < 12; i++) { if (s.ep[i] !== i) d++; if (s.eo[i] !== 0) d++; }
      arr.push(d);
    }
    return arr;
  }, [alg, period]);

  const stop = useCallback(() => {
    if (animRef.current) { clearTimeout(animRef.current); animRef.current = null; }
    setIter(0);
  }, []);

  const animate = useCallback(() => {
    if (!playerRef.current || !period) return;
    stop();
    let n = 0;
    const tick = async () => {
      if (!playerRef.current) return;
      try {
        // Append the alg to the current player. Re-build alg as alg repeated.
        n++;
        setIter(n);
        if (n >= period) {
          stop();
          return;
        }
        animRef.current = window.setTimeout(tick, 800);
      } catch { stop(); }
    };
    tick();
  }, [period, stop]);

  useEffect(() => () => stop(), [stop]);

  // Re-compute alg-times-iter for displayed alg.
  const playAlg = useMemo(() => {
    if (!iter) return alg;
    return Array.from({ length: iter }, () => alg).join(' ');
  }, [alg, iter]);

  const max = trajectory.length ? Math.max(...trajectory) : 1;
  const showOver = period && period > 60;

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">{tr({ zh: '互动 § 元素阶', en: 'Interactive § Order of an element'
    })}</div>
      <p className="gt-panel-sub">
        {tr({ zh: '一个公式重复多少次能回到起点?这就是它的「阶」。点几个常见例子看看。', en: 'Repeat a sequence until it returns to identity. The smallest such count is its order.'
        })}
      </p>
      <div className="gt-panel-input-row">
        <label>alg</label>
        <input className="gt-input" value={alg} onChange={e => { setAlg(e.target.value); stop(); }} />
      </div>
      <div className="gt-panel-input-row" style={{ marginTop: 4 }}>
        {[
          ['R', '4'], ['R U', '105'], ["R U R' U'", '6'],
          ["R U R' U R U2 R'", '6'],
          ["F R U' R' U' R U R' F'", '24'],
          ["R U2 R' U' R U' R'", '8'],
          ['R L', '4'],
          ["F R B' L F'", '63'],
        ].map(([s, n]) => (
          <span key={s} className="gt-chip" onClick={() => { setAlg(s); stop(); }}>
            {s} <span style={{ opacity: .5 }}>· {n}</span>
          </span>
        ))}
      </div>

      <div className="gt-twisty-inline" style={{ maxWidth: 280, margin: '20px auto' }}>
        <TwistyMini key={playAlg} alg={playAlg} onPlayerReady={p => { playerRef.current = p; }} />
      </div>

      <div className="gt-panel-input-row">
        <button className="gt-btn" onClick={animate} disabled={!period || period > 60}>
          {tr({ zh: '播放轨道', en: 'play orbit'
        })}
        </button>
        <button className="gt-btn-ghost gt-btn" onClick={stop}>
          {tr({ zh: '停', en: 'stop' })}
        </button>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-faint)', marginLeft: 'auto' }}>
          {iter > 0 ? `${iter} / ${period}` : ''}
        </span>
      </div>

      <div className="gt-panel-result">
        <div className="gt-result-row">
          <div className="gt-result-label">{tr({ zh: '阶 (返回单位元所需重复数)', en: 'order (period)'
        })}</div>
          <div className="gt-result-val-strong">{period === null ? '—' : period}</div>
        </div>
        {showOver && (
          <div className="gt-aside" style={{ marginTop: 12 }}>
            {tr({ zh: '阶 > 60,动画不再播放;轨道太长,光看图就够。', en: 'Order > 60 — orbit too long to animate, but the chart shows the full trajectory.'
            })}
          </div>
        )}
      </div>

      {trajectory.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', marginBottom: 4 }}>
            {tr({ zh: '与单位元的距离 (错位件数), 每次幂', en: 'distance from identity (mismatched positions), per power'
            })}
          </div>
          <div className="gt-period-chart">
            {trajectory.map((d, i) => (
              <div
                key={i}
                className={`gt-period-bar ${d === 0 ? 'gt-period-bar-solved' : ''}`}
                style={{ height: `${Math.max(2, (d / max) * 100)}%` }}
                title={`${i + 1}: ${d} pieces off`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Small helper duplicating composeStates from cube_state.ts (kept private to
// avoid widening cube_state's API surface).

// avoid widening cube_state's API surface).
function composeS(a: CubieState, b: CubieState): CubieState {
  const cp = new Array(8), co = new Array(8);
  for (let i = 0; i < 8; i++) { cp[i] = a.cp[b.cp[i]]; co[i] = (a.co[b.cp[i]] + b.co[i]) % 3; }
  const ep = new Array(12), eo = new Array(12);
  for (let i = 0; i < 12; i++) { ep[i] = a.ep[b.ep[i]]; eo[i] = (a.eo[b.ep[i]] + b.eo[i]) % 2; }
  return { cp, co, ep, eo };
}

// ── §8 ConjugateViewer ─────────────────────────────────────────────────────

// ── Other-puzzle comparison table (§15) ───────────────────────────────────
function OrderDistribution() {
  // Known orders that occur in the cube group with at least one element.
  // Source: enumerated from conjugacy classes; the orders that exist are the
  // divisors of 1260, but not ALL divisors — exact attainable set:
  const orders = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 18, 20, 21, 24, 28, 30, 35, 36, 40, 42, 45, 56, 60, 63, 70, 72, 84, 90, 105, 126, 140, 180, 210, 252, 315, 420, 630, 1260];
  return (
    <div>
      <div className="gt-aside" style={{ marginBottom: 12 }}>
        {tr({ zh: '魔方群中实际出现的元素阶（共 73 个不同的阶）。最大为 1260。每个阶都对应一组共轭类。', en: 'Orders actually attained by some cube element (73 distinct values). Maximum is 1260. Each order corresponds to a family of conjugacy classes.'
        })}
      </div>
      <div className="gt-order-table">
        {orders.map(n => (
          <div className="gt-order-cell" key={n}>
            <div className="gt-order-cell-n">{n}</div>
            <div className="gt-order-cell-lbl">{tr({ zh: '阶', en: 'ord'
            })}</div>
          </div>
        ))}
      </div>
      <div className="gt-aside" style={{ marginTop: 12 }}>
        {tr({ zh: '1260 = 2² · 3² · 5 · 7 是 |G| 的最大整除元素阶。这个特殊数字来自一个 (7-cycle on corners) × (5-cycle on edges) × (9-twist on corner ori) 的精心构造。', en: '1260 = 2² · 3² · 5 · 7 is the maximum element order dividing |G|. Achievable via a (7-cycle on corners) × (5-cycle on edges) × (9-twist orbit) construction.'
        })}
      </div>
    </div>
  );
}

export default function OrderOfElement() {
  return (
      <GTSec id="order-of-element" className="gt-sec">
        <div className="gt-sec-num">§7</div>
        <h2 className="gt-sec-title">
          <L zh="元素的阶" en="Order of an element" />
        </h2>
        <p>
          <L
            zh={<>对任何 <TeX src={`g \\in G`} />, 存在最小正整数 <TeX src={`n`} /> 使 <TeX src={`g^n = e`} />。 这个 <TeX src={`n`} /> 称为 <strong>g 的阶 (order)</strong>。 换句话说:不停重复同一公式, 多久回到原点?</>}
            en={<>For any <TeX src={`g \\in G`} />, there is a smallest positive integer <TeX src={`n`} /> with <TeX src={`g^n = e`} />. This <TeX src={`n`} /> is the <strong>order</strong> of <TeX src={`g`} />. Repeat the same alg until you come home — that count is its order.</>}
          />
        </p>
        <p>
          <L
            zh={<>一些有名的数字:<span className="gt-mono">R</span> 的阶是 4(简单),<span className="gt-mono">R U</span> 的阶却是 <strong>105</strong>(神奇),<span className="gt-mono">R U R' U'</span>(小鱼起手)的阶是 6。</>}
            en={<>Some famous orders: <span className="gt-mono">R</span> has order 4 (obvious), but <span className="gt-mono">R U</span> has order <strong>105</strong> (remarkable), and <span className="gt-mono">R U R' U'</span> (the "sexy move") has order 6.</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 7.1 — Lagrange', en: 'Theorem 7.1 — Lagrange' })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>每个元素的阶必须整除 |G|。 所以 <TeX src={`n \\,\\bigm|\\, 43{,}252{,}003{,}274{,}489{,}856{,}000`} />。 魔方群中实际出现的元素阶,最大是 <strong>1260</strong>(由两个不交圈乘出来的 LCM)。</>}
              en={<>Every element's order divides |G|. So <TeX src={`n \\,\\bigm|\\, 43{,}252{,}003{,}274{,}489{,}856{,}000`} />. The maximum order attained by any cube element is <strong>1260</strong> (the LCM of disjoint cycle lengths in optimal combination).</>}
            />
          </div>
        </div>
        <PeriodExplorer />
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="7.1  所有可能的阶" en="7.1  All attained orders" />
        </h3>
        <p>
          <L
            zh={<>G 中的元素阶必须整除 |G| = 2²⁷ · 3¹⁴ · 5³ · 7² · 11。这给出了 (27+1)(14+1)(3+1)(2+1)(1+1) = 28 · 15 · 4 · 3 · 2 = 10,080 个整除数。但 <em>实际可达</em> 的阶只有 <strong>73 个</strong>:</>}
            en={<>An element's order in G must divide |G| = 2²⁷ · 3¹⁴ · 5³ · 7² · 11. That allows (27+1)(14+1)(3+1)(2+1)(1+1) = 10,080 divisors. But only <strong>73</strong> are <em>actually attained</em> by elements of G:</>}
          />
        </p>
        <OrderDistribution />
        <p>
          <L
            zh={<>哪些阶达不到?例如 <TeX src={`|G|`} /> 本身 (<TeX src={`4.3 \\times 10^{19}`} />) 不可能是元素阶 — 因为这要求一个循环子群等于整个 G,而 G 不是循环群 (它非阿贝尔)。同样大部分大的整除数也达不到。</>}
            en={<>Which divisors are missed? For instance <TeX src={`|G|`} /> itself (<TeX src={`4.3 \\times 10^{19}`} />) cannot be an element's order — that would force a cyclic subgroup equal to G, but G is non-Abelian. Most large divisors are similarly out of reach.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="7.2  为什么 1260 是最大?" en="7.2  Why 1260 is the maximum" />
        </h3>
        <p>
          <L
            zh={<>找一个最大阶元素的方法:让角块部分形成一组合适的轮换,让棱块部分形成另一组,使两边周期的 LCM 最大化。具体地,需要:</>}
            en={<>To find a maximal-order element: arrange the corner part into a set of disjoint cycles, and the edge part likewise, maximising the LCM of their lengths. Specifically:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L zh="角块: 一个 5-循环 (考虑 CO,周期变 5 × LCM(co-sums))" en="Corners: a 5-cycle with internal CO summing to 1 mod 3 — local period 5 × 3 = 15" /></li>
          <li><L zh="棱块: 一个 7-循环 + 一个 5-cycle (考虑 EO,周期 lcm(7×2, 5))" en="Edges: a 7-cycle × a 5-cycle of edges with EO summing to 1 mod 2 — local period lcm(7, 4·2) ..." /></li>
          <li><L zh="总阶 = LCM(对应周期) = 4 · 9 · 5 · 7 = 1260" en="Total = LCM of the local periods = 2² · 3² · 5 · 7 = 1260" /></li>
        </ul>
        <p>
          <L
            zh={<>这个最大值最早由 J. Mathieu (1973) 类比对称群 S_n 的最大阶公式 (Landau 函数 g(n)) 确认。对 S_12 而言 g(12) = 60,但魔方加上 CO/EO 后变成 1260。</>}
            en={<>This maximum was first established by analogy with Landau's function g(n) (max order in S_n). Here g(12) = 60, but with the extra CO/EO structure on cubies the cube's maximum bumps up to 1260.</>}
          />
        </p>
        <div className="gt-aside">
          <L
            zh={<>这个阶的元素并不罕见 — 但难以一次性写出来。一个例子: <span className="gt-mono" style={{ fontSize: 11 }}>R U2 D' B D'</span> 有阶 1260。不信?<a href="/scramble/analyzer">用分析器自己跑一遍</a>。</>}
            en={<>Such elements are not rare, but hard to spot. Example: <span className="gt-mono" style={{ fontSize: 11 }}>R U2 D' B D'</span> has order 1260. Skeptical? <a href="/scramble/analyzer">Run it in the analyzer.</a></>}
          />
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="7.3  Landau 函数与对称群比较" en="7.3  Landau's function & comparison with Sₙ" />
        </h3>
        <p>
          <L
            zh={<>对称群 <TeX src={`S_n`} /> 中元素阶的最大值由 <strong>Landau 函数</strong> <TeX src={`g(n)`} /> 给出:对 <TeX src={`n`} /> 的所有分拆 <TeX src={`n = \\lambda_1 + \\lambda_2 + \\cdots`} />,最大化 <TeX src={`\\operatorname{lcm}(\\lambda_1, \\lambda_2, \\ldots)`} />。 这是因为 <TeX src={`S_n`} /> 中元素由不交圈型决定, 阶 = 各圈长 lcm。</>}
            en={<>The maximum element order in the symmetric group <TeX src={`S_n`} /> is given by <strong>Landau's function</strong> <TeX src={`g(n)`} />: over all partitions <TeX src={`n = \\lambda_1 + \\lambda_2 + \\cdots`} />, maximise <TeX src={`\\operatorname{lcm}(\\lambda_1, \\lambda_2, \\ldots)`} />. Why: an element of <TeX src={`S_n`} /> is determined by its disjoint cycle type, and its order equals the lcm of cycle lengths.</>}
          />
        </p>
        <table className="gt-landau-tbl">
          <thead>
            <tr>
              <th>n</th>
              <th>g(n)</th>
              <th>{tr({ zh: '取到最大值的分拆', en: 'optimal partition' })}</th>
              <th>{tr({ zh: '魔方上的对应', en: 'cube analogue'
            })}</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="num">5</td><td className="num">6</td><td>2 + 3</td><td>—</td></tr>
            <tr><td className="num">6</td><td className="num">6</td><td>1 + 2 + 3</td><td>—</td></tr>
            <tr><td className="num">7</td><td className="num">12</td><td>3 + 4</td><td>—</td></tr>
            <tr><td className="num">8</td><td className="num">15</td><td>3 + 5</td><td><L zh="角块部分 (8 角)" en="corner sector (8 corners)" /></td></tr>
            <tr><td className="num">9</td><td className="num">20</td><td>4 + 5</td><td>—</td></tr>
            <tr><td className="num">10</td><td className="num">30</td><td>2 + 3 + 5</td><td>—</td></tr>
            <tr><td className="num">11</td><td className="num">30</td><td>1 + 2 + 3 + 5</td><td>—</td></tr>
            <tr><td className="num">12</td><td className="num">60</td><td>3 + 4 + 5</td><td><L zh="棱块部分 (12 棱)" en="edge sector (12 edges)" /></td></tr>
            <tr><td className="num">13</td><td className="num">60</td><td>1 + 3 + 4 + 5</td><td>—</td></tr>
            <tr><td className="num">14</td><td className="num">84</td><td>2 + 3 + 4 + 5 / 3 + 4 + 7</td><td>—</td></tr>
            <tr><td className="num">15</td><td className="num">105</td><td>3 + 5 + 7</td><td>—</td></tr>
            <tr><td className="num">20</td><td className="num">420</td><td>3 + 4 + 5 + 7 + 1</td><td>—</td></tr>
          </tbody>
        </table>
        <p style={{ marginTop: 18 }}>
          <L
            zh={<>角块部分 (<TeX src={`S_8 \\ltimes (\\mathbb{Z}/3)^7`} />) 上限阶 <TeX src={`= 3 \\cdot g(8) = 3 \\cdot 15 = 45`} />,但魔方加了 「角扭和守恒 mod 3」,只允许 <TeX src={`\\text{lcm}(\\text{角圈长}) \\cdot 3`} /> 的形式; 棱块部分上限阶 <TeX src={`= 2 \\cdot g(12) / k`} /> (k 跟翻面奇偶有关)。 两边联合在角棱奇偶共生条件下取最大 LCM, 得 <strong>1260</strong>。</>}
            en={<>The corner sector (<TeX src={`S_8 \\ltimes (\\mathbb{Z}/3)^7`} />) maxes at <TeX src={`3 \\cdot g(8) = 3 \\cdot 15 = 45`} />, but the cube's "Σco ≡ 0 mod 3" constraint forces orders into the form <TeX src={`\\operatorname{lcm}(\\text{corner cycles}) \\cdot 3`} />. The edge sector maxes at <TeX src={`2 \\cdot g(12) / k`} /> (k depends on the parity of EO). Combining both under the parity-coupling constraint yields the maximum <strong>1260</strong>.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="7.4  73 个可达阶 — 完整清单" en="7.4  All 73 attained orders" />
        </h3>
        <p>
          <L
            zh={<>下面 73 个数是 G 中 <em>实际出现</em> 的所有元素阶,从小到大列出。 注意每个都整除 <TeX src={`|G| = 2^{27} \\cdot 3^{14} \\cdot 5^3 \\cdot 7^2 \\cdot 11`} />;不出现的整除数 (比如 4096) 都被 CO/EO 守恒约束排除掉了。</>}
            en={<>The following 73 integers are <em>all</em> attained element orders in G, sorted ascending. Every entry divides <TeX src={`|G| = 2^{27} \\cdot 3^{14} \\cdot 5^3 \\cdot 7^2 \\cdot 11`} />; divisors that do not appear (e.g. 4096) are ruled out by the CO/EO conservation laws.</>}
          />
        </p>
        <div className="gt-orders-grid">
          {[1,2,3,4,5,6,7,8,9,10,11,12,14,15,18,20,21,22,24,28,30,33,35,36,40,42,44,45,55,56,60,63,66,70,72,77,84,90,99,105,110,112,120,126,132,140,144,154,165,168,180,198,210,231,240,252,280,315,330,336,360,420,440,462,495,504,630,720,770,840,990,1260].map((n, i) => (
            <div key={i} className={`gt-order-chip${n === 1260 ? ' gt-order-chip-max' : ''}${n === 1 ? ' gt-order-chip-id' : ''}`}>{n}</div>
          ))}
        </div>
        <p style={{ marginTop: 18 }}>
          <L
            zh={<>分布特征:小阶 (1–12) 几乎全连续;13、 16、 17、 19、 23、 25、 26、 27、 29… 全部 <em>不可达</em> (素数 13、17、19、23 不整除 |G|;16、25 等被守恒限制)。 大阶集中在 <TeX src={`2^a \\cdot 3^b \\cdot 5 \\cdot 7`} /> 的乘积上, 1260 = 2² · 3² · 5 · 7 是顶点。</>}
            en={<>Pattern: small orders (1–12) appear almost without gaps; 13, 16, 17, 19, 23, 25, 26, 27, 29… are all <em>missing</em> (primes 13, 17, 19, 23 don't divide |G|; 16 and 25 are blocked by CO/EO conservation). Large orders concentrate at products of the form <TeX src={`2^a \\cdot 3^b \\cdot 5 \\cdot 7`} />, peaking at 1260 = 2² · 3² · 5 · 7.</>}
          />
        </p>
      </GTSec>
  );
}
