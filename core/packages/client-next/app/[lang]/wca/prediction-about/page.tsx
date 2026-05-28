'use client';

/**
 * /wca/prediction-about — 速拧极限预测说明页
 */
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './prediction_about.css';

interface StepProps { step: number; title: string; body: string; highlight?: boolean; }
function Step({ step, title, body, highlight }: StepProps) {
  return (
    <div className={`pa-step${highlight ? ' is-highlight' : ''}`}>
      <span className="pa-step-num">{step}</span>
      <div>
        <div className="pa-step-title">{title}</div>
        <div className="pa-step-body">{body}</div>
      </div>
    </div>
  );
}
function Arrow() { return <span className="pa-arrow" aria-hidden="true">↓</span>; }

export default function PredictionAboutPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);
  useDocumentTitle('速拧极限预测说明', 'Speedcubing Prediction Guide');

  return (
    <div className="pa-page">
      <div className="pa-header">
        <Link href="/wca/prediction" className="pa-back">
          <ArrowLeft size={16} />
          <span>{t('返回极限预测', 'Back to Prediction')}</span>
        </Link>
      </div>

      <main className="pa-main">
        <h1 className="pa-title">{t('速拧极限预测是怎么工作的', 'How the speedcubing limit forecast works')}</h1>
        <p className="pa-intro">
          {t(
            '/wca/prediction 用三轨并行的数学方法预测 16 个 WCA 项目的速拧极限:曲线拟合(exp+floor / Gompertz / 幂律)、物理下界(M/TPS+R 步数法)、以及极值统计理论(GEV)。数据覆盖 1982-2050。',
            '/wca/prediction forecasts the physical and statistical limits of 16 WCA events using three parallel approaches: curve-fitting (exp+floor / Gompertz / power-law), first-principles physics floors (M/TPS+R), and extreme-value theory (GEV). Data span 1982-2050.',
          )}
        </p>

        <h2 className="pa-section-title">{t('三轨预测方法', 'Three-track forecast methods')}</h2>
        <ul className="pa-list">
          <li>
            <strong>{t('曲线拟合 (exp+floor / Gompertz / 幂律)', 'Curve fitting (exp+floor / Gompertz / power-law)')}</strong>
            {t(
              ' — 对 WR 历史序列拟合收敛型曲线。exp+floor 和 Gompertz 都能捕捉"S 型"衰减;幂律适合早期快速下降段。三条曲线的预测值取加权均值。',
              ' — fits converging curves to the historical WR sequence. exp+floor and Gompertz capture S-shaped deceleration; power-law fits the early rapid-drop phase. Forecasts are a weighted ensemble.',
            )}
          </li>
          <li>
            <strong>{t('物理下界 (M/TPS+R)', 'Physics floor (M/TPS+R)')}</strong>
            {t(
              ' — 把一次 solve 拆解成步数 M、人类手速 TPS、和反应时间 R 三部分,估算生物力学不可突破的硬墙。各项目参数来自公开文献 + 竞技运动数据。',
              ' — decomposes a solve into move count M, human TPS, and reaction time R, then derives the biomechanical hard floor. Per-event parameters come from published literature and sports-science data.',
            )}
          </li>
          <li>
            <strong>{t('极值统计 (GEV)', 'Extreme-value theory (GEV)')}</strong>
            {t(
              ' — 把历年 WR 当成极值序列,用广义极值分布(GEV)建模。给出"百年可达"("10 亿人参与")等概率框下的预测区间。',
              ' — treats annual WR progressions as an extremes sequence and fits a generalised extreme-value distribution. Yields probabilistic intervals for "century-scale" and "billion-participant" scenarios.',
            )}
          </li>
        </ul>

        <h2 className="pa-section-title">{t('报告结构', 'Report structure')}</h2>
        <div className="pa-flow">
          <Step
            step={1}
            title={t('一句话结论', 'Top Line')}
            body={t(
              '显示"有多少项目已经压到物理下界 80% 以内",即还有不到 1.25 倍压缩空间 — 速拧正在撞墙的全局信号。',
              'Shows how many events sit within 80% of their physics floor — less than 1.25× compression remaining — the global signal that speedcubing is hitting the wall.',
            )}
          />
          <Arrow />
          <Step
            step={2}
            title={t('撞墙排名', 'Closest to Wall')}
            body={t(
              '16 个项目按"当前 WR / 物理下界"比值排序。比值越接近 1 代表越接近极限。3×3 BLD / 5×5 BLD 等通常在顶部。',
              '16 events ranked by current WR / physics-floor ratio. Closer to 1.0 = closer to the limit. 3×3 BLD and 5×5 BLD typically top the list.',
            )}
          />
          <Arrow />
          <Step
            step={3}
            title={t('各项目详细分析', 'Per-event analysis')}
            body={t(
              '每个项目有:历史 WR 折线图 + 三条拟合曲线 + 物理下界线;TPS / 步数分解 biomech 计算;各时间节点(2030/2040/2050)的里程碑预测;区域格局地图。',
              'Per event: historical WR line + three fitted curves + physics floor; per-move TPS/step biomechanical decomposition; milestone forecasts for 2030/2040/2050; regional distribution map.',
            )}
            highlight
          />
        </div>

        <h2 className="pa-section-title">{t('数据来源', 'Data source')}</h2>
        <p className="pa-section-intro">
          {t(
            '数据来自本机 WCA MySQL dump + Python 拟合脚本生成的 stats/prediction/all_events.json。每次有新 WR 后手动重跑。不保证实时性 — 页面会显示数据生成日期。',
            'Data comes from a local WCA MySQL dump processed by a Python fitting script, producing stats/prediction/all_events.json. Regenerated manually after major WR progressions. Not guaranteed real-time — the page shows the data generation date.',
          )}
        </p>

        <h2 className="pa-section-title">{t('相关页面', 'See also')}</h2>
        <ul className="pa-refs">
          <li>
            <Link href="/wca/prediction/333">{t('3×3 详细分析', '3×3 deep-dive')}</Link>
            {t(' — 单项目更深入的分节分析。', ' — deeper per-section analysis for 3×3.')}
          </li>
          <li>
            <Link href="/wca/viz">{t('成绩分布', 'Distribution')}</Link>
            {t(' — 单选手成绩分布 KDE 可视化。', ' — per-cuber result distribution KDE visualisation.')}
          </li>
          <li>
            <Link href="/wca/all-results">{t('全成绩排名', 'All Results')}</Link>
            {t(' — 查看任意项目的历史 WR 排列。', ' — browse historical WR progressions per event.')}
          </li>
        </ul>
      </main>
    </div>
  );
}
