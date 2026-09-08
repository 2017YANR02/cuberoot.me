'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import BackHome from '@/components/BackHome';
import JsonLd, { articleJsonLd } from '@/components/JsonLd';
import { TeXBlock } from '@/components/math/Tex';
import { useT } from '@/hooks/useT';
import article from './article.json';

const SOURCE = 'https://openai.com/index/navier-stokes-solution/';
const CLAY = 'https://www.claymath.org/wp-content/uploads/2022/06/navierstokes.pdf';
const LEAN = 'https://github.com/openai/NavierStokesAndEuler';

export default function NavierStokesPage() {
  useTranslation();
  const t = useT();
  // Positive radius prevents division by zero; this illustration has no physical units.
  const [radius, setRadius] = useState(0.5);
  const [exponent, setExponent] = useState(1);
  const speed = radius ** -exponent;
  const energy = radius ** (3 - 2 * exponent);
  const heading = t('关于纳维–斯托克斯千禧年大奖难题', 'On the Navier–Stokes Millennium Prize Problem');
  const description = t('OpenAI 文章全文中文翻译，含研究过程、同期研究、原图与图注。', 'The OpenAI article with a full Chinese translation, original figures, and captions.');

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 64px', lineHeight: 1.85, overflowWrap: 'anywhere' }}>
      <JsonLd data={{ ...articleJsonLd({ headline: heading, description, url: t('https://cuberoot.me/zh/math/navier-stokes', 'https://cuberoot.me/math/navier-stokes'), lang: t('zh', 'en') }), author: { '@type': 'Organization', name: 'OpenAI', url: 'https://openai.com' }, isBasedOn: SOURCE }} />
      <header className="navier-header">
        <div className="page-back-row"><BackHome /></div>
        <p>{t('数学 / 偏微分方程', 'Mathematics / Partial differential equations')}</p>
        <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.7rem)', lineHeight: 1.3 }}>{heading}</h1>
        <p>{t('原文：OpenAI ｜ 中文翻译：CubeRoot', 'Original: OpenAI | Chinese translation: CubeRoot')}</p>
        <p><a href={SOURCE} target="_blank" rel="noreferrer">{t('阅读原文', 'Read the original')}</a></p>
        <p>{t('以下为所提供正文的完整译文。文中的“我们”指 OpenAI，研究结论及相关表述均沿用原文。', 'The article below follows the supplied source text. “We” refers to OpenAI; research claims and statements are those of the original author.')}</p>
      </header>
      <article>
        {article.map((block, index) => {
          const text = t(block.zh, block.en);
          if (block.kind === 'heading') return <h2 key={index} style={{ marginTop: 40 }}>{text}</h2>;
          if (block.kind === 'vortex' || block.kind === 'benchmark') return (
            <figure key={index} style={{ margin: '32px 0' }}>
              {/* Original source figures are served locally at their native aspect ratio. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/assets/math/navier-stokes/${block.kind === 'vortex' ? 'vortex.webp' : 'benchmark.png'}`} alt={text} width={block.kind === 'vortex' ? 1254 : 944} height={block.kind === 'vortex' ? 1254 : 732} loading="lazy" style={{ display: 'block', width: '100%', height: 'auto' }} />
              <figcaption style={{ marginTop: 12, whiteSpace: 'pre-line' }}>{text}</figcaption>
            </figure>
          );
          return <p key={index} style={{ whiteSpace: 'pre-line' }}>{text}</p>;
        })}
        <p><small>{t('译注：[1] 为原文脚注标记；所提供的文本未包含脚注正文，可前往原文查看。图中英文标注的中文释义见图注。', 'Translation note: [1] is a source footnote marker; its text was not included in the supplied document. See the original article for the footnote. Figure labels are explained in the captions.')}</small></p>
      </article>
      <details style={{ marginTop: 48 }}>
        <summary>{t('附录：数学背景与交互示意（CubeRoot 补充，非原文）', 'Appendix: mathematical background and interactive illustration (added by CubeRoot)')}</summary>
      <section style={{ marginTop: 36 }}>
        <h2>{t('先看清问题的条件', 'Read the assumptions first')}</h2>
        <div style={{ overflowX: 'auto' }}><TeXBlock src={String.raw`\partial_t u+(u\cdot\nabla)u=-\nabla p+\nu\Delta u+f,\qquad \nabla\cdot u=0`} /></div>
        <p>{t('u 是速度，p 是压力，ν 是黏性系数，f 是外力；散度为零表示不可压缩。令 ν 为零得到 Euler 方程。光滑性讨论的是解能否持续保持足够的可微性。', 'Here u is velocity, p pressure, ν viscosity and f forcing; zero divergence means incompressibility. Setting ν to zero gives Euler’s equations. Smoothness concerns continued differentiability.')}</p>
        <p>{t('官方表述 A、B 要求无外力时的整体光滑解；C、D 则允许符合规定的光滑外力，寻找整体光滑解不存在的例子。A、C 在整个三维空间讨论，B、D 使用周期空间。带外力的反例不能直接说成无外力版本也已被否定。', 'Official formulations A and B ask for global smooth solutions without forcing. C and D allow prescribed smooth forcing and seek counterexamples. A and C use the whole space; B and D use periodic space. A forced counterexample does not by itself disprove the unforced assertions.')}</p>
        <p><a href={CLAY} target="_blank" rel="noreferrer">{t('依据：Clay 官方问题说明，第 1–2 页', 'Reference: Clay’s official formulation, pages 1–2')}</a></p>
      </section>
      <section style={{ marginTop: 36 }}>
        <h2>{t('有限能量，为什么还可能越来越快？', 'How can finite energy coexist with growing speed?')}</h2>
        <p>{t('把一个区域缩小，同时提高其中的速度。下面只比较“速度的平方 × 体积”的量级：半径缩小到 r，速度取 r 的负 α 次方，能量比例就是 r 的 3−2α 次方。它是本站的缩放示例，不是流体解，也不是原论文的构造。', 'Shrink a region while increasing its speed. This original scaling example compares speed squared times volume: radius r, speed r to the power −α, and energy proportional to r to the power 3−2α. It is neither a fluid solution nor the paper’s construction.')}</p>
        <div style={{ overflowX: 'auto' }}><TeXBlock src={String.raw`U=r^{-\alpha},\qquad \frac{E}{E_0}=U^2r^3=r^{3-2\alpha}`} /></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px 32px' }}>
          <label style={{ display: 'grid', gap: 8 }}>
            {t('相对半径 r', 'Relative radius r')}: {radius.toFixed(2)}
            <input aria-label={t('相对半径', 'Relative radius')} type="range" min="0.05" max="1" step="0.05" value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
          </label>
          <label style={{ display: 'grid', gap: 8 }}>
            {t('速度增长指数 α', 'Speed growth exponent α')}: {exponent.toFixed(1)}
            <input aria-label={t('速度增长指数', 'Speed growth exponent')} type="range" min="0.5" max="2" step="0.1" value={exponent} onChange={(e) => setExponent(Number(e.target.value))} />
          </label>
        </div>
        <figure style={{ margin: '24px 0' }}>
          <svg viewBox="0 0 560 240" width="100%" style={{ maxWidth: 560 }} role="img" aria-label={t('基准区域与缩小后的区域截面对比', 'Cross-sections of the reference and shrunken regions')}>
            <circle cx="135" cy="110" r="90" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="420" cy="110" r={90 * radius} fill="none" stroke="var(--accent)" strokeWidth="3" />
            <text x="135" y="225" textAnchor="middle" fill="currentColor">r = 1</text>
            <text x="420" y="225" textAnchor="middle" fill="currentColor">r = {radius.toFixed(2)}</text>
          </svg>
          <figcaption>{t('截面示意；计算体积时使用三维缩放 r³。', 'Cross-sections only; volume uses the three-dimensional scaling r³.')}</figcaption>
        </figure>
        <output style={{ display: 'block' }} aria-live="polite">
          {t('速度倍数', 'Speed factor')}: {speed.toFixed(2)} ｜ {t('能量比例', 'Energy ratio')}: {energy.toFixed(3)}
        </output>
        <p>{t('当 α=1，r 趋近零时速度无限增大，能量比例却趋近零。α=1.5 时能量比例恒为 1；α>1.5 时则发散。这个计算说明：控制总量，不等于控制每一点的峰值。', 'For α=1, speed grows without bound as r approaches zero while the energy ratio tends to zero. At α=1.5 the ratio stays at 1; for α>1.5 it diverges. Controlling a total does not necessarily control a pointwise peak.')}</p>
        <p>{t('真正的难点还在于：速度、压力和外力必须一起满足方程及全部正则性条件。仅有这种缩放关系远远不够。', 'The real difficulty remains: velocity, pressure and forcing must jointly satisfy the equations and all regularity conditions. A scaling relation alone is far from sufficient.')}</p>
      </section>
      <section style={{ marginTop: 36 }}>
        <h2>{t('继续读证明', 'Continue to the proof')}</h2>
        <p>{t('读者可以从正式定理的量词与假设开始，再对照形式化代码。特别要区分“存在一个反例”和“所有初值都会出现奇性”。', 'Start with the formal theorem’s quantifiers and assumptions, then compare the formalization. Distinguish existence of a counterexample from a claim about every initial condition.')}</p>
        <p><a href={LEAN} target="_blank" rel="noreferrer">{t('OpenAI 的 Lean 证明仓库', 'OpenAI’s Lean proof repository')}</a></p>
      </section>
      </details>
    </main>
  );
}
