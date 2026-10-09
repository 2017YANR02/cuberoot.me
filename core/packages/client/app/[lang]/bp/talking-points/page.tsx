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
        { title: { zh: '业务围绕持续学习', en: 'Services around continued learning' }, body: { zh: '个人订阅、机构订阅和课程共同连接学习与训练；线上赛事以每月 4 场为运营目标，参赛方案涵盖普通与智能魔方。商城暂列后续待办。', en: 'Individual and institutional subscriptions and courses connect learning with practice. The operating target is four monthly online events, with a format covering conventional and smart cubes. Commerce remains on the later backlog.' } },
        { title: { zh: '已有内容与教师渠道', en: 'Existing audience and teacher channels' }, body: { zh: '创始人有约 50 万平台合计关注，也是约 500 人魔方老师群的群主，与部分机构正在洽谈合作。这些渠道有助于推广产品、沟通需求和组织试用。', en: 'The founder has about 500,000 aggregate follows and leads a teacher group of about 500 members, with some institutional discussions underway. These channels support product discovery, customer conversations and trials.' } },
        { title: { zh: '智能魔方扩大软件的使用场景', en: 'Smart cubes expand the role of software' }, body: { zh: '智能魔方通过传感器与蓝牙记录转动，把练习过程变成可分析的数据。魔方根计时器已接入 GAN、魔域、奇艺等品牌的部分智能三阶型号，让不同设备的用户使用同一套训练工具。', en: 'Smart cubes use sensors and Bluetooth to turn practice into analysable data. CubeRoot’s timer integrates supported smart 3x3 models from GAN, MoYu, QiYi and other brands, bringing different devices into one practice tool.' } },
        { title: { zh: '厂商 App 是必须正视的竞品', en: 'Manufacturer apps are substantial competitors' }, body: { zh: 'GAN 魔方星球、魔域 WCU CUBE、奇艺配套的 Smart Player Pro 已覆盖多种训练与对战场景，XC大师也支持跨品牌。我们的切入点是把专业教学、日常训练、内容渠道和机构服务结合起来，以课程和持续服务获得收入。', en: 'GAN CubeStation, MoYu WCU CUBE and QiYi’s companion Smart Player Pro already cover many practice and battle use cases; XC Master also supports multiple brands. Our approach combines specialist teaching, daily practice, distribution and educator services, earning revenue through courses and continuing service.' } },
        { title: { zh: '赛事测算与实际成本', en: 'Event assumptions and real costs' }, body: { zh: `每场预计 200 人，每人每场 20 元，每月 4 场，对应月报名费毛收入 ¥${EVENT_GROSS_PER_MONTH.toLocaleString('en-US')}。这是计划情景，需要扣除退款、奖品、审核、客服等支出；首场实际报名和交付情况决定后续安排。`, en: `At 200 entrants per event, CNY 20 per entry and four events per month, planned gross monthly fees are CNY ${EVENT_GROSS_PER_MONTH.toLocaleString('en-US')}. Refunds, prizes, review and support must be deducted. Actual first-event participation and delivery guide subsequent scheduling.` } },
      ].map(item => <article key={item.title.en}><h2>{tr(item.title)}</h2><p>{tr(item.body)}</p></article>)}</div>
      <AppLink href="/bp#bp-competition" prefetch={false} className="overview-text-link">{tr({ zh: '查看竞品对比与官方介绍', en: 'Compare products and read their official introductions' })}<ArrowUpRight size={16} aria-hidden /></AppLink>
      <div className="overview-review" data-site-surface="panel"><div><h2>{tr({ zh: '如何提出合作', en: 'How to introduce a partnership' })}</h2><p>{tr(COOPERATION_INTRO)}</p><p className="overview-small">{tr(COOPERATION_EQUITY_POSITION)}</p><AppLink href="/bp#bp-cooperation" prefetch={false} className="overview-text-link">{tr({ zh: '看看三类合作方式', en: 'Explore the three partnership options' })}<ArrowUpRight size={16} aria-hidden /></AppLink></div></div>
      <p className="overview-small"><a href={MARKET_SOURCE.url} target="_blank" rel="noopener noreferrer">{tr({ zh: '核对市场数据原文：人民日报，2026-06-01', en: 'Verify the market source: People’s Daily, June 1, 2026' })}</a></p>
    </section>
  </main>;
}
