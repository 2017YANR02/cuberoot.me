'use client';

import { ArrowDown, ArrowUpRight, AudioLines, BookOpen, Check, Code2, Globe2, HeartHandshake, Layers3, LockKeyhole, Radio, School, Sparkles, Timer, Users } from 'lucide-react';
import AppLink from '@/components/AppLink';
import AppearanceToggle from '@/components/AppearanceToggle';
import { VisualCube } from '@/components/VisualCube';
import './partnership.css';

// Chinese-only presentation, explicitly requested by the owner.
export default function PartnershipPage() {
  return (
    <main className="partnership-page" lang="zh-Hans">
      <header className="partner-nav partner-wrap">
        <AppLink href="/" className="partner-brand" prefetch={false}>CubeRoot</AppLink>
        <span className="partner-private"><LockKeyhole size={12} aria-hidden />{"合作提案 · 管理员专属"}</span>
        <AppearanceToggle />
      </header>

      <section className="partner-hero partner-wrap" aria-labelledby="partner-title">
        <p className="partner-eyebrow">{"从一枚魔方，到一个世界。"}</p>
        <h1 id="partner-title">{"让热爱，"}<br /><span>{"转动更大的世界。"}</span></h1>
        <p className="partner-lead">{"为每一次练习、每一个突破、每一份热爱，创造更好的工具。"}<br />{"一起，建设面向全球的魔方平台。"}</p>
        <div className="partner-hero-actions"><AppLink href="/partnership/talking-points" className="partner-button" prefetch={false}>会谈提纲<ArrowUpRight size={16} aria-hidden /></AppLink><a className="partner-outline-button" href="#vision">{"看见我们的愿景"}<ArrowDown size={16} aria-hidden /></a></div>
        <div className="partner-stage" role="img" aria-label={"魔方与计时、公式、全球社区的产品概念图"}>
          <div className="partner-orbit partner-orbit-one" /><div className="partner-orbit partner-orbit-two" />
          <span className="partner-stage-word" aria-hidden>CUBE ROOT</span>
          <div className="partner-hero-cube"><VisualCube view="iso" size={440} local alt="" /></div>
          <div className="partner-float partner-float-timer"><Timer size={19} /><span>{"专注每一次进步"}</span><strong>00:00.00</strong><small>{"从这一刻开始"}</small></div>
          <div className="partner-float partner-float-alg"><Layers3 size={19} /><span>{"理解每一次转动"}</span><strong>R U R′ U′</strong></div>
          <div className="partner-float partner-float-world"><Globe2 size={24} /><span>{"为世界各地的热爱"}</span></div>
          <span className="partner-stage-caption">{"产品概念展示"}</span>
        </div>
      </section>

      <section id="vision" className="partner-vision partner-wrap">
        <p className="partner-eyebrow">{"01 / 为什么做"}</p>
        <h2>{"魔方很小。"}<br /><span>{"热爱的可能，很大。"}</span></h2>
        <p className="partner-body">{"从第一次还原，到不断刷新自己的成绩；从一个人的练习，到与世界各地的爱好者交流。魔方带来的好奇心、专注和连接，值得被认真对待。"}</p>
        <p className="partner-vision-statement">{"我们的长期愿景：成为全球最大的魔方网站。"}<span>{"从让每一个具体体验更好开始。"}</span></p>
      </section>

      <section id="product" className="partner-products partner-wrap">
        <div className="partner-section-head"><div><p className="partner-eyebrow">{"02 / 产品已在生长"}</p><h2>{"让想法，变成能用的东西。"}</h2></div><p>{"已有产品入口。点开，亲自体验。"}</p></div>
        <div className="partner-product-grid">
          <AppLink href="/timer" prefetch={false} className="partner-product partner-product-timer">
            <div className="partner-product-art partner-timer-art" aria-hidden><span className="partner-demo-label">{"计时界面示意"}</span><div className="partner-timer-dial"><Timer size={30} /><strong>00:00.00</strong><span>{"下一次，超越自己。"}</span></div><div className="partner-timer-lines">{[32, 48, 38, 68, 53, 78, 60, 86, 72, 95, 80, 100].map((height, i) => <i key={i} style={{ height: `${height}%` }} />)}</div></div>
            <div className="partner-product-copy"><span className="partner-product-kicker"><Timer size={15} />{"练习"}</span><h3>{"每一次转动，都有意义。"}</h3><p>{"计时、打乱与练习工具，让日常训练从打开网页开始。"}</p><span className="partner-text-link">{"体验计时工具"}<ArrowUpRight size={17} /></span></div>
          </AppLink>
          <AppLink href="/alg" prefetch={false} className="partner-product partner-product-alg">
            <div className="partner-product-art partner-alg-art" aria-hidden><span className="partner-demo-label">{"公式与状态可视化"}</span><VisualCube view="iso" algorithm="R U R' U'" size={235} local alt="" /><span className="partner-alg-notation">R U R′ U′</span></div>
            <div className="partner-product-copy"><span className="partner-product-kicker"><BookOpen size={15} />{"理解"}</span><h3>{"不止记住，更要看懂。"}</h3><p>{"公式、图示与训练，把抽象的转动变成可以理解的过程。"}</p><span className="partner-text-link">{"探索公式库"}<ArrowUpRight size={17} /></span></div>
          </AppLink>
          <AppLink href="/wca" prefetch={false} className="partner-product partner-product-world">
            <div className="partner-product-art partner-world-art" aria-hidden><span className="partner-demo-label">{"连接全球魔方视野"}</span><Globe2 className="partner-globe" strokeWidth={0.65} /><span className="partner-world-label">{"看见更大的世界"}</span></div>
            <div className="partner-product-copy"><span className="partner-product-kicker"><Globe2 size={15} />{"发现"}</span><h3>{"你的热爱，世界的语言。"}</h3><p>{"通过 WCA 比赛、成绩与统计，了解更广阔的魔方世界。"}</p><span className="partner-text-link">{"打开 WCA 中心"}<ArrowUpRight size={17} /></span></div>
          </AppLink>
        </div>
      </section>

      <section className="partner-next partner-wrap" id="next">
        <p className="partner-eyebrow">{"03 / 下一步计划"}</p>
        <h2>{"把产品做好。"}<br /><span>{"也让热爱，持续下去。"}</span></h2>
        <p className="partner-body">{"以个人与机构订阅探索持续收入，用直播连接用户，用 AI 工具提高开发与运营效率。以下是下一阶段方向，具体服务与商业模式仍需验证。"}</p>
        <div className="partner-plan-grid">
          {[
            { Icon: Users, n: '01', title: "个人订阅", body: "围绕真实练习需求，打磨值得持续付费的进阶体验。", tag: "验证付费意愿与续订" },
            { Icon: School, n: '02', title: "机构订阅", body: "与老师和机构共同验证教学、学员管理与训练服务。", tag: "从实际教学场景出发" },
            { Icon: Radio, n: '03', title: "直播与 AI", body: "通过内容和直播接触用户，把反馈更快变成产品改进。", tag: "关注获客成本与交付效率" },
          ].map(({ Icon, n, title, body, tag }) => <article className="partner-plan" key={n}><div className="partner-plan-top"><Icon size={28} strokeWidth={1.4} /><span>{n}</span></div><h3>{title}</h3><p>{body}</p><span className="partner-plan-tag">{tag}</span></article>)}
        </div>
        <div className="partner-ai-note"><Code2 size={20} aria-hidden /><p>{"AI 提高效率。真正的价值，来自对魔方和用户的理解。"}</p><AudioLines size={26} aria-hidden /></div>
      </section>

      <section className="partner-support" id="collaborate"><div className="partner-wrap">
        <p className="partner-eyebrow">{"04 / 一起向前"}</p>
        <h2>{"给热爱，一份向前的力量。"}</h2>
        <p className="partner-body">{"我们希望结识认同这个方向的支持者。让一份支持，成为更稳定的工具、更好的内容，以及更多可以落地的进步。"}</p>
        <div className="partner-support-grid">
          {[
            { Icon: HeartHandshake, title: "项目资助", body: "支持约定阶段的开发、基础设施与日常维护，共同确定用途和阶段目标。" },
            { Icon: Sparkles, title: "品牌赞助", body: "围绕品牌展示、内容或直播合作，约定具体权益、周期与交付。" },
            { Icon: School, title: "机构共创", body: "提供真实使用场景与反馈，一起验证能帮助老师与学员的服务。" },
          ].map(({ Icon, title, body }) => <article className="partner-support-card" key={title}><Icon size={28} strokeWidth={1.5} /><h3>{title}</h3><p>{body}</p></article>)}
        </div>
        <div className="partner-agreement"><span><Check size={16} />{"用途清楚"}</span><span><Check size={16} />{"阶段目标"}</span><span><Check size={16} />{"定期沟通"}</span></div>
        <p className="partner-terms">{"本页讨论项目资助与赞助合作，不涉及股权出让，不承诺还本、分红或投资收益。合作金额、用途、交付与终止安排，以双方书面约定为准。"}</p>
      </div></section>

      <section className="partner-closing partner-wrap">
        <HeartHandshake size={36} strokeWidth={1.25} aria-hidden />
        <p className="partner-eyebrow">{"一份共同的热爱，一个值得做的未来。"}</p>
        <h2>{"下一次转动，"}<br /><span>{"希望与你一起。"}</span></h2>
        <p>{"从一次认真交流开始，把愿景变成具体的合作。"}</p>
        <AppLink href="/contact" prefetch={false} className="partner-button">{"联系，开启合作"}<ArrowUpRight size={17} aria-hidden /></AppLink>
        <AppLink href="/about/ruimin" prefetch={false} className="partner-founder">{"认识创作者 · 颜瑞民"}<ArrowUpRight size={14} aria-hidden /></AppLink>
      </section>
      <footer className="partner-footer partner-wrap"><span>CubeRoot</span><span>{"为热爱而造。"}</span><span><LockKeyhole size={12} aria-hidden />{"管理员展示页"}</span></footer>
    </main>
  );
}
