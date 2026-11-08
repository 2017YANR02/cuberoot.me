'use client';

import Link from '@/components/AppLink';
import MoreToggle from '@/components/MoreToggle';
import PageHeading from '@/components/PageHeading';
import { useT } from '@/hooks/useT';
import '@/components/report-page.css';

export default function NemesizerAboutPage() {
  const t = useT();
  return <main className="report-page">
    <header className="report-header">
      <PageHeading backHref="/nemesizer">{t('谁是你的宿敌', 'Who is your nemesis?')}</PageHeading>
      <p>{t('你有排名的每个项目、每种成绩类型，对方都有排名且严格领先，才算你的「宿敌」。单次与平均分开比较。', 'A nemesis ranks strictly ahead of you in every event and result type where you have a ranking. Singles and averages are compared separately.')}</p>
      <div className="report-links"><Link href="/nemesizer">{t('查找宿敌', 'Find nemeses')}</Link><Link href="/nemesizer?mode=h2h">{t('两人对比', 'Compare two cubers')}</Link></div>
    </header>
    <h2>{t('用一个简化例子看懂', 'A simplified example')}</h2>
    <p>{t('假设你只有以下两项排名：', 'Suppose these are your only ranked results:')}</p>
    <table className="report-table">
      <thead><tr><th scope="col">{t('世界排名', 'World rank')}</th><th scope="col">{t('你', 'You')}</th><th scope="col">{t('选手 A', 'Cuber A')}</th><th scope="col">{t('选手 B', 'Cuber B')}</th></tr></thead>
      <tbody>
        <tr><th scope="row">{t('三阶单次', '3×3 single')}</th><td>100</td><td>90</td><td>90</td></tr>
        <tr><th scope="row">{t('三阶平均', '3×3 average')}</th><td>200</td><td>180</td><td>200</td></tr>
        <tr><th scope="row">{t('是你的宿敌？', 'Your nemesis?')}</th><td>—</td><td>{t('是', 'Yes')}</td><td>{t('否，平均并列', 'No: average tied')}</td></tr>
      </tbody>
    </table>
    <p>{t('少一项排名也不满足条件；对方多出的项目不影响判断。无需有共同参赛经历，也不要求实力接近。', 'Missing any of your ranked categories disqualifies a candidate; their extra events do not matter. Shared competitions and similar ability are not required.')}</p>
    <h2>{t('还可以怎样比较', 'Other ways to compare')}</h2>
    <ul className="report-limits">
      <li>{t('对决：并排查看两人的各项目成绩与排名。', 'Head to head: compare both cubers’ results and ranks by event.')}</li>
      <li>{t('假设：修改假想排名，看看宿敌关系如何变化。', 'What if: change hypothetical ranks to explore how relationships change.')}</li>
      <li>{t('统计：查看宿敌数量与关系分布。', 'Statistics: explore counts and relationships across the dataset.')}</li>
    </ul>
    <p>{t('这是历史最佳排名的比较，不代表当前状态或下一场比赛胜负。数据有更新延迟；假设模式不会修改正式成绩。', 'This compares personal-best rankings, not current form or the outcome of a future competition. Data can lag; hypothetical changes do not alter official results.')}</p>
    <details className="report-details">
      <MoreToggle as="summary">{t('关系筛选与数据口径', 'Relation filters and data')}</MoreToggle>
      <div className="report-detail-body">
        <p>{t('「几乎」表示覆盖全部所需排名，但恰好有一项没领先（并列也算）；「仅差一点」仍须全部领先，且最小排名差为 1。反向关系则以对方拥有的排名为比较范围。', '“Nearly” covers all required rankings but fails to lead in exactly one, including a tie. “Only just” still requires a lead in all of them, with a smallest rank gap of one. Reverse relations use the other cuber’s ranked categories.')}</p>
        <p>{t('地区筛选缩小候选人范围，比较依据仍是世界排名。数据来自 WCA 排名快照，日期以工具中显示的导出日期为准。', 'Region filters narrow the candidate pool; comparisons still use world ranks. Data comes from a WCA rankings snapshot, dated by the export shown in the tool.')}</p>
      </div>
    </details>
  </main>;
}
