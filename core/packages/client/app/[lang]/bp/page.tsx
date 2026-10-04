'use client';

import { useRef } from 'react';
import { useBpMotion } from './useBpMotion';
import { ArrowRight, ArrowUpRight, BookOpen, Building2, ChartNoAxesColumnIncreasing, Check, ChevronDown, Clock3, Code2, Globe2, Layers3, Printer, Radio, RotateCcw, ScanSearch, School, ShieldCheck, Sparkles, Timer, Users } from 'lucide-react';
import AppLink from '@/components/AppLink';
import HeaderToggles from '@/components/HeaderToggles';
import CubeRootLogo from '@/components/CubeRootLogo';
import { VisualCube } from '@/components/VisualCube';
import { tr } from '@/i18n/tr';
import { CREATOR_AUDIENCE } from '@/lib/creator-profile';
import { benefitCopy } from '@cuberoot/shared/membership-benefits';
import { useMembershipBenefits } from '@/hooks/useMembershipBenefits';
import { EXPENSES, EQUIPMENT_GROUPS } from '@/lib/infrastructure-costs';
import InvestorStory from './InvestorStory';
import MarketOpening from './MarketOpening';
import CooperationOpportunity from './CooperationOpportunity';
import BusinessExpansion, { BusinessStreams } from './BusinessExpansion';
import { MARKET_SOURCE } from './bp-data';
import './bp-market.css';
import { BUSINESS_SECTIONS, BP_NAV, type BpSection } from './bp-content';
import { CHAPTER_VISUALS } from './bp-visuals';
import { FounderEvidence, ProductAtlas, ServiceMap } from './BpIllustrations';
import './bp.css';
import './bp-editorial.css';

const PRODUCTS = [
  { Icon: Timer, href: '/timer', title: { zh: '计时器与训练记录', en: 'Timer & practice records' }, body: { zh: '打乱、计时、训练记录和统计服务日常练习。选手反复还原、比较表现并积累记录，是平台高频使用的主要入口。', en: 'Scrambles, timing, records and statistics support routine practice. Repeated solves, comparisons and accumulated history make this a frequent entry point.' } },
  { Icon: BookOpen, href: '/alg', title: { zh: '公式库与训练器', en: 'Algorithms & trainers' }, body: { zh: '将公式、状态图示、动画和训练连接起来，让识别与动作熟练度通过反复练习提高；与计时器共同承接内容中的训练方法。', en: 'Connect algorithms, state diagrams, animation and training for repeated recognition and execution practice, alongside the timer.' } },
  { Icon: ScanSearch, href: '/recon', title: { zh: '解法复盘与专业分析', en: 'Reconstruction & specialist analysis' }, body: { zh: '借助解法记录、动画和逐帧工具研究步骤与效率；将高手解法与个人练习连接，为专业会员服务提供基础。', en: 'Study steps and efficiency through solve records, animation and frame tools, connecting expert solutions with individual practice.' } },
  { Icon: ChartNoAxesColumnIncreasing, href: '/wca', title: { zh: '赛事、成绩与数据', en: 'Competitions, results & data' }, body: { zh: '提供赛事、公开成绩、统计与可视化，帮助用户理解比赛和进步方向，连接训练与魔方圈的长期活动。', en: 'Competition information, public results, statistics and visualisations connect training with ongoing activity in the sport.' } },
] as const;

const SUPPORT_USES = [
  { title: { zh: '产品开发与维护', en: 'Development & maintenance' }, body: { zh: '团队持续开发时间、核心计时和训练体验、会员服务交付、必要的开发协作。', en: 'Sustained team work, core timing and training, membership delivery and targeted development help.' } },
  { title: { zh: 'AI、计算与运行服务', en: 'AI, compute & operations' }, body: { zh: 'Codex、服务器、求解与统计计算、数据存储、部署与多端发布维护。', en: 'Codex, hosting, solving and statistics, storage, deployment and platform maintenance.' } },
  { title: { zh: '内容与专业服务', en: 'Content & specialist delivery' }, body: { zh: '教程和公式整理、高手解法内容、个人视频复盘、课程方案与质量复核。', en: 'Lessons and algorithms, expert reconstructions, personal review, course planning and quality checks.' } },
  { title: { zh: '推广与机构服务', en: 'Promotion & educator services' }, body: { zh: '已有粉丝渠道推广、用户沟通、会员运营、企业上线与可复用的交付流程。', en: 'Existing-audience promotion, user communication, membership operations, enterprise onboarding and repeatable delivery.' } },
] as const;

function NarrativeSection({ section }: { section: BpSection }) {
  const visual = CHAPTER_VISUALS[section.id];
  const icons = visual.style === 'audience' ? [Users, Building2, School, Globe2]
    : visual.style === 'flow' ? [Radio, Timer, Sparkles, Building2]
    : visual.style === 'system' ? [Code2, Sparkles, Clock3, ShieldCheck]
    : [Users, Layers3, ChartNoAxesColumnIncreasing, Globe2, ShieldCheck, Clock3];
  return (
    <section id={section.id} className={'overview-section overview-wrap bp-chapter bp-chapter-' + visual.style} aria-labelledby={section.id + '-title'}>
      <p className="overview-kicker">{section.number} / {tr(section.label)}</p>
      <h2 id={section.id + '-title'}>{tr(section.title)}</h2>
      <div className={'bp-visual bp-visual-' + visual.style}>
        {section.cards.map((card, index) => {
          const Icon = icons[index];
          return <article key={card.title.en} data-site-surface="panel">
            <div className="bp-visual-top"><span className="bp-icon"><Icon size={24} strokeWidth={1.5} aria-hidden /></span><span className="bp-visual-tag">{tr(visual.tags[index])}</span></div>
            <h3>{tr(card.title)}</h3>
            <p>{tr(visual.captions[index])}</p>
          </article>;
        })}
      </div>
      <details className="bp-detail">
        <summary>{tr({ zh: '阅读完整商业说明', en: 'Read the full business rationale' })}<ChevronDown size={18} aria-hidden /></summary>
        <div className="bp-detail-body">
          <p className="overview-intro">{tr(section.intro)}</p>
          <div className="bp-detail-columns">{section.cards.map(card => <article key={card.title.en}><h3>{tr(card.title)}</h3><p>{tr(card.body)}</p></article>)}</div>
          {section.conclusion && <p className="bp-conclusion">{tr(section.conclusion)}</p>}
        </div>
      </details>
    </section>
  );
}

function printBusinessPlan() {
  const sections = [...document.querySelectorAll<HTMLDetailsElement>('.bp-page details')];
  const states = sections.map(section => section.open);
  sections.forEach(section => { section.open = true; });
  window.addEventListener('afterprint', () => sections.forEach((section, index) => { section.open = states[index]; }), { once: true });
  window.print();
}

export default function BusinessPlanPage() {
  const { content: benefits } = useMembershipBenefits();
  const pageRef = useRef<HTMLElement>(null);
  useBpMotion(pageRef);
  return (
    <main ref={pageRef} className="overview-page bp-page bp-editorial">
      <header className="overview-nav overview-wrap">
        <div className="overview-brand">
          <CubeRootLogo height={30} variant="mark" />
          <div>{tr({ zh: '魔方根', en: 'CubeRoot' })}<span>{tr({ zh: '商业计划书', en: 'Business plan' })}</span></div>
        </div>
        <div className="overview-actions">
          <button className="overview-action" type="button" onClick={printBusinessPlan}>
            <Printer size={16} aria-hidden />{tr({ zh: '打印 / PDF', en: 'Print / PDF' })}
          </button>
          <HeaderToggles />
        </div>
      </header>

      <MarketOpening />

      <div className="overview-summary overview-wrap">
        {[
          { number: { zh: `${CREATOR_AUDIENCE.followersApprox / 10000} 万`, en: `${CREATOR_AUDIENCE.followersApprox / 1000}K` }, label: { zh: '平台合计关注', en: 'Aggregate follows' }, text: { zh: '已有内容与推广渠道', en: 'An existing distribution channel' } },
          { number: { zh: '500+', en: '500+' }, label: { zh: '教师社群成员', en: 'Teacher-group members' }, text: { zh: '创始人为群主 · 机构合作洽谈中', en: 'Founder-led group · institution talks ongoing' } },
          { number: { zh: '3 类', en: '3' }, label: { zh: '业务方向', en: 'Business streams' }, text: { zh: '订阅 · 课程 · 计划中的线上赛事', en: 'Subscriptions · courses · planned online events' } },
        ].map(item => <div key={item.label.en}><span className="bp-stat-number">{tr(item.number)}</span><strong>{tr(item.label)}</strong><span>{tr(item.text)}</span></div>)}
      </div>

      <nav className="bp-toc overview-wrap" aria-label={tr({ zh: '商业计划书目录', en: 'Business plan contents' })}>
        {BP_NAV.filter(([id]) => ['bp-market-size', 'bp-product', 'bp-business', 'bp-competition', 'bp-roadmap', 'bp-cooperation'].includes(id)).map(([id, label]) => <a href={'#' + id} key={id}>{tr(label)}</a>)}
      </nav>

      <section id="bp-summary" className="overview-section overview-wrap" aria-labelledby="bp-summary-title">
        <p className="overview-kicker">{tr({ zh: '00 / 执行摘要', en: '00 / Executive summary' })}</p>
        <h2 id="bp-summary-title">{tr({ zh: '订阅、课程与线上赛事，\n围绕同一条学习路径展开。', en: 'Subscriptions, courses and online events.\nOne connected learning journey.' })}</h2>
        <p className="overview-intro">{tr({ zh: '魔方速拧是一项依靠反复练习、记录和反馈提升的技能。计时器和训练器可以进入选手的日常练习，复盘与教学内容则帮助用户决定怎么练。魔方根已有可使用的工具和真实付费会员，课程业务正在开展，线上赛事计划按月组织。下一阶段重点是完善服务交付、推进课程和赛事准备，并扩大已有渠道的推广。', en: 'Speedcubing improves through repeated practice, records and feedback. Timers and trainers support routine practice, while reconstruction and lessons guide the next steps. CubeRoot has usable tools and real paid members, ongoing course work and planned monthly online events. Next steps strengthen service delivery, course and event preparation, and distribution.' })}</p>
        <div className="bp-executive-bento">
          <div className="bp-executive-core" data-site-surface="panel">
            <span className="bp-icon"><RotateCcw size={30} aria-hidden /></span>
            <h3>{tr({ zh: '高频练习，持续服务。', en: 'Recurring practice. Continuing service.' })}</h3>
            <div className="bp-mini-loop"><span>{tr({ zh: '计时', en: 'Time' })}</span><ArrowRight size={15} /><span>{tr({ zh: '训练', en: 'Train' })}</span><ArrowRight size={15} /><span>{tr({ zh: '复盘', en: 'Reflect' })}</span><RotateCcw size={16} /></div>
            <p>{tr({ zh: '专业能力 × 内容触达 × 日常工具', en: 'Expertise × distribution × daily tools' })}</p>
          </div>
          <div className="bp-executive-tile" data-site-surface="panel"><Users size={26} aria-hidden /><h3>{tr({ zh: '个人订阅', en: 'Individuals' })}</h3><p>{tr({ zh: '求解 · 高手复盘 · 专业反馈', en: 'Solving · reconstructions · feedback' })}</p></div>
          <div className="bp-executive-tile" data-site-surface="panel"><Building2 size={26} aria-hidden /><h3>{tr({ zh: '机构订阅', en: 'Organisations' })}</h3><p>{tr({ zh: '展示 · 资料 · 课程与教学服务', en: 'Profiles · resources · teaching services' })}</p></div>
          <div className="bp-executive-milestone" data-site-surface="panel"><span className="bp-milestone-number">02<span>{tr({ zh: '个月', en: 'months' })}</span></span><div><h3>{tr({ zh: '规模化订阅推广目标', en: 'Target for expanded subscriptions' })}</h3><p>{tr({ zh: '支付与资质审核完成后推进', en: 'Subject to payment and qualification approvals' })}</p></div><ArrowUpRight size={25} aria-hidden /></div>
        </div>
        <details className="bp-detail"><summary>{tr({ zh: '完整执行摘要与事实口径', en: 'Full executive summary & definitions' })}<ChevronDown size={18} aria-hidden /></summary><div className="bp-detail-body"><div className="bp-detail-columns">
          {[
            { title: { zh: '产品与目标客户', en: 'Product & customers' }, body: { zh: '服务持续训练的个人选手，以及需要展示、资料和教学服务的老师、工作室与机构。计时、公式训练、复盘和数据入口已在网站提供。', en: 'Serve regular practitioners and educators needing visibility, resources and teaching services. Timing, algorithms, reconstruction and data tools are already available on the website.' } },
            { title: { zh: '收入方式', en: 'Revenue model' }, body: { zh: '以个人和企业的月度、年度会员为主要方向。个人侧交付专业求解、复盘与反馈；企业侧交付介绍页、师生展示、资料存储和课程方案。课程业务正在开展，线上赛事作为计划中的另一项收入来源；商城留待后续。', en: 'Monthly and annual personal and enterprise memberships are the main direction. Individuals receive specialist solving, reconstruction and feedback; organisations receive profiles, teacher–student visibility, storage and course planning. Course work is in progress, online events are another planned revenue stream, and commerce is deferred.' } },
            { title: { zh: '执行与市场基础', en: 'Execution & distribution' }, body: { zh: '创始人有数学与物理背景、参赛与教学经历，以及约 50 万平台合计关注。创始人全职投入，并运营约 500 人的魔方老师群，与部分机构持续洽谈；已有用户在计时器和训练器中使用多项功能。', en: 'The founder combines mathematics and physics, competing and teaching, and about 500,000 aggregate follows. The founder works full time, runs a teacher group of about 500 members and is discussing opportunities with institutions; users already use multiple timer and trainer functions.' } },
            { title: { zh: '下一阶段的执行重点', en: 'Next-stage priorities' }, body: { zh: '计划在本计划形成后的两个月内推进规模化订阅推广，前提是微信支付与相关资质审核完成、服务能够稳定交付。并行推进课程交付和线上赛事规则、报名及成绩审核准备。', en: 'Aim to expand subscription promotion within two months of this plan, conditional on WeChat payment and relevant qualification approvals and reliable delivery. Prepare course delivery and online-event rules, registration and result review in parallel.' } },
          ].map(card => <article key={card.title.en} data-site-surface="panel"><h3>{tr(card.title)}</h3><p>{tr(card.body)}</p></article>)}
        </div>
        <p className="overview-small">{tr({ zh: '全职投入、付费会员、课程进展、教师社群与赛事计划由创始人确认。关注数为平台合计、未去重；行业预测、经营计划与已实现成果分别标注。', en: 'Full-time work, paid membership, courses, the teacher community and event plans are founder-confirmed. Follows are aggregate and not deduplicated. Industry forecasts, operating plans and realised results are labelled separately.' })}</p>
        </div></details>
      </section>

      <InvestorStory />

      <section id="bp-product" className="overview-section overview-wrap" aria-labelledby="bp-product-title">
        <p className="overview-kicker">{tr({ zh: '04 / 产品与已有使用', en: '04 / Product & existing use' })}</p>
        <div className="overview-section-head"><h2 id="bp-product-title">{tr({ zh: '训练不是一次性需求，\n产品围绕持续使用展开。', en: 'Practice is a recurring need.\nThe product supports repeated use.' })}</h2></div>
        <p className="overview-intro">{tr({ zh: '正在持续训练的选手，需要反复计时、练习识别与动作、比较记录并研究解法。计时器与训练器中的多项功能已经被使用；本计划不展开具体选手案例，把重点放在产品如何承接日常练习与专业服务。', en: 'Practising competitors repeatedly time solves, train recognition and execution, compare records and study solutions. Multiple timer and trainer functions are already in use. This plan focuses on the product’s practice and service role without identifying individual athletes.' })}</p>
        <div className="bp-product-story">
        <figure className="bp-product-preview">
          <div className="bp-preview-toolbar"><span className="bp-window-dots" aria-hidden><i /><i /><i /></span><span>cuberoot.me / timer</span><span>{tr({ zh: '真实产品界面', en: 'ACTUAL PRODUCT' })}</span></div>
          <img src="/images/overview/timer-preview-v3.png" width={2880} height={1344} loading="lazy" alt={tr({ zh: '魔方根计时器的真实界面，包含打乱、计时和阶段求解入口', en: 'The actual CubeRoot timer with scramble, timing and stage-solving controls' })} />
          <figcaption><div><Timer size={18} aria-hidden /><strong>{tr({ zh: '计时器 · 高频训练入口', en: 'Timer · the everyday practice entry' })}</strong></div><AppLink href="/timer" prefetch={false}>{tr({ zh: '打开体验', en: 'Try it' })}<ArrowUpRight size={16} aria-hidden /></AppLink></figcaption>
        </figure>
        <div className="bp-product-chapters">
          {[
            { label: { zh: '计时', en: 'TIME' }, title: { zh: '每一次练习，\n都有记录。', en: 'Every practice.\nA new record.' }, body: { zh: '从打乱到计时，把日常练习留在同一个入口。', en: 'From scramble to timer, everyday practice starts in one place.' } },
            { label: { zh: '训练', en: 'TRAIN' }, title: { zh: '理解解法，\n再进一步。', en: 'Understand a solve.\nGo one step further.' }, body: { zh: '阶段求解与状态展示，让选手研究不同的还原思路。', en: 'Stage solving and cube states help practitioners explore different solutions.' } },
            { label: { zh: '进阶', en: 'PROGRESS' }, title: { zh: '从反复使用，\n到持续服务。', en: 'Repeated practice.\nContinuing service.' }, body: { zh: '以高频工具连接公式训练、解法复盘与专业会员服务。', en: 'Connect frequent practice with algorithms, reconstruction and specialist membership.' } },
          ].map(step => <article className="bp-product-chapter" key={step.label.en}><span>{tr(step.label)}</span><h3>{tr(step.title)}</h3><p>{tr(step.body)}</p></article>)}
        </div>
        </div>
        <ProductAtlas />
        <div className="overview-product-grid">
          {PRODUCTS.map(({ Icon, href, title, body }) => <AppLink href={href} key={href} prefetch={false} className="overview-product" data-site-surface="panel"><Icon size={27} aria-hidden /><h3>{tr(title)}</h3><p>{tr(body)}</p><span className="overview-text-link">{tr({ zh: '打开体验', en: 'Try it' })}<ArrowUpRight size={16} aria-hidden /></span></AppLink>)}
        </div>
        <div className="overview-engine">
          <VisualCube view="iso" algorithm="R U R' U'" size={170} local alt={tr({ zh: '用于求解与训练的魔方状态展示', en: 'A cube state for solving and training' })} />
          <div><h3>{tr({ zh: '技术积累支撑专业训练服务', en: 'Technical work supports specialist practice' })}</h3><p>{tr({ zh: '求解器、状态可视化、复盘交互与打乱统计，为专业工具提供基础。原创成果可直接体验，公开数据与开源组件保留来源。工具、内容与服务在一个平台协同，减少用户在不同资料与工具之间切换。', en: 'Solvers, state visualisation, reconstruction and scramble statistics support specialist tools. Original work is inspectable; public data and open-source components are credited. Connecting tools, content and services reduces switching between resources.' })}</p><AppLink href="/achievements" prefetch={false} className="overview-text-link">{tr({ zh: '查看原创工作与在线入口', en: 'Inspect original work and tools' })}<ArrowUpRight size={16} aria-hidden /></AppLink></div>
        </div>
      </section>

      <section id="bp-founder" className="overview-section overview-wrap overview-founder" aria-labelledby="bp-founder-title">
        <div><p className="overview-kicker">{tr({ zh: '05 / 创始人与专业积累', en: '05 / Founder & expertise' })}</p><h2 id="bp-founder-title">{tr({ zh: '懂专业，也能把产品做出来。', en: 'Domain expertise with product execution.' })}</h2><AppLink href="/about/ruimin" prefetch={false} className="overview-text-link">{tr({ zh: '颜瑞民 · 公开履历与获奖档案', en: 'Ruimin Yan · profile and awards' })}<ArrowUpRight size={16} aria-hidden /></AppLink><div className="overview-founder-note"><School size={24} aria-hidden /><p>{tr({ zh: '数学与物理 × 参赛与教学 × 内容与开发', en: 'Mathematics & physics × competing & teaching × content & development' })}</p></div></div>
        <div className="bp-founder-profile"><div className="bp-founder-art" data-site-surface="panel"><span className="bp-founder-monogram" aria-hidden>∑</span><span className="bp-founder-name">{tr({ zh: '颜瑞民', en: 'Ruimin Yan' })}</span><p>{tr({ zh: '创始人 · 数学硕士 · 魔方内容创作者', en: 'Founder · mathematics graduate · cubing creator' })}</p><div className="bp-founder-credentials"><span>{tr({ zh: '南开大学', en: 'Nankai University' })}</span><span>{tr({ zh: '乔治华盛顿大学', en: 'George Washington University' })}</span><span>WCA 2017YANR02</span></div></div><FounderEvidence /><details className="bp-detail"><summary>{tr({ zh: '创始人的专业与教学经历', en: 'Founder’s professional and teaching background' })}<ChevronDown size={18} aria-hidden /></summary><div className="overview-story bp-detail-body">
          <p>{tr({ zh: '颜瑞民拥有南开大学数学与金融数学、物理学学士学位，以及乔治华盛顿大学数学硕士学位。曾两次获全国高中数学联赛一等奖，并获中国数学奥林匹克铜牌。专业训练为求解算法、数据分析和复杂产品开发提供基础。', en: 'Ruimin Yan holds bachelor’s degrees in Mathematics and Financial Mathematics, and Physics from Nankai University, and a master’s in Mathematics from George Washington University. He won first prize twice in the National High School Mathematics League and a bronze medal at the Chinese Mathematical Olympiad.' })}</p>
          <p>{tr({ zh: '自 2017 年起参加 WCA 比赛，持续开展速拧课程、公式库和自媒体内容工作，著有《超脑思维：魔方游戏技巧从入门到精通》。内容创作、教学与亲身训练使他能够把专业能力转换为用户理解和使用的产品。', en: 'Competing in WCA events since 2017, he works on speedcubing courses, algorithms and media, and wrote Superbrain Thinking: Rubik’s Cube Skills from Beginner to Mastery. Teaching, content and practice help translate expertise into usable products.' })}</p>
        </div></details></div>
      </section>

      <section id="bp-business" className="overview-section overview-wrap" aria-labelledby="bp-business-title">
        <p className="overview-kicker">{tr({ zh: '06 / 商业模式与会员价值', en: '06 / Business model & membership value' })}</p>
        <h2 id="bp-business-title">{tr({ zh: '订阅服务长期练习，\n课程与赛事推动持续参与。', en: 'Subscriptions support practice.\nCourses and events sustain participation.' })}</h2>
        <p className="overview-intro">{tr({ zh: '会员页面与公开套餐已列出个人、企业的月度与年度服务。用户付费的理由，是持续获得专业求解、复盘、反馈或机构服务，而日常工具提供高频入口。基础计时和训练保持开放，收费范围以实际发布的会员权益为准。', en: 'The membership page and public plans describe monthly and annual personal and enterprise services. Payment buys ongoing specialist solving, reconstruction, feedback or educator services; daily tools provide frequent access. Basic timing and training remain open, with paid scope defined by published entitlements.' })}</p>
        <BusinessStreams />
        <ServiceMap />
        <div className="bp-subscriptions">
          {[{ title: { zh: '个人会员', en: 'Individual membership' }, perks: benefits.items.filter(item => item.group === 'common' && item.enabled), explanation: { zh: '续费理由：持续练习中不断遇到新的解法与效率问题，会员获得专业资源和反馈。云端服务与高手内容可复用，个人视频复盘按已发布的数量与项目范围交付。', en: 'Renewal value: ongoing practice brings new solution and efficiency questions. Cloud tools and expert content are reusable; personal video review follows the published allowances and puzzle scope.' } }, { title: { zh: '企业会员', en: 'Enterprise membership' }, perks: benefits.items.filter(item => item.group === 'enterprise' && item.enabled), explanation: { zh: '续费理由：企业展示、资料维护、课程安排和教学关系需要持续服务。标准权益覆盖可复用需求；额外定制明确范围与验收，持续完善机构的实际使用流程。', en: 'Renewal value: profiles, resources, courses and teaching relationships require continuing service. Standard benefits meet repeated needs; additional customisation needs explicit scope and acceptance.' } }].map(plan => (
            <article data-site-surface="panel" key={plan.title.en}>
              <div className="bp-subscription-heading"><span className="bp-icon">{plan.title.en === 'Individual membership' ? <Users size={32} aria-hidden /> : <Building2 size={32} aria-hidden />}</span><span className="bp-subscription-tag">{tr({ zh: '持续服务', en: 'ONGOING SERVICE' })}</span></div>
              <h3>{tr(plan.title)}</h3>
              <ul>{plan.perks.map(perk => <li key={perk.id}><Check size={16} aria-hidden /><span>{tr(benefitCopy(perk))}</span></li>)}</ul>
              <p>{tr(plan.explanation)}</p>
            </article>
          ))}
        </div>
        <details className="bp-detail"><summary>{tr({ zh: '会员交付与商业化进度', en: 'Member delivery & commercial progress' })}<ChevronDown size={18} aria-hidden /></summary><div className="bp-detail-body"><div className="bp-detail-columns">
          <article data-site-surface="panel"><h3>{tr({ zh: '共有权益与会员关系', en: 'Shared benefits & member relationships' })}</h3><p>{tr({ zh: '会员页还列出徽章、抢先体验、致谢、VIP 群与自定义展示等权益，为交流和身份认同提供补充。长期经营以专业服务的使用效果为核心，建立反馈、问题响应和内容更新机制。', en: 'Badges, early access, acknowledgments, community and custom presentation complement specialist services. Long-term membership centres on useful delivery, feedback, support and content updates.' })}</p></article>
          <article data-site-surface="panel"><h3>{tr({ zh: '已有付费，规模化上线仍需条件', en: 'Real paid members; launch conditions remain' })}</h3><p>{tr({ zh: '创始人确认已有真实付费会员。会员当前尚未正式全面开放，微信支付及部分资质审核仍在推进，自动续费尚未开放。目标是在两个月内推动更大规模订阅，按审核、支付和服务交付的实际完成情况执行。', en: 'The founder confirms real paid members. Membership has not fully launched; WeChat payment and qualification approvals remain in progress and auto-renewal is unavailable. The two-month expansion target depends on approvals, payment readiness and delivery.' })}</p></article>
          <article data-site-surface="panel"><h3>{tr({ zh: '建议完善：权益与交付规则', en: 'Proposed improvement: entitlement delivery rules' })}</h3><p>{tr({ zh: '为每项专业服务说明输入要求、提交入口、排期、处理范围和问题反馈方式；把人工复盘与计算服务的交付能力分别管理。机构定制明确需求确认、制作、修改和验收流程，降低购买前的不确定性。', en: 'Define inputs, submission, scheduling, scope and issue handling for specialist services. Manage human review separately from compute delivery. Define requirements, production, revision and acceptance for educator customisation.' })}</p></article>
          <article data-site-surface="panel"><h3>{tr({ zh: '建议完善：可复制的机构产品', en: 'Proposed improvement: repeatable educator products' })}</h3><p>{tr({ zh: '沿现有企业权益，逐步完善老师任务、学员训练、反馈与管理能力。将标准服务和额外定制分开说明；新权益在实际可交付后发布。更深入的教学系统已有研发积累，正式商用范围按实际上线情况确定。', en: 'Extend existing benefits towards teacher assignments, learner practice, feedback and management. Separate standard services from custom work and publish new benefits only when deliverable. Deeper teaching workflows have development foundations; commercial scope follows release status.' })}</p></article>
        </div>
        </div></details>
        <AppLink href="/membership" prefetch={false} className="overview-text-link">{tr({ zh: '查看会员页面与当前权益', en: 'Inspect the current membership page' })}<ArrowUpRight size={16} aria-hidden /></AppLink>
      </section>

      <BusinessExpansion />

      {BUSINESS_SECTIONS.filter(section => section.number !== '14').map(section => <NarrativeSection key={section.id} section={section} />)}

      <section id="bp-costs" className="overview-section overview-wrap" aria-labelledby="bp-costs-title">
        <p className="overview-kicker">{tr({ zh: '13 / 已有投入与运营成本', en: '13 / Existing resources & operating costs' })}</p>
        <h2 id="bp-costs-title">{tr({ zh: '让持续交付的成本可管理，\n让已有设备继续发挥作用。', en: 'Manage the cost of delivery.\nKeep using existing equipment.' })}</h2>
        <p className="overview-intro">{tr({ zh: '网站已记录 AI 开发工具、服务器、发布服务和工作设备等投入。本节列出成本类别与用途。下一阶段围绕订阅、课程和线上赛事安排开发与服务工作，已有设备按实际需要复用。', en: 'The site records development AI, hosting, distribution and equipment costs. This section lists cost categories and purposes. Plan development and delivery around subscriptions, courses and online events while reusing existing equipment.' })}</p>
        <div className="overview-cost-grid">
          <div><h3>{tr({ zh: '持续运行与开发服务', en: 'Ongoing development & operations' })}</h3><dl className="overview-cost-list">{EXPENSES.map(expense => <div key={expense.name.en}><dt><strong>{tr(expense.name)}</strong><span>{tr(expense.purpose)}</span></dt></div>)}</dl></div>
          <div><h3>{tr({ zh: '已有开发与内容设备', en: 'Existing development & production equipment' })}</h3><div className="overview-equipment-pictures"><img src="/images/dev/infrastructure/mac-mini-m5-pro.webp" width={240} height={180} loading="lazy" alt="Mac mini" /><img src="/images/dev/infrastructure/canon-eos-r5-mark-ii-cutout.webp" width={240} height={180} loading="lazy" alt="Canon EOS R5 Mark II" /><img src="/images/dev/infrastructure/dji-mic-3.webp" width={240} height={180} loading="lazy" alt="DJI Mic 3" /></div><dl className="overview-cost-list">{EQUIPMENT_GROUPS.filter(group => group.items.length > 0).map(group => <div key={group.category.en}><dt><strong>{tr(group.category)}</strong><span>{group.items.slice(0, 3).map(item => tr(item.name)).join(' · ')}</span></dt></div>)}</dl></div>
        </div>
        <div className="overview-advantage-grid bp-detail-grid">{SUPPORT_USES.map(item => <article data-site-surface="panel" key={item.title.en}><h3>{tr(item.title)}</h3><p>{tr(item.body)}</p></article>)}</div>
        <p className="overview-small">{tr({ zh: '设备记录包含个人通用设备、曾用设备和估价，不视作全部属于项目的实付款；既有设备不重复列为新采购。开发工具、用户侧计算、人工服务与固定运行成本分别核算，实际预算由下一阶段任务形成。', en: 'Equipment records include general-purpose, former and estimated devices rather than a project payment ledger. Do not count existing equipment as new purchases. Account separately for tooling, user-serving compute, human delivery and fixed operations.' })}</p>
      </section>

      {BUSINESS_SECTIONS.filter(section => section.number === '14').map(section => <NarrativeSection key={section.id} section={section} />)}

      <CooperationOpportunity />

      <section id="bp-sources" className="overview-section overview-wrap bp-sources" aria-labelledby="bp-sources-title">
        <p className="overview-kicker">{tr({ zh: '16 / 资料来源与说明', en: '16 / Sources & definitions' })}</p>
        <h2 id="bp-sources-title">{tr({ zh: '市场、产品与经历，都有据可查。', en: 'Inspect the market, product and founder’s record.' })}</h2>
        <p className="overview-small"><a href={MARKET_SOURCE.url} target="_blank" rel="noopener noreferrer">{tr({ zh: '市场来源：《人民日报》2026-06-01《小小魔方，为何让人如此着迷》', en: 'Market source: People’s Daily, June 1, 2026, “Why is the little cube so captivating?”' })}</a></p>
        <div className="bp-source-links">{[
          ['/membership', { zh: '会员权益与当前开放状态', en: 'Membership benefits & availability' }],
          ['/about/ruimin', { zh: '创始人公开履历与获奖资料', en: 'Founder profile & awards' }],
          ['/achievements', { zh: '原创工具与技术成果', en: 'Original tools & technical work' }],
          ['/about', { zh: '公开数据与开源致谢', en: 'Public data & open-source credits' }],
        ].map(([href, label]) => <AppLink key={String(href)} href={String(href)} prefetch={false}>{tr(label as { zh: string; en: string })}<ArrowUpRight size={15} aria-hidden /></AppLink>)}</div>
        <p className="overview-small">{tr({ zh: '市场规模依据《人民日报》报道，预测保留预测标识；会员内容使用当前权益，竞品说明保留查询日期。付费会员、课程进展、教师社群与线上赛事计划由创始人确认。赛事测算为报名费毛收入情景，机构洽谈不等于签约，商城为后续待办。', en: 'Market figures follow People’s Daily with forecasts labelled. Membership uses current benefits; competitor statements retain their research date. Paid members, courses, the teacher community and online-event plans are founder-reported. Event figures are gross entry-fee scenarios, discussions are not signed contracts, and commerce is deferred.' })}</p>
      </section>
      <p className="overview-print-url">cuberoot.me/zh/bp</p>
      <footer className="overview-footer overview-wrap"><strong>{tr({ zh: '魔方根', en: 'CubeRoot' })}</strong><p>{tr({ zh: '颜瑞民 · 商业计划书 · 2026.10', en: 'Ruimin Yan · Business plan · 2026.10' })}</p><AppLink href="/contact" prefetch={false}>{tr({ zh: '联系方式', en: 'Contact' })}</AppLink></footer>
    </main>
  );
}
