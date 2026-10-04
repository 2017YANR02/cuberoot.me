import { ArrowUpRight, BookOpen, Building2, CalendarDays, Check, Trophy, Users } from 'lucide-react';
import AppLink from '@/components/AppLink';
import { tr } from '@/i18n/tr';
import { EVENT_GROSS_PER_EVENT, EVENT_GROSS_PER_MONTH, ONLINE_EVENT_PLAN } from './bp-data';

export function BusinessStreams() {
  return <div className="bp-streams">{[
    { Icon: Building2, title: { zh: '个人与机构订阅', en: 'Individual & institutional subscriptions' }, status: { zh: '已有真实付费会员', en: 'Existing paid members' }, body: { zh: '个人获得持续的专业训练服务；机构获得教学展示、资料与课程服务。按实际使用与续费完善交付。', en: 'Ongoing specialist practice services for individuals; teaching profiles, resources and course services for institutions. Improve delivery through use and renewal.' } },
    { Icon: BookOpen, title: { zh: '课程业务', en: 'Courses' }, status: { zh: '正在开展', en: 'In progress' }, body: { zh: '创始人持续开展课程工作，将专业教学与网站的公式、训练和复盘工具连接。课程帮助用户明确学什么、怎么练。', en: 'The founder is developing course work linked to algorithms, practice and reconstruction tools, helping learners decide what to study and how to practise.' } },
    { Icon: Trophy, title: { zh: '线上赛事', en: 'Online competitions' }, status: { zh: '计划开展', en: 'Planned' }, body: { zh: '计划每月 4 场，普通魔方和智能魔方均可参与。通过定期比赛为练习提供目标，并形成独立的报名收入。', en: 'Four events per month are planned, open to conventional and smart cubes. Regular competition gives practice a goal and creates an entry-fee revenue stream.' } },
  ].map(({ Icon, title, status, body }) => <article key={title.en} data-site-surface="panel"><span className="bp-stream-status">{tr(status)}</span><Icon size={30} aria-hidden /><h3>{tr(title)}</h3><p>{tr(body)}</p></article>)}</div>;
}

export default function BusinessExpansion() {
  return <>
    <section id="bp-courses" className="overview-section overview-wrap" aria-labelledby="bp-courses-title">
      <p className="overview-kicker">{tr({ zh: '课程 / 专业内容与练习相连接', en: 'COURSES / CONNECT TEACHING AND PRACTICE' })}</p>
      <h2 id="bp-courses-title">{tr({ zh: '学完之后，\n有地方继续练。', en: 'After a lesson,\nkeep practising.' })}</h2>
      <p className="overview-intro">{tr({ zh: '课程业务正在开展。创始人的教学、著作和公式内容提供专业基础，网站承接学习后的反复练习与复盘。课程收入与订阅收入分别核算，具体课程内容、价格和交付方式以实际发布为准。', en: 'Course work is in progress. The founder’s teaching, book and algorithm content provide expertise; the website supports practice and reflection after learning. Account for courses separately from subscriptions, with content, prices and delivery defined by actual offerings.' })}</p>
      <div className="bp-course-path">{[
        { title: { zh: '课程讲解', en: 'Instruction' }, body: { zh: '理解方法与学习目标', en: 'Understand methods and goals' } },
        { title: { zh: '工具练习', en: 'Practice' }, body: { zh: '在公式库、训练器和计时器中应用', en: 'Apply lessons with algorithms, trainers and timing' } },
        { title: { zh: '复盘进阶', en: 'Review & progress' }, body: { zh: '发现问题，安排下一步学习', en: 'Identify gaps and plan the next learning step' } },
      ].map((step, index) => <article key={step.title.en}><span>0{index + 1}</span><h3>{tr(step.title)}</h3><p>{tr(step.body)}</p></article>)}</div>
      <AppLink href="/courses" prefetch={false} className="overview-text-link">{tr({ zh: '查看课程入口', en: 'Explore courses' })}<ArrowUpRight size={16} aria-hidden /></AppLink>
      <div className="bp-network" data-site-surface="panel"><Users size={32} aria-hidden /><div><h3>{tr({ zh: '已有教师社群，连接机构需求。', en: 'An existing teacher community connects educator needs.' })}</h3><p>{tr({ zh: '创始人是一个约 500 人魔方老师群的群主，群内有来自多家培训机构的老师与负责人。目前正与部分机构洽谈合作，可围绕课程、教学工具和课后训练组织演示与试用。', en: 'The founder runs a cubing-teacher group of about 500 members, including teachers and leaders from multiple training organisations. Discussions with some institutions are underway, creating opportunities to demonstrate and trial courses, teaching tools and after-class practice.' })}</p><p className="overview-small">{tr({ zh: '社群规模与洽谈状态由创始人确认；群成员未按机构去重，不作为已签约客户数量。', en: 'Group size and discussion status are founder-reported. Members are not deduplicated by institution and are not counted as signed clients.' })}</p></div></div>
    </section>
    <section id="bp-events" className="overview-section overview-wrap" aria-labelledby="bp-events-title">
      <p className="overview-kicker">{tr({ zh: '线上赛事 / 创始人计划与报名费测算', en: 'ONLINE EVENTS / FOUNDER’S PLAN & ENTRY-FEE SCENARIO' })}</p>
      <h2 id="bp-events-title">{tr({ zh: '每月四场，\n让训练有一个共同目标。', en: 'Four events a month.\nA shared goal for practice.' })}</h2>
      <p className="overview-intro">{tr({ zh: '计划开展线上赛事，现阶段不举办线下赛事。普通魔方与智能魔方均纳入参赛方案，让已有不同设备的用户都能参与。', en: 'Online competitions are planned; in-person events are outside the current scope. Both conventional and smart cubes are included in the participation plan.' })}</p>
      <div className="bp-event-inputs">{[
        [ONLINE_EVENT_PLAN.eventsPerMonth, { zh: '场 / 月 · 计划频率', en: 'events / month · planned' }, CalendarDays],
        [ONLINE_EVENT_PLAN.entriesPerEvent, { zh: '人 / 场 · 招募目标', en: 'entrants / event · target' }, Users],
        [ONLINE_EVENT_PLAN.feeCny, { zh: '元 / 人 / 场 · 计划报名费', en: 'CNY / entrant / event · planned fee' }, Trophy],
      ].map(([value, label, Icon]) => { const MetricIcon = Icon as typeof Users; return <article key={String(value)} data-site-surface="panel"><MetricIcon size={24} aria-hidden /><strong>{String(value)}</strong><span>{tr(label as { zh: string; en: string })}</span></article>; })}</div>
      <div className="bp-event-calculation" data-site-surface="panel"><div><span>{tr({ zh: '达到上述参与规模时', en: 'IF THE PARTICIPATION TARGET IS MET' })}</span><h3>{tr({ zh: '月报名费收入测算', en: 'Monthly gross entry fees' })}</h3><p>{ONLINE_EVENT_PLAN.eventsPerMonth} × {ONLINE_EVENT_PLAN.entriesPerEvent} × ¥{ONLINE_EVENT_PLAN.feeCny}</p></div><strong>¥{EVENT_GROSS_PER_MONTH.toLocaleString('en-US')}</strong><p>{tr({ zh: `单场 ¥${EVENT_GROSS_PER_EVENT.toLocaleString('en-US')}；每月合计 ${ONLINE_EVENT_PLAN.eventsPerMonth * ONLINE_EVENT_PLAN.entriesPerEvent} 参赛人次，可包含重复参赛者。`, en: `CNY ${EVENT_GROSS_PER_EVENT.toLocaleString('en-US')} per event; ${ONLINE_EVENT_PLAN.eventsPerMonth * ONLINE_EVENT_PLAN.entriesPerEvent} entries per month may include returning participants.` })}</p></div>
      <p className="overview-small">{tr({ zh: '以上为计划条件下的报名费毛收入，尚未扣除退款、支付费用、奖品、裁判与审核、客服和技术运行成本，不是净利润或已实现收入。实际报名与成本将逐场记录。', en: 'This is planned gross entry-fee revenue before refunds, payment fees, prizes, judging, review, support and technical costs. It is neither profit nor realised revenue. Actual entries and costs will be recorded per event.' })}</p>
      <div className="bp-detail-columns bp-event-delivery">{[
        { title: { zh: '普通魔方与智能魔方', en: 'Conventional & smart cubes' }, body: { zh: '两种设备均计划支持。赛前明确成绩记录方式、证明材料与审核要求，并据此确定分组或排名规则。', en: 'Both device types are planned. Define timing records, evidence and review requirements before determining grouping or ranking rules.' } },
        { title: { zh: '先明确规则，再开放报名', en: 'Rules before registration' }, body: { zh: '每场公布项目、时间、轮次、成绩有效性、异常处理、申诉与退费安排。具体方案仍在制定，开放报名以实际准备完成为准。', en: 'Publish events, schedule, rounds, result validity, incident handling, appeals and refunds. Details are being developed; registration depends on operational readiness.' } },
      ].map(item => <article key={item.title.en}><Check size={20} aria-hidden /><h3>{tr(item.title)}</h3><p>{tr(item.body)}</p></article>)}</div>
      <aside className="bp-backlog"><strong>{tr({ zh: '后续待办：商城', en: 'Later backlog: commerce' })}</strong><p>{tr({ zh: '商城留待后续评估，当前不计入近期收入计划与执行重点。', en: 'Commerce remains for later evaluation and is excluded from near-term revenue plans and execution priorities.' })}</p></aside>
    </section>
  </>;
}
