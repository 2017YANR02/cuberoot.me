'use client';

import Link from '@/components/AppLink';
import MoreToggle from '@/components/MoreToggle';
import PageHeading from '@/components/PageHeading';
import { useT } from '@/hooks/useT';
import '@/components/report-page.css';

export default function ReconAboutPage() {
  const t = useT();
  return <main className="report-page">
    <header className="report-header">
      <PageHeading backHref="/recon">{t('复盘怎么看', 'Reading a reconstruction')}</PageHeading>
      <p>{t('把一次还原拆成打乱、步骤与阶段，看看选手怎样把魔方还原。', 'Follow a solve from its scramble through the moves and stages to the solved state.')}</p>
      <div className="report-links"><Link href="/recon">{t('浏览复盘', 'Browse reconstructions')}</Link><Link href="/recon/submit">{t('提交复盘', 'Submit a reconstruction')}</Link></div>
    </header>
    <h2>{t('看一条复盘，关注这三件事', 'Three things to look for')}</h2>
    <table className="report-table">
      <tbody>
        <tr><th scope="row">{t('还原路线', 'The solution')}</th><td>{t('对照打乱和步骤，用动画看每一步改变了什么。', 'Use the scramble, move sequence and animation to follow how the cube changes.')}</td></tr>
        <tr><th scope="row">{t('阶段选择', 'Stage choices')}</th><td>{t('看十字、F2L 与顶层的衔接，比较步数、转体和处理顺序。', 'Inspect the cross, F2L and last-layer transitions: moves, rotations and the order of pairs.')}</td></tr>
        <tr><th scope="row">{t('其他解法', 'Alternative solutions')}</th><td>{t('有替代解或相同打乱的复盘时，对照不同思路。替代解不等于选手当时实际使用的解法。', 'Compare alternatives or other reconstructions of the same scramble when available. An alternative is not necessarily what the competitor executed.')}</td></tr>
      </tbody>
    </table>
    <h2>{t('补充自己的还原', 'Contribute a solve')}</h2>
    <p>{t('登录后填写打乱、还原步骤和成绩，附上视频或出处。可选择公开、不公开列出或私享；提交前检查符号、朝向和还原结果。', 'Sign in, enter the scramble, solution and result, and add a video or source. Choose public, unlisted or private visibility. Check notation, orientation and the solved state before submitting.')}</p>
    <h2>{t('数据能说明什么', 'What the data can tell you')}</h2>
    <ul className="report-limits">
      <li>{t('复盘由投稿与资料整理而来，可能存在漏步、误记或来源缺失。还原成功只能验证步骤一致，不能证明它就是视频中的实际动作。', 'Contributed reconstructions may have missing moves, transcription errors or incomplete sources. A sequence that solves the cube is not proof of what happened in the video.')}</li>
      <li>{t('总时间与步数可以算整体 TPS；准确的阶段用时还需要视频打点或设备时间记录。', 'Total time and move count give an overall TPS. Accurate stage times also need video markers or device timestamps.')}</li>
    </ul>
    <details className="report-details">
      <MoreToggle as="summary">{t('阶段、校验与相关工具', 'Stages, validation and related tools')}</MoreToggle>
      <div className="report-detail-body">
        <p>{t('阶段分析按魔方状态识别阶段完成位置，旋转、跳步和不同还原方法可能影响切分。提交校验也不能代替对视频、成绩和出处的人工核对。', 'Stage analysis detects completion from cube states. Rotations, skips and different solving methods can affect segmentation. Submission checks do not replace reviewing the video, result and source.')}</p>
        <div className="report-links"><Link href="/frame-count">{t('逐帧计时', 'Frame counter')}</Link><Link href="/scramble/analyzer">{t('CFOP 分析器', 'CFOP analyzer')}</Link><Link href="/wca/comp">{t('比赛成绩', 'Competition results')}</Link></div>
      </div>
    </details>
  </main>;
}
