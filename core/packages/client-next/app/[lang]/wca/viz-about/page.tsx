'use client';

/**
 * /wca/viz-about — 成绩分布可视化说明页
 */
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './viz_about.css';

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
  const t = (zh: string, en: string) => (isZh ? zh : en);
  useDocumentTitle('成绩分布说明', 'Distribution Guide');

  return (
    <div className="va-page">
      <div className="va-header">
        <Link href="/wca/viz" className="va-back">
          <ArrowLeft size={16} />
          <span>{t('返回成绩分布', 'Back to Distribution')}</span>
        </Link>
      </div>

      <main className="va-main">
        <h1 className="va-title">{t('成绩分布可视化是怎么工作的', 'How the Distribution visualiser works')}</h1>
        <p className="va-intro">
          {t(
            '/wca/viz 把一位(或多位)选手的全部历史成绩画成核密度估计(KDE)曲线,展示成绩分布的形状 — 峰值 / 展宽 / 尾部。支持多选手叠加对比和逐场比赛动画播放。',
            '/wca/viz renders one or more cubers\' complete WCA results as a kernel density estimate (KDE) curve, showing the shape of their result distribution — peak, spread, and tail. Multiple cubers can be overlaid, and the timeline can be animated by competition.',
          )}
        </p>

        <h2 className="va-section-title">{t('核心原理', 'Core concept')}</h2>
        <p className="va-section-intro">
          {t(
            'KDE 把离散的成绩序列平滑成连续的概率密度曲线。带宽自适应(Silverman\'s rule of thumb)。x 轴是成绩(单次),y 轴是密度。峰值越高越集中,曲线越宽越波动大。顶尖选手在图中表现为一条窄而高的峰,接近个人 PB 的地方。',
            'KDE smooths a discrete sequence of results into a continuous probability-density curve with adaptive bandwidth (Silverman\'s rule of thumb). The x-axis is result (single); y-axis is density. A tall, narrow peak means consistent; wide means high variance. Top cubers show a sharp spike close to their personal best.',
          )}
        </p>

        <h2 className="va-section-title">{t('使用流程', 'How to use')}</h2>
        <div className="va-flow">
          <Step
            step={1}
            title={t('搜索选手', 'Search a cuber')}
            body={t(
              '顶部搜索框输入选手名字或 WCA-ID,选中后加载其所有参赛成绩。默认预加载一位示例选手。',
              'Type a name or WCA-ID in the search box; selecting loads all their results. A sample cuber is pre-loaded by default.',
            )}
          />
          <Arrow />
          <Step
            step={2}
            title={t('选项目', 'Pick an event')}
            body={t(
              '项目下拉选择器切换到目标项目。切换时所有已加载选手的成绩一起重新渲染。',
              'The event dropdown switches the view. All currently-loaded cubers re-render for the new event.',
            )}
          />
          <Arrow />
          <Step
            step={3}
            title={t('叠加多位选手对比', 'Overlay multiple cubers')}
            body={t(
              '可以继续搜索更多选手叠加到同一张图里(每位自动分配不同颜色)。右上角选手 chip 点 × 可移除。',
              'Search and add more cubers — each gets a distinct color and overlays on the same chart. Click × on a chip to remove.',
            )}
          />
          <Arrow />
          <Step
            step={4}
            title={t('播放时间轴', 'Animate the timeline')}
            body={t(
              '底部播放控制器按比赛顺序逐场动画。每一帧只累积到那场比赛为止的成绩,看成绩分布怎么随职业生涯演变。右侧脊线图展示每一场比赛的成绩分布小缩略。',
              'The bottom playback controls animate by competition — each frame accumulates results up to that comp. The ridgeline chart on the right shows a per-competition density thumbnail across the career.',
            )}
            highlight
          />
        </div>

        <h2 className="va-section-title">{t('数据来源', 'Data source')}</h2>
        <p className="va-section-intro">
          {t(
            '成绩通过 WCA API 实时拉取(按选手 + 项目),存在浏览器内存里。没有缓存到服务端 — 每次进页刷新。速度取决于 WCA API 响应时间。',
            'Results are fetched live from the WCA API (per cuber + event) and kept in browser memory. No server-side caching — refreshes on every page load. Speed depends on WCA API response time.',
          )}
        </p>

        <h2 className="va-section-title">{t('相关页面', 'See also')}</h2>
        <ul className="va-refs">
          <li>
            <Link href="/wca/all-results">{t('全成绩排名', 'All Results')}</Link>
            {t(' — 所有选手成绩的可分页搜索。', ' — paginated search over every WCA result.')}
          </li>
          <li>
            <Link href="/wca/prediction">{t('极限预测', 'Prediction')}</Link>
            {t(' — 速拧成绩的数学极限预测报告。', ' — mathematical limit forecasts for speedcubing results.')}
          </li>
          <li>
            <Link href="/wca/cohort-ranks">{t('届别排名', 'Cohort Ranks')}</Link>
            {t(' — 按首参赛年分组看生涯 PB 排名。', ' — lifetime PB rankings grouped by first-competition year.')}
          </li>
        </ul>
      </main>
    </div>
  );
}
