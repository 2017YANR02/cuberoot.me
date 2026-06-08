'use client';

/**
 * /wca/prediction-about — 速拧极限预测说明页
 */
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './prediction_about.css';
import i18n from "@/i18n/i18n-client";

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
  const t = (zh: string, en: string, zhHant?: string) => i18n.language === 'zh-Hant' ? (zhHant ?? zh) : (isZh ? zh : en);
  useDocumentTitle('速拧极限预测说明', 'Speedcubing Prediction Guide', "速擰極限預測說明");

  return (
    <div className="pa-page">
      <div className="pa-header">
        <Link href="/wca/prediction" className="pa-back">
          <ArrowLeft size={16} />
          <span>{t('返回极限预测', 'Back to Prediction', "返回極限預測")}</span>
        </Link>
      </div>

      <main className="pa-main">
        <h1 className="pa-title">{t('速拧极限预测是怎么工作的', 'How the speedcubing limit forecast works', "速擰極限預測是怎麼工作的")}</h1>
        <p className="pa-intro">
          {t(
            '/wca/prediction 用三轨并行的数学方法预测 16 个 WCA 项目的速拧极限:曲线拟合(exp+floor / Gompertz / 幂律)、物理下界(M/TPS+R 步数法)、以及极值统计理论(GEV)。数据覆盖 1982-2050。',
            '/wca/prediction forecasts the physical and statistical limits of 16 WCA events using three parallel approaches: curve-fitting (exp+floor / Gompertz / power-law), first-principles physics floors (M/TPS+R), and extreme-value theory (GEV). Data span 1982-2050.', "/wca/prediction 用三軌並行的數學方法預測 16 個 WCA 項目的速擰極限:曲線擬合(exp+floor / Gompertz / 冪律)、物理下界(M/TPS+R 步數法)、以及極值統計理論(GEV)。資料覆蓋 1982-2050。"
          )}
        </p>

        <h2 className="pa-section-title">{t('三轨预测方法', 'Three-track forecast methods', "三軌預測方法")}</h2>
        <ul className="pa-list">
          <li>
            <strong>{t('曲线拟合 (exp+floor / Gompertz / 幂律)', 'Curve fitting (exp+floor / Gompertz / power-law)', "曲線擬合 (exp+floor / Gompertz / 冪律)")}</strong>
            {t(
              ' — 对 WR 历史序列拟合收敛型曲线。exp+floor 和 Gompertz 都能捕捉"S 型"衰减;幂律适合早期快速下降段。三条曲线的预测值取加权均值。',
              ' — fits converging curves to the historical WR sequence. exp+floor and Gompertz capture S-shaped deceleration; power-law fits the early rapid-drop phase. Forecasts are a weighted ensemble.', " — 對 WR 歷史序列擬合收斂型曲線。exp+floor 和 Gompertz 都能捕捉\"S 型\"衰減;冪律適合早期快速下降段。三條曲線的預測值取加權均值。"
            )}
          </li>
          <li>
            <strong>{t('物理下界 (M/TPS+R)', 'Physics floor (M/TPS+R)')}</strong>
            {t(
              ' — 把一次 solve 拆解成步数 M、人类手速 TPS、和反应时间 R 三部分,估算生物力学不可突破的硬墙。各项目参数来自公开文献 + 竞技运动数据。',
              ' — decomposes a solve into move count M, human TPS, and reaction time R, then derives the biomechanical hard floor. Per-event parameters come from published literature and sports-science data.', " — 把一次 solve 拆解成步數 M、人類手速 TPS、和反應時間 R 三部分,估算生物力學不可突破的硬牆。各項目引數來自公開文獻 + 競技運動資料。"
            )}
          </li>
          <li>
            <strong>{t('极值统计 (GEV)', 'Extreme-value theory (GEV)', "極值統計 (GEV)")}</strong>
            {t(
              ' — 把历年 WR 当成极值序列,用广义极值分布(GEV)建模。给出"百年可达"("10 亿人参与")等概率框下的预测区间。',
              ' — treats annual WR progressions as an extremes sequence and fits a generalised extreme-value distribution. Yields probabilistic intervals for "century-scale" and "billion-participant" scenarios.', " — 把歷年 WR 當成極值序列,用廣義極值分佈(GEV)建模。給出\"百年可達\"(\"10 億人參與\")等機率框下的預測區間。"
            )}
          </li>
        </ul>

        <h2 className="pa-section-title">{t('报告结构', 'Report structure', "報告結構")}</h2>
        <div className="pa-flow">
          <Step
            step={1}
            title={t('一句话结论', 'Top Line', "一句話結論")}
            body={t(
              '显示"有多少项目已经压到物理下界 80% 以内",即还有不到 1.25 倍压缩空间 — 速拧正在撞墙的全局信号。',
              'Shows how many events sit within 80% of their physics floor — less than 1.25× compression remaining — the global signal that speedcubing is hitting the wall.', "顯示\"有多少項目已經壓到物理下界 80% 以內\",即還有不到 1.25 倍壓縮空間 — 速擰正在撞牆的全域性訊號。"
            )}
          />
          <Arrow />
          <Step
            step={2}
            title={t('撞墙排名', 'Closest to Wall', "撞牆排名")}
            body={t(
              '16 个项目按"当前 WR / 物理下界"比值排序。比值越接近 1 代表越接近极限。3×3 BLD / 5×5 BLD 等通常在顶部。',
              '16 events ranked by current WR / physics-floor ratio. Closer to 1.0 = closer to the limit. 3×3 BLD and 5×5 BLD typically top the list.', "16 個項目按\"當前 WR / 物理下界\"比值排序。比值越接近 1 代表越接近極限。3×3 BLD / 5×5 BLD 等通常在頂部。"
            )}
          />
          <Arrow />
          <Step
            step={3}
            title={t('各项目详细分析', 'Per-event analysis', "各項目詳細分析")}
            body={t(
              '每个项目有:历史 WR 折线图 + 三条拟合曲线 + 物理下界线;TPS / 步数分解 biomech 计算;各时间节点(2030/2040/2050)的里程碑预测;区域格局地图。',
              'Per event: historical WR line + three fitted curves + physics floor; per-move TPS/step biomechanical decomposition; milestone forecasts for 2030/2040/2050; regional distribution map.', "每個項目有:歷史 WR 折線圖 + 三條擬合曲線 + 物理下界線;TPS / 步數分解 biomech 計算;各時間節點(2030/2040/2050)的里程碑預測;區域格局地圖。"
            )}
            highlight
          />
        </div>

        <h2 className="pa-section-title">{t('数据来源', 'Data source', "資料來源")}</h2>
        <p className="pa-section-intro">
          {t(
            '数据来自本机 WCA MySQL dump + Python 拟合脚本生成的 stats/prediction/all_events.json。每次有新 WR 后手动重跑。不保证实时性 — 页面会显示数据生成日期。',
            'Data comes from a local WCA MySQL dump processed by a Python fitting script, producing stats/prediction/all_events.json. Regenerated manually after major WR progressions. Not guaranteed real-time — the page shows the data generation date.', "資料來自本機 WCA MySQL dump + Python 擬合指令碼生成的 stats/prediction/all_events.json。每次有新 WR 後手動重跑。不保證實時性 — 頁面會顯示資料生成日期。"
          )}
        </p>

        <h2 className="pa-section-title">{t('相关页面', 'See also', "相關頁面")}</h2>
        <ul className="pa-refs">
          <li>
            <Link href="/wca/prediction/333">{t('3×3 详细分析', '3×3 deep-dive', "3×3 詳細分析")}</Link>
            {t(' — 单项目更深入的分节分析。', ' — deeper per-section analysis for 3×3.', " — 單項目更深入的分節分析。")}
          </li>
          <li>
            <Link href="/wca/viz">{t('成绩分布', 'Distribution', "成績分佈")}</Link>
            {t(' — 单选手成绩分布 KDE 可视化。', ' — per-cuber result distribution KDE visualisation.', " — 單選手成績分佈 KDE 視覺化。")}
          </li>
          <li>
            <Link href="/wca/all-results">{t('全成绩排名', 'All Results', "全成績排名")}</Link>
            {t(' — 查看任意项目的历史 WR 排列。', ' — browse historical WR progressions per event.', " — 檢視任意項目的歷史 WR 排列。")}
          </li>
        </ul>
      </main>
    </div>
  );
}
