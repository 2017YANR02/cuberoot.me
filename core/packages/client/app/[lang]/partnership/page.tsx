'use client';

import { ArrowRight, ArrowUpRight, BookOpen, Building2, ChartNoAxesColumnIncreasing, Check, ChevronDown, Clock3, Code2, Globe2, HeartHandshake, Layers3, Printer, Radio, RotateCcw, ScanSearch, School, ShieldCheck, Sparkles, Timer, Users } from 'lucide-react';
import AppLink from '@/components/AppLink';
import HeaderToggles from '@/components/HeaderToggles';
import CubeRootLogo from '@/components/CubeRootLogo';
import { VisualCube } from '@/components/VisualCube';
import { tr } from '@/i18n/tr';
import { CREATOR_AUDIENCE } from '@/lib/creator-profile';
import { MEMBERSHIP_PERK_LABEL } from '@/lib/membership-perks';
import { EXPENSES, EQUIPMENT_GROUPS } from '@/lib/infrastructure-costs';
import InvestorStory from './InvestorStory';
import { BUSINESS_SECTIONS, BP_NAV, type BpSection } from './bp-content';
import { CHAPTER_VISUALS } from './bp-visuals';
import './bp.css';

const PRODUCTS = [
  { Icon: Timer, href: '/timer', title: { zh: '计时器与训练记录', en: 'Timer & practice records' }, body: { zh: '打乱、计时、训练记录和统计服务日常练习。选手反复还原、比较表现并积累记录，是平台高频使用的主要入口。', en: 'Scrambles, timing, records and statistics support routine practice. Repeated solves, comparisons and accumulated history make this a frequent entry point.' } },
  { Icon: BookOpen, href: '/alg', title: { zh: '公式库与训练器', en: 'Algorithms & trainers' }, body: { zh: '将公式、状态图示、动画和训练连接起来，让识别与动作熟练度通过反复练习提高；与计时器共同承接内容中的训练方法。', en: 'Connect algorithms, state diagrams, animation and training for repeated recognition and execution practice, alongside the timer.' } },
  { Icon: ScanSearch, href: '/recon', title: { zh: '解法复盘与专业分析', en: 'Reconstruction & specialist analysis' }, body: { zh: '借助解法记录、动画和逐帧工具研究步骤与效率；将高手解法与个人练习连接，为专业会员服务提供基础。', en: 'Study steps and efficiency through solve records, animation and frame tools, connecting expert solutions with individual practice.' } },
  { Icon: ChartNoAxesColumnIncreasing, href: '/wca', title: { zh: '赛事、成绩与数据', en: 'Competitions, results & data' }, body: { zh: '提供赛事、公开成绩、统计与可视化，帮助用户理解比赛和进步方向，连接训练与魔方圈的长期活动。', en: 'Competition information, public results, statistics and visualisations connect training with ongoing activity in the sport.' } },
] as const;

const PERSONAL_PERKS = ['unlimited_333_cloud_optimal', 'expert_recon_10_monthly', 'personal_video_review_2_monthly'] as const;
const ENTERPRISE_PERKS = ['teacher_student_profile_ranking', 'enterprise_profile', 'enterprise_content_storage_custom_course'] as const;
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
            <span className="bp-visual-step" aria-hidden>{String(index + 1).padStart(2, '0')}</span>
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

export default function PartnershipPage() {
  return (
    <main className="overview-page bp-page">
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

      <section className="overview-hero overview-wrap" aria-labelledby="bp-title">
        <div className="overview-hero-copy">
          <p className="overview-kicker"><span className="bp-live-dot" />{tr({ zh: '个人与企业订阅 · 2026 年 10 月', en: 'Individual & enterprise subscriptions · October 2026' })}</p>
          <h1 id="bp-title">{tr({ zh: '每天练习。\n持续进步。', en: 'Everyday practice.\nLasting progress.' })}</h1>
          <p className="bp-hero-subtitle">{tr({ zh: '让专业工具，成为长期服务。', en: 'Specialist tools. Lasting services.' })}</p>
          <p className="overview-lead">
            {tr({ zh: '魔方根将计时、训练、复盘、专业内容和教学服务连接起来，面向个人选手与企业机构提供持续使用的魔方平台。以创始人的内容触达和行业积累为起点，用可靠工具建立日常使用，通过个人与企业会员发展可持续收入。', en: 'CubeRoot connects timing, training, reconstruction, specialist content and educator services for individuals and organisations. Founder-led distribution and domain expertise support daily use, with personal and enterprise membership as the route to sustained revenue.' })}
          </p>
          <a href="#bp-summary" className="overview-primary">
            {tr({ zh: '先看执行摘要', en: 'Read the executive summary' })}<ArrowUpRight size={17} aria-hidden />
          </a>
          <a href="#bp-business" className="overview-funding-request">
            {tr({ zh: '了解个人与企业订阅', en: 'Explore individual & enterprise subscriptions' })}<ArrowUpRight size={16} aria-hidden />
          </a>
          <p className="overview-reading">{tr({ zh: '先读摘要，再按目录查看完整商业逻辑与合作安排', en: 'Start with the summary, then explore the business model and partnership plan' })}</p>
        </div>
        <figure className="overview-cover">
          <img src="/images/overview/cubing-cover-v1.webp" width={1536} height={1024} alt={tr({ zh: '魔方与学习、数据元素组成的概念插画', en: 'A cube with abstract learning and data elements' })} fetchPriority="high" />
          <div className="bp-cover-label"><span>{tr({ zh: '练习 · 记录 · 复盘', en: 'PRACTICE · RECORD · REFLECT' })}</span><ArrowUpRight size={22} aria-hidden /></div>
          <figcaption>{tr({ zh: 'AI 生成概念插画', en: 'AI-generated concept illustration' })}</figcaption>
        </figure>
      </section>

      <div className="overview-summary overview-wrap">
        {[
          { number: { zh: `${CREATOR_AUDIENCE.followersApprox / 10000} 万`, en: `${CREATOR_AUDIENCE.followersApprox / 1000}K` }, label: { zh: '约 · 平台合计关注', en: 'Approx. aggregate follows' }, text: { zh: '已有内容与推广渠道', en: 'An existing distribution channel' } },
          { number: { zh: '03', en: '03' }, label: { zh: '约 · 固定团队成员', en: 'Approx. core team members' }, text: { zh: '创始人全职投入', en: 'Full-time founder commitment' } },
          { number: { zh: '02', en: '02' }, label: { zh: '个人 + 企业订阅方向', en: 'Individual + enterprise' }, text: { zh: '已有真实付费会员', en: 'Real paid members already' } },
        ].map(item => <div key={item.label.en}><span className="bp-stat-number">{tr(item.number)}</span><strong>{tr(item.label)}</strong><span>{tr(item.text)}</span></div>)}
      </div>

      <nav className="bp-toc overview-wrap" aria-label={tr({ zh: '商业计划书目录', en: 'Business plan contents' })}>
        {BP_NAV.map(([id, label]) => <a href={'#' + id} key={id}>{tr(label)}</a>)}
      </nav>

      <section id="bp-summary" className="overview-section overview-wrap" aria-labelledby="bp-summary-title">
        <p className="overview-kicker">{tr({ zh: '00 / 执行摘要', en: '00 / Executive summary' })}</p>
        <h2 id="bp-summary-title">{tr({ zh: '有产品，有受众，\n正在走向规模化订阅。', en: 'A product and an audience.\nMoving towards scaled subscriptions.' })}</h2>
        <p className="overview-intro">{tr({ zh: '魔方速拧是一项依靠反复练习、记录和反馈提升的技能。计时器和训练器可以进入选手的日常练习，复盘与教学内容则帮助用户决定怎么练。魔方根已有可使用的工具和真实付费会员，下一阶段重点是打通商业上线条件、完善会员交付，并扩大已有渠道的推广。', en: 'Speedcubing improves through repeated practice, records and feedback. Timers and trainers support routine practice, while reconstruction and lessons guide the next steps. CubeRoot has usable tools and real paid members; the next stage completes commercial launch requirements, strengthens delivery and expands promotion.' })}</p>
        <div className="bp-executive-bento">
          <div className="bp-executive-core" data-site-surface="panel">
            <span className="bp-icon"><RotateCcw size={30} aria-hidden /></span>
            <h3>{tr({ zh: '高频练习，持续服务。', en: 'Recurring practice. Continuing service.' })}</h3>
            <div className="bp-mini-loop"><span>{tr({ zh: '计时', en: 'Time' })}</span><ArrowRight size={15} /><span>{tr({ zh: '训练', en: 'Train' })}</span><ArrowRight size={15} /><span>{tr({ zh: '复盘', en: 'Reflect' })}</span><RotateCcw size={16} /></div>
            <p>{tr({ zh: '专业能力 × 内容触达 × 日常工具', en: 'Expertise × distribution × daily tools' })}</p>
          </div>
          <div className="bp-executive-tile" data-site-surface="panel"><Users size={26} aria-hidden /><h3>{tr({ zh: '个人订阅', en: 'Individuals' })}</h3><p>{tr({ zh: '求解 · 高手复盘 · 专业反馈', en: 'Solving · reconstructions · feedback' })}</p></div>
          <div className="bp-executive-tile" data-site-surface="panel"><Building2 size={26} aria-hidden /><h3>{tr({ zh: '企业订阅', en: 'Organisations' })}</h3><p>{tr({ zh: '展示 · 资料 · 课程与教学服务', en: 'Profiles · resources · teaching services' })}</p></div>
          <div className="bp-executive-milestone" data-site-surface="panel"><span className="bp-milestone-number">02<span>{tr({ zh: '个月', en: 'months' })}</span></span><div><h3>{tr({ zh: '规模化订阅推广目标', en: 'Target for expanded subscriptions' })}</h3><p>{tr({ zh: '支付与资质审核完成后推进', en: 'Subject to payment and qualification approvals' })}</p></div><ArrowUpRight size={25} aria-hidden /></div>
        </div>
        <details className="bp-detail"><summary>{tr({ zh: '完整执行摘要与事实口径', en: 'Full executive summary & definitions' })}<ChevronDown size={18} aria-hidden /></summary><div className="bp-detail-body"><div className="bp-detail-columns">
          {[
            { title: { zh: '产品与目标客户', en: 'Product & customers' }, body: { zh: '服务持续训练的个人选手，以及需要展示、资料和教学服务的老师、工作室与机构。计时、公式训练、复盘和数据入口已在网站提供。', en: 'Serve regular practitioners and educators needing visibility, resources and teaching services. Timing, algorithms, reconstruction and data tools are already available on the website.' } },
            { title: { zh: '收入方式', en: 'Revenue model' }, body: { zh: '以个人和企业的月度、年度会员为主要方向。个人侧交付专业求解、复盘与反馈；企业侧交付介绍页、师生展示、资料存储和课程方案。品牌合作作为可选补充。', en: 'Monthly and annual personal and enterprise memberships are the main direction. Individuals receive specialist solving, reconstruction and feedback; organisations receive profiles, teacher–student visibility, storage and course planning. Brand partnerships are optional complements.' } },
            { title: { zh: '执行与市场基础', en: 'Execution & distribution' }, body: { zh: '创始人有数学与物理背景、参赛与教学经历，以及约 50 万平台合计关注。项目已从独立开发转为约 3 人固定团队，当前全职投入；已有用户在计时器和训练器中使用多项功能。', en: 'The founder combines mathematics and physics, competing and teaching, and about 500,000 aggregate follows. The project has moved from solo development to approximately three core team members with full-time commitment; users already use multiple timer and trainer functions.' } },
            { title: { zh: '下一阶段与合作诉求', en: 'Next stage & support request' }, body: { zh: '计划在本计划形成后的两个月内推进规模化订阅推广，前提是微信支付与相关资质审核完成、服务能够稳定交付。本轮寻求项目支持，资金规模按具体阶段计划协商；未来股权合作单独讨论。', en: 'Aim to expand subscription promotion within two months of this plan, conditional on WeChat payment and relevant qualification approvals and reliable delivery. Seek project support sized to agreed milestones; discuss future equity separately.' } },
          ].map(card => <article key={card.title.en} data-site-surface="panel"><h3>{tr(card.title)}</h3><p>{tr(card.body)}</p></article>)}
        </div>
        <p className="overview-small">{tr({ zh: '团队、全职投入、付费会员与上线目标由创始人本轮确认。关注数为平台合计、未去重；本版不公布经营人数、收入、价格和融资金额。', en: 'Team, full-time commitment, paid membership and launch targets were confirmed by the founder for this plan. Follows are aggregate and not deduplicated. This version omits operating counts, income, prices and funding figures.' })}</p>
        </div></details>
      </section>

      <InvestorStory />

      <section id="bp-product" className="overview-section overview-wrap" aria-labelledby="bp-product-title">
        <p className="overview-kicker">{tr({ zh: '04 / 产品与已有使用', en: '04 / Product & existing use' })}</p>
        <div className="overview-section-head"><h2 id="bp-product-title">{tr({ zh: '训练不是一次性需求，\n产品围绕持续使用展开。', en: 'Practice is a recurring need.\nThe product supports repeated use.' })}</h2></div>
        <p className="overview-intro">{tr({ zh: '正在持续训练的选手，需要反复计时、练习识别与动作、比较记录并研究解法。计时器与训练器中的多项功能已经被使用；本计划不展开具体选手案例，把重点放在产品如何承接日常练习与专业服务。', en: 'Practising competitors repeatedly time solves, train recognition and execution, compare records and study solutions. Multiple timer and trainer functions are already in use. This plan focuses on the product’s practice and service role without identifying individual athletes.' })}</p>
        <figure className="bp-product-preview">
          <div className="bp-preview-toolbar"><span className="bp-window-dots" aria-hidden><i /><i /><i /></span><span>cuberoot.me / timer</span><span>{tr({ zh: '真实产品界面', en: 'ACTUAL PRODUCT' })}</span></div>
          <img src="/images/overview/timer-preview-v2.webp" width={1440} height={900} loading="lazy" alt={tr({ zh: '魔方根计时器的真实界面，包含打乱、计时和阶段求解入口', en: 'The actual CubeRoot timer with scramble, timing and stage-solving controls' })} />
          <figcaption><div><Timer size={18} aria-hidden /><strong>{tr({ zh: '计时器 · 高频训练入口', en: 'Timer · the everyday practice entry' })}</strong></div><AppLink href="/timer" prefetch={false}>{tr({ zh: '打开体验', en: 'Try it' })}<ArrowUpRight size={16} aria-hidden /></AppLink></figcaption>
        </figure>
        <div className="overview-product-grid">
          {PRODUCTS.map(({ Icon, href, title, body }) => <AppLink href={href} key={href} prefetch={false} className="overview-product" data-site-surface="panel"><Icon size={27} aria-hidden /><h3>{tr(title)}</h3><p>{tr(body)}</p><span className="overview-text-link">{tr({ zh: '打开体验', en: 'Try it' })}<ArrowUpRight size={16} aria-hidden /></span></AppLink>)}
        </div>
        <div className="overview-engine">
          <VisualCube view="iso" algorithm="R U R' U'" size={170} local alt={tr({ zh: '用于求解与训练的魔方状态展示', en: 'A cube state for solving and training' })} />
          <div><h3>{tr({ zh: '技术积累支撑专业训练服务', en: 'Technical work supports specialist practice' })}</h3><p>{tr({ zh: '求解器、状态可视化、复盘交互与打乱统计，为专业工具提供基础。原创成果可直接体验，公开数据与开源组件保留来源。工具、内容与服务在一个平台协同，减少用户在不同资料与工具之间切换。', en: 'Solvers, state visualisation, reconstruction and scramble statistics support specialist tools. Original work is inspectable; public data and open-source components are credited. Connecting tools, content and services reduces switching between resources.' })}</p><AppLink href="/achievements" prefetch={false} className="overview-text-link">{tr({ zh: '查看原创工作与在线入口', en: 'Inspect original work and tools' })}<ArrowUpRight size={16} aria-hidden /></AppLink></div>
        </div>
      </section>

      <section id="bp-founder" className="overview-section overview-wrap overview-founder" aria-labelledby="bp-founder-title">
        <div><p className="overview-kicker">{tr({ zh: '05 / 创始人、团队与主体', en: '05 / Founder, team & entity' })}</p><h2 id="bp-founder-title">{tr({ zh: '懂专业，也能把产品做出来。', en: 'Domain expertise with product execution.' })}</h2><AppLink href="/about/ruimin" prefetch={false} className="overview-text-link">{tr({ zh: '颜瑞民 · 公开履历与获奖档案', en: 'Ruimin Yan · profile and awards' })}<ArrowUpRight size={16} aria-hidden /></AppLink><div className="overview-founder-note"><School size={24} aria-hidden /><p>{tr({ zh: '数学与物理 × 参赛与教学 × 内容与开发', en: 'Mathematics & physics × competing & teaching × content & development' })}</p></div></div>
        <div className="bp-founder-profile"><div className="bp-founder-art" data-site-surface="panel"><span className="bp-founder-monogram" aria-hidden>∑</span><span className="bp-founder-name">{tr({ zh: '颜瑞民', en: 'Ruimin Yan' })}</span><p>{tr({ zh: '创始人 · 数学硕士 · 魔方内容创作者', en: 'Founder · mathematics graduate · cubing creator' })}</p><div className="bp-founder-credentials"><span>{tr({ zh: '南开大学', en: 'Nankai University' })}</span><span>{tr({ zh: '乔治华盛顿大学', en: 'George Washington University' })}</span><span>WCA 2017YANR02</span></div></div><details className="bp-detail"><summary>{tr({ zh: '经历、团队与主体说明', en: 'Profile, team and entity details' })}<ChevronDown size={18} aria-hidden /></summary><div className="overview-story bp-detail-body">
          <p>{tr({ zh: '颜瑞民拥有南开大学数学与金融数学、物理学学士学位，以及乔治华盛顿大学数学硕士学位。曾两次获全国高中数学联赛一等奖，并获中国数学奥林匹克铜牌。专业训练为求解算法、数据分析和复杂产品开发提供基础。', en: 'Ruimin Yan holds bachelor’s degrees in Mathematics and Financial Mathematics, and Physics from Nankai University, and a master’s in Mathematics from George Washington University. He won first prize twice in the National High School Mathematics League and a bronze medal at the Chinese Mathematical Olympiad.' })}</p>
          <p>{tr({ zh: '自 2017 年起参加 WCA 比赛，持续开展速拧课程、公式库和自媒体内容工作，著有《超脑思维：魔方游戏技巧从入门到精通》。内容创作、教学与亲身训练使他能够把专业能力转换为用户理解和使用的产品。', en: 'Competing in WCA events since 2017, he works on speedcubing courses, algorithms and media, and wrote Superbrain Thinking: Rubik’s Cube Skills from Beginner to Mastery. Teaching, content and practice help translate expertise into usable products.' })}</p>
          <p>{tr({ zh: '目前项目已由个人独立推进转为约 3 人固定团队，包括创始人与合作伙伴侧投入的两位成员；项目全职推进。合作伙伴拥有更大的团队背景，但本计划仅按实际参与项目的人力说明，后续扩充按交付需要安排。', en: 'The project has moved from solo work to approximately three core team members: the founder and two contributors from a partner team. Work is full time. The partner’s wider team is not counted as project headcount; future expansion follows delivery needs.' })}</p>
          <p>{tr({ zh: '目前已有个人独资主体，计划调整为新的有限公司或科技公司主体。具体名称、合作签约主体、人员职责和相关权利归属在正式合作前明确；计划中的主体调整不写成已经完成。', en: 'An existing sole-proprietor entity is in place, with a planned transition to a new limited or technology company. Confirm the name, contracting entity, roles and relevant rights before formal partnership; the transition is planned, not completed.' })}</p>
        </div></details></div>
      </section>

      <section id="bp-business" className="overview-section overview-wrap" aria-labelledby="bp-business-title">
        <p className="overview-kicker">{tr({ zh: '06 / 商业模式与会员价值', en: '06 / Business model & membership value' })}</p>
        <h2 id="bp-business-title">{tr({ zh: '个人订阅提供专业帮助，\n企业订阅连接教学与服务。', en: 'Specialist help for individuals.\nTeaching services for organisations.' })}</h2>
        <p className="overview-intro">{tr({ zh: '会员页面与公开套餐已列出个人、企业的月度与年度服务。用户付费的理由，是持续获得专业求解、复盘、反馈或机构服务，而日常工具提供高频入口。基础计时和训练保持开放，收费范围以实际发布的会员权益为准。', en: 'The membership page and public plans describe monthly and annual personal and enterprise services. Payment buys ongoing specialist solving, reconstruction, feedback or educator services; daily tools provide frequent access. Basic timing and training remain open, with paid scope defined by published entitlements.' })}</p>
        <div className="bp-business-spine"><span>{tr({ zh: '日常工具', en: 'Daily tools' })}</span><ArrowRight size={20} aria-hidden /><strong>{tr({ zh: '长期会员服务', en: 'Lasting member services' })}</strong><ArrowRight size={20} aria-hidden /><span>{tr({ zh: '订阅与续费', en: 'Subscriptions & renewal' })}</span></div>
        <div className="bp-subscriptions">
          {[{ title: { zh: '个人会员', en: 'Individual membership' }, perks: PERSONAL_PERKS, explanation: { zh: '续费理由：持续练习中不断遇到新的解法与效率问题，会员获得专业资源和反馈。云端服务与高手内容可复用，个人视频复盘按已发布的数量与项目范围交付。', en: 'Renewal value: ongoing practice brings new solution and efficiency questions. Cloud tools and expert content are reusable; personal video review follows the published allowances and puzzle scope.' } }, { title: { zh: '企业会员', en: 'Enterprise membership' }, perks: ENTERPRISE_PERKS, explanation: { zh: '续费理由：企业展示、资料维护、课程安排和教学关系需要持续服务。标准权益覆盖可复用需求；额外定制明确范围与验收，持续完善机构的实际使用流程。', en: 'Renewal value: profiles, resources, courses and teaching relationships require continuing service. Standard benefits meet repeated needs; additional customisation needs explicit scope and acceptance.' } }].map(plan => (
            <article data-site-surface="panel" key={plan.title.en}>
              <div className="bp-subscription-heading"><span className="bp-icon">{plan.title.en === 'Individual membership' ? <Users size={32} aria-hidden /> : <Building2 size={32} aria-hidden />}</span><span className="bp-subscription-tag">{tr({ zh: '持续服务', en: 'ONGOING SERVICE' })}</span></div>
              <h3>{tr(plan.title)}</h3>
              <ul>{plan.perks.map(perk => <li key={perk}><Check size={16} aria-hidden /><span>{tr(MEMBERSHIP_PERK_LABEL[perk])}</span></li>)}</ul>
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

      {BUSINESS_SECTIONS.filter(section => section.number !== '14').map(section => <NarrativeSection key={section.id} section={section} />)}

      <section id="bp-costs" className="overview-section overview-wrap" aria-labelledby="bp-costs-title">
        <p className="overview-kicker">{tr({ zh: '13 / 已有投入与资金用途', en: '13 / Existing resources & use of funds' })}</p>
        <h2 id="bp-costs-title">{tr({ zh: '资金支持持续交付，\n已有设备继续发挥作用。', en: 'Fund sustained delivery.\nKeep using existing equipment.' })}</h2>
        <p className="overview-intro">{tr({ zh: '网站已记录 AI 开发工具、服务器、发布服务和工作设备等投入。本版保留成本类别与用途，暂不展示任何具体金额。下一阶段优先支持团队时间、会员交付与商业推广，已有设备按实际需要复用。', en: 'The site records development AI, hosting, distribution and equipment costs. This version shows categories and purposes without monetary figures. Prioritise team time, membership delivery and promotion while reusing existing equipment.' })}</p>
        <div className="overview-cost-grid">
          <div><h3>{tr({ zh: '持续运行与开发服务', en: 'Ongoing development & operations' })}</h3><dl className="overview-cost-list">{EXPENSES.map(expense => <div key={expense.name.en}><dt><strong>{tr(expense.name)}</strong><span>{tr(expense.purpose)}</span></dt></div>)}</dl></div>
          <div><h3>{tr({ zh: '已有开发与内容设备', en: 'Existing development & production equipment' })}</h3><div className="overview-equipment-pictures"><img src="/images/dev/infrastructure/mac-mini-m5-pro.webp" width={240} height={180} loading="lazy" alt="Mac mini" /><img src="/images/dev/infrastructure/canon-eos-r5-mark-ii-cutout.webp" width={240} height={180} loading="lazy" alt="Canon EOS R5 Mark II" /><img src="/images/dev/infrastructure/dji-mic-3.webp" width={240} height={180} loading="lazy" alt="DJI Mic 3" /></div><dl className="overview-cost-list">{EQUIPMENT_GROUPS.filter(group => group.items.length > 0).map(group => <div key={group.category.en}><dt><strong>{tr(group.category)}</strong><span>{group.items.slice(0, 3).map(item => tr(item.name)).join(' · ')}</span></dt></div>)}</dl></div>
        </div>
        <div className="overview-advantage-grid bp-detail-grid">{SUPPORT_USES.map(item => <article data-site-surface="panel" key={item.title.en}><h3>{tr(item.title)}</h3><p>{tr(item.body)}</p></article>)}</div>
        <p className="overview-small">{tr({ zh: '设备记录包含个人通用设备、曾用设备和估价，不视作全部属于项目的实付款；既有设备不重复列为新采购。开发工具、用户侧计算、人工服务与固定运行成本分别核算，实际预算由下一阶段任务形成。', en: 'Equipment records include general-purpose, former and estimated devices rather than a project payment ledger. Do not count existing equipment as new purchases. Account separately for tooling, user-serving compute, human delivery and fixed operations.' })}</p>
      </section>

      {BUSINESS_SECTIONS.filter(section => section.number === '14').map(section => <NarrativeSection key={section.id} section={section} />)}

      <section id="bp-support" className="overview-section overview-wrap" aria-labelledby="bp-support-title">
        <p className="overview-kicker">{tr({ zh: '15 / 合作方式与阶段安排', en: '15 / Partnership & milestone arrangements' })}</p>
        <h2 id="bp-support-title">{tr({ zh: '支持下一阶段，\n用清楚的交付建立合作。', en: 'Support the next stage\nwith clear delivery and review.' })}</h2>
        <p className="overview-intro">{tr({ zh: '项目有明确的商业化方向，当前希望获得直接项目资助，支持团队持续投入、会员交付与规模化推广。本轮按非借贷提出；资金规模与周期在具体阶段计划形成后协商。未来若双方希望开展股权合作，另行讨论。', en: 'The project has a commercial direction and currently seeks direct project support for sustained team work, member delivery and expanded promotion. This request is not a loan. Agree scope and period around milestones; discuss future equity separately if both parties wish.' })}</p>
        <div className="overview-business-grid">
          <article><h3>{tr({ zh: '项目资助', en: 'Project support' })}</h3><p>{tr({ zh: '支持者获得明确的工作计划、阶段成果、产品演示与资金使用报告，可按意愿约定致谢。本轮不承诺还本、分红或自动股权；项目之后的订阅收入用于经营，资助者的具体权利在合作前说清楚。', en: 'Agree a work plan, milestones, demonstrations, spending reports and optional acknowledgment. Current support does not promise repayment, profit shares or automatic equity; define supporter rights before partnering.' })}</p></article>
          <article><h3>{tr({ zh: '可选品牌赞助', en: 'Optional brand sponsorship' })}</h3><p>{tr({ zh: '若支持者有企业推广需求，可单独约定品牌展示、联合内容、直播或活动合作。交付位置、数量、期限和报告方式事先明确；实际传播效果据实报告。', en: 'If the supporter has brand needs, separately agree placements, co-created content, livestreams or activities with scope, period and reporting. Report actual outcomes.' })}</p></article>
          <article><h3>{tr({ zh: '后续股权合作', en: 'Future equity partnership' })}</h3><p>{tr({ zh: '在主体、经营数据和合作意愿明确后，双方可以讨论股权投资及相应权利。本轮资助不自动转换股权；对方若现在希望获得财务回报，应另外形成清楚的投资方案。', en: 'Once the entity, operating evidence and mutual intent are clear, discuss equity investment and rights. Current support does not automatically convert; a supporter seeking financial returns now needs a separate investment proposal.' })}</p></article>
        </div>
        <div className="overview-review" data-site-surface="panel"><HeartHandshake size={26} aria-hidden /><div><h3>{tr({ zh: '以阶段交付、月度沟通与季度复核推进。', en: 'Use milestones, monthly updates and quarterly reviews.' })}</h3><ul>
          <li>{tr({ zh: '上线阶段：审核进度、支付可用性、会员权益与服务交付规则。', en: 'Launch stage: approvals, payment readiness, entitlements and delivery rules.' })}</li>
          <li>{tr({ zh: '推广阶段：内容发布、真实练习、会员使用、服务完成与用户反馈。', en: 'Promotion stage: content, real practice, member use, service delivery and feedback.' })}</li>
          <li>{tr({ zh: '经营阶段：订阅续费、企业服务、成本核算与下一阶段计划。', en: 'Operating stage: renewals, enterprise delivery, costs and the next plan.' })}</li>
        </ul><p className="overview-small">{tr({ zh: '正式合作明确签约主体、用途、交付、拨付条件、信息披露、停止条件与未使用资金处理。阶段目标是执行计划，审核时间、增长与商业结果不能事先保证。', en: 'Agree the contracting entity, purposes, milestones, release conditions, reporting, termination and treatment of unused funds. Milestones are plans; approval timing, growth and business outcomes are not guaranteed.' })}</p></div></div>
        <AppLink href="/contact" prefetch={false} className="overview-primary">{tr({ zh: '联系颜瑞民，讨论下一阶段', en: 'Contact Ruimin Yan about the next stage' })}<ArrowUpRight size={17} aria-hidden /></AppLink>
        <p className="overview-print-url">cuberoot.me/zh/partnership</p>
      </section>

      <section id="bp-sources" className="overview-section overview-wrap bp-sources" aria-labelledby="bp-sources-title">
        <p className="overview-kicker">{tr({ zh: '16 / 资料来源与说明', en: '16 / Sources & definitions' })}</p>
        <h2 id="bp-sources-title">{tr({ zh: '产品与经历可以直接查阅。', en: 'Inspect the product and founder’s record.' })}</h2>
        <div className="bp-source-links">{[
          ['/membership', { zh: '会员权益与当前开放状态', en: 'Membership benefits & availability' }],
          ['/about/ruimin', { zh: '创始人公开履历与获奖资料', en: 'Founder profile & awards' }],
          ['/achievements', { zh: '原创工具与技术成果', en: 'Original tools & technical work' }],
          ['/about', { zh: '公开数据与开源致谢', en: 'Public data & open-source credits' }],
        ].map(([href, label]) => <AppLink key={String(href)} href={String(href)} prefetch={false}>{tr(label as { zh: string; en: string })}<ArrowUpRight size={15} aria-hidden /></AppLink>)}</div>
        <p className="overview-small">{tr({ zh: '会员内容依据当前公开页面与套餐核对；行业与竞品引用官方介绍。团队、主体、付费会员和两个月目标为创始人本轮确认。发展规划、服务完善与财务情景是计划，不写成已实现成果。本文是商业计划与合作说明，具体合作条件另行约定。', en: 'Membership content uses the public page and plans; industry and competitor statements use official sources. Team, entity, paid membership and the two-month target were founder-confirmed. Roadmaps, service improvements and financial scenarios are plans rather than completed results. Partnership conditions are agreed separately.' })}</p>
      </section>
      <footer className="overview-footer overview-wrap"><strong>{tr({ zh: '魔方根', en: 'CubeRoot' })}</strong><p>{tr({ zh: '颜瑞民 · 商业计划书 · 2026.10', en: 'Ruimin Yan · Business plan · 2026.10' })}</p><AppLink href="/contact" prefetch={false}>{tr({ zh: '联系方式', en: 'Contact' })}</AppLink></footer>
    </main>
  );
}
