import { ArrowUpRight, ChartNoAxesColumnIncreasing, ChevronDown, Handshake, Megaphone } from 'lucide-react';
import AppLink from '@/components/AppLink';
import { tr } from '@/i18n/tr';

const OPTIONS = [
  {
    Icon: Handshake,
    status: { zh: '现阶段的合作重点', en: 'Our current focus' },
    title: { zh: '长期战略合作', en: 'Long-term strategic partnership' },
    body: { zh: '以一段时期的资金支持，帮助魔方根持续开发产品、完善内容与服务。我和团队负责日常经营，向您定期分享业务进展与资金使用情况。', en: 'Funding over an agreed period would support product development, content and service delivery. My team and I would handle day-to-day operations and keep you informed about business progress and spending.' },
    value: { zh: '可以商谈约定业务范围内的收益分配，按实际经营情况结算。合作范围、期限与结算方式，由双方一起确定。', en: 'We could discuss sharing earnings from an agreed scope of business, settled according to actual results. We would agree the scope, duration and settlement terms together.' },
    next: { zh: '先聊清楚您期待的回报、支持周期和业务目标，再确定适合双方的合作安排。', en: 'Start with your return expectations, the support period and business goals, then agree an arrangement that works for both of us.' },
    href: '#bp-business',
    link: { zh: '了解业务与收入来源', en: 'Explore the business and revenue streams' },
  },
  {
    Icon: Megaphone,
    status: { zh: '围绕明确的合作权益', en: 'Defined partnership benefits' },
    title: { zh: '品牌与项目合作', en: 'Brand & project partnerships' },
    body: { zh: '如果您有品牌或业务推广需求，可以选择赛事冠名、内容合作或专题项目。策划、制作与执行由我们承担，您确认合作目标与成果。', en: 'If you have a brand or business to promote, options include event naming, content partnerships or a focused project. We would handle planning, production and delivery, while you agree the objectives and review the results.' },
    value: { zh: '围绕您的业务，商定品牌展示、内容传播或客户触达权益，并反馈实际传播和参与情况。', en: 'Agree brand visibility, content distribution or audience reach that serves your business, with reporting on actual reach and participation.' },
    next: { zh: '先明确希望触达的人群与合作周期，我们提供方案和执行安排，按约定交付。', en: 'Define the audience and period; we would propose the approach, organise delivery and fulfil the agreed scope.' },
    href: '#bp-events',
    link: { zh: '了解线上赛事业务', en: 'Explore the online-event business' },
  },
  {
    Icon: ChartNoAxesColumnIncreasing,
    status: { zh: '着眼长期，共同探索', en: 'Explore the long term together' },
    title: { zh: '未来资本合作', en: 'Potential future investment' },
    body: { zh: '随着产品与经营更加成熟，期待在双方认可的基础上，进一步探讨战略投资与更深层的合作，让今天建立的信任拥有更长远的发展空间。', en: 'As the product and business mature, we look forward to exploring strategic investment and deeper collaboration where our interests align, building on the trust established today.' },
    value: { zh: '以更清晰的经营表现和发展目标为基础，共同探讨适合双方的合作方式与条件。', en: 'Use a clearer picture of operating performance and development goals to explore arrangements and terms that work for both parties.' },
    next: { zh: '先通过业务合作积累了解与信任，让后续交流有更扎实的基础。', en: 'Build understanding and trust through business collaboration, giving future discussions a stronger foundation.' },
    href: '#bp-roadmap',
    link: { zh: '了解长期发展方向', en: 'Explore the long-term direction' },
  },
] as const;

// Shared with the meeting notes so the invitation and current equity position agree.
export const COOPERATION_INTRO = {
  zh: '我希望找到一位认可魔方根长期价值的合作伙伴。您的资金支持，让我们能更专注地打磨产品、课程和服务。研发、教学、赛事与日常运营由我和团队负责；我们一起商定合作目标与商业回报方式，我会定期向您汇报进展，让您了解每一阶段的投入与结果。',
  en: 'I am looking for a partner who sees CubeRoot’s long-term value. Your funding would let us focus on improving products, courses and services. My team and I would handle development, teaching, events and daily operations. Together we would agree the goals and commercial terms, and I would keep you informed about spending and results at each stage.',
};

export const COOPERATION_EQUITY_POSITION = {
  zh: '接下来几个月，我们先以业务合作为起点。随着合作深入、业务发展，期待在双方认可的基础上，进一步探讨长期合作与投资的可能。',
  en: 'Over the next few months, we would begin with business collaboration. As the relationship and business develop, we look forward to exploring longer-term partnerships and possible investment where our interests align.',
};

export default function CooperationOpportunity() {
  return <section id="bp-cooperation" className="overview-section overview-wrap" aria-labelledby="bp-cooperation-title">
    <p className="overview-kicker">{tr({ zh: '一起往前走', en: 'BUILDING TOGETHER' })}</p>
    <h2 id="bp-cooperation-title">{tr({ zh: '您支持长远发展，\n我们专注把业务做好。', en: 'Your support for the long term.\nOur focus on building the business.' })}</h2>
    <p className="overview-intro">{tr(COOPERATION_INTRO)}</p>
    <div className="bp-streams">{OPTIONS.map(({ Icon, status, title, body, value, next, href, link }) => <article key={title.en} data-site-surface="panel">
      <span className="bp-stream-status">{tr(status)}</span><Icon size={30} aria-hidden />
      <h3>{tr(title)}</h3><p>{tr(body)}</p>
      <AppLink href={href} prefetch={false} className="overview-text-link">{tr(link)}<ArrowUpRight size={16} aria-hidden /></AppLink>
      <details className="bp-cooperation-detail"><summary>{tr({ zh: '可以怎么合作', en: 'How we could work together' })}<ChevronDown size={16} aria-hidden /></summary><dl className="overview-cost-list"><div><dt><strong>{tr({ zh: '您的回报', en: 'Your potential return' })}</strong><span>{tr(value)}</span></dt></div><div><dt><strong>{tr({ zh: '第一步怎么走', en: 'The first step' })}</strong><span>{tr(next)}</span></dt></div></dl></details>
    </article>)}</div>
    <div className="overview-review" data-site-surface="panel"><Handshake size={26} aria-hidden /><div>
      <h3>{tr({ zh: '您看方向与结果，具体执行交给我们。', en: 'Stay close to the direction and results. Leave delivery to us.' })}</h3>
      <p>{tr({ zh: '我们先把投入用途、合作周期与回报方式聊清楚。日常工作由团队推进，我负责定期向您汇报产品进展、经营收支与用户反馈。重要方向一起沟通，具体事务由我们落实，让合作建立在清晰的目标和看得见的进展上。', en: 'We would first agree how funds are used, the collaboration period and the commercial terms. The team would run day-to-day work, and I would report product progress, finances and user feedback. We would discuss major directions together while handling the practical work ourselves, building the relationship around clear goals and visible progress.' })}</p>
      <p className="overview-small">{tr(COOPERATION_EQUITY_POSITION)}</p>
    </div></div>
    <AppLink href="/contact" prefetch={false} className="overview-primary">{tr({ zh: '和我聊聊', en: 'Let’s talk' })}<ArrowUpRight size={17} aria-hidden /></AppLink>
  </section>;
}
