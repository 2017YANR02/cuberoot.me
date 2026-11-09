'use client';

import Link from '@/components/AppLink';
import MoreToggle from '@/components/MoreToggle';
import PageHeading from '@/components/PageHeading';
import { useT } from '@/hooks/useT';
import '@/components/report-page.css';

export default function CompAboutPage() {
  const t = useT();
  return <main className="report-page">
    <header className="report-header">
      <PageHeading backHref="/wca/comp">{t('比赛成绩怎么看', 'Reading competition results')}</PageHeading>
      <p>{t('搜索比赛名或粘贴比赛链接，查看每轮成绩、选手表现和赛前排名。', 'Search a competition or paste its link to browse rounds, competitor results and pre-competition rankings.')}</p>
      <div className="report-links"><Link href="/wca/comp">{t('查找比赛', 'Find a competition')}</Link><Link href="/wca/comp?view=globe">{t('在地图上找', 'Browse the globe')}</Link></div>
    </header>
    <table className="report-table">
      <thead><tr><th scope="col">{t('想看什么', 'Looking for')}</th><th scope="col">{t('在哪里', 'Where to find it')}</th></tr></thead>
      <tbody>
        <tr><th scope="row">{t('某一轮的成绩', 'Round results')}</th><td>{t('选项目和轮次，查看名次、单次与平均。', 'Select an event and round to see places, singles and averages.')}</td></tr>
        <tr><th scope="row">{t('一个选手的整场表现', 'A competitor’s full event')}</th><td>{t('点选手姓名，查看本场各轮成绩与个人最佳对比。', 'Select a competitor to inspect their rounds and compare personal bests.')}</td></tr>
        <tr><th scope="row">{t('赛前实力排序', 'Pre-competition seeding')}</th><td>{t('切到 Psych Sheet，查看报名选手的历史成绩排名。', 'Open the Psych Sheet for registered competitors ranked by past performance.')}</td></tr>
      </tbody>
    </table>
    <h2>{t('PR2 不是第二名', 'PR2 is not second place')}</h2>
    <p>{t('PR 表示个人最快，PR2 表示个人历史第二快的成绩档位。它与本轮名次不同，单次和平均分别比较，同值共享档位。', 'PR marks a personal best; PR2 marks the second-fastest distinct result in that person’s history. It is separate from round placement. Singles and averages are ranked separately, with equal values sharing a rank.')}</p>
    <p>{t('历史比较以赛前成绩为基础，再按轮次计入本场成绩；未来的新纪录不会把旧比赛标记改成按今天排名。', 'Historical comparisons start with pre-competition results and incorporate this competition round by round. Future records do not turn old badges into present-day rankings.')}</p>
    <h2>{t('直播成绩可能变化', 'Live results can change')}</h2>
    <p>{t('录入、判罚与来源同步可能有延迟或修正，直播结果以最终官方发布为准。Psych Sheet 是赛前参考，不是最终名次；数据缺失也不代表选手没有成绩。', 'Entry, penalties and source updates can be delayed or corrected. Final official results take precedence. A Psych Sheet is a pre-competition reference, not a final ranking; missing data does not mean no result exists.')}</p>
    <details className="report-details">
      <MoreToggle as="summary">{t('数据来源与更新方式', 'Data sources and updates')}</MoreToggle>
      <div className="report-detail-body">
        <p>{t('历史成绩来自 WCA 数据，进行中的比赛按可用情况读取 cubing.com 或 WCA Live；部分新比赛通过 WCA 接口补充。静态快照与缓存加快读取，但不保证实时同步。', 'Historical results come from WCA data. Ongoing competitions use cubing.com or WCA Live where available, with WCA APIs supplementing some new events. Snapshots and caches speed up access but do not guarantee real-time updates.')}</p>
        <p>{t('支持的直播来源通过事件通知触发刷新，并用轮询补偿漏掉的更新。来源切换、网络中断与上游更正都可能影响显示时间。', 'Supported live sources trigger refreshes through event notifications, with polling to recover missed updates. Source changes, outages and upstream corrections can affect when results appear.')}</p>
        <div className="report-links"><Link href="/wca/comp/sources">{t('完整数据源流程', 'Full data-source flow')}</Link><a href="https://www.worldcubeassociation.org/competitions" target="_blank" rel="noopener noreferrer">{t('WCA 官方比赛', 'Official WCA competitions')}</a></div>
      </div>
    </details>
  </main>;
}
