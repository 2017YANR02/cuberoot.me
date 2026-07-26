'use client';

/**
 * /math/lsll — LSLL(最后一槽 + 顶层)情况计数长文。
 *
 * 严格推导 583,284:原始态 (5!·5!/2)·3⁴·2⁴ = 9,331,200 → 两侧 AUF 的 Z4×Z4 商 → Burnside。
 * 三类(再商 mid-AUF)实测非良定义:mid 依赖所选 ZBLS 公式,详见 §3。并对齐 42 大类账本与
 * /alg/lsll 页那条 288×7776/4 + (3916+3888)×3 速记式。与 /alg/lsll 双向链接。
 *
 * 与 /math/probability(末层 62,208 态的 AUF 概率)同源,是它在"最后一槽"上的推广。
 */
import Link from '@/components/AppLink';
import { ArrowLeft, Boxes } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { TeX, TeXBlock } from '@/components/math/Tex';
import { useT } from '@/hooks/useT';
import { T } from '@/i18n/tr';
import './lsll_math.css';

const R = String.raw;

function Block({ src }: { src: string }) {
  return <div className="lmath-formula"><TeXBlock src={src} /></div>;
}

export default function LsllMathPage() {
  const t = useT();
  useDocumentTitle('LSLL 情况计数', 'Counting LSLL cases');

  return (
    <div className="lmath-page">
      <header className="lmath-header">
        <Link href="/math" className="lmath-back">
          <ArrowLeft size={16} />
          <span>{t('返回 数学', 'Back to Math')}</span>
        </Link>
        <Link href="/alg/lsll" className="lmath-header-link">
          <Boxes size={15} />
          <span>{t('LSLL 公式集', 'LSLL algorithms')}</span>
        </Link>
      </header>

      <main className="lmath-main">
        <section className="lmath-hero">
          <div className="lmath-eyebrow">{t('数学 群论 组合计数', 'Mathematics Group Theory Enumeration')}</div>
          <h1 className="lmath-title">
            {t('LSLL 到底有多少个 case', 'How many LSLL cases are there')}
            <span className="lmath-title-sub">
              {t('583,284 的严格推导:原始态 → 两侧 AUF 商 → Burnside',
                 '583,284 from first principles: raw states → two-sided AUF quotient → Burnside')}
            </span>
          </h1>
          <p className="lmath-lead">
            <T
              zh={<>LSLL(Last Slot and Last Layer)= 一步解掉<strong>最后一槽 + 整个顶层</strong>。
                「一个 case」的定义里藏着一个群作用:开始前、结束后各允许转一下 U 层(pre-AUF / post-AUF),
                case 不变 —— 这是 <TeX src={R`\mathbb{Z}_4\times\mathbb{Z}_4`} />(16 元)。把 9,331,200 个物理态
                按这个作用归并,轨道数就是 case 数。下面一步步算清楚;<strong>§3</strong> 再看把 LSLL 拆成
                ZBLS + ZBLL 之后冒出来的<strong>第三个 AUF</strong> —— 为什么不能拿它再商一次,以及正确的数法
                (<strong>306 × 494 = 151,164</strong>)。
                本文是 <Link href="/math/probability">{t('末层 AUF 概率', 'last-layer AUF probability')}</Link> 一页在「最后一槽」上的推广。</>}
              en={<>LSLL (Last Slot and Last Layer) means solving the <strong>last slot and the whole top layer</strong> in
                one look. The definition of “one case” hides a group action: a U turn is allowed before and after the
                algorithm (pre-AUF / post-AUF) without changing the case — an action of <TeX src={R`\mathbb{Z}_4\times\mathbb{Z}_4`} /> (16
                elements). Collapsing the 9,331,200 physical states under it gives the case count. We derive it step by
                step; <strong>§3</strong> then looks at the <strong>third AUF</strong> that appears once LSLL is split into ZBLS + ZBLL —
                why you must not quotient by it, and what the right count is (<strong>306 × 494 = 151,164</strong>). This is the{' '}
                <Link href="/math/probability">{t('末层 AUF 概率', 'last-layer AUF probability')}</Link> page extended to the last slot.</>}
            />
          </p>

          <div className="lmath-numbers">
            <div className="lmath-num-card">
              <div className="lmath-num">9,331,200</div>
              <div className="lmath-num-label">{t('原始物理态', 'raw physical states')}</div>
            </div>
            <div className="lmath-num-card">
              <div className="lmath-num">583,284</div>
              <div className="lmath-num-label">{t('二类:商 pre + post = case 数', 'class 2: pre + post = # cases')}</div>
            </div>
            <div className="lmath-num-card">
              <div className="lmath-num">151,164</div>
              <div className="lmath-num-label">{t('三类:两步路线 306 × 494(见三)', 'class 3: two-look routes, 306 × 494 (§3)')}</div>
            </div>
            <div className="lmath-num-card">
              <div className="lmath-num">42</div>
              <div className="lmath-num-label">{t('槽对构型大类', 'pair-config families')}</div>
            </div>
          </div>
        </section>

        {/* ── §1 raw ── */}
        <section className="lmath-section">
          <h2 className="lmath-h2">{t('一、状态空间与原始计数', '1. State space and the raw count')}</h2>
          <p className="lmath-body">
            <T
              zh={<><strong>在动的块</strong>:最后一槽的 DFR 角、FR 棱,加顶层 4 角 4 棱 —— 合计 <strong>5 个角、5 个棱</strong>,
                分布在各自的 5 个位置(4 顶位 + 1 槽位)。其余块(十字 + 前三槽)全部锁死为恒等。三条全局约束:</>}
              en={<><strong>Pieces in play</strong>: the DFR corner and FR edge of the last slot, plus the 4 corners and 4 edges of
                the top layer — <strong>5 corners and 5 edges</strong> over their 5 positions each (4 on top + 1 slot). Everything
                else (cross + first three slots) is frozen to the identity. Three global constraints:</>}
            />
          </p>
          <ul className="lmath-body">
            <li><T
              zh={<><strong>置换奇偶</strong>:整方块 <TeX src={R`\operatorname{sgn}(\text{角}) = \operatorname{sgn}(\text{棱})`} />;
                锁死块偶,故 <TeX src={R`\operatorname{sgn}(5\text{角}) = \operatorname{sgn}(5\text{棱})`} />,得 <TeX src={R`\tfrac{5!\,5!}{2}=7200`} />。</>}
              en={<><strong>Permutation parity</strong>: overall <TeX src={R`\operatorname{sgn}(\text{corners}) = \operatorname{sgn}(\text{edges})`} />;
                frozen pieces are even, so <TeX src={R`\operatorname{sgn}(5\text{ corners}) = \operatorname{sgn}(5\text{ edges})`} />, giving <TeX src={R`\tfrac{5!\,5!}{2}=7200`} />.</>}
            /></li>
            <li><T
              zh={<><strong>角向</strong>:8 角总扭 <TeX src={R`\equiv 0 \pmod 3`} />,3 个锁死角为 0,故 <TeX src={R`3^5/3=3^4=81`} />。</>}
              en={<><strong>Corner twist</strong>: total <TeX src={R`\equiv 0 \pmod 3`} /> over 8 corners, 3 frozen at 0, so <TeX src={R`3^5/3=3^4=81`} />.</>}
            /></li>
            <li><T
              zh={<><strong>棱向</strong>:12 棱总翻 <TeX src={R`\equiv 0 \pmod 2`} />,同理 <TeX src={R`2^5/2=2^4=16`} />。</>}
              en={<><strong>Edge flip</strong>: total <TeX src={R`\equiv 0 \pmod 2`} /> over 12 edges, likewise <TeX src={R`2^5/2=2^4=16`} />.</>}
            /></li>
          </ul>
          <Block src={R`N_{\text{raw}}=\frac{5!\cdot 5!}{2}\cdot 3^{4}\cdot 2^{4}=7200\cdot 81\cdot 16=9{,}331{,}200 .`} />
        </section>

        {/* ── §2 equivalence ── */}
        <section className="lmath-section">
          <h2 className="lmath-h2">{t('二、等价关系:两侧 AUF = Z₄ × Z₄', '2. The equivalence: two-sided AUF = Z₄ × Z₄')}</h2>
          <p className="lmath-body">
            <T
              zh={<>把打乱看成 cube group 里的元 <TeX src="g" />。用公式 <TeX src="A" /> 解、首尾各允许垫一个顶转,
                意味着可用 <TeX src={R`A=U^{i}g^{-1}U^{j}`} />,于是</>}
              en={<>View a scramble as an element <TeX src="g" /> of the cube group. Solving with <TeX src="A" /> while allowing a U
                before and after means <TeX src={R`A=U^{i}g^{-1}U^{j}`} />, hence</>}
            />
          </p>
          <Block src={R`g \;\sim\; U^{k}\,g\,U^{l},\qquad k,l\in\mathbb{Z}_4 .`} />
          <p className="lmath-body">
            <T
              zh={<>这是两个<strong>互相交换</strong>的 <TeX src={R`\mathbb{Z}_4`} /> 作用,合成 <TeX src={R`\mathbb{Z}_4\times\mathbb{Z}_4`} />(16 阶):</>}
              en={<>These are two <strong>commuting</strong> <TeX src={R`\mathbb{Z}_4`} /> actions, together <TeX src={R`\mathbb{Z}_4\times\mathbb{Z}_4`} /> (order 16):</>}
            />
          </p>
          <ul className="lmath-body">
            <li><T
              zh={<><strong><TeX src={R`T_{\text{phys}}`} />(左乘 <TeX src="U" />,post-AUF)</strong>:物理转顶层,把 4 顶位的
                <strong>内容</strong>循环移一格;槽块不动,朝向不变(绕 U/D 轴既不扭角也不翻棱)。</>}
              en={<><strong><TeX src={R`T_{\text{phys}}`} /> (left-mult by <TeX src="U" />, post-AUF)</strong>: physically turns the top,
                cycling the <strong>contents</strong> of the 4 top slots; slot pieces and orientations are untouched.</>}
            /></li>
            <li><T
              zh={<><strong><TeX src={R`T_{\text{home}}`} />(右乘 <TeX src="U" />,pre-AUF)</strong>:在还原态上先转一下 =
                重标「哪个位算 home」,<strong>只换身份标签不搬块</strong>。</>}
              en={<><strong><TeX src={R`T_{\text{home}}`} /> (right-mult by <TeX src="U" />, pre-AUF)</strong>: a U on the solved state =
                relabelling which slot is “home”, <strong>renaming identities without moving anything</strong>.</>}
            /></li>
          </ul>
          <p className="lmath-body">
            <T
              zh={<>一个 case = 这 16 元作用下的一条<strong>轨道</strong>。哪个叫 pre、哪个叫 post 是约定;
                下面会看到只商任意单侧,结果一样,所以计数不依赖这个约定。</>}
              en={<>A case is an <strong>orbit</strong> under these 16 elements. Which action is “pre” vs “post” is a convention;
                quotienting by either single factor gives the same number, so the count does not depend on it.</>}
            />
          </p>
        </section>

        {/* ── §3 single quotient ── */}
        <section className="lmath-section">
          <h2 className="lmath-h2">{t('三、三个 AUF:pre / mid / post', '3. Three AUFs: pre / mid / post')}</h2>
          <div className="lmath-note">
            <T
              zh={<><strong>「商」在魔方里是什么?</strong>把「我们认作同一 case」的态捏成一个点来数。起手 / 收尾多转一下 U
                不产生新的公式需求,这些态属于同一条<strong>轨道</strong>;商空间(轨道集 <TeX src={R`G\backslash X`} />)的大小 =
                真正不同的 case 数。一句话:<strong>数 case = 数轨道,不是数态</strong>。</>}
              en={<><strong>What does “quotient” mean here?</strong> It collapses the states we agree are the same case into one point.
                A stray U before or after needs no new algorithm, so those states share one <strong>orbit</strong>; the size of the
                quotient (the orbit set <TeX src={R`G\backslash X`} />) is the number of genuinely distinct cases. In short:
                <strong> counting cases = counting orbits, not states</strong>.</>}
            />
          </div>
          <p className="lmath-body">
            <T
              zh={<>把 LSLL 拆成速拧实际的两段 —— 先 <strong>ZBLS</strong>(解掉最后一槽、顺手翻正顶层棱),再 <strong>ZBLL</strong>(一步解掉顶层)——
                中间还能垫一个顶转。于是完整解法长这样,共<strong>三个</strong> AUF:</>}
              en={<>Split LSLL the way speedcubers actually do — first <strong>ZBLS</strong> (finish the last slot, orienting the top edges on the way),
                then <strong>ZBLL</strong> (one-shot last layer) — with a spare top turn in between. A full solution carries <strong>three</strong> AUFs:</>}
            />
          </p>
          <Block src={R`g\cdot \underbrace{U^{a}}_{\text{pre}}\cdot Z \cdot \underbrace{U^{m}}_{\text{mid}} \cdot L \cdot \underbrace{U^{p}}_{\text{post}} = e .`} />
          <ul className="lmath-body">
            <li><T
              zh={<><strong>pre-AUF</strong>:认图前转顶层。在状态上 = <strong>右乘 <TeX src="U" /></strong>。</>}
              en={<><strong>pre-AUF</strong>: turning the top before recognising. On states this is <strong>right-multiplication by <TeX src="U" /></strong>.</>}
            /></li>
            <li><T
              zh={<><strong>mid-AUF</strong>:ZBLS 做完、ZBLL 之前的那一下。</>}
              en={<><strong>mid-AUF</strong>: the turn after ZBLS and before ZBLL.</>}
            /></li>
            <li><T
              zh={<><strong>post-AUF</strong>:做完这一下魔方就完全还原。在状态上 = <strong>左乘 <TeX src="U" /></strong>。</>}
              en={<><strong>post-AUF</strong>: after it the cube is solved. On states this is <strong>left-multiplication by <TeX src="U" /></strong>.</>}
            /></li>
          </ul>
          <p className="lmath-body">
            <T
              zh={<>pre 和 post 是状态空间上的<strong>规范</strong>作用:一个右乘、一个左乘,互相交换,合起来正是 §2 的
                <TeX src={R`\;\mathbb{Z}_4\times\mathbb{Z}_4`} /> —— 二类计数 583,284 就是它的轨道数(§4)。
                <strong>mid 不是</strong>:一个置换只有左右两侧,「第三个 AUF」必须借 ZBLS/ZBLL 的两段拆分才有定义。把它翻译到状态上,得到的是</>}
              en={<>pre and post are <strong>canonical</strong> actions on the state space: one right-, one left-multiplication, and they commute — exactly the
                <TeX src={R`\;\mathbb{Z}_4\times\mathbb{Z}_4`} /> of §2, whose orbit count is the 583,284 of §4.
                <strong>mid is not</strong>: a permutation has only two sides, so a “third AUF” needs the ZBLS/ZBLL split to even be defined. Translated back to states it reads</>}
            />
          </p>
          <Block src={R`s \;\longmapsto\; s\cdot\bigl(W\,U^{-k}\,W^{-1}\bigr),\qquad W=U^{a}Z .`} />
          <p className="lmath-body">
            <T
              zh={<>作用里明晃晃地含着 <TeX src="Z" /> —— <strong>你选哪条 ZBLS 公式,mid 就是什么作用</strong>。这不是记号问题,是实打实的后果。</>}
              en={<>The action visibly contains <TeX src="Z" /> — <strong>whichever ZBLS algorithm you pick, that is what mid does</strong>. This is not a notational quibble; it has teeth.</>}
            />
          </p>

          <h3 className="lmath-body" style={{ fontWeight: 700, color: 'var(--foreground)', marginBottom: 4 }}>
            {t('结构:哪一部分是硬的', 'Structure: which part is rock-solid')}
          </h3>
          <p className="lmath-body">
            <T
              zh={<>记 <TeX src={R`\Phi`} /> 为 ZBLS 构型空间(槽角的位置与扭、槽棱的位置与翻、其余 4 个棱位的 EO),
                <TeX src={R`|\Phi|=5\cdot3\times5\cdot2\times\tfrac{2^{5}}{2}=1200`} />。pre-AUF 作用在它上面,Burnside 给 <strong>306</strong> 个 ZBLS 大类
                —— 站内 zbls 公式集恰好 <strong>305 = 306 − 全解态</strong>,自洽。轨道谱:</>}
              en={<>Let <TeX src={R`\Phi`} /> be the ZBLS configuration space (slot corner’s position and twist, slot edge’s position and flip, and the EO of the other 4 edge slots),
                <TeX src={R`|\Phi|=5\cdot3\times5\cdot2\times\tfrac{2^{5}}{2}=1200`} />. pre-AUF acts on it; Burnside gives <strong>306</strong> ZBLS families
                — and the site’s zbls set holds exactly <strong>305 = 306 − solved</strong>. Its orbit spectrum:</>}
            />
          </p>
          <Block src={R`4\cdot 297+2\cdot 3+1\cdot 6=1200,\qquad 297+3+6=306 .`} />
          <p className="lmath-body">
            <T
              zh={<>固定一条 <TeX src={R`Z_\varphi`} /> 后,每个 fiber(<TeX src={R`9{,}331{,}200/1200=7776`} /> 个态)与 ZBLL 态空间一一对应,
                其上 mid = 右乘 <TeX src="U" />、post = 左乘 <TeX src="U" />,双侧商 = <strong>494</strong>(= 通行的 ZBLL 493 + 全解态)。于是:</>}
              en={<>Once a <TeX src={R`Z_\varphi`} /> is fixed, each fiber (<TeX src={R`9{,}331{,}200/1200=7776`} /> states) matches the ZBLL state space, on which
                mid = right-<TeX src="U" /> and post = left-<TeX src="U" />, with two-sided quotient <strong>494</strong> (= the usual ZBLL 493 + solved). Hence:</>}
            />
          </p>
          <ul className="lmath-body">
            <li><T
              zh={<>对 <strong>297 个自由</strong>大类,pre 被完全吸收,fiber 里只剩 mid 与 post,每类贡献恰 494 —— <strong>与公式选择无关</strong>:
                <TeX src={R`\;297\times494=146{,}718`} />。</>}
              en={<>For the <strong>297 free</strong> families, pre is fully absorbed and only mid and post remain inside the fiber, contributing exactly 494 each
                — <strong>independent of any algorithm choice</strong>: <TeX src={R`\;297\times494=146{,}718`} />.</>}
            /></li>
            <li><T
              zh={<>对<strong>剩下 9 个</strong>有 pre-AUF 对称的大类,stabilizer 会在 fiber 上多诱导一个「右乘
                <TeX src={R`\;V=Z^{-1}U^{k}Z`} />」,而 <TeX src="V" /> 直接依赖 <TeX src="Z" />。</>}
              en={<>For the <strong>remaining 9</strong> families with pre-AUF symmetry, the stabiliser induces one more action on the fiber, “right-multiply by
                <TeX src={R`\;V=Z^{-1}U^{k}Z`} />”, and <TeX src="V" /> depends directly on <TeX src="Z" />.</>}
            /></li>
          </ul>

          <h3 className="lmath-body" style={{ fontWeight: 700, color: 'var(--foreground)', marginBottom: 4 }}>
            {t('实测:拿 mid 再商一次会漂', 'Measured: quotienting by mid drifts')}
          </h3>
          <p className="lmath-body">
            <T
              zh={<>取同一个对称大类,把公式换成另一条<strong>同样合法</strong>的(只在尾部接一条末层公式,它照样解掉该 ZBLS 构型),轨道数就变:</>}
              en={<>Take one symmetric family and swap in another <strong>equally valid</strong> algorithm (append a last-layer alg — it still solves that ZBLS configuration). The orbit count moves:</>}
            />
          </p>
          <div className="lmath-table-wrap">
            <table className="lmath-table">
              <thead>
                <tr>
                  <th><T zh="大类 / 所用 ZBLS 公式" en="family / ZBLS algorithm used" /></th>
                  <th className="is-num"><T zh="轨道数" en="orbits" /></th>
                </tr>
              </thead>
              <tbody>
                <tr><td>O / I:<code>F R U R&apos; U&apos; F&apos;</code></td><td className="is-num">19</td></tr>
                <tr><td>{t('同上 + Sune', 'same + Sune')}</td><td className="is-num">62</td></tr>
                <tr><td>{t('同上 + T-perm', 'same + T-perm')}</td><td className="is-num">89</td></tr>
                <tr><td>D+ / D L:<code>U F&apos; (L&apos; U2 L U&apos;)2 F</code></td><td className="is-num">127</td></tr>
                <tr><td>{t('同上 + U-perm', 'same + U-perm')}</td><td className="is-num">494</td></tr>
              </tbody>
            </table>
          </div>
          <p className="lmath-body">
            <T
              zh={<>最后一行值得盯住:<strong>换对公式,轨道数会回到满格 494</strong>。这不是巧合,下面会证明它对九个对称大类全部成立。</>}
              en={<>Watch the last row: <strong>with the right algorithm the count climbs back to the full 494</strong>. Not a coincidence — below we show it holds for all nine symmetric families.</>}
            />
          </p>

          <h3 className="lmath-body" style={{ fontWeight: 700, color: 'var(--foreground)', marginBottom: 4 }}>
            {t('正确的数法:不商,而是乘', 'The right count: multiply, don’t quotient')}
          </h3>
          <p className="lmath-body">
            <T
              zh={<>毛病出在硬把 mid 塞成「局面之间的等价关系」。局面是死的 —— 你插不插那一下 <TeX src="U" />,魔方摆在那儿一动不动;
                mid 发生在<strong>解法</strong>上,不发生在局面上。两步解法里真正在变的,是<strong>一对图</strong>:
                先认出一个 ZBLS case,做完之后看到一个 ZBLL case。这两个集合各自都跟公式无关,于是</>}
              en={<>The mistake is forcing mid into an equivalence between <em>states</em>. A state does not budge when you insert that
                <TeX src={R`\;U`} /> — mid happens to the <strong>solution</strong>, not to the cube. What actually varies across a two-look solve is a
                <strong> pair of pictures</strong>: the ZBLS case you recognise first, the ZBLL case you meet second. Both sets are algorithm-free, so</>}
            />
          </p>
          <Block src={R`N_3=\underbrace{306}_{\text{ZBLS}}\times\underbrace{494}_{\text{ZBLL}}=151{,}164 .`} />
          <p className="lmath-body">
            <T
              zh={<>306 = <TeX src={R`\Phi`} /> 模 pre-AUF(上面刚算过),494 = 7776 个 ZBLL 态模两侧 AUF。
                <strong>每一个组合都真会发生</strong>:固定任意一条 <TeX src={R`Z_\varphi`} />,它的 fiber 打满整个 ZBLL 空间 ——
                所以这个乘积对<strong>任何</strong>公式表都给同一个数。扣掉「全部已解」那一格 = <strong>151,163</strong>。</>}
              en={<>306 is <TeX src={R`\Phi`} /> mod pre-AUF (computed just above); 494 is the 7776 ZBLL states mod both AUFs.
                <strong> Every combination really occurs</strong>: fix any <TeX src={R`Z_\varphi`} /> and its fiber covers the whole ZBLL space —
                so the product is the same number for <strong>any</strong> algorithm set. Drop the fully-solved cell and it is <strong>151,163</strong>.</>}
            />
          </p>

          <h3 className="lmath-body" style={{ fontWeight: 700, color: 'var(--foreground)', marginBottom: 4 }}>
            {t('佐证一:同一构造在末层上复现社区数字', 'Check 1: the same construction reproduces the community’s LL numbers')}
          </h3>
          <p className="lmath-body">
            <T
              zh={<>把「两步 = 两个 case 集合相乘」套到 OLL → PLL 上:216 个朝向态模 pre-AUF = <strong>58</strong> 个 OLL(57 + 跳O),
                288 个置换态模两侧 AUF = <strong>22</strong> 个 PLL(21 + 跳P) —— 正是大家在用的数。
                从没有人把两步末层定义成「1LLL 的 3916 ÷ 4 = 979」;那个数离 <TeX src={R`58\times22=1276`} /> 差得远,
                和这里 <TeX src={R`583{,}284\div4=145{,}821`} /> 离 151,164 差得远,是同一回事。
                而且 OLL 里同样有对称 case(同一条公式、不同 AUF 进,出来不同 PLL),社区面对完全一样的现象,选的就是乘法。</>}
              en={<>Apply “two looks = product of two case sets” to OLL → PLL: 216 orientation states mod pre-AUF = <strong>58</strong> OLL cases (57 + skip),
                288 permutation states mod both AUFs = <strong>22</strong> PLL cases (21 + skip) — precisely the numbers everyone uses.
                Nobody defines two-look LL as “1LLL’s 3916 ÷ 4 = 979”; that misses <TeX src={R`58\times22=1276`} /> by a mile, exactly as
                <TeX src={R`\;583{,}284\div4=145{,}821`} /> misses 151,164. And OLL has symmetric cases too (one algorithm, different AUFs in, different PLL out) —
                the community met the identical phenomenon and chose multiplication.</>}
            />
          </p>

          <h3 className="lmath-body" style={{ fontWeight: 700, color: 'var(--foreground)', marginBottom: 4 }}>
            {t('佐证二:151,164 恰是商定义的上确界', 'Check 2: 151,164 is exactly the supremum of the quotient count')}
          </h3>
          <p className="lmath-body">
            <T
              zh={<>对称大类的轨道数 = 494 当且仅当那个多出来的生成元 <TeX src="V" /> 落在 <TeX src={R`\langle U\rangle`} /> 里;
                而换一条合法 ZBLS 公式,恰好就是把 <TeX src="V" /> 在 ZBLL 群里<strong>共轭</strong>一次。于是问题化成
                「<TeX src="V" /> 的共轭类碰不碰得到 <TeX src={R`\langle U\rangle`} />」—— 7776 个元素直接全扫,
                <strong>9 个对称大类全部可达</strong>(<TeX src={R`|\mathrm{Stab}|=4`} /> 的共轭到 <TeX src={R`U^{\pm1}`} />,
                <TeX src={R`|\mathrm{Stab}|=2`} /> 的共轭到 <TeX src={R`U^{2}`} />)。记商定义算出的 case 数为 <TeX src="Q" />,则</>}
              en={<>A symmetric family hits 494 exactly when the extra generator <TeX src="V" /> lands inside <TeX src={R`\langle U\rangle`} /> —
                and swapping in another legal ZBLS algorithm is precisely a <strong>conjugation</strong> of <TeX src="V" /> inside the ZBLL group.
                So the question becomes “does <TeX src="V" />’s conjugacy class meet <TeX src={R`\langle U\rangle`} />?” Scanning all 7776 elements:
                <strong> all 9 symmetric families reach it</strong> (<TeX src={R`|\mathrm{Stab}|=4`} /> conjugates to <TeX src={R`U^{\pm1}`} />,
                <TeX src={R`\;|\mathrm{Stab}|=2`} /> to <TeX src={R`U^{2}`} />). Writing <TeX src="Q" /> for the quotient count,</>}
            />
          </p>
          <Block src={R`\sup_{\{Z_\varphi\}} Q \;=\; 306\times 494 \;=\; 151{,}164 .`} />
          <p className="lmath-body">
            <T
              zh={<>也就是说,商定义永远不会超过这个乘积,而且够得着。它每低一点,都是某条具体公式
                <strong>把两个本来不同的 ZBLL case 强行粘在一起</strong>丢掉的信息 —— 那是公式的副作用,不是魔方的性质。</>}
              en={<>So the quotient count never exceeds the product, and the bound is attained. Every unit below it is information a particular algorithm
                <strong> destroyed by gluing two genuinely different ZBLL cases together</strong> — a side effect of the algorithm, not a property of the cube.</>}
            />
          </p>
          <div className="lmath-table-wrap">
            <table className="lmath-table">
              <thead>
                <tr>
                  <th><T zh="量" en="quantity" /></th>
                  <th className="is-num"><T zh="值" en="value" /></th>
                </tr>
              </thead>
              <tbody>
                <tr><td><T zh="三类 case 数 = 306 × 494,与公式表无关" en="class-3 count = 306 × 494, algorithm-free" /></td><td className="is-num is-hot">151,164</td></tr>
                <tr><td><T zh="其中 297 个自由大类的贡献" en="of which the 297 free families contribute" /></td><td className="is-num">146,718</td></tr>
                <tr><td><T zh="商定义在站内当前公式库下(= 151,164 − 3,656 被粘掉)" en="the quotient count under the site’s current set (= 151,164 − 3,656 glued away)" /></td><td className="is-num">147,508</td></tr>
                <tr><td><T zh="商定义的严格区间" en="strict range of the quotient count" /></td><td className="is-num">147,220 – 151,164</td></tr>
                <tr className="is-total"><td><T zh="天真估算 583,284 ÷ 4" en="naïve 583,284 ÷ 4" /></td><td className="is-num">145,821</td></tr>
              </tbody>
            </table>
          </div>
          <div className="lmath-note">
            <T
              zh={<>一处诚实的说明:一类、二类数的是<strong>局面</strong>(你可能面对的那张图),151,164 数的是<strong>两步路线</strong>
                (先后看到的两张图)。这确实是两种不同的量 —— 但三类从头到尾问的就是路线,而这是它唯一良定义的版本。
                天真值 <TeX src={R`583{,}284\div4`} /> <strong>必然偏小</strong>:pre / mid / post 不构成自由的
                <TeX src={R`\;(\mathbb{Z}_4)^3`} /> 作用 —— pre 动的是大类 <TeX src={R`\varphi`} />,mid 与 post 动的是 fiber 内部。
                所有数字由 <code>scripts/lsll-class3.mts</code> 实证(|Φ| = 1200、306、297/3/6、7776、494、共轭类扫描逐项复算)。</>}
              en={<>One honest caveat: classes 1 and 2 count <strong>positions</strong> (the picture you may face); 151,164 counts <strong>two-look routes</strong>
                (the ordered pair of pictures). These are genuinely different quantities — but routes are what class 3 was always asking about, and this is
                its only well-defined form. The naïve <TeX src={R`583{,}284\div4`} /> is <strong>necessarily too small</strong>: pre / mid / post do not form a free
                <TeX src={R`\;(\mathbb{Z}_4)^3`} /> action — pre moves the family <TeX src={R`\varphi`} />, mid and post move inside the fiber.
                Every number here is recomputed by <code>scripts/lsll-class3.mts</code> (|Φ| = 1200, 306, 297/3/6, 7776, 494, plus the conjugacy scan).</>}
            />
          </div>
        </section>

        {/* ── §4 Burnside ── */}
        <section className="lmath-section">
          <h2 className="lmath-h2">{t('四、两侧全商:Burnside 引理', '4. Both AUFs: Burnside’s lemma')}</h2>
          <Block src={R`\#\{\text{cases}\}=\frac{1}{16}\sum_{(a,b)\in\mathbb{Z}_4\times\mathbb{Z}_4}\bigl|\operatorname{Fix}(a,b)\bigr| .`} />

          <h3 className="lmath-body" style={{ fontWeight: 700, color: 'var(--foreground)', marginBottom: 4 }}>
            {t('(A) 一般扇区(槽块至少一块在顶层)—— 自由', '(A) Generic sector (a slot piece is on top) — free')}
          </h3>
          <p className="lmath-body">
            <T
              zh={<>只要槽角或槽棱有一块在顶层,它是个<strong>带标记</strong>的块(标签「4」,<TeX src={R`T_{\text{home}}`} /> 的
                <TeX src={R`\,+b`} /> 动不了它)。若 <TeX src={R`(a,b)\neq\mathrm{id}`} /> 要有不动点,这块必须映回原位,逼出
                <TeX src={R`\,a=0`} />;而 <TeX src={R`a=0,b\neq0`} /> 又无不动点(上一节)。故一般扇区<strong>自由</strong>,轨道数 = 原始态 ÷ 16:</>}
              en={<>If a slot piece sits on top it is a <strong>marked</strong> piece (label “4”, immune to <TeX src={R`T_{\text{home}}`} />’s <TeX src={R`+b`} />).
                A fixed point of <TeX src={R`(a,b)\neq\mathrm{id}`} /> would send it back to its own position, forcing <TeX src={R`a=0`} />; and
                <TeX src={R`\;a=0,b\neq0`} /> has none either. So the generic sector is <strong>free</strong>, orbits = raw ÷ 16:</>}
            />
          </p>
          <Block src={R`\frac{N_{\text{raw}}-N_{\text{SS}}}{16}=\frac{9{,}331{,}200-373{,}248}{16}=\frac{8{,}957{,}952}{16}=559{,}872 .`} />
          <div className="lmath-note">
            <T
              zh={<>这正是 /alg/lsll 页速记式的第一项:<TeX src={R`288\times 7776=2{,}239{,}488=\tfrac{8{,}957{,}952}{4}`} />(一般扇区模一次 AUF),
                再除以 4 得 <TeX src={R`\tfrac{288\times 7776}{4}=559{,}872=36\times 15{,}552`} />,其中 <TeX src={R`15{,}552=\tfrac{62{,}208}{4}`} />(一个末层群模一次 AUF)。
                这里 <TeX src={R`N_{\text{SS}}=6\times 62{,}208=373{,}248`} />。</>}
              en={<>This is the first term of the shorthand on /alg/lsll: <TeX src={R`288\times 7776=2{,}239{,}488=\tfrac{8{,}957{,}952}{4}`} /> (generic sector mod one AUF),
                divided again by 4 gives <TeX src={R`\tfrac{288\times 7776}{4}=559{,}872=36\times 15{,}552`} />, with <TeX src={R`15{,}552=\tfrac{62{,}208}{4}`} />.
                Here <TeX src={R`N_{\text{SS}}=6\times 62{,}208=373{,}248`} />.</>}
            />
          </div>

          <hr className="lmath-divider" />

          <h3 className="lmath-body" style={{ fontWeight: 700, color: 'var(--foreground)', marginBottom: 4 }}>
            {t('(B) 槽对已归位扇区(SS)—— 唯一有不动点的地方', '(B) Slot-solved sector (SS) — the only fixed points')}
          </h3>
          <p className="lmath-body">
            <T
              zh={<>槽角、槽棱都回槽位,但可带扭 <TeX src={R`c\in\{0,1,2\}`} />、带翻 <TeX src={R`e\in\{0,1\}`} />,共 6 类。残余自由度正好是
                <strong>末层群</strong> <TeX src="L" />,<TeX src={R`|L|=\tfrac{4!\,4!}{2}\cdot 3^{3}\cdot 2^{3}=62{,}208`} />,两个 AUF 都只作用在 <TeX src="L" /> 上。逐 <TeX src={R`(c,e)`} /> 做 Burnside:</>}
              en={<>Both slot pieces are home, but may be twisted <TeX src={R`c\in\{0,1,2\}`} /> or flipped <TeX src={R`e\in\{0,1\}`} /> — 6 classes. The residual
                freedom is exactly the <strong>last-layer group</strong> <TeX src="L" />, <TeX src={R`|L|=\tfrac{4!\,4!}{2}\cdot 3^{3}\cdot 2^{3}=62{,}208`} />, on which both AUFs act. Burnside per <TeX src={R`(c,e)`} />:</>}
            />
          </p>
          <div className="lmath-table-wrap">
            <table className="lmath-table">
              <thead>
                <tr>
                  <th><T zh="群元 (a,b)" en="element (a,b)" /></th>
                  <th className="is-num"><T zh="不动态 e=0" en="Fix, e=0" /></th>
                  <th className="is-num"><T zh="不动态 e=1" en="Fix, e=1" /></th>
                </tr>
              </thead>
              <tbody>
                <tr><td>{t('恒等', 'identity')}</td><td className="is-num">62,208</td><td className="is-num">62,208</td></tr>
                <tr><td><T zh={<><TeX src={R`(a,b),\ a,b\in\{1,3\}`} />(4 个)</>} en={<><TeX src={R`(a,b),\ a,b\in\{1,3\}`} /> (4 of them)</>} /></td><td className="is-num">16 × 4</td><td className="is-num">0</td></tr>
                <tr><td><TeX src={R`(2,2)`} /></td><td className="is-num">384</td><td className="is-num">0</td></tr>
                <tr><td>{t('其余 10 个', 'other 10')}</td><td className="is-num">0</td><td className="is-num">0</td></tr>
                <tr><td><TeX src={R`\sum|\operatorname{Fix}|`} /></td><td className="is-num is-hot">62,656</td><td className="is-num is-hot">62,208</td></tr>
                <tr className="is-total"><td>{t('轨道数 (÷16)', 'orbits (÷16)')}</td><td className="is-num">3,916</td><td className="is-num">3,888</td></tr>
              </tbody>
            </table>
          </div>
          <p className="lmath-body">
            <T
              zh={<>表里那两个数不是天上掉的。不动态要求「置换与 <TeX src={R`U^a`} /> 的循环结构相容 + 朝向沿轨道常值 + 朝向和守恒」,再被角棱<strong>同奇偶</strong>砍一半:</>}
              en={<>Those two entries are derived, not asserted. A fixed state needs its permutation to commute with the cycle structure of <TeX src={R`U^a`} />,
                its orientations constant along each cycle, and the orientation sums to survive — then the <strong>equal-parity</strong> coupling halves it:</>}
            />
          </p>
          <Block src={R`\underbrace{4}_{\text{CP}}\cdot\underbrace{1}_{\text{CO}:\,4c\equiv0}\cdot\underbrace{4}_{\text{EP}}\cdot\underbrace{2}_{\text{EO}}\big/\underbrace{2}_{\text{parity}}=16,\qquad
\underbrace{8}_{\text{CP}}\cdot\underbrace{3}_{\text{CO}:\,c_1+c_2\equiv0}\cdot\underbrace{8}_{\text{EP}}\cdot\underbrace{4}_{\text{EO}}\big/\underbrace{2}_{\text{parity}}=384 .`} />
          <p className="lmath-body">
            <T
              zh={<>左式是 <TeX src={R`a,b\in\{1,3\}`} />(顶层 4 位被 4-循环打转:中心化子 4 元,CO 常值 <TeX src="c" /> 要 <TeX src={R`4c\equiv c\equiv0\ (\mathrm{mod}\ 3)`} /> 逼出 <TeX src="c=0`" />,EO 常值总翻恒偶故 2 种);
                右式是 <TeX src={R`(2,2)`} />(顶层拆成两个 2-循环:中心化子 <TeX src={R`24/3=8`} />,两条轨道各一个常值扭且 <TeX src={R`2(c_1+c_2)\equiv0`} />,EO 每轨道常值 <TeX src={R`2^2=4`} /> 种)。</>}
              en={<>The left is <TeX src={R`a,b\in\{1,3\}`} /> (the 4 top slots form one 4-cycle: centraliser of order 4; a constant twist <TeX src="c" /> needs <TeX src={R`4c\equiv c\equiv0`} />, forcing <TeX src="c=0" />; constant flip always sums even, so 2 choices);
                the right is <TeX src={R`(2,2)`} /> (two 2-cycles: centraliser <TeX src={R`24/3=8`} />, one constant twist per cycle with <TeX src={R`2(c_1+c_2)\equiv0`} />, and <TeX src={R`2^2=4`} /> flip patterns).</>}
            />
          </p>
          <p className="lmath-body">
            <T
              zh={<><TeX src={R`e=1`} /> 全翻不成立:<TeX src="a,b" /> 全非零的不动态里,顶层棱翻必须<strong>整体常值</strong>,而常值翻总翻 <TeX src={R`\equiv 0`} />,与 <TeX src={R`e=1`} /> 冲突。于是</>}
              en={<><TeX src={R`e=1`} /> kills them: a fixed state under <TeX src="a,b" /> both non-zero forces a <strong>constant</strong> flip on the top edges, whose total <TeX src={R`\equiv 0`} /> clashes with <TeX src={R`e=1`} />. Hence</>}
            />
          </p>
          <Block src={R`e=0:\ \frac{62{,}208+4\cdot 16+384}{16}=\frac{62{,}656}{16}=3916,\qquad e=1:\ \frac{62{,}208}{16}=3888 .`} />
          <div className="lmath-note">
            <T
              zh={<><strong><TeX src={R`c=0,\,e=0`} /> 的「O」类(对子已归位)= 纯末层模两侧 AUF = 1LLL 数 3916</strong> —— 天然自洽。
                <TeX src={R`e=1`} /> 类无不动点,干净地 <TeX src={R`62{,}208/16=3888`} />。三个 <TeX src={R`e=0`} /> + 三个 <TeX src={R`e=1`} />:<TeX src={R`(3916+3888)\times 3=23{,}412`} />。</>}
              en={<><strong>The “O” class <TeX src={R`(c{=}0,e{=}0)`} /> (pair already solved) = pure last layer mod both AUF = the 1LLL count 3916</strong> — a built-in check.
                The <TeX src={R`e=1`} /> classes are free: <TeX src={R`62{,}208/16=3888`} />. Three <TeX src={R`e=0`} /> + three <TeX src={R`e=1`} />: <TeX src={R`(3916+3888)\times 3=23{,}412`} />.</>}
            />
          </div>

          <hr className="lmath-divider" />
          <p className="lmath-body" style={{ fontWeight: 600, color: 'var(--foreground)' }}>{t('合计', 'Total')}</p>
          <Block src={R`559{,}872 + 3\cdot 3916 + 3\cdot 3888 = 559{,}872 + 23{,}412 = 583{,}284 .`} />
          <p className="lmath-body">
            <T
              zh={<>等价地,全局 Burnside <TeX src={R`\tfrac{9{,}331{,}200+1{,}344}{16}=583{,}284`} />,那 <TeX src={R`1{,}344`} /> 个非恒等不动点全来自 SS 扇区。
                相对天真值 <TeX src={R`9{,}331{,}200/16=583{,}200`} /> 多出的 <strong>84</strong> 恰是 <TeX src={R`(3916-3888)\times 3`} /> —— 全记在槽对归位这 6 类头上。</>}
              en={<>Equivalently, global Burnside <TeX src={R`\tfrac{9{,}331{,}200+1{,}344}{16}=583{,}284`} />; the <TeX src={R`1{,}344`} /> non-identity fixed points all live in SS.
                The <strong>84</strong> above the naïve <TeX src={R`9{,}331{,}200/16=583{,}200`} /> is exactly <TeX src={R`(3916-3888)\times 3`} /> — charged entirely to the 6 slot-solved classes.</>}
            />
          </p>
        </section>

        {/* ── §5 ledger ── */}
        <section className="lmath-section">
          <h2 className="lmath-h2">{t('五、42 大类账本(命名沿用 ZBLS)', '5. The 42-family ledger (named after ZBLS)')}</h2>
          <div className="lmath-table-wrap">
            <table className="lmath-table">
              <thead>
                <tr>
                  <th><T zh="槽对构型" en="pair configuration" /></th>
                  <th className="is-num"><T zh="类数" en="families" /></th>
                  <th className="is-num"><T zh="每类 case" en="cases each" /></th>
                  <th className="is-num"><T zh="小计" en="subtotal" /></th>
                </tr>
              </thead>
              <tbody>
                <tr><td>{t('角棱都在顶层(相对位 d × 扭 c × 翻 e)', 'both on top (offset d × twist c × flip e)')}</td><td className="is-num">24</td><td className="is-num">15,552</td><td className="is-num">373,248</td></tr>
                <tr><td>{t('角在槽(扭 c)、棱在顶(翻 e)', 'corner in slot (twist c), edge on top (flip e)')}</td><td className="is-num">6</td><td className="is-num">15,552</td><td className="is-num">93,312</td></tr>
                <tr><td>{t('棱在槽(翻 e)、角在顶(扭 c)', 'edge in slot (flip e), corner on top (twist c)')}</td><td className="is-num">6</td><td className="is-num">15,552</td><td className="is-num">93,312</td></tr>
                <tr><td>{t('都在槽,e=0(c=0 即 1LLL)', 'both in slot, e=0 (c=0 is 1LLL)')}</td><td className="is-num">3</td><td className="is-num">3,916</td><td className="is-num">11,748</td></tr>
                <tr><td>{t('都在槽,e=1', 'both in slot, e=1')}</td><td className="is-num">3</td><td className="is-num">3,888</td><td className="is-num">11,664</td></tr>
                <tr className="is-total"><td>{t('合计', 'total')}</td><td className="is-num">42</td><td className="is-num">—</td><td className="is-num">583,284</td></tr>
              </tbody>
            </table>
          </div>
          <p className="lmath-body">
            <T
              zh={<><TeX src={R`15{,}552=62{,}208/4`} />:大类吸收 pre-AUF 后,类内就是「末层 62,208 态 ÷ post-AUF」。42 类 =
                24(角棱都在顶,<TeX src={R`d\!\in\!\{0,1,2,3\}\times c\times e`} />)+ 6 + 6 + 6(槽对归位 <TeX src={R`c\times e`} />)。</>}
              en={<><TeX src={R`15{,}552=62{,}208/4`} />: once a family absorbs the pre-AUF, inside it is “62,208 last-layer states ÷ post-AUF”.
                42 = 24 (both on top, <TeX src={R`d\!\in\!\{0,1,2,3\}\times c\times e`} />) + 6 + 6 + 6 (slot-solved <TeX src={R`c\times e`} />).</>}
            />
          </p>
        </section>

        {/* ── §6 verification ── */}
        <section className="lmath-section">
          <h2 className="lmath-h2">{t('六、独立验证', '6. Independent verification')}</h2>
          <p className="lmath-body">
            <T
              zh={<>一个不依赖上面任何解析推导的脚本,把 9,331,200 个原始态逐个做 16 元 canonical 去重,得
                <strong> cases = 583,284、42 大类、每类计数与上表逐项吻合</strong>。
                解析与暴力两条路完全一致(站内回归测试锁死这些数)。</>}
              en={<>A script independent of the derivation canonicalises all 9,331,200 raw states under the 16 images and gets
                <strong> cases = 583,284, 42 families, every subtotal matching the table</strong>.
                Analytic and brute-force agree (a regression test pins these numbers).</>}
            />
          </p>
          <Link href="/alg/lsll" className="lmath-xlink">
            <Boxes size={26} />
            <div className="lmath-xlink-body">
              <div className="lmath-xlink-title">{t('去 LSLL 公式集 →', 'Open the LSLL algorithm set →')}</div>
              <div className="lmath-xlink-desc">
                {t('浏览 42 大类、粘打乱定位 case、看每个 case 的状态图与打乱;最优解与 MCC 推荐由后台管道回填。',
                   'Browse the 42 families, locate a case from a scramble, view each case’s diagram and setup; optimal and MCC algs are being backfilled.')}
              </div>
            </div>
          </Link>
        </section>
      </main>
    </div>
  );
}
