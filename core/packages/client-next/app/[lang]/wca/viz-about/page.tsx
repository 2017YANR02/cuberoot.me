'use client';

/**
 * /wca/viz-about — 成绩分布可视化说明页
 */
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './viz_about.css';
import i18n from "@/i18n/i18n-client";

interface StepProps { step: number; title: string; body: string; highlight?: boolean; }
function Step({ step, title, body, highlight }: StepProps) {
  return (
    <div className={`va-step${highlight ? ' is-highlight' : ''}`}>
      <span className="va-step-num">{step}</span>
      <div>
        <div className="va-step-title">{title}</div>
        <div className="va-step-body">{body}</div>
      </div>
    </div>
  );
}
function Arrow() { return <span className="va-arrow" aria-hidden="true">↓</span>; }

export default function VizAboutPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string, zhHant?: string) => i18n.language === 'zh-Hant' ? (zhHant ?? zh) : (isZh ? zh : en);
  useDocumentTitle('成绩分布说明', 'Distribution Guide', "成績分佈說明");

  return (
    <div className="va-page">
      <div className="va-header">
        <Link href="/wca/viz" className="va-back">
          <ArrowLeft size={16} />
          <span>{t('返回成绩分布', 'Back to Distribution', "返回成績分佈")}</span>
        </Link>
      </div>

      <main className="va-main">
        <h1 className="va-title">{t('成绩分布可视化是怎么工作的', 'How the Distribution visualiser works', "成績分佈視覺化是怎麼工作的")}</h1>
        <p className="va-intro">
          {t(
            '/wca/viz 把一位(或多位)选手的全部历史成绩画成核密度估计(KDE)曲线,展示成绩分布的形状 — 峰值 / 展宽 / 尾部。支持多选手叠加对比和逐场比赛动画播放。',
            '/wca/viz renders one or more cubers\' complete WCA results as a kernel density estimate (KDE) curve, showing the shape of their result distribution — peak, spread, and tail. Multiple cubers can be overlaid, and the timeline can be animated by competition.', "/wca/viz 把一位(或多位)選手的全部歷史成績畫成核密度估計(KDE)曲線,展示成績分佈的形狀 — 峰值 / 展寬 / 尾部。支援多選手疊加對比和逐場比賽動畫播放。"
          )}
        </p>

        <h2 className="va-section-title">{t('核心原理', 'Core concept')}</h2>
        <p className="va-section-intro">
          {t(
            'KDE 把离散的成绩序列平滑成连续的概率密度曲线。带宽自适应(Silverman\'s rule of thumb)。x 轴是成绩(单次),y 轴是密度。峰值越高越集中,曲线越宽越波动大。顶尖选手在图中表现为一条窄而高的峰,接近个人 PB 的地方。',
            'KDE smooths a discrete sequence of results into a continuous probability-density curve with adaptive bandwidth (Silverman\'s rule of thumb). The x-axis is result (single); y-axis is density. A tall, narrow peak means consistent; wide means high variance. Top cubers show a sharp spike close to their personal best.', "KDE 把離散的成績序列平滑成連續的機率密度曲線。頻寬自適應(Silverman's rule of thumb)。x 軸是成績(單次),y 軸是密度。峰值越高越集中,曲線越寬越波動大。頂尖選手在圖中表現為一條窄而高的峰,接近個人 PB 的地方。"
          )}
        </p>

        <h2 className="va-section-title">{t('使用流程', 'How to use')}</h2>
        <div className="va-flow">
          <Step
            step={1}
            title={t('搜索选手', 'Search a cuber', "搜尋選手")}
            body={t(
              '顶部搜索框输入选手名字或 WCA-ID,选中后加载其所有参赛成绩。默认预加载一位示例选手。',
              'Type a name or WCA-ID in the search box; selecting loads all their results. A sample cuber is pre-loaded by default.', "頂部搜尋框輸入選手名字或 WCA-ID,選中後載入其所有參賽成績。預設預載入一位示例選手。"
            )}
          />
          <Arrow />
          <Step
            step={2}
            title={t('选项目', 'Pick an event', "選項目")}
            body={t(
              '项目下拉选择器切换到目标项目。切换时所有已加载选手的成绩一起重新渲染。',
              'The event dropdown switches the view. All currently-loaded cubers re-render for the new event.', "項目下拉選擇器切換到目標項目。切換時所有已載入選手的成績一起重新渲染。"
            )}
          />
          <Arrow />
          <Step
            step={3}
            title={t('叠加多位选手对比', 'Overlay multiple cubers', "疊加多位選手對比")}
            body={t(
              '可以继续搜索更多选手叠加到同一张图里(每位自动分配不同颜色)。右上角选手 chip 点 × 可移除。',
              'Search and add more cubers — each gets a distinct color and overlays on the same chart. Click × on a chip to remove.', "可以繼續搜尋更多選手疊加到同一張圖裡(每位自動分配不同顏色)。右上角選手 chip 點 × 可移除。"
            )}
          />
          <Arrow />
          <Step
            step={4}
            title={t('播放时间轴', 'Animate the timeline', "播放時間軸")}
            body={t(
              '底部播放控制器按比赛顺序逐场动画。每一帧只累积到那场比赛为止的成绩,看成绩分布怎么随职业生涯演变。右侧脊线图展示每一场比赛的成绩分布小缩略。',
              'The bottom playback controls animate by competition — each frame accumulates results up to that comp. The ridgeline chart on the right shows a per-competition density thumbnail across the career.', "底部播放控制器按比賽順序逐場動畫。每一幀只累積到那場比賽為止的成績,看成績分佈怎麼隨職業生涯演變。右側脊線圖展示每一場比賽的成績分佈小縮略。"
            )}
            highlight
          />
        </div>

        <h2 className="va-section-title">{t('数据来源', 'Data source', "資料來源")}</h2>
        <p className="va-section-intro">
          {t(
            '成绩通过 WCA API 实时拉取(按选手 + 项目),存在浏览器内存里。没有缓存到服务端 — 每次进页刷新。速度取决于 WCA API 响应时间。',
            'Results are fetched live from the WCA API (per cuber + event) and kept in browser memory. No server-side caching — refreshes on every page load. Speed depends on WCA API response time.', "成績透過 WCA API 實時拉取(按選手 + 項目),存在瀏覽器記憶體裡。沒有快取到服務端 — 每次進頁重新整理。速度取決於 WCA API 響應時間。"
          )}
        </p>

        <h2 className="va-section-title">{t('相关页面', 'See also', "相關頁面")}</h2>
        <ul className="va-refs">
          <li>
            <Link href="/wca/all-results">{t('全成绩排名', 'All Results', "全成績排名")}</Link>
            {t(' — 所有选手成绩的可分页搜索。', ' — paginated search over every WCA result.', " — 所有選手成績的可分頁搜尋。")}
          </li>
          <li>
            <Link href="/wca/prediction">{t('极限预测', 'Prediction', "極限預測")}</Link>
            {t(' — 速拧成绩的数学极限预测报告。', ' — mathematical limit forecasts for speedcubing results.', " — 速擰成績的數學極限預測報告。")}
          </li>
          <li>
            <Link href="/wca/cohort-ranks">{t('届别排名', 'Cohort Ranks', "屆別排名")}</Link>
            {t(' — 按首参赛年分组看生涯 PB 排名。', ' — lifetime PB rankings grouped by first-competition year.', " — 按首參賽年分組看生涯 PB 排名。")}
          </li>
        </ul>
      </main>
    </div>
  );
}
