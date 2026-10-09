import { ArrowUpRight, Building2, ChartNoAxesColumnIncreasing, Users } from 'lucide-react';
import { tr } from '@/i18n/tr';
import { MARKET_SOURCE } from './bp-data';

export default function MarketOpening() {
  return <section id="bp-market-size" className="bp-market-opening overview-wrap" aria-labelledby="bp-title">
    <div className="bp-market-heading">
      <div>
        <p className="overview-kicker">{tr({ zh: '中国魔方市场 / 商业计划书 · 2026.10', en: 'CHINA’S CUBING MARKET / BUSINESS PLAN · 2026.10' })}</p>
        <h1 id="bp-title">{tr({ zh: '数百万人的热爱。\n一个持续进阶的市场。', en: 'Millions of enthusiasts.\nA market for learning and practice.' })}</h1>
        <p className="overview-lead">{tr({ zh: '魔方根连接个人练习者、老师与培训机构，以个人和机构订阅、课程及线上赛事，服务从学习到持续进阶的需求。', en: 'CubeRoot connects practitioners, teachers and training organisations through individual and institutional subscriptions, courses and online competitions.' })}</p>
      </div>
      <figure className="bp-cover-art"><img src="/images/overview/bp-glass-sculpture-v1.webp" srcSet="/images/overview/bp-glass-sculpture-mobile-v1.webp 800w, /images/overview/bp-glass-sculpture-v1.webp 1672w" sizes="(max-width: 760px) calc(100vw - 40px), 550px" width={1672} height={941} fetchPriority="high" alt={tr({ zh: '玻璃、金属与陶土方块构成的悬浮几何雕塑', en: 'A floating geometric sculpture of glass, metal and terracotta modules' })} /><figcaption>{tr({ zh: 'AI 概念图 · 专业积累，汇聚成形', en: 'AI concept illustration · expertise coming together' })}</figcaption></figure>
    </div>
    <div className="bp-market-cards">
      <article data-site-surface="panel"><Users size={26} aria-hidden /><span className="bp-market-label">{tr({ zh: '中国魔方爱好者', en: 'Cubing enthusiasts in China' })}</span><strong>{tr({ zh: '800 万', en: '8 million' })}</strong><span className="bp-market-status">{tr({ zh: '2026 年预测', en: '2026 forecast' })}</span><p>{tr({ zh: '2024 年约 700 万人；2026 年预计达到 800 万人。', en: 'About 7 million in 2024; forecast to reach 8 million in 2026.' })}</p></article>
      <article data-site-surface="panel"><Building2 size={26} aria-hidden /><span className="bp-market-label">{tr({ zh: '国内魔方培训机构', en: 'Training organisations in China' })}</span><strong>1,400+</strong><span className="bp-market-status">{tr({ zh: '报道时已有', en: 'Reported existing institutions' })}</span><p>{tr({ zh: '已有教学供给，为机构订阅、课程与课后训练服务提供切入场景。', en: 'An established teaching sector creates potential use cases for subscriptions, courses and after-class practice.' })}</p></article>
      <article data-site-surface="panel"><ChartNoAxesColumnIncreasing size={26} aria-hidden /><span className="bp-market-label">{tr({ zh: '国内魔方培训市场', en: 'China’s cubing training market' })}</span><strong>{tr({ zh: '6 亿元', en: 'CNY 600M' })}</strong><span className="bp-market-status">{tr({ zh: '2026 年底预测', en: 'End-2026 forecast' })}</span><p>{tr({ zh: '培训消费的行业规模；魔方根从专业工具、课程和教学服务切入。', en: 'Training-sector spending; CubeRoot’s entry points are specialist tools, courses and educator services.' })}</p></article>
    </div>
    <p className="bp-market-source"><a href={MARKET_SOURCE.url} target="_blank" rel="noopener noreferrer">{tr({ zh: '来源：《人民日报》2026-06-01，第 14 版', en: 'Source: People’s Daily, 2026-06-01, page 14' })}<ArrowUpRight size={14} aria-hidden /></a></p>
    <div className="bp-market-bridge"><p>{tr({ zh: '智能魔方正在把每次转动带进数字训练。魔方根用工具承接练习，用课程推动进阶，以线上赛事为持续参与提供目标。', en: 'Smart cubes bring each turn into digital practice. CubeRoot connects that practice to learning through tools and courses, with online events as a focus for continued participation.' })}</p><a className="overview-primary" href="#bp-competition">{tr({ zh: '看智能魔方与竞争格局', en: 'Explore smart cubes & the competition' })}<ArrowUpRight size={17} aria-hidden /></a></div>
  </section>;
}
