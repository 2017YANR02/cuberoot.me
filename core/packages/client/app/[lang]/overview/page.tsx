'use client';

import { ArrowUpRight, BookOpen, ChartNoAxesColumnIncreasing, HeartHandshake, Printer, ScanSearch, School, Timer } from 'lucide-react';
import AppLink from '@/components/AppLink';
import HeaderToggles from '@/components/HeaderToggles';
import { VisualCube } from '@/components/VisualCube';
import { tr } from '@/i18n/tr';
import CostsFunding from './CostsFunding';
import InvestorStory from './InvestorStory';
import { CREATOR_AUDIENCE } from '@/lib/creator-profile';
import './overview.css';

const PRODUCTS = [
  { Icon: Timer, href: '/timer', title: { zh: '练习与计时', en: 'Practice & timing' }, body: { zh: '打乱、计时与训练记录，让日常练习有迹可循。', en: 'Scrambles, timing and solve records give everyday practice a history.' }, tag: { zh: '高频使用入口', en: 'An everyday entry point' } },
  { Icon: BookOpen, href: '/alg', title: { zh: '公式与训练', en: 'Algorithms & training' }, body: { zh: '把公式、状态图示与动画放在一起，帮助用户理解并练习。', en: 'Algorithms, state diagrams and animation help cubers understand and practise.' }, tag: { zh: '从学习到掌握', en: 'From learning to mastery' } },
  { Icon: ScanSearch, href: '/recon', title: { zh: '复盘与分析', en: 'Reconstruction & analysis' }, body: { zh: '复盘还原过程，结合逐帧视频工具，研究步骤与效率。', en: 'Reconstruct solves and use frame-by-frame video tools to study steps and efficiency.' }, tag: { zh: '服务进阶选手', en: 'For improving competitors' } },
  { Icon: ChartNoAxesColumnIncreasing, href: '/wca', title: { zh: '比赛与数据', en: 'Competitions & data' }, body: { zh: '通过比赛、成绩、统计与可视化，理解个人进步和全球赛事。', en: 'Explore competitions, results, statistics and visualisations to understand progress and the wider sport.' }, tag: { zh: '连接全球魔方圈', en: 'Connected to global cubing' } },
] as const;

const ROADMAP = [
  { period: { zh: '近期 · 首个 90 天', en: 'Near term · first 90 days' }, title: { zh: '先证明内容能带来真实练习。', en: 'Test whether content leads to real practice.' }, body: { zh: '建议围绕 3 个具体训练问题发布专题内容，招募 30 位深度试用者，并访谈 3 位老师或机构负责人。交付一条“看内容 → 做练习 → 看记录 → 再练习”的可用路径。', en: 'Propose three focused practice topics, recruit 30 closely followed pilot users and interview three teachers or organisation leaders. Deliver a usable path from content to practice, records and repeat practice.' }, proof: { zh: '提交：全部来源到访、首次练习、4 周复练与成本报告。30 人是深度跟踪样本，不是总获客上限；不预设转化率。', en: 'Report all source visits, first practice, week-four repeat practice and costs. The 30-person cohort is for close follow-up, not a cap on acquisition; no conversion rate is assumed.' } },
  { period: { zh: '中期 · 3–12 个月', en: 'Medium term · 3–12 months' }, title: { zh: '验证付费价值与合作交付。', en: 'Validate paid value and partner delivery.' }, body: { zh: '以个人进阶服务、机构教学工具和品牌合作做分阶段试点；持续推进多端体验，用真实使用结果决定投入顺序。', en: 'Run staged pilots for advanced individual services, teaching tools and brand partnerships; improve cross-platform access and let real use determine priorities.' }, proof: { zh: '观察：付费转化、续订、机构留存与赞助交付结果。', en: 'Measure: paid conversion, renewals, organisation retention and sponsor deliverables.' } },
  { period: { zh: '长期 · 1–3 年', en: 'Long term · 1–3 years' }, title: { zh: '成为贯穿学习、训练与交流的魔方平台。', en: 'Connect learning, practice and community.' }, body: { zh: '让个人训练数据、教学反馈与赛事信息相互连接，逐步扩大中英双语内容和合作网络，向全球性的魔方平台发展。', en: 'Connect training records, teaching feedback and competition information; expand bilingual content and partnerships towards a global cubing platform.' }, proof: { zh: '方向：长期使用、可持续收入与可复制的服务能力。', en: 'Focus: lasting use, sustainable revenue and repeatable service delivery.' } },
] as const;

export default function OverviewPage() {
  return <main className="overview-page">
    <header className="overview-nav overview-wrap">
      <AppLink href="/" prefetch={false} className="overview-brand">CubeRoot<span>{tr({ zh: '魔方根', en: 'Built for cubers' })}</span></AppLink>
      <div className="overview-actions"><button type="button" onClick={() => window.print()}><Printer size={16} aria-hidden />{tr({ zh: '打印 / PDF', en: 'Print / PDF' })}</button><HeaderToggles /></div>
    </header>

    <section className="overview-hero overview-wrap" aria-labelledby="overview-title">
      <div className="overview-hero-copy">
        <p className="overview-kicker">{tr({ zh: '项目资助提案 · 2026 年 10 月', en: 'Project-support proposal · October 2026' })}</p>
        <h1 id="overview-title">{tr({ zh: '让学会魔方的人，\n知道下一步怎么练。', en: 'After the first solve,\nknow what to practise next.' })}</h1>
        <p className="overview-lead">{tr({ zh: '我希望把已有的魔方内容与教学积累，做成能够长期使用的学习与训练平台。CubeRoot 已有可体验的工具；下一步先验证：内容能否带来真实练习，练习能否形成持续使用。', en: 'I want to turn existing cubing content and teaching experience into a lasting learning and practice platform. CubeRoot has usable tools. The next step is to test whether content leads to real practice, and practice to repeat use.' })}</p>
        <a href="#overview-product" className="overview-primary">{tr({ zh: '看看已经做出的产品', en: 'Explore the product' })}<ArrowUpRight size={17} aria-hidden /></a>
        <a href="#overview-funding" className="overview-funding-request">{tr({ zh: '本轮寻求项目资助：人民币 20 万—50 万元', en: 'Project support sought: CNY 200,000–500,000' })}<ArrowUpRight size={16} aria-hidden /></a>
        <p className="overview-reading">{tr({ zh: '先读 3 分钟主线，再看产品与预算明细', en: 'Start with a 3-minute brief, then explore the tools and budget' })}</p>
      </div>
      <figure className="overview-cover"><img src="/images/overview/cubing-cover-v1.webp" width={1536} height={1024} alt={tr({ zh: '魔方与抽象学习、数据元素组成的概念插画', en: 'Concept illustration of a cube with abstract learning and data elements' })} fetchPriority="high" /><figcaption>{tr({ zh: 'AI 生成概念插画', en: 'AI-generated concept illustration' })}</figcaption></figure>
    </section>

    <div className="overview-summary overview-wrap">
      {[{ label: { zh: '为什么是我', en: 'Why this founder' }, text: CREATOR_AUDIENCE.summary }, { label: { zh: '已经有的基础', en: 'Already built' }, text: { zh: '教学经验与可体验的训练工具', en: 'Teaching experience and usable tools' } }, { label: { zh: '本轮要证明什么', en: 'What funding will test' }, text: { zh: '内容带来用户，产品留住用户', en: 'Content brings users; tools earn repeat use' } }].map(item => <div key={item.label.en}><span>{tr(item.label)}</span><strong>{tr(item.text)}</strong></div>)}
    </div>
    <InvestorStory />

    <section className="overview-section overview-wrap overview-founder" aria-labelledby="overview-founder-title">
      <div><p className="overview-kicker">{tr({ zh: '04 / 创始人', en: '04 / Founder' })}</p><h2 id="overview-founder-title">{tr({ zh: '懂数学，\n也在魔方圈里。', en: 'Mathematical roots.\nA cuber’s perspective.' })}</h2><AppLink href="/about/ruimin" prefetch={false} className="overview-text-link">{tr({ zh: '颜瑞民 · 完整个人介绍与获奖档案', en: 'Ruimin Yan · full profile and award archive' })}<ArrowUpRight size={16} aria-hidden /></AppLink></div>
      <div className="overview-story"><p>{tr({ zh: '我在南开大学学习数学与金融数学、物理学，之后取得乔治华盛顿大学数学硕士学位。数学和科学计算的训练，让我习惯把复杂问题拆开、建模，再做成可以验证的工具。', en: 'I studied Mathematics and Financial Mathematics, and Physics at Nankai University, then earned a master’s degree in Mathematics at the George Washington University. Mathematics and scientific computing taught me to break complex problems down, model them and build tools whose results can be checked.' })}</p><p>{tr({ zh: '自 2017 年起参加 WCA 比赛，也持续做速拧课程设计、公式库建设与魔方内容创作，著有《超脑思维：魔方游戏技巧从入门到精通》。这些经历，是 CubeRoot 产品方向的基础：把专业知识变成更容易学习、更方便使用的东西。', en: 'I have competed in WCA events since 2017 and work on speedcubing courses, algorithm libraries and cubing content. I wrote Superbrain Thinking: Rubik’s Cube Skills from Beginner to Mastery. These experiences underpin CubeRoot: turning specialist knowledge into resources that are easier to learn from and use.' })}</p><div className="overview-founder-note"><School size={24} aria-hidden /><p>{tr({ zh: '数学与物理背景 × 参赛经历 × 教学与内容 × 产品开发', en: 'Mathematics & physics × competing × teaching & content × product development' })}</p></div></div>
    </section>

    <section id="overview-product" className="overview-section overview-wrap" aria-labelledby="overview-product-title">
      <p className="overview-kicker">{tr({ zh: '05 / 产品基础', en: '05 / Product foundation' })}</p><div className="overview-section-head"><h2 id="overview-product-title">{tr({ zh: '有产品，才有下一步。', en: 'A working foundation for what comes next.' })}</h2><AppLink href="/achievements" prefetch={false} className="overview-text-link">{tr({ zh: '查看原创工作', en: 'Explore original work' })}<ArrowUpRight size={16} aria-hidden /></AppLink></div>
      <div className="overview-product-grid">{PRODUCTS.map(({ Icon, href, title, body, tag }) => <AppLink href={href} prefetch={false} className="overview-product" data-site-surface="panel" key={href}><Icon size={27} strokeWidth={1.5} aria-hidden /><span className="overview-small">{tr(tag)}</span><h3>{tr(title)}</h3><p>{tr(body)}</p><span className="overview-text-link">{tr({ zh: '打开体验', en: 'Try it' })}<ArrowUpRight size={16} aria-hidden /></span></AppLink>)}</div>
      <div className="overview-engine"><VisualCube view="iso" algorithm="R U R' U'" size={170} local alt={tr({ zh: '可计算、可展示的魔方状态', en: 'A cube state that can be computed and visualised' })} /><div><h3>{tr({ zh: '专业能力，进入日常使用。', en: 'Specialist work, everyday use.' })}</h3><p>{tr({ zh: '求解器、打乱难度分析、状态可视化与数据统计，为进阶体验提供技术基础。网站同时使用公开数据与开源项目，保留来源与致谢。', en: 'Solvers, scramble difficulty analysis, state visualisation and statistics provide the technical foundation for advanced experiences. Public data and open-source projects are used with attribution.' })}</p><AppLink href="/about" prefetch={false} className="overview-text-link">{tr({ zh: '数据与开源致谢', en: 'Data & open-source credits' })}<ArrowUpRight size={15} aria-hidden /></AppLink></div></div>
    </section>

    <section className="overview-section overview-wrap" aria-labelledby="overview-plan-title"><p className="overview-kicker">{tr({ zh: '06 / 阶段规划', en: '06 / Roadmap' })}</p><h2 id="overview-plan-title">{tr({ zh: '从可靠工具，走向长期平台。', en: 'From reliable tools to a lasting platform.' })}</h2><p className="overview-intro">{tr({ zh: '以下是本提案建议的推进节奏，随资金、试用反馈与团队能力调整；多端客户端和教学系统正在推进，不等于已经全面发布或完成商业验证。', en: 'This brief proposes a sequence that can adapt to funding, feedback and team capacity. Cross-platform clients and teaching systems are in development; that does not imply full release or commercial validation.' })}</p><ol className="overview-roadmap">{ROADMAP.map((item, index) => <li key={item.period.en}><span className="overview-step">0{index + 1}</span><div><p className="overview-kicker">{tr(item.period)}</p><h3>{tr(item.title)}</h3><p>{tr(item.body)}</p><p className="overview-measure">{tr(item.proof)}</p></div></li>)}</ol></section>

    <CostsFunding />
    <section className="overview-section overview-wrap overview-partner" aria-labelledby="overview-partner-title"><div><p className="overview-kicker">{tr({ zh: '10 / 开始合作', en: '10 / Next steps' })}</p><h2 id="overview-partner-title">{tr({ zh: '把下一年的计划，\n变成可共同推进的项目。', en: 'Turn the next year’s plan\ninto a shared undertaking.' })}</h2><p className="overview-intro">{tr({ zh: '本轮希望以项目资助支持下一阶段，不按借贷提出，也不附带自动股权。欢迎先体验产品，再确认资助规模、阶段成果与拨付安排。未来股权合作如有共同意愿，另行讨论。', en: 'This request is for project support, not a loan or automatic equity. Try the tools, then agree the support amount, milestones and funding stages. Any future equity partnership would be discussed separately if both parties wish.' })}</p><AppLink href="/contact" prefetch={false} className="overview-primary">{tr({ zh: '联系颜瑞民，讨论合作', en: 'Contact Ruimin Yan to discuss partnering' })}<ArrowUpRight size={17} aria-hidden /></AppLink><p className="overview-print-url">cuberoot.me/zh/overview</p></div><div className="overview-use-of-funds" data-site-surface="panel"><HeartHandshake size={28} aria-hidden /><h3>{tr({ zh: '下一次沟通，明确四件事', en: 'Four decisions for our next conversation' })}</h3><ul><li>{tr({ zh: '合作方式与资金规模', en: 'Partnership type and funding amount' })}</li><li>{tr({ zh: '12 个月预算与阶段交付', en: '12-month budget and staged delivery' })}</li><li>{tr({ zh: '双方权益与成果统计口径', en: 'Partner rights and outcome measurement' })}</li><li>{tr({ zh: '拨付、复核与后续安排', en: 'Funding stages, reviews and next steps' })}</li></ul><p>{tr({ zh: '从一组明确目标开始，用真实使用和交付结果建立长期合作。', en: 'Start with clear objectives and build a lasting partnership through real use and delivery.' })}</p></div></section>
    <footer className="overview-footer overview-wrap"><strong>CubeRoot</strong><p>{tr({ zh: '颜瑞民 · 项目介绍 · 2026.10', en: 'Ruimin Yan · Project brief · 2026.10' })}</p><AppLink href="/about/ruimin" prefetch={false}>{tr({ zh: '个人履历', en: 'Founder profile' })}</AppLink><AppLink href="/contact" prefetch={false}>{tr({ zh: '联系方式', en: 'Contact' })}</AppLink></footer>
  </main>;
}
