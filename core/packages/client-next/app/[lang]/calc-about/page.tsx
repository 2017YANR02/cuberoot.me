'use client';

/**
 * /calc-about — 成绩计算器说明页
 */
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './calc_about.css';
import i18n from "@/i18n/i18n-client";
import { useT } from "@/hooks/useT";

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
  const t = useT();
  useDocumentTitle('成绩计算器说明', 'Score Calculator Guide', "成績計算器說明");

  return (
    <div className="calca-page">
      <div className="calca-header">
        <Link href="/calc" className="calca-back">
          <ArrowLeft size={16} />
          <span>{t('返回成绩计算器', 'Back to Calculator', "返回成績計算器")}</span>
        </Link>
      </div>

      <main className="calca-main">
        <h1 className="calca-title">{t('成绩计算器是怎么工作的', 'How the Score Calculator works', "成績計算器是怎麼工作的")}</h1>
        <p className="calca-intro">
          {t(
            '/calc 是一个 WCA 成绩概率计算器。给定两位选手各 5 把成绩,模拟 Ao5 / Mo3 等赛制下的对决胜率,并绘制成绩分布核密度估计(KDE)曲线。移植自 carykh/hthgrapher。',
            '/calc is a WCA result probability calculator. Given each player\'s five solve times, it simulates win probability for Ao5 / Mo3 and other formats, and plots KDE curves. Ported from carykh/hthgrapher.', "/calc 是一個 WCA 成績機率計算器。給定兩位選手各 5 把成績,模擬 Ao5 / Mo3 等賽制下的對決勝率,並繪製成績分佈核密度估計(KDE)曲線。移植自 carykh/hthgrapher。"
          )}
        </p>

        <h2 className="calca-section-title">{t('两种 tab', 'Two tabs', "兩種 tab")}</h2>
        <ul className="calca-list">
          <li>
            <strong>{t('对决 (Compare)', 'Compare', "對決 (Compare)")}</strong>
            {t(
              ' — 两位选手面对面:左右各 5 个输入格输入成绩,图表实时画出 KDE 曲线并给出胜率估算。',
              ' — side-by-side comparison: five input cells per player, KDE chart + win-probability update live.', " — 兩位選手面對面:左右各 5 個輸入格輸入成績,圖表實時畫出 KDE 曲線並給出勝率估算。"
            )}
          </li>
          <li>
            <strong>{t('平均 (Average)', 'Average')}</strong>
            {t(
              ' — 单选手平均速度计算器:输入任意组成绩,查看移动平均 / session 统计 / PB 预测。',
              ' — single-player average calculator: input any set of results to view rolling averages, session stats, and PB trend.', " — 單選手平均速度計算器:輸入任意組成績,檢視移動平均 / session 統計 / PB 預測。"
            )}
          </li>
        </ul>

        <h2 className="calca-section-title">{t('使用流程(对决模式)', 'How to use (Compare mode)', "使用流程(對決模式)")}</h2>
        <div className="calca-flow">
          <Step
            step={1}
            title={t('选项目', 'Pick an event', "選項目")}
            body={t(
              '底部事件选择器切换项目。切换时所有成绩清空,并按新项目更新 WR 默认参数。',
              'The event selector at the bottom switches events. All times are cleared and WR defaults update for the new event.', "底部事件選擇器切換項目。切換時所有成績清空,並按新項目更新 WR 預設引數。"
            )}
          />
          <Arrow />
          <Step
            step={2}
            title={t('加载示例数据', 'Load sample data', "載入示例資料")}
            body={t(
              '点"随机 / World TOP 2"按钮自动加载当前项目 WR #1 和 WR #2 选手的 KDE 分布作为起点。头像出现代表数据已就绪。',
              'Click the "World TOP 2" button to auto-load KDE data for WR #1 and WR #2 of the current event. Avatars appear when data is ready.', "點\"隨機 / World TOP 2\"按鈕自動載入當前項目 WR #1 和 WR #2 選手的 KDE 分佈作為起點。頭像出現代表資料已就緒。"
            )}
          />
          <Arrow />
          <Step
            step={3}
            title={t('输入成绩', 'Enter times', "輸入成績")}
            body={t(
              '直接在数字格里点击输入(单位:百分之一秒,即 cs)。也可以用屏幕下方的虚拟键盘。DNF 输入 -1,DNS 留 0。',
              'Click any cell to enter times in centiseconds (cs). The on-screen numpad also works. Enter -1 for DNF and leave 0 for DNS.', "直接在數字格里點選輸入(單位:百分之一秒,即 cs)。也可以用螢幕下方的虛擬鍵盤。DNF 輸入 -1,DNS 留 0。"
            )}
          />
          <Arrow />
          <Step
            step={4}
            title={t('读胜率', 'Read win probability', "讀勝率")}
            body={t(
              '图表上方的统计面板实时显示:双方平均、标准差、以及"Player 1 打赢 Player 2 的概率"百分比。概率由 Monte Carlo 采样 KDE 计算。',
              'The stats panel above the chart updates live: mean, std, and "P1 beats P2" win probability. Probability is computed by Monte Carlo sampling the KDE.', "圖表上方的統計面板實時顯示:雙方平均、標準差、以及\"Player 1 打贏 Player 2 的機率\"百分比。機率由 Monte Carlo 取樣 KDE 計算。"
            )}
            highlight
          />
          <Arrow />
          <Step
            step={5}
            title={t('替换为真实选手', 'Replace with a real cuber', "替換為真實選手")}
            body={t(
              '头像按钮旁的搜索框可以搜索任意 WCA 选手,加载其历史成绩生成 KDE。也可以用"我"按钮关联自己的 WCA 账号(需要先在右上角登录)。',
              'The search field next to each avatar loads any WCA cuber\'s history to generate a real KDE. The "me" button links your own WCA account (login required in the top right).', "頭像按鈕旁的搜尋框可以搜尋任意 WCA 選手,載入其歷史成績生成 KDE。也可以用\"我\"按鈕關聯自己的 WCA 賬號(需要先在右上角登入)。"
            )}
          />
        </div>

        <h2 className="calca-section-title">{t('算法', 'Algorithm', "演算法")}</h2>
        <p className="calca-section-intro">
          {t(
            '对每位选手的历史成绩用高斯核做 KDE,带宽按 Silverman 规则自适应。胜率通过 10000 次模拟 Ao5(各自从 KDE 采样 5 次,计算均值)得到:Player 1 平均 < Player 2 平均的次数比例即胜率。FMC 走步数分布,MBLD 走自定义成绩函数。',
            'A Gaussian KDE is fit to each player\'s history with Silverman-rule adaptive bandwidth. Win probability comes from 10,000 simulated Ao5 rounds (5 samples from each KDE, average, compare). FMC uses move-count distributions; MBLD uses a custom score function.', "對每位選手的歷史成績用高斯核做 KDE,頻寬按 Silverman 規則自適應。勝率透過 10000 次模擬 Ao5(各自從 KDE 取樣 5 次,計算均值)得到:Player 1 平均 < Player 2 平均的次數比例即勝率。FMC 走步數分佈,MBLD 走自定義成績函式。"
          )}
        </p>

        <h2 className="calca-section-title">{t('相关页面', 'See also', "相關頁面")}</h2>
        <ul className="calca-refs">
          <li>
            <Link href="/wca/viz">{t('成绩分布', 'Distribution', "成績分佈")}</Link>
            {t(' — 单选手成绩 KDE 分布的详细可视化。', ' — detailed KDE visualisation for a single cuber\'s results.', " — 單選手成績 KDE 分佈的詳細視覺化。")}
          </li>
          <li>
            <Link href="/nemesizer">{t('宿敌', 'Nemesizer', "宿敵")}</Link>
            {t(' — 找到和你成绩最接近的 WCA 对手。', ' — find your closest WCA rival by result proximity.', " — 找到和你成績最接近的 WCA 對手。")}
          </li>
          <li>
            <Link href="/wca/prediction">{t('极限预测', 'Prediction', "極限預測")}</Link>
            {t(' — WCA 项目速拧极限的数学预测报告。', ' — mathematical limit forecasts for WCA events.', " — WCA 項目速擰極限的數學預測報告。")}
          </li>
          <li>
            <a href="https://github.com/carykh/hthgrapher" target="_blank" rel="noopener noreferrer">carykh/hthgrapher</a>
            {t(' — 本页的上游开源项目(MIT)。', ' — the upstream open-source project this was ported from (MIT).', " — 本頁的上游開源專案(MIT)。")}
          </li>
        </ul>
      </main>
    </div>
  );
}
