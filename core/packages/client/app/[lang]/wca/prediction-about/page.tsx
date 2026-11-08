'use client';

import Link from '@/components/AppLink';
import MoreToggle from '@/components/MoreToggle';
import PageHeading from '@/components/PageHeading';
import { useT } from '@/hooks/useT';
import '@/components/report-page.css';

export default function PredictionAboutPage() {
  const t = useT();
  return <main className="report-page">
    <header className="report-header">
      <PageHeading backHref="/wca/prediction">{t('怎样读极限预测', 'Reading the forecasts')}</PageHeading>
      <p>{t('用历史纪录与模型假设，探索速拧还有多少进步空间。预测值是条件下的估计，不是已证明的人类极限。', 'Explore possible progress using record history and model assumptions. Forecasts are conditional estimates, not proven human limits.')}</p>
      <div className="report-links"><Link href="/wca/prediction">{t('查看预测报告', 'Open forecasts')}</Link><Link href="/wca/prediction/333">{t('三阶详细分析', '3×3 analysis')}</Link></div>
    </header>
    <table className="report-table">
      <thead><tr><th scope="col">{t('看到的数字', 'What you see')}</th><th scope="col">{t('应该怎样理解', 'How to read it')}</th></tr></thead>
      <tbody>
        <tr><th scope="row">{t('历史纪录', 'Record history')}</th><td>{t('数据快照中已发生的成绩，是模型的输入。', 'Results that occurred within the data snapshot: the model’s input.')}</td></tr>
        <tr><th scope="row">{t('未来年份的预测', 'Future-year forecast')}</th><td>{t('历史趋势按所选模型延续后的估计，不是破纪录时间表。', 'An extrapolation of past trends under the selected model, not a record-breaking schedule.')}</td></tr>
        <tr><th scope="row">{t('「物理下界」', '“Physical floor”')}</th><td>{t('由步数、手速、识别等假设推算的参考线。改变假设，参考线也会变。', 'A reference based on assumed move counts, turning speed and recognition time. Change the assumptions and it changes too.')}</td></tr>
      </tbody>
    </table>
    <h2>{t('读区间，不只看单个数', 'Look beyond the point estimate')}</h2>
    <p>{t('先看数据日期，再看模型是否与历史走势吻合，最后比较不同模型与预测区间。模型分歧越大，越不宜只摘一个数字。', 'Check the data date, how well the model fits the history, and the range across models and intervals. When models disagree, quoting one number hides uncertainty.')}</p>
    <h2>{t('这些因素仍无法保证', 'Where forecasts can fail')}</h2>
    <ul className="report-limits">
      <li>{t('新硬件、新方法、参赛规模和幸运打乱，都可能使未来偏离旧趋势。', 'New hardware, methods, participation levels and lucky scrambles can shift results away from past trends.')}</li>
      <li>{t('拟合得好不代表预测得准。区间只反映建模时包含的变化，不包含所有未来变化。', 'A good historical fit does not guarantee a good forecast. Intervals reflect modelled variation, not every possible future change.')}</li>
      <li>{t('报告使用数据快照，未必包含最新纪录；不同项目的秒数、步数与成绩类型不能直接混比。', 'The snapshot may omit recent records. Seconds, move counts and different result types are not directly comparable.')}</li>
    </ul>
    <details className="report-details">
      <MoreToggle as="summary">{t('模型与计算口径', 'Models and assumptions')}</MoreToggle>
      <div className="report-detail-body">
        <p>{t('趋势对照包括带下限的指数、Gompertz 与幂律等曲线；动作模型以「步数 ÷ 手速 + 识别等额外时间」估算用时；极值模型探索大量尝试下的极端成绩。这三类模型回答的问题不同。', 'Trend comparisons include exponential-with-floor, Gompertz and power-law curves. Movement models estimate time as moves ÷ turning speed plus recognition and other overhead. Extreme-value models explore exceptional results over many attempts. These answer different questions.')}</p>
        <p>{t('预测报告中保留各项目参数、拟合图与数据日期。公式里的下限是估计参数；数学上证明的最少步下界与人体执行时间的假设应分开理解。', 'The report retains event parameters, fit charts and data dates. A fitted floor is an estimate; a proven mathematical move bound and an assumed human execution time are distinct.')}</p>
      </div>
    </details>
  </main>;
}
