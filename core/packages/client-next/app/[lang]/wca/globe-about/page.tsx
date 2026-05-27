'use client';

/**
 * /wca/globe-about — WCA 地球视图说明页
 */
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import LangToggle from '@/components/LangToggle';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './globe_about.css';

interface StepProps { step: number; title: string; body: string; highlight?: boolean; }
function Step({ step, title, body, highlight }: StepProps) {
  return (
    <div className={`gla-step${highlight ? ' is-highlight' : ''}`}>
      <span className="gla-step-num">{step}</span>
      <div>
        <div className="gla-step-title">{title}</div>
        <div className="gla-step-body">{body}</div>
      </div>
    </div>
  );
}
function Arrow() { return <span className="gla-arrow" aria-hidden="true">↓</span>; }

export default function GlobeAboutPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);
  useDocumentTitle('地球视图说明', 'Globe Guide');

  return (
    <div className="gla-page">
      <div className="gla-header">
        <Link href="/wca/globe" className="gla-back">
          <ArrowLeft size={16} />
          <span>{t('返回地球视图', 'Back to Globe')}</span>
        </Link>
        <LangToggle />
      </div>

      <main className="gla-main">
        <h1 className="gla-title">{t('WCA 地球视图是怎么工作的', 'How the WCA Globe works')}</h1>
        <p className="gla-intro">
          {t(
            '/wca/globe 是 WCA 比赛的交互式 3D 地球。基于 MapLibre GL JS + 矢量瓦片构建,支持近期比赛分布、选手生涯足迹动画、历史赛事密度等多种模式。',
            '/wca/globe is an interactive 3D globe of WCA competitions, built on MapLibre GL JS with vector tiles. Modes include upcoming-comp clusters, animated cuber career trajectories, and historical event density.',
          )}
        </p>

        <h2 className="gla-section-title">{t('三种模式', 'Three modes')}</h2>
        <p className="gla-section-intro">
          {t(
            '顶部模式切换器可在以下三个模式间切换:',
            'The mode selector at the top switches between:',
          )}
        </p>
        <ul className="gla-list">
          <li>
            <strong>{t('近期比赛 (Upcoming)', 'Upcoming')}</strong>
            {t(' — 显示近期全球 WCA 比赛的聚合点。缩放后聚合点展开为单场比赛,点击查看日期 / 地点 / 项目。', ' — shows clustered upcoming WCA competitions worldwide. Zoom in to expand clusters to individual comps; click to see date / location / events.')}
          </li>
          <li>
            <strong>{t('选手足迹 (Cuber)', 'Cuber')} </strong>
            {t(' — 输入任意 WCA 选手 ID,播放其生涯参赛地点的时序动画。大圆弧连接每一场比赛,可 play / pause / scrub。', ' — type any WCA-ID to animate that person\'s career competition locations as a time-ordered arc sequence. Play / pause / scrub the timeline.')}
          </li>
          <li>
            <strong>{t('历史密度 (Density)', 'Density')} </strong>
            {t(' — 以色阶 / 热力图 / 国家 choropleth 三种风格展示 WCA 比赛在全球的历史分布密度。可拖动时间滑杆看特定年份。', ' — shows historical WCA competition density across the globe in three styles: log-scale, heatmap, or country choropleth. Drag the year slider to inspect a specific time window.')}
          </li>
        </ul>

        <h2 className="gla-section-title">{t('操作与快捷键', 'Controls')}</h2>
        <div className="gla-flow">
          <Step
            step={1}
            title={t('基础导航', 'Basic navigation')}
            body={t(
              '鼠标左键拖动旋转地球,滚轮缩放,右键平移。触屏设备支持单指旋转 / 双指缩放。',
              'Left-drag to rotate, scroll to zoom, right-drag to pan. Touch devices support single-finger rotate and pinch-to-zoom.',
            )}
          />
          <Arrow />
          <Step
            step={2}
            title={t('地图样式', 'Map styles')}
            body={t(
              '右上图层切换器可在矢量地图 / 卫星图像 / 暗色模式地图之间切换。暗色跟随系统主题自动选择。',
              'The layers button in the top right switches between vector map, satellite imagery, and dark-mode map. Dark mode follows the site theme automatically.',
            )}
          />
          <Arrow />
          <Step
            step={3}
            title={t('绘图工具', 'Drawing tools')}
            body={t(
              '底部工具栏有测距 / 绘路线 / 绘多边形三种工具。可以量两场比赛之间的大圆距离,或圈出区域统计比赛密度。',
              'The toolbar at the bottom offers measure / path / polygon drawing modes. Use them to measure great-circle distances between comps or to mark regions of interest.',
            )}
          />
          <Arrow />
          <Step
            step={4}
            title={t('选手模式播放', 'Cuber mode playback')}
            body={t(
              '输入选手 WCA-ID 后点 Play 开始动画,弧线按时间顺序逐条画出。时间轴可拖动到任意时刻,支持 0.5× / 1× / 2× 速度。',
              'After entering a WCA-ID, click Play to start the animation — arcs draw chronologically. The timeline is scrub-able; playback speed is 0.5× / 1× / 2×.',
            )}
            highlight
          />
        </div>

        <h2 className="gla-section-title">{t('数据与技术', 'Data and technology')}</h2>
        <p className="gla-section-intro">
          {t(
            '地球基于 MapLibre GL JS(开源 WebGL 渲染),瓦片来自本站或 MapTiler。WCA 比赛坐标来自每周 dump。密度计算在客户端实时运行(Canvas + vt-pbf 矢量瓦片压缩)。卫星图需要网络;矢量地图完全在浏览器渲染,离线也能用。',
            'The globe uses MapLibre GL JS (open-source WebGL), with tiles from the site or MapTiler. WCA competition coordinates come from the weekly dump. Density calculations run in the client in real-time (Canvas + vt-pbf vector tile encoding). Satellite mode requires network; vector tiles render entirely in the browser and work offline.',
          )}
        </p>

        <h2 className="gla-section-title">{t('相关页面', 'See also')}</h2>
        <ul className="gla-refs">
          <li>
            <Link href="/wca/calendar">{t('比赛日历', 'Competition Calendar')}</Link>
            {t(' — 同一批比赛数据的日历视图。', ' — the same competition data in a calendar layout.')}
          </li>
          <li>
            <Link href="/wca/comp">{t('比赛成绩', 'Competition Results')}</Link>
            {t(' — 逐轮次成绩查看。', ' — round-by-round results viewer.')}
          </li>
          <li>
            <a href="https://maplibre.org" target="_blank" rel="noopener noreferrer">MapLibre GL JS</a>
            {t(' — 地球渲染引擎,Apache 2.0 开源。', ' — the WebGL rendering engine, Apache 2.0 open source.')}
          </li>
        </ul>
      </main>
    </div>
  );
}
