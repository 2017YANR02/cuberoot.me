'use client';

import Link from '@/components/AppLink';
import MoreToggle from '@/components/MoreToggle';
import PageHeading from '@/components/PageHeading';
import { useT } from '@/hooks/useT';
import '@/components/report-page.css';

export default function CalcAboutPage() {
  const t = useT();
  return <main className="report-page">
    <header className="report-header">
      <PageHeading backHref="/calc">{t('成绩计算器', 'Score calculator')}</PageHeading>
      <p>{t('算平均、看最后一把需要多快，或用历史成绩模拟两位选手的对决。', 'Calculate an average, find the last solve you need, or simulate a matchup from past results.')}</p>
      <div className="report-links"><Link href="/calc">{t('打开计算器', 'Open calculator')}</Link><Link href="/calc?tab=average">{t('计算一组成绩', 'Calculate session averages')}</Link></div>
    </header>
    <table className="report-table">
      <thead><tr><th scope="col">{t('想知道', 'Your question')}</th><th scope="col">{t('用哪个功能', 'Where to look')}</th></tr></thead>
      <tbody>
        <tr><th scope="row">{t('最后一把要多快？', 'What do I need on the last solve?')}</th><td>{t('对决：填已有成绩与目标平均，查看所需单次及最好、最坏平均。', 'Compare: enter completed solves and a target average to see the required solve and best/worst possible averages.')}</td></tr>
        <tr><th scope="row">{t('这组练习表现如何？', 'How was this session?')}</th><td>{t('平均：粘贴成绩，查看 Mo3、Ao5、Ao12 与本组最佳。', 'Average: paste results to see Mo3, Ao5, Ao12 and session bests.')}</td></tr>
        <tr><th scope="row">{t('两位选手谁更可能赢？', 'Who is more likely to win?')}</th><td>{t('对决：加载两位 WCA 选手，再运行 Race 模拟。', 'Compare: load two WCA competitors, then run the Race simulation.')}</td></tr>
      </tbody>
    </table>
    <h2>{t('一个 Ao5 例子', 'An Ao5 example')}</h2>
    <p>{t('9、10、11、12、13 秒 → 去掉最快的 9 和最慢的 13 → 平均 11 秒。', '9, 10, 11, 12, 13 seconds → drop the fastest (9) and slowest (13) → average 11 seconds.')}</p>
    <p>{t('只有一把 DNF 时，DNF 作为最差成绩去掉；两把 DNF 则整组 Ao5 为 DNF。', 'One DNF is dropped as the worst solve; two DNFs make the Ao5 a DNF.')}</p>
    <h2>{t('模拟胜率的边界', 'What a simulated win rate means')}</h2>
    <p>{t('胜率取决于加载的历史成绩和模拟设置，不等于下一场比赛的胜率。样本少、状态变化或缺少历史数据时，估计更不稳定；平局不计入胜率分母。', 'The estimate depends on the loaded results and simulation settings. It does not predict the next competition. Small samples, changing form and missing history add uncertainty; ties are excluded from the win-rate denominator.')}</p>
    <details className="report-details">
      <MoreToggle as="summary">{t('模拟方法与来源', 'Simulation method and source')}</MoreToggle>
      <div className="report-detail-body">
        <p>{t('采样优先使用选手最近最多 100 把官方单次，以核密度估计（KDE）平滑成绩分布；缺少可用样本时使用回退分布。目标与进步设置也会影响采样。Race 模拟 10 万轮，按项目计算成绩后比较胜负。', 'Sampling uses up to 100 recent official singles, smoothed with kernel density estimation (KDE). A fallback distribution is used when samples are unavailable. Target and improvement settings also affect sampling. Race simulates 100,000 rounds and compares event-specific results.')}</p>
        <p>{t('计算器基于开源项目改编：', 'Adapted from the open-source project: ')}<a href="https://github.com/carykh/hthgrapher" target="_blank" rel="noopener noreferrer">carykh/hthgrapher</a></p>
      </div>
    </details>
  </main>;
}
