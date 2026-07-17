'use client';

import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { tr } from '@/i18n/tr';

function ScaleComparison() {
  // log10 values
  const items: { label: string; zh: string; en: string; log10: number; colour: string
 }[] = [
    { label: '1 thousand',         zh: '1 千',                en: '1 thousand',                  log10: 3,  colour: '#7BA88B' },
    { label: '1 million',          zh: '1 百万',              en: '1 million',                   log10: 6,  colour: '#7BA88B'
    },
    { label: 'world population',   zh: '世界人口 8 × 10⁹',     en: 'world population 8 × 10⁹',    log10: 9.9,colour: '#2A4D69' },
    { label: '1 trillion',         zh: '1 万亿',              en: '1 trillion',                  log10: 12, colour: '#2A4D69'
    },
    { label: 'stars in observable universe', zh: '可观宇宙恒星 ≈ 10²³', en: 'stars in observable universe', log10: 23, colour: '#B8860B'
    },
    { label: '|G| = 4.3 × 10¹⁹', zh: '|G| 魔方状态', en: '|G| cube states', log10: 19.6, colour: '#8B2E3C'
    },
    { label: 'atoms in a kilogram',zh: '1 公斤物质原子 ≈ 10²⁵', en: 'atoms in a kg of matter ≈ 10²⁵', log10: 25, colour: '#B8860B'
    },
    { label: 'age of universe in nanoseconds', zh: '宇宙年龄(纳秒) ≈ 10²⁶', en: 'age of universe (ns) ≈ 10²⁶', log10: 26, colour: '#B8860B'
    },
  ];
  // Sort ascending
  const sorted = [...items].sort((a, b) => a.log10 - b.log10);
  return (
    <div className="gt-scale">
      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 4 }}>
        {tr({ zh: '数量级对照 (log₁₀)', en: 'orders of magnitude (log₁₀)'
        })}
      </div>
      {sorted.map((it, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 70px', alignItems: 'center', gap: 12, padding: '6px 0', fontSize: 13, borderBottom: i < sorted.length - 1 ? '1px dashed var(--rule)' : 'none' }}>
          <div style={{ fontFamily: 'var(--mono)', color: it.colour, fontWeight: 600 }}>10<sup>{Math.round(it.log10)}</sup></div>
          <div style={{ color: 'var(--ink)' }}>{tr(it)}</div>
          <div style={{ background: it.colour, height: 8, borderRadius: 4, width: `${(it.log10 / 30) * 100}%` }} />
        </div>
      ))}
    </div>
  );
}

// ── Quotient chart (§10) ──────────────────────────────────────────────────

export default function ScaleComparisonSection() {
  const lang = useLang();
  return (
      <GTSec id="order" className="gt-sec">
        <div className="gt-sec-num">§4</div>
        <h2 className="gt-sec-title">
          <L zh="G 的阶 — 多少种状态?" en="The order |G| — how many states?" />
        </h2>
        <p>
          <L
            zh={<>如果魔方完全自由 (拆开重组、想拧就拧),状态数会是:</>}
            en={<>If the cube were fully free (disassemble and reassemble at will), the count would be:</>}
          />
        </p>
        <TeXBlock src={`|\\text{free cube}| \\;=\\; 8! \\cdot 12! \\cdot 3^8 \\cdot 2^{12} \\;=\\; 519{,}024{,}039{,}293{,}878{,}272{,}000`} />
        <p>
          <L
            zh={<>但 <em>没有</em> 拆装,只能转面 —— 这样会损失三条独立约束 (下一节细讲),每条砍掉一半状态:</>}
            en={<>But without disassembly, three independent constraints kick in (§5), each halving the state count:</>}
          />
        </p>
        <TeXBlock src={`|G| \\;=\\; \\frac{8! \\cdot 12! \\cdot 3^8 \\cdot 2^{12}}{3 \\cdot 2 \\cdot 2}`} />
        <div className="gt-big-number">
          <div className="gt-big-number-val">43,252,003,274,489,856,000</div>
          <div className="gt-big-number-label">|G| — order of the Rubik's cube group</div>
          <div className="gt-big-number-factor">
            <TeX src={`= 2^{27} \\cdot 3^{14} \\cdot 5^{3} \\cdot 7^{2} \\cdot 11`} />
          </div>
        </div>
        <p>
          <L
            zh={<>四千三百二十五京。如果你每秒看一个状态,看完 <strong>1.37 万亿年</strong>,远超宇宙年龄。每秒看十亿个,也要 <strong>1370 年</strong>。</>}
            en={<>Forty-three quintillion. At one state per second, it would take <strong>1.37 trillion years</strong>, dwarfing the age of the universe. At a billion states per second, still <strong>1,370 years</strong>.</>}
          />
        </p>
        <div className="gt-pullquote">
          <L
            zh={<>「魔方的全部状态,排成一行,可以从地球铺到太阳 256 次。」</>}
            en={<>"You can lay out all cube positions, one millimetre apart, and the line stretches from Earth to the Sun two hundred and fifty-six times over."</>}
          />
          <div className="gt-pullquote-cite">— scale of |G|</div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="4.1  数量级对照" en="4.1  Sense of scale" />
        </h3>
        <p>
          <L
            zh={<>4.3 × 10¹⁹ 究竟有多大?把它对数化,放进熟悉的数列里:</>}
            en={<>How big is 4.3 × 10¹⁹? Plotted on a logarithmic scale among familiar quantities:</>}
          />
        </p>
        <ScaleComparison />
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="4.2  质因数分解 — 为什么群论喜欢这个数字" en="4.2  Prime factorization — why group theorists love this number" />
        </h3>
        <TeXBlock src={`|G| \\;=\\; 2^{27} \\cdot 3^{14} \\cdot 5^{3} \\cdot 7^{2} \\cdot 11`} />
        <p>
          <L
            zh={<>这个分解告诉我们 G 的 <strong>Sylow 子群</strong> 结构 —— 群论里最强的「显微镜」之一。每个 <em>p</em>-Sylow 子群对应 |G| 中 <em>p</em>-部分:</>}
            en={<>This factorization determines the <strong>Sylow subgroups</strong> of G — one of group theory's sharpest microscopes. For each prime <em>p</em>, the <em>p</em>-Sylow subgroup captures the <em>p</em>-part of |G|:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><TeX src={`P_2`} />: <L zh={<>2-Sylow 子群,阶 <TeX src={`2^{27} = 134{,}217{,}728`} />。 包含所有半圈方块</>} en={<>2-Sylow, order <TeX src={`2^{27} = 134{,}217{,}728`} />. Contains all half-turn squares</>} /></li>
          <li><TeX src={`P_3`} />: <L zh={<>3-Sylow 子群,阶 <TeX src={`3^{14} = 4{,}782{,}969`} />。 包含所有 3-循环</>} en={<>3-Sylow, order <TeX src={`3^{14} = 4{,}782{,}969`} />. Contains all 3-cycles</>} /></li>
          <li><TeX src={`P_5`} />: <L zh={<>5-Sylow 子群,阶 <TeX src={`5^3 = 125`} /></>} en={<>5-Sylow, order <TeX src={`5^3 = 125`} /></>} /></li>
          <li><TeX src={`P_7`} />: <L zh={<>7-Sylow 子群,阶 <TeX src={`7^2 = 49`} /></>} en={<>7-Sylow, order <TeX src={`7^2 = 49`} /></>} /></li>
          <li><TeX src={`P_{11}`} />: <L zh={<>11-Sylow 子群,阶 11</>} en={<>11-Sylow, order 11</>} /></li>
        </ul>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '为什么有 11 出现?', en: 'Why does 11 appear?'
        })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>11 是 ≤ 12 的最大素数 — 它来自 <strong>S₁₂</strong> 中的 11-循环 (12 个棱块上)。如果某个 11-阶元素被还原,意味着 11 个棱块被循环 (剩 1 个不动)。这种 11-循环在 G 中真实存在,数学上称为 <strong>11-阶元素</strong>。</>}
              en={<>11 is the largest prime ≤ 12 — it arises from an <strong>11-cycle in S₁₂</strong> (the symmetric group of the 12 edges). Some element of G cycles 11 edges while leaving 1 fixed. Such 11-order elements exist and are concrete witnesses of the prime 11 in |G|.</>}
            />
          </div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="4.3  时间尺度" en="4.3  Time scales" />
        </h3>
        <table className="gt-compare">
          <thead>
            <tr>
              <th>{tr({ zh: '速率', en: 'Rate' })}</th>
              <th>{tr({ zh: '看完所有状态所需时间', en: 'Time to enumerate all states'
            })}</th>
              <th>{tr({ zh: '对照', en: 'Comparable to'
            })}</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>1 / second</td><td className="num">1.37 × 10¹² <L zh="年" en="years" /></td><td>100 × <L zh="宇宙年龄" en="age of universe" /></td></tr>
            <tr><td>1 / millisecond</td><td className="num">1.37 × 10⁹ <L zh="年" en="years" /></td><td><L zh="地球年龄 × 1/3" en="1/3 the age of Earth" /></td></tr>
            <tr><td>1 / microsecond</td><td className="num">1.37 × 10⁶ <L zh="年" en="years" /></td><td><L zh="智人诞生以来 × 5" en="5 × time since Homo sapiens" /></td></tr>
            <tr><td>1 / nanosecond</td><td className="num">1370 <L zh="年" en="years" /></td><td><L zh="罗马帝国到今天" en="Rome to today" /></td></tr>
            <tr><td>1 / picosecond (10¹²/s)</td><td className="num">501 <L zh="天" en="days" /></td><td>—</td></tr>
            <tr><td>1 / femtosecond</td><td className="num">12 <L zh="小时" en="hours" /></td><td><L zh="一个工作日" en="a workday" /></td></tr>
          </tbody>
        </table>
        <p>
          <L
            zh={<>即便用最快的计算机硬件 (10¹⁵ 操作/秒, 即 PFlops 级超算),完整枚举一遍 G 仍需 12 小时左右。这就是为什么 God's number 的证明用了 35 CPU 年 (依赖海量对称等价化简) —— §11 详述。</>}
            en={<>Even at petaflop scale (10¹⁵ ops/sec), enumerating G outright takes about half a day. This is why the proof of God's number consumed 35 CPU-years and relied on aggressive symmetry reductions — see §11.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="4.4  |G| 的素因子分解" en="4.4  Prime factorisation of |G|" />
        </h3>
        <p>
          <L
            zh={<>整理上面的乘积:</>}
            en={<>Collecting the product above:</>}
          />
        </p>
        <TeXBlock src={`|G| \\;=\\; \\frac{8! \\cdot 3^7 \\cdot 12! \\cdot 2^{11}}{2} \\;=\\; 2^{27} \\cdot 3^{14} \\cdot 5^3 \\cdot 7^2 \\cdot 11.`} />
        <p>
          <L
            zh={<>这是非常 「干净」 的分解 — 只用了 <strong>5 个最小素数</strong>, 没有 13、 17、 19 等大素数。 这一限制来自 8! 和 12! 的素因子: <TeX src={`8! = 2^7 \\cdot 3^2 \\cdot 5 \\cdot 7`} />, <TeX src={`12! = 2^{10} \\cdot 3^5 \\cdot 5^2 \\cdot 7 \\cdot 11`} />。 11 是出现的最大素因子 (因为 <TeX src={`13 > 12`} />)。</>}
            en={<>This is an extremely "clean" factorisation — using only the <strong>5 smallest primes</strong>, with no 13, 17, 19, etc. The bound comes from the prime factorisations <TeX src={`8! = 2^7 \\cdot 3^2 \\cdot 5 \\cdot 7`} /> and <TeX src={`12! = 2^{10} \\cdot 3^5 \\cdot 5^2 \\cdot 7 \\cdot 11`} />. The 11 is the largest prime factor (since <TeX src={`13 > 12`} />).</>}
          />
        </p>
        <div className="gt-prime-grid">
          {[
            { p: 2, exp: 27, val: '134,217,728', share: 0.625, src: '7 + 10 + 11 − 1' },
            { p: 3, exp: 14, val: '4,782,969', share: 0.21, src: '2 + 5 + 7' },
            { p: 5, exp: 3, val: '125', share: 0.07, src: '1 + 2' },
            { p: 7, exp: 2, val: '49', share: 0.05, src: '1 + 1' },
            { p: 11, exp: 1, val: '11', share: 0.025, src: '0 + 1' },
          ].map(({ p, exp, val, share, src }) => (
            <div key={p} className="gt-prime-card">
              <div className="gt-prime-card-head">
                <span className="gt-prime-card-base">{p}</span>
                <span className="gt-prime-card-exp">{exp}</span>
              </div>
              <div className="gt-prime-card-val">{val}</div>
              <div className="gt-prime-card-bar"><span style={{ width: `${share * 100}%` }} /></div>
              <div className="gt-prime-card-foot">{lang === 'zh' ? `来自 ${src}` : `from ${src}`}</div>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 18 }}>
          <L
            zh={<>验证: <TeX src={`2^{27} \\cdot 3^{14} \\cdot 5^3 \\cdot 7^2 \\cdot 11 = 4.325 \\times 10^{19}`} /> ✓。 这套素因子结构还决定了 §7 中元素的可达阶 (必整除 |G|) — 没有 13、 17、 19 等素数, 所以魔方上 <em>不存在</em> 阶为 13 或 17 的元素。</>}
            en={<>Verify: <TeX src={`2^{27} \\cdot 3^{14} \\cdot 5^3 \\cdot 7^2 \\cdot 11 = 4.325 \\times 10^{19}`} /> ✓. This prime structure also constrains §7's attainable element orders (every divisor of |G|) — since 13, 17, 19 don't appear, there is <em>no</em> cube element of order 13 or 17.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="4.5  其它拼图的阶 — 比较表" en="4.5  Order comparison across puzzles" />
        </h3>
        <table className="gt-puzzle-order-tbl">
          <thead>
            <tr>
              <th>{tr({ zh: '拼图', en: 'puzzle'
            })}</th>
              <th>|G|</th>
              <th>{tr({ zh: '十进制', en: 'decimal'
            })}</th>
              <th>{tr({ zh: '相对 3×3', en: 'vs 3×3'
            })}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{lang === 'zh' ? '2×2×2 (Pocket)' : '2×2×2 (Pocket)'}</td>
              <td><TeX src={`\\dfrac{7! \\cdot 3^6}{1}`} /></td>
              <td className="num">3,674,160</td>
              <td className="num">~10<sup>-13</sup></td>
            </tr>
            <tr>
              <td>{tr({ zh: '3×3×3 (本文主角)', en: '3×3×3 (this article)' })}</td>
              <td><TeX src={`\\dfrac{8! \\cdot 3^7 \\cdot 12! \\cdot 2^{11}}{2}`} /></td>
              <td className="num">4.33 × 10<sup>19</sup></td>
              <td className="num">1.00</td>
            </tr>
            <tr>
              <td>{lang === 'zh' ? '4×4×4 (Rubik\'s Revenge)' : '4×4×4 (Rubik\'s Revenge)'}</td>
              <td><TeX src={`\\dfrac{8! \\cdot 3^7 \\cdot 24!^2}{4!^{6} \\cdot 24}`} /></td>
              <td className="num">7.40 × 10<sup>45</sup></td>
              <td className="num">1.7 × 10<sup>26</sup></td>
            </tr>
            <tr>
              <td>{lang === 'zh' ? '5×5×5 (Professor)' : '5×5×5 (Professor)'}</td>
              <td><TeX src={`\\sim 8!\\cdot 3^7\\cdot 12!\\cdot 2^{10}\\cdot 24!^2\\cdot \\tfrac{24!^2}{4!^{12}}`} /></td>
              <td className="num">2.83 × 10<sup>74</sup></td>
              <td className="num">6.5 × 10<sup>54</sup></td>
            </tr>
            <tr>
              <td>{tr({ zh: 'Megaminx (12 面)', en: 'Megaminx (12 faces)' })}</td>
              <td><TeX src={`\\dfrac{20!\\cdot 30!\\cdot 3^{19}\\cdot 2^{29}}{60}`} /></td>
              <td className="num">1.01 × 10<sup>68</sup></td>
              <td className="num">2.3 × 10<sup>48</sup></td>
            </tr>
            <tr>
              <td>{tr({ zh: 'Pyraminx (四面体)', en: 'Pyraminx (tetrahedron)'
            })}</td>
              <td><TeX src={`\\dfrac{6!\\cdot 3^4 \\cdot 3^4}{2}`} /></td>
              <td className="num">75,582,720</td>
              <td className="num">~10<sup>-12</sup></td>
            </tr>
            <tr>
              <td>{lang === 'zh' ? 'Square-1' : 'Square-1'}</td>
              <td><TeX src={`\\sim 2 \\cdot 8! \\cdot 8! \\cdot 6`} /></td>
              <td className="num">1.55 × 10<sup>10</sup></td>
              <td className="num">~10<sup>-10</sup></td>
            </tr>
            <tr>
              <td>{lang === 'zh' ? 'Skewb' : 'Skewb'}</td>
              <td><TeX src={`\\dfrac{8! \\cdot 3^4}{12}`} /></td>
              <td className="num">3,149,280</td>
              <td className="num">~10<sup>-13</sup></td>
            </tr>
          </tbody>
        </table>
        <p style={{ marginTop: 18 }}>
          <L
            zh={<>有趣观察:Pyraminx 跟 Pocket 量级相同 (约 10<sup>7</sup>),Square-1 比 Pocket 大三个数量级。 4×4 是 3×3 平方再乘几个常数,但「中心可换 + 同色棱可换」 让人在求 |G| 时常常翻车 (要 ÷ 4!<sup>6</sup> 中心、 再 ÷ 24 整体)。 Megaminx 「12 面」 量级让 5×5 还小一些, 这是因为它每面只有 11 个非中心块 (角 + 棱)。</>}
            en={<>Notable observations: Pyraminx and Pocket are roughly the same order (~10<sup>7</sup>); Square-1 is three orders bigger than Pocket. The 4×4 squares the 3×3 plus extra constants — but the "indistinguishable centres + edge pairs" make computing |G| error-prone (need to divide by 4!<sup>6</sup> for centres and another 24 for orientation). Megaminx (12 faces) edges out the 5×5 in absolute count, since it has fewer cubies per face than the 5×5.</>}
          />
        </p>
      </GTSec>
  );
}
