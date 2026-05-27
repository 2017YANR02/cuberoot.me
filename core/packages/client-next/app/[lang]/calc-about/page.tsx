'use client';

/**
 * /calc-about — 成绩计算器说明页
 */
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import LangToggle from '@/components/LangToggle';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './calc_about.css';

interface StepProps { step: number; title: string; body: string; highlight?: boolean; }
function Step({ step, title, body, highlight }: StepProps) {
  return (
    <div className={`calca-step${highlight ? ' is-highlight' : ''}`}>
      <span className="calca-step-num">{step}</span>
      <div>
        <div className="calca-step-title">{title}</div>
        <div className="calca-step-body">{body}</div>
      </div>
    </div>
  );
}
function Arrow() { return <span className="calca-arrow" aria-hidden="true">↓</span>; }

export default function CalcAboutPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);
  useDocumentTitle('成绩计算器说明', 'Score Calculator Guide');

  return (
    <div className="calca-page">
      <div className="calca-header">
        <Link href="/calc" className="calca-back">
          <ArrowLeft size={16} />
          <span>{t('返回成绩计算器', 'Back to Calculator')}</span>
        </Link>
        <LangToggle />
      </div>

      <main className="calca-main">
        <h1 className="calca-title">{t('成绩计算器是怎么工作的', 'How the Score Calculator works')}</h1>
        <p className="calca-intro">
          {t(
            '/calc 是一个 WCA 成绩概率计算器。给定两位选手各 5 把成绩,模拟 Ao5 / Mo3 等赛制下的对决胜率,并绘制成绩分布核密度估计(KDE)曲线。移植自 carykh/hthgrapher。',
            '/calc is a WCA result probability calculator. Given each player\'s five solve times, it simulates win probability for Ao5 / Mo3 and other formats, and plots KDE curves. Ported from carykh/hthgrapher.',
          )}
        </p>

        <h2 className="calca-section-title">{t('两种 tab', 'Two tabs')}</h2>
        <ul className="calca-list">
          <li>
            <strong>{t('对决 (Compare)', 'Compare')}</strong>
            {t(
              ' — 两位选手面对面:左右各 5 个输入格输入成绩,图表实时画出 KDE 曲线并给出胜率估算。',
              ' — side-by-side comparison: five input cells per player, KDE chart + win-probability update live.',
            )}
          </li>
          <li>
            <strong>{t('平均 (Average)', 'Average')}</strong>
            {t(
              ' — 单选手平均速度计算器:输入任意组成绩,查看移动平均 / session 统计 / PB 预测。',
              ' — single-player average calculator: input any set of results to view rolling averages, session stats, and PB trend.',
            )}
          </li>
        </ul>

        <h2 className="calca-section-title">{t('使用流程(对决模式)', 'How to use (Compare mode)')}</h2>
        <div className="calca-flow">
          <Step
            step={1}
            title={t('选项目', 'Pick an event')}
            body={t(
              '底部事件选择器切换项目。切换时所有成绩清空,并按新项目更新 WR 默认参数。',
              'The event selector at the bottom switches events. All times are cleared and WR defaults update for the new event.',
            )}
          />
          <Arrow />
          <Step
            step={2}
            title={t('加载示例数据', 'Load sample data')}
            body={t(
              '点"随机 / World TOP 2"按钮自动加载当前项目 WR #1 和 WR #2 选手的 KDE 分布作为起点。头像出现代表数据已就绪。',
              'Click the "World TOP 2" button to auto-load KDE data for WR #1 and WR #2 of the current event. Avatars appear when data is ready.',
            )}
          />
          <Arrow />
          <Step
            step={3}
            title={t('输入成绩', 'Enter times')}
            body={t(
              '直接在数字格里点击输入(单位:百分之一秒,即 cs)。也可以用屏幕下方的虚拟键盘。DNF 输入 -1,DNS 留 0。',
              'Click any cell to enter times in centiseconds (cs). The on-screen numpad also works. Enter -1 for DNF and leave 0 for DNS.',
            )}
          />
          <Arrow />
          <Step
            step={4}
            title={t('读胜率', 'Read win probability')}
            body={t(
              '图表上方的统计面板实时显示:双方平均、标准差、以及"Player 1 打赢 Player 2 的概率"百分比。概率由 Monte Carlo 采样 KDE 计算。',
              'The stats panel above the chart updates live: mean, std, and "P1 beats P2" win probability. Probability is computed by Monte Carlo sampling the KDE.',
            )}
            highlight
          />
          <Arrow />
          <Step
            step={5}
            title={t('替换为真实选手', 'Replace with a real cuber')}
            body={t(
              '头像按钮旁的搜索框可以搜索任意 WCA 选手,加载其历史成绩生成 KDE。也可以用"我"按钮关联自己的 WCA 账号(需要先在右上角登录)。',
              'The search field next to each avatar loads any WCA cuber\'s history to generate a real KDE. The "me" button links your own WCA account (login required in the top right).',
            )}
          />
        </div>

        <h2 className="calca-section-title">{t('算法', 'Algorithm')}</h2>
        <p className="calca-section-intro">
          {t(
            '对每位选手的历史成绩用高斯核做 KDE,带宽按 Silverman 规则自适应。胜率通过 10000 次模拟 Ao5(各自从 KDE 采样 5 次,计算均值)得到:Player 1 平均 < Player 2 平均的次数比例即胜率。FMC 走步数分布,MBLD 走自定义成绩函数。',
            'A Gaussian KDE is fit to each player\'s history with Silverman-rule adaptive bandwidth. Win probability comes from 10,000 simulated Ao5 rounds (5 samples from each KDE, average, compare). FMC uses move-count distributions; MBLD uses a custom score function.',
          )}
        </p>

        <h2 className="calca-section-title">{t('相关页面', 'See also')}</h2>
        <ul className="calca-refs">
          <li>
            <Link href="/wca/viz">{t('成绩分布', 'Distribution')}</Link>
            {t(' — 单选手成绩 KDE 分布的详细可视化。', ' — detailed KDE visualisation for a single cuber\'s results.')}
          </li>
          <li>
            <Link href="/nemesizer">{t('宿敌', 'Nemesizer')}</Link>
            {t(' — 找到和你成绩最接近的 WCA 对手。', ' — find your closest WCA rival by result proximity.')}
          </li>
          <li>
            <Link href="/wca/prediction">{t('极限预测', 'Prediction')}</Link>
            {t(' — WCA 项目速拧极限的数学预测报告。', ' — mathematical limit forecasts for WCA events.')}
          </li>
          <li>
            <a href="https://github.com/carykh/hthgrapher" target="_blank" rel="noopener noreferrer">carykh/hthgrapher</a>
            {t(' — 本页的上游开源项目(MIT)。', ' — the upstream open-source project this was ported from (MIT).')}
          </li>
        </ul>
      </main>
    </div>
  );
}
