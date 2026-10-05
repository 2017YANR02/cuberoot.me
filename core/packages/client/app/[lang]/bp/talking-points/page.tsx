'use client';
import { ArrowUpRight } from 'lucide-react';
import AppLink from '@/components/AppLink';
import HeaderToggles from '@/components/HeaderToggles';
import { tr } from '@/i18n/tr';
import { EVENT_GROSS_PER_MONTH, MARKET_SOURCE } from '../bp-data';
import { COOPERATION_INTRO, COOPERATION_EQUITY_POSITION } from '../CooperationOpportunity';
import '../bp.css';

export default function TalkingPointsPage() {
  return <main className="overview-page bp-page">
    <header className="overview-nav overview-wrap"><strong>{tr({ zh: '魔方根 · 业务交流提纲', en: 'CubeRoot · business discussion notes' })}</strong><HeaderToggles /></header>
    <section className="overview-section overview-wrap"><p className="overview-kicker">{tr({ zh: '市场 → 业务 → 执行', en: 'MARKET → BUSINESS → EXECUTION' })}</p><h1>{tr({ zh: '先讲清楚市场，\n再展示如何服务。', en: 'Explain the market.\nShow how to serve it.' })}</h1>
      <AppLink href="/bp" prefetch={false} className="overview-text-link">{tr({ zh: '打开商业计划书', en: 'Open the business plan' })}<ArrowUpRight size={16} /></AppLink>
      <div className="bp-detail-columns">{[
        { title: { zh: '市场已有规模', en: 'An established market' }, body: { zh: '《人民日报》报道，2024 年国内约有 700 万魔方爱好者，预计 2026 年达 800 万；国内已有 1400 多家培训机构，预计 2026 年底培训市场达 6 亿元。', en: 'People’s Daily reported about 7 million enthusiasts in China in 2024, forecasting 8 million in 2026, more than 1,400 training organisations and CNY 600 million in training spending by end-2026. ' } },
        { title: { zh: '业务围绕持续学习', en: 'Services around continued learning' }, body: { zh: '个人订阅、机构订阅和课程共同连接学习与训练；线上赛事计划每月举办 4 场，普通与智能魔方都能参与。商城暂列后续待办。', en: 'Individual and institutional subscriptions and courses connect learning with practice. Four monthly online events are planned for conventional and smart cubes. Commerce remains on the later backlog.' } },
        { title: { zh: '已有内容与教师渠道', en: 'Existing audience and teacher channels' }, body: { zh: '创始人有约 50 万平台合计关注，也是约 500 人魔方老师群的群主，与部分机构正在洽谈合作。这些渠道有助于推广产品、沟通需求和组织试用。', en: 'The founder has about 500,000 aggregate follows and leads a teacher group of about 500 members, with some institutional discussions underway. These channels support product discovery, customer conversations and trials.' } },
        { title: { zh: '赛事测算与实际成本', en: 'Event assumptions and real costs' }, body: { zh: `每场预计 200 人，每人每场 20 元，每月 4 场，对应月报名费毛收入 ¥${EVENT_GROSS_PER_MONTH.toLocaleString('en-US')}。这是计划情景，需要扣除退款、奖品、审核、客服等支出；首场实际报名和交付情况决定后续安排。`, en: `At 200 entrants per event, CNY 20 per entry and four events per month, planned gross monthly fees are CNY ${EVENT_GROSS_PER_MONTH.toLocaleString('en-US')}. Refunds, prizes, review and support must be deducted. Actual first-event participation and delivery guide subsequent scheduling.` } },
      ].map(item => <article key={item.title.en}><h2>{tr(item.title)}</h2><p>{tr(item.body)}</p></article>)}</div>
      <div className="overview-review" data-site-surface="panel"><div><h2>{tr({ zh: '如何提出合作', en: 'How to introduce a partnership' })}</h2><p>{tr(COOPERATION_INTRO)}</p><p className="overview-small">{tr(COOPERATION_EQUITY_POSITION)}</p><AppLink href="/bp#bp-cooperation" prefetch={false} className="overview-text-link">{tr({ zh: '看看可以一起做的项目', en: 'Explore projects we could work on together' })}<ArrowUpRight size={16} aria-hidden /></AppLink></div></div>
      <p className="overview-small"><a href={MARKET_SOURCE.url} target="_blank" rel="noopener noreferrer">{tr({ zh: '核对市场数据原文：人民日报，2026-06-01', en: 'Verify the market source: People’s Daily, June 1, 2026' })}</a></p>
    </section>
  </main>;
}
