import { ArrowUpRight, BookOpen, Building2, ChevronDown, Handshake, Trophy } from 'lucide-react';
import AppLink from '@/components/AppLink';
import { tr } from '@/i18n/tr';

const OPTIONS = [
  {
    Icon: BookOpen,
    status: { zh: '把专业内容变成好课程', en: 'Turn expertise into useful courses' },
    title: { zh: '一起做课程', en: 'Build a course together' },
    body: { zh: '我负责专业内容和训练工具，您可以参与课程投入或推广。先把一门课程做好，再看销售、学习反馈和后续需求。', en: 'I bring the teaching content and practice tools; you could contribute funding or distribution. Start with one course, then review sales, learner feedback and demand for what comes next.' },
    value: { zh: '可以讨论课程销售合作或项目收益分配，具体方式根据双方投入一起商定。', en: 'We could explore a sales partnership or a share of project earnings, with the arrangement agreed around our respective contributions.' },
    next: { zh: '先选定课程、受众和上线计划，把制作费用、推广分工与结算方式谈清楚。', en: 'Choose the course, audience and launch plan, then agree production costs, promotion responsibilities and settlement terms.' },
    href: '/courses',
    link: { zh: '看看正在做的课程', en: 'Explore the courses' },
  },
  {
    Icon: Trophy,
    status: { zh: '从一场线上赛开始', en: 'Start with one online event' },
    title: { zh: '一起办线上赛', en: 'Run an online event together' },
    body: { zh: '线上赛事正在筹备。我们可以先合作一场，把报名、比赛体验和组织流程做好，再根据参与情况决定是否持续举办。', en: 'Online events are being prepared. We could begin with one event, get registration and the competition experience right, then decide whether to continue based on participation.' },
    value: { zh: '可以围绕赛事项目收益、冠名或相关业务推广讨论合作，选择与您的商业目标相符的方式。', en: 'Possible arrangements include project earnings, event naming or promotion of a relevant business, depending on your commercial goals.' },
    next: { zh: '报名收入、奖品与组织成本分别记录，合作前约定双方投入和收益安排。', en: 'Track entry fees, prizes and operating costs separately, and agree contributions and any sharing of earnings before starting.' },
    href: '#bp-events',
    link: { zh: '看看赛事计划', en: 'Explore the event plan' },
  },
  {
    Icon: Building2,
    status: { zh: '把工具带进真实教学', en: 'Bring tools into everyday teaching' },
    title: { zh: '一起服务更多机构', en: 'Reach more educators together' },
    body: { zh: '依托现有教师社群，把课程和训练工具带给有需求的机构。如果您有合适的渠道或经营经验，我们可以从少量机构试用开始。', en: 'Use the existing teacher community to introduce courses and practice tools to institutions that need them. If you bring suitable channels or operating experience, we could begin with a small set of trials.' },
    value: { zh: '可以讨论渠道合作、机构服务项目或销售分成，围绕实际成交与持续服务形成回报。', en: 'We could discuss distribution, educator-service projects or sales commissions, with returns tied to actual sales and continuing services.' },
    next: { zh: '先明确服务内容、客户对接和交付分工，再商定合作周期与结算方式。', en: 'Define the service, customer relationship and delivery responsibilities, then agree the collaboration period and settlement terms.' },
    href: '/membership#enterprise-plans-title',
    link: { zh: '看看现有机构服务', en: 'Explore current educator services' },
  },
] as const;

// Shared with the meeting notes so the invitation and current equity position agree.
export const COOPERATION_INTRO = {
  zh: '我希望找到一位愿意和我一起把魔方根做下去的合作伙伴。产品已经能用，也有了付费会员；接下来，我想把课程、订阅和线上赛事做得更扎实。您的投入可以帮助我们更稳定地开发和提供服务，我们也可以围绕具体项目，一起商量适合双方的商业回报方式。',
  en: 'I am looking for a partner to help build CubeRoot for the long term. The products are usable and there are already paid members. Next, I want to strengthen courses, subscriptions and online events. Your contribution could give development and service delivery a steadier footing, while we agree a commercial arrangement around a specific project that works for both of us.',
};

export const COOPERATION_EQUITY_POSITION = {
  zh: '接下来几个月，我会先专注业务合作，暂不出让公司股权。以后是否讨论投资，再看双方意愿与合作情况，现在不作承诺。',
  en: 'Over the next few months, I will focus on business partnerships without offering company equity. Whether we discuss investment later will depend on mutual interest and how the collaboration develops; there is no commitment now.',
};

export default function CooperationOpportunity() {
  return <section id="bp-cooperation" className="overview-section overview-wrap" aria-labelledby="bp-cooperation-title">
    <p className="overview-kicker">{tr({ zh: '一起往前走', en: 'BUILDING TOGETHER' })}</p>
    <h2 id="bp-cooperation-title">{tr({ zh: '从一个具体项目开始，\n一起把事情做成。', en: 'Start with one project.\nBuild something worthwhile together.' })}</h2>
    <p className="overview-intro">{tr(COOPERATION_INTRO)}</p>
    <div className="bp-streams">{OPTIONS.map(({ Icon, status, title, body, value, next, href, link }) => <article key={title.en} data-site-surface="panel">
      <span className="bp-stream-status">{tr(status)}</span><Icon size={30} aria-hidden />
      <h3>{tr(title)}</h3><p>{tr(body)}</p>
      <AppLink href={href} prefetch={false} className="overview-text-link">{tr(link)}<ArrowUpRight size={16} aria-hidden /></AppLink>
      <details className="bp-cooperation-detail"><summary>{tr({ zh: '可以怎么合作', en: 'How we could work together' })}<ChevronDown size={16} aria-hidden /></summary><dl className="overview-cost-list"><div><dt><strong>{tr({ zh: '您的回报', en: 'Your potential return' })}</strong><span>{tr(value)}</span></dt></div><div><dt><strong>{tr({ zh: '第一步怎么走', en: 'The first step' })}</strong><span>{tr(next)}</span></dt></div></dl></details>
    </article>)}</div>
    <div className="overview-review" data-site-surface="panel"><Handshake size={26} aria-hidden /><div>
      <h3>{tr({ zh: '先聊聊，哪件事值得我们一起做。', en: 'Let’s talk about what we could build together.' })}</h3>
      <p>{tr({ zh: '我想先了解您最看重的回报，再选一个双方都认可的项目。把钱用在哪里、各自负责什么、收益怎么算谈清楚。合作过程中，我会持续分享产品进展、项目收支和用户反馈；做得怎么样，我们一起看，再决定下一步。', en: 'I would like to understand the return you value most, then choose a project we both believe in. We can agree how funds will be used, who does what and how earnings are calculated. I will share product progress, project finances and user feedback along the way, so we can assess the results together before deciding what comes next.' })}</p>
      <p className="overview-small">{tr(COOPERATION_EQUITY_POSITION)}</p>
    </div></div>
    <AppLink href="/contact" prefetch={false} className="overview-primary">{tr({ zh: '和我聊聊', en: 'Let’s talk' })}<ArrowUpRight size={17} aria-hidden /></AppLink>
  </section>;
}
