import { ArrowUpRight, BookOpen, Building2, CalendarDays, Check, Trophy, Users } from 'lucide-react';
import AppLink from '@/components/AppLink';
import { tr } from '@/i18n/tr';
import { EVENT_GROSS_PER_EVENT, EVENT_GROSS_PER_MONTH, ONLINE_EVENT_PLAN } from './bp-data';

export function BusinessStreams() {
  return <div className="bp-streams">{[
    { href: '/membership', linkLabel: { zh: '查看当前会员权益', en: 'View current membership benefits' }, Icon: Building2, title: { zh: '个人与机构订阅', en: 'Individual & institutional subscriptions' }, status: { zh: '已有真实付费会员', en: 'Existing paid members' }, body: { zh: '个人获得持续的专业训练服务；机构获得教学展示、资料与课程服务。按实际使用与续费完善交付。', en: 'Ongoing specialist practice services for individuals; teaching profiles, resources and course services for institutions. Improve delivery through use and renewal.' } },
    { href: '/courses', linkLabel: { zh: '查看课程入口', en: 'Explore courses' }, Icon: BookOpen, title: { zh: '课程业务', en: 'Courses' }, status: { zh: '专业教学与训练', en: 'Teaching & practice' }, body: { zh: '创始人持续开展课程工作，将专业教学与网站的公式、训练和复盘工具连接。课程帮助用户明确学什么、怎么练。', en: 'The founder’s course work connects algorithms, practice and reconstruction tools, helping learners decide what to study and how to practise.' } },
    { href: '#bp-events', linkLabel: { zh: '查看赛事方案与测算', en: 'Read the event format and scenario' }, Icon: Trophy, title: { zh: '线上赛事', en: 'Online competitions' }, status: { zh: '周期性线上赛', en: 'Recurring online events' }, body: { zh: '以每月 4 场为运营目标，参赛方案涵盖普通魔方和智能魔方。通过定期比赛为练习提供目标，并形成独立的报名收入。', en: 'The operating target is four events per month, with a format covering conventional and smart cubes. Regular competition gives practice a goal and creates an entry-fee revenue stream.' } },
  ].map(({ Icon, title, status, body, href, linkLabel }) => <article key={title.en} data-site-surface="panel"><span className="bp-stream-status">{tr(status)}</span><Icon size={30} aria-hidden /><h3>{tr(title)}</h3><p>{tr(body)}</p><AppLink href={href} prefetch={false} className="overview-text-link">{tr(linkLabel)}<ArrowUpRight size={16} aria-hidden /></AppLink></article>)}</div>;
}

export default function BusinessExpansion() {
  return <>
    <section id="bp-courses" className="overview-section overview-wrap" aria-labelledby="bp-courses-title">
      <p className="overview-kicker">{tr({ zh: '课程 / 专业内容与练习相连接', en: 'COURSES / CONNECT TEACHING AND PRACTICE' })}</p>
      <h2 id="bp-courses-title">{tr({ zh: '学完之后，\n有地方继续练。', en: 'After a lesson,\nkeep practising.' })}</h2>
      <p className="overview-intro">{tr({ zh: '课程连接专业教学与日常训练。创始人的教学、著作和公式内容提供专业基础，网站承接学习后的反复练习与复盘。课程内容与教学入口见下方链接。', en: 'Courses connect specialist teaching with daily practice. The founder’s teaching, book and algorithm content provide expertise; the website supports practice and reflection after learning. Explore the course content and learning options below.' })}</p>
      <AppLink href="/courses" prefetch={false} className="overview-text-link">{tr({ zh: '查看课程入口', en: 'Explore courses' })}<ArrowUpRight size={16} aria-hidden /></AppLink>
      <div className="bp-network" data-site-surface="panel"><Users size={32} aria-hidden /><div><h3>{tr({ zh: '已有教师社群，连接机构需求。', en: 'An existing teacher community connects educator needs.' })}</h3><p>{tr({ zh: '创始人是一个约 500 人魔方老师群的群主，群内有来自多家培训机构的老师与负责人。目前正与部分机构洽谈合作，可围绕课程、教学工具和课后训练组织演示与试用。', en: 'The founder runs a cubing-teacher group of about 500 members, including teachers and leaders from multiple training organisations. Discussions with some institutions are underway, creating opportunities to demonstrate and trial courses, teaching tools and after-class practice.' })}</p><AppLink href="/contact" prefetch={false} target="_blank" rel="noopener noreferrer" className="overview-text-link">{tr({ zh: '查看公开社群介绍与联系方式', en: 'View the community directory and contact details' })}<ArrowUpRight size={16} aria-hidden /></AppLink></div></div>
    </section>
    <section id="bp-events" className="overview-section overview-wrap" aria-labelledby="bp-events-title">
      <p className="overview-kicker">{tr({ zh: '线上赛事 / 业务模式与收入测算', en: 'ONLINE EVENTS / BUSINESS MODEL & REVENUE SCENARIO' })}</p>
      <h2 id="bp-events-title">{tr({ zh: '每月四场，\n让训练有一个共同目标。', en: 'Four events a month.\nA shared goal for practice.' })}</h2>
      <p className="overview-intro">{tr({ zh: '赛事业务聚焦线上，以定期比赛连接日常训练。参赛方案涵盖普通魔方与智能魔方，兼顾不同设备用户的参与需求。', en: 'The event business focuses on online competition, connecting regular events with daily practice. The format covers conventional and smart cubes to accommodate users with different devices.' })}</p>
      <div className="bp-event-inputs">{[
        [ONLINE_EVENT_PLAN.eventsPerMonth, { zh: '场 / 月 · 运营目标', en: 'events / month · target' }, CalendarDays],
        [ONLINE_EVENT_PLAN.entriesPerEvent, { zh: '人 / 场 · 招募目标', en: 'entrants / event · target' }, Users],
        [ONLINE_EVENT_PLAN.feeCny, { zh: '元 / 人 / 场 · 测算单价', en: 'CNY / entrant / event · scenario fee' }, Trophy],
      ].map(([value, label, Icon]) => { const MetricIcon = Icon as typeof Users; return <article key={String(value)} data-site-surface="panel"><MetricIcon size={24} aria-hidden /><strong>{String(value)}</strong><span>{tr(label as { zh: string; en: string })}</span></article>; })}</div>
      <div className="bp-event-calculation" data-site-surface="panel"><div><span>{tr({ zh: '达到上述参与规模时', en: 'IF THE PARTICIPATION TARGET IS MET' })}</span><h3>{tr({ zh: '月报名费收入测算', en: 'Monthly gross entry fees' })}</h3><p>{ONLINE_EVENT_PLAN.eventsPerMonth} × {ONLINE_EVENT_PLAN.entriesPerEvent} × ¥{ONLINE_EVENT_PLAN.feeCny}</p></div><strong>¥{EVENT_GROSS_PER_MONTH.toLocaleString('en-US')}</strong><p>{tr({ zh: `单场 ¥${EVENT_GROSS_PER_EVENT.toLocaleString('en-US')}；每月合计 ${ONLINE_EVENT_PLAN.eventsPerMonth * ONLINE_EVENT_PLAN.entriesPerEvent} 参赛人次。`, en: `CNY ${EVENT_GROSS_PER_EVENT.toLocaleString('en-US')} per event; ${ONLINE_EVENT_PLAN.eventsPerMonth * ONLINE_EVENT_PLAN.entriesPerEvent} entries per month.` })}</p></div>
      <p className="overview-small">{tr({ zh: '按目标规模测算的报名费毛收入，未扣除退款、支付、奖品、审核与运营成本。', en: 'Gross entry fees at the target scale, before refunds, payment fees, prizes, review and operating costs.' })}</p>
      <div className="bp-detail-columns bp-event-delivery">{[
        { title: { zh: '普通魔方与智能魔方', en: 'Conventional & smart cubes' }, body: { zh: '参赛方案覆盖两种设备，按成绩记录方式、证明材料与审核要求设置分组或排名规则。', en: 'The format covers both device types, with groups or ranking rules based on timing records, evidence and review requirements.' } },
        { title: { zh: '先明确规则，再开放报名', en: 'Rules before registration' }, body: { zh: '每场公布项目、时间、轮次、成绩有效性、异常处理、申诉与退费安排。参赛要求与报名信息一并说明。', en: 'Publish events, schedule, rounds, result validity, incident handling, appeals and refunds. Provide participation requirements alongside registration information.' } },
      ].map(item => <article key={item.title.en}><Check size={20} aria-hidden /><h3>{tr(item.title)}</h3><p>{tr(item.body)}</p></article>)}</div>
      <aside className="bp-backlog"><strong>{tr({ zh: '后续待办：商城', en: 'Later backlog: commerce' })}</strong><p>{tr({ zh: '商城留待后续评估，当前不计入近期收入计划与执行重点。', en: 'Commerce remains for later evaluation and is excluded from near-term revenue plans and execution priorities.' })}</p></aside>
    </section>
  </>;
}
