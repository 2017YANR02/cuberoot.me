'use client';

/**
 * /math/lsll — LSLL(最后一槽 + 顶层)情况计数长文。
 *
 * 严格推导 583,284:原始态 (5!·5!/2)·3⁴·2⁴ = 9,331,200 → 两侧 AUF 的 Z4×Z4 商 → Burnside。
 * 顺带给出只商单侧 AUF(自由作用)的中间量 2,332,800,并对齐 42 大类账本与
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
                按这个作用归并,轨道数就是 case 数。下面一步步算清楚,并分别给出<strong>只商 pre-AUF</strong>、
                <strong>只商 post-AUF</strong> 那个中间量。本文是 <Link href="/math/probability">{t('末层 AUF 概率', 'last-layer AUF probability')}</Link> 一页
                在「最后一槽」上的推广。</>}
              en={<>LSLL (Last Slot and Last Layer) means solving the <strong>last slot and the whole top layer</strong> in
                one look. The definition of “one case” hides a group action: a U turn is allowed before and after the
                algorithm (pre-AUF / post-AUF) without changing the case — an action of <TeX src={R`\mathbb{Z}_4\times\mathbb{Z}_4`} /> (16
                elements). Collapsing the 9,331,200 physical states under it gives the case count. We derive it step by
                step, including the intermediate counts where <strong>only the pre-AUF</strong> and <strong>only the post-AUF</strong> are quotiented. This is the{' '}
                <Link href="/math/probability">{t('末层 AUF 概率', 'last-layer AUF probability')}</Link> page extended to the last slot.</>}
            />
          </p>

          <div className="lmath-numbers">
            <div className="lmath-num-card">
              <div className="lmath-num">9,331,200</div>
              <div className="lmath-num-label">{t('原始物理态', 'raw physical states')}</div>
            </div>
            <div className="lmath-num-card">
              <div className="lmath-num">2,332,800</div>
              <div className="lmath-num-label">{t('只商单侧 AUF(pre = post)', 'one AUF only (pre = post)')}</div>
            </div>
            <div className="lmath-num-card">
              <div className="lmath-num">583,284</div>
              <div className="lmath-num-label">{t('两侧 AUF 全商 = case 数', 'both AUFs = # cases')}</div>
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
          <h2 className="lmath-h2">{t('三、只商单侧 AUF(pre 或 post 皆可)', '3. Quotient by one AUF (pre or post)')}</h2>
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
              zh={<>先只用<strong>单个 <TeX src={R`\mathbb{Z}_4`} /></strong> 去商。关键:<strong>无论取哪一侧</strong>,这个作用都<strong>自由</strong>(无不动点)。</>}
              en={<>Quotient by a <strong>single <TeX src={R`\mathbb{Z}_4`} /></strong>. Key fact: <strong>whichever side we pick</strong>, the action is <strong>free</strong> (no fixed points).</>}
            />
          </p>
          <ul className="lmath-body">
            <li><T
              zh={<><strong>post-AUF</strong> <TeX src={R`T_{\text{phys}}^{a}`} />(<TeX src={R`a\neq0`} />):4 个顶角位永远装 4 个<strong>互异</strong>的角块;
                不动点要求位置 <TeX src="p" /> 与 <TeX src={R`p+a`} /> 装同一块 —— 不可能。</>}
              en={<><strong>post-AUF</strong> <TeX src={R`T_{\text{phys}}^{a}`} /> (<TeX src={R`a\neq0`} />): the 4 top corner slots always hold 4 <strong>distinct</strong>
                corners; a fixed point needs positions <TeX src="p" /> and <TeX src={R`p+a`} /> to hold the same piece — impossible.</>}
            /></li>
            <li><T
              zh={<><strong>pre-AUF</strong> <TeX src={R`T_{\text{home}}^{b}`} />(<TeX src={R`b\neq0`} />):不动点要求每个顶块标签 <TeX src="i" /> 满足
                <TeX src={R`\;i=i+b`} />;顶层里始终坐着真顶层块(标签 0–3),逼出 <TeX src={R`b=0`} />,矛盾。</>}
              en={<><strong>pre-AUF</strong> <TeX src={R`T_{\text{home}}^{b}`} /> (<TeX src={R`b\neq0`} />): a fixed point needs every top label <TeX src="i" /> to satisfy
                <TeX src={R`\;i=i+b`} />; genuine top-layer pieces (labels 0–3) sit on top, forcing <TeX src={R`b=0`} /> — contradiction.</>}
            /></li>
          </ul>
          <p className="lmath-body">
            <T zh={<>自由作用 ⇒ 每条轨道恰 4 元,轨道数 = 总数 ÷ 4。两侧各算一遍,数值相同:</>}
               en={<>A free action ⇒ every orbit has exactly 4 elements, so the count is the total ÷ 4. Do it on each side — same number:</>} />
          </p>
          <Block src={R`\#\{\text{pre-AUF only}\}=\#\{\text{post-AUF only}\}=\frac{N_{\text{raw}}}{4}=\frac{9{,}331{,}200}{4}=2{,}332{,}800 .`} />
          <div className="lmath-note">
            <T
              zh={<>两个单侧商相等不是巧合,<strong>但这不等于「双侧就再 ÷4」</strong>:不动点只在 <strong>pre-AUF 与 post-AUF 同时作用</strong>、
                且只在「槽对已归位」的态里出现,所以天真地 <TeX src={R`\tfrac{2{,}332{,}800}{4}=583{,}200`} /> 会差一点点 —— 见下节 Burnside。</>}
              en={<>The two single-sided counts agreeing is no accident, <strong>but it does not mean “both sides = ÷4 again”</strong>: fixed points
                appear only when <strong>pre-AUF and post-AUF act together</strong>, and only among slot-solved states, so the naïve{' '}
                <TeX src={R`\tfrac{2{,}332{,}800}{4}=583{,}200`} /> is slightly off — see Burnside below.</>}
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
              zh={<><TeX src={R`e=1`} /> 全翻不成立:<TeX src="a,b" /> 全非零的不动态里,顶层棱翻必须<strong>整体常值</strong>,而常值翻总翻 <TeX src={R`\equiv 0`} />,与 <TeX src={R`e=1`} /> 冲突。于是</>}
              en={<><TeX src={R`e=1`} /> kills them: a fixed state under <TeX src="a,b" /> both non-zero forces a <strong>constant</strong> flip on the top edges, whose total <TeX src={R`\equiv 0`} /> clashes with <TeX src={R`e=1`} />. Hence</>}
            />
          </p>
          <Block src={R`e=0:\ \frac{62{,}208+4\cdot 16+384}{16}=\frac{62{,}656}{16}=3916,\qquad e=1:\ \frac{62{,}208}{16}=3888 .`} />
          <div className="lmath-note">
            <T
              zh={<><strong><TeX src={R`c=0,\,e=0`} /> 的「Solved Pair」类 = 纯末层模两侧 AUF = 1LLL 数 3916</strong> —— 天然自洽。
                <TeX src={R`e=1`} /> 类无不动点,干净地 <TeX src={R`62{,}208/16=3888`} />。三个 <TeX src={R`e=0`} /> + 三个 <TeX src={R`e=1`} />:<TeX src={R`(3916+3888)\times 3=23{,}412`} />。</>}
              en={<><strong>The “Solved Pair” class <TeX src={R`(c{=}0,e{=}0)`} /> = pure last layer mod both AUF = the 1LLL count 3916</strong> — a built-in check.
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
                <strong> cases = 583,284、42 大类、每类计数与上表逐项吻合</strong>;单侧 4 元去重得 <strong>2,332,800</strong>。
                解析与暴力两条路完全一致(站内回归测试锁死这些数)。</>}
              en={<>A script independent of the derivation canonicalises all 9,331,200 raw states under the 16 images and gets
                <strong> cases = 583,284, 42 families, every subtotal matching the table</strong>; the 4-image quotient gives <strong>2,332,800</strong>.
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
