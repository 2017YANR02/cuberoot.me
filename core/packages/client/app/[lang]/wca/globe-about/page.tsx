'use client';

import Link from '@/components/AppLink';
import MoreToggle from '@/components/MoreToggle';
import PageHeading from '@/components/PageHeading';
import { useT } from '@/hooks/useT';
import '@/components/report-page.css';

export default function GlobeAboutPage() {
  const t = useT();
  return <main className="report-page">
    <header className="report-header">
      <PageHeading backHref="/wca/comp?view=globe">{t('在地球上看比赛', 'Competitions on the globe')}</PageHeading>
      <p>{t('找附近的比赛，回看选手的参赛足迹，观察世界纪录的地域变化。', 'Find nearby competitions, explore a cuber’s competition trail and follow the geography of world records.')}</p>
      <div className="report-links"><Link href="/wca/comp?view=globe">{t('打开地球', 'Open globe')}</Link><Link href="/wca/comp">{t('比赛日历', 'Competition calendar')}</Link></div>
    </header>
    <table className="report-table">
      <thead><tr><th scope="col">{t('视图', 'View')}</th><th scope="col">{t('看什么', 'What it shows')}</th></tr></thead>
      <tbody>
        <tr><th scope="row">{t('比赛', 'Competitions')}</th><td>{t('放大聚合点，查看日期、地点与项目。加入往期比赛后，可按时间范围查看分布。', 'Zoom into clusters for dates, locations and events. Include past competitions to explore a time range.')}</td></tr>
        <tr><th scope="row">{t('选手足迹', 'Cuber trails')}</th><td>{t('搜索姓名或 WCA ID，按时间播放参赛地点，也可导出足迹视频。', 'Search a name or WCA ID to animate competition locations in date order and export a trail video.')}</td></tr>
        <tr><th scope="row">{t('世界纪录', 'World records')}</th><td>{t('按国家查看纪录分布，用时间轴回看不同年份。', 'Explore records by country and use the timeline to revisit different years.')}</td></tr>
      </tbody>
    </table>
    <h2>{t('从一场比赛到一段足迹', 'From one competition to a career')}</h2>
    <p>{t('搜索城市可以找比赛；搜索选手可以回看参赛经历。拖动地球、滚轮缩放，或在手机上双指缩放；地图点可继续进入比赛信息。', 'Search a city to find competitions or a cuber to explore their history. Drag to move around and scroll or pinch to zoom. Select a map point for competition details.')}</p>
    <h2>{t('地图上的线代表什么', 'What the map can tell you')}</h2>
    <ul className="report-limits">
      <li>{t('足迹连接的是参赛地点，不是实际旅行路线，也不表示居住地。', 'Trails connect competition locations. They do not show actual travel routes or places of residence.')}</li>
      <li>{t('坐标、成绩和日期来自数据源，可能缺失或滞后；聚合点和热力颜色也随缩放与筛选变化。', 'Source coordinates, results and dates may be missing or delayed. Clusters and heatmap colours also change with zoom and filters.')}</li>
      <li>{t('地图与数据加载需要网络。视频导出取决于浏览器能力，长足迹可能耗时较多。', 'Loading maps and data requires a connection. Video export depends on browser support and may take time for long trails.')}</li>
    </ul>
    <details className="report-details">
      <MoreToggle as="summary">{t('地图工具与技术来源', 'Map tools and technology')}</MoreToggle>
      <div className="report-detail-body">
        <p>{t('支持测距、绘制路径和多边形，以及色阶、热力、分国等密度视图。测距是地图上的几何距离，不能直接当作行程距离。', 'Tools include distance measurement, paths and polygons, plus scale, heatmap and country density views. Map distance is geometric distance, not a travel itinerary.')}</p>
        <p>{t('地图由 MapLibre GL JS 渲染，比赛位置与选手足迹使用 WCA 数据。地图样式可切换明暗或卫星影像。', 'MapLibre GL JS renders the globe; WCA data supplies competition locations and cuber trails. Styles include light, dark and satellite imagery.')}</p>
        <a href="https://maplibre.org" target="_blank" rel="noopener noreferrer">MapLibre GL JS</a>
      </div>
    </details>
  </main>;
}
