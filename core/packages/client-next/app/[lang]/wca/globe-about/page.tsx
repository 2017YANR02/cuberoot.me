'use client';

/**
 * /wca/globe-about — WCA 地球视图说明页
 */
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './globe_about.css';
import i18n from "@/i18n/i18n-client";

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
  const t = (zh: string, en: string, zhHant?: string) => i18n.language === 'zh-Hant' ? (zhHant ?? zh) : (isZh ? zh : en);
  useDocumentTitle('地球视图说明', 'Globe Guide', "地球檢視說明");

  return (
    <div className="gla-page">
      <div className="gla-header">
        <Link href="/wca/comp?view=globe" className="gla-back">
          <ArrowLeft size={16} />
          <span>{t('返回地球视图', 'Back to Globe', "返回地球檢視")}</span>
        </Link>
      </div>

      <main className="gla-main">
        <h1 className="gla-title">{t('WCA 地球视图是怎么工作的', 'How the WCA Globe works', "WCA 地球檢視是怎麼工作的")}</h1>
        <p className="gla-intro">
          {t(
            '/wca/globe 是 WCA 比赛的交互式 3D 地球。基于 MapLibre GL JS + 矢量瓦片构建,顶部一个搜索框即可搜比赛 / 选手 / 城市 / 地点;支持近期比赛分布、选手生涯足迹动画、各国世界纪录等视图。',
            '/wca/globe is an interactive 3D globe of WCA competitions, built on MapLibre GL JS with vector tiles. A single top search box finds competitions, cubers, cities and places; views include upcoming-comp clusters, animated cuber career trajectories, and world-records-by-country.', "/wca/globe 是 WCA 比賽的互動式 3D 地球。基於 MapLibre GL JS + 向量瓦片構建,頂部一個搜尋框即可搜比賽 / 選手 / 城市 / 地點;支援近期比賽分佈、選手生涯足跡動畫、各國世界紀錄等檢視。"
          )}
        </p>

        <h2 className="gla-section-title">{t('三种模式', 'Three modes', "三種模式")}</h2>
        <p className="gla-section-intro">
          {t(
            '顶部切换器在「比赛」「WR」之间切换;「选手足迹」通过搜索框搜选手进入:',
            'The top selector toggles Upcoming and WR; the cuber trail is entered by searching for a person:', "頂部切換器在「比賽」「WR」之間切換;「選手足跡」透過搜尋框搜選手進入:"
          )}
        </p>
        <ul className="gla-list">
          <li>
            <strong>{t('比赛 (Upcoming)', 'Upcoming', "比賽 (Upcoming)")}</strong>
            {t(' — 显示近期全球 WCA 比赛的聚合点,缩放展开为单场,点击查看日期 / 地点 / 项目。勾选「包含往期」可叠加历史比赛,并用年-月时间范围过滤;右上可切换 色阶 / 热力 / 分国 三种密度风格。', ' — shows clustered upcoming WCA competitions worldwide; zoom in to expand clusters and click for date / location / events. Toggle "Include past" to overlay historical comps with a year-month range filter; the top-right switches density styles: log-scale / heatmap / country choropleth.', " — 顯示近期全球 WCA 比賽的聚合點,縮放展開為單場,點選檢視日期 / 地點 / 專案。勾選「包含往期」可疊加歷史比賽,並用年-月時間範圍過濾;右上可切換 色階 / 熱力 / 分國 三種密度風格。")}
          </li>
          <li>
            <strong>{t('世界纪录 (WR)', 'WR', "世界紀錄 (WR)")} </strong>
            {t(' — 以国家 choropleth 展示各国持有的世界纪录数量,可拖时间轴看特定年份的纪录版图。', ' — a country choropleth of how many world records each country holds; drag the timeline to inspect the record map for a given year.', " — 以國家 choropleth 展示各國持有的世界紀錄數量,可拖時間軸看特定年份的紀錄版圖。")}
          </li>
          <li>
            <strong>{t('选手足迹 (Trail)', 'Trail', "選手足跡 (Trail)")} </strong>
            {t(' — 在顶部搜索框搜选手名或 WCA-ID 并选中,即播放其生涯参赛地点的时序动画。大圆弧逐场画出,可 play / pause / scrub、调速,并导出为视频。', ' — search a cuber name or WCA-ID in the top search box and select it to animate their career competition locations as a time-ordered arc sequence. Play / pause / scrub, change speed, and export as video.', " — 在頂部搜尋框搜選手名或 WCA-ID 並選中,即播放其生涯參賽地點的時序動畫。大圓弧逐場畫出,可 play / pause / scrub、調速,並匯出為影片。")}
          </li>
        </ul>

        <h2 className="gla-section-title">{t('操作与快捷键', 'Controls', "操作與快捷鍵")}</h2>
        <div className="gla-flow">
          <Step
            step={1}
            title={t('基础导航', 'Basic navigation', "基礎導航")}
            body={t(
              '鼠标左键拖动旋转地球,滚轮缩放,右键平移。触屏设备支持单指旋转 / 双指缩放。',
              'Left-drag to rotate, scroll to zoom, right-drag to pan. Touch devices support single-finger rotate and pinch-to-zoom.', "滑鼠左鍵拖動旋轉地球,滾輪縮放,右鍵平移。觸屏裝置支援單指旋轉 / 雙指縮放。"
            )}
          />
          <Arrow />
          <Step
            step={2}
            title={t('地图样式', 'Map styles', "地圖樣式")}
            body={t(
              '右上图层切换器可在矢量地图 / 卫星图像 / 暗色模式地图之间切换。暗色跟随系统主题自动选择。',
              'The layers button in the top right switches between vector map, satellite imagery, and dark-mode map. Dark mode follows the site theme automatically.', "右上圖層切換器可在向量地圖 / 衛星影象 / 暗色模式地圖之間切換。暗色跟隨系統主題自動選擇。"
            )}
          />
          <Arrow />
          <Step
            step={3}
            title={t('绘图工具', 'Drawing tools', "繪圖工具")}
            body={t(
              '底部工具栏有测距 / 绘路线 / 绘多边形三种工具。可以量两场比赛之间的大圆距离,或圈出区域统计比赛密度。',
              'The toolbar at the bottom offers measure / path / polygon drawing modes. Use them to measure great-circle distances between comps or to mark regions of interest.', "底部工具欄有測距 / 繪路線 / 繪多邊形三種工具。可以量兩場比賽之間的大圓距離,或圈出區域統計比賽密度。"
            )}
          />
          <Arrow />
          <Step
            step={4}
            title={t('选手足迹与导出', 'Cuber trail & export', "選手足跡與匯出")}
            body={t(
              '在顶部搜索框搜选手名或 WCA-ID 并选中,即进入足迹模式;点 Play 弧线按时间逐条画出。时间轴可拖动,支持 0.5× / 1× / 2× 速度,还能一键导出 60fps mp4 视频(带选手 / 比赛字幕 + logo)。',
              'Search a cuber name or WCA-ID in the top search box and select it to enter trail mode; click Play and arcs draw chronologically. The timeline is scrub-able, speed is 0.5× / 1× / 2×, and you can export a 60 fps mp4 (with cuber / comp captions + logo).', "在頂部搜尋框搜選手名或 WCA-ID 並選中,即進入足跡模式;點 Play 弧線按時間逐條畫出。時間軸可拖動,支援 0.5× / 1× / 2× 速度,還能一鍵匯出 60fps mp4 影片(帶選手 / 比賽字幕 + logo)。"
            )}
            highlight
          />
        </div>

        <h2 className="gla-section-title">{t('数据与技术', 'Data and technology', "資料與技術")}</h2>
        <p className="gla-section-intro">
          {t(
            '地球基于 MapLibre GL JS(开源 WebGL 渲染),瓦片来自本站或 MapTiler。WCA 比赛坐标来自每周 dump。密度计算在客户端实时运行(Canvas + vt-pbf 矢量瓦片压缩)。卫星图需要网络;矢量地图完全在浏览器渲染,离线也能用。',
            'The globe uses MapLibre GL JS (open-source WebGL), with tiles from the site or MapTiler. WCA competition coordinates come from the weekly dump. Density calculations run in the client in real-time (Canvas + vt-pbf vector tile encoding). Satellite mode requires network; vector tiles render entirely in the browser and work offline.', "地球基於 MapLibre GL JS(開源 WebGL 渲染),瓦片來自本站或 MapTiler。WCA 比賽座標來自每週 dump。密度計算在客戶端實時執行(Canvas + vt-pbf 向量瓦片壓縮)。衛星圖需要網路;向量地圖完全在瀏覽器渲染,離線也能用。"
          )}
        </p>

        <h2 className="gla-section-title">{t('相关页面', 'See also', "相關頁面")}</h2>
        <ul className="gla-refs">
          <li>
            <Link href="/wca/comp">{t('比赛', 'Competitions', "比賽")}</Link>
            {t(' — 比赛日历 + 逐轮次成绩查看。', ' — competition calendar + round-by-round results.', " — 比賽日曆 + 逐輪次成績檢視。")}
          </li>
          <li>
            <a href="https://maplibre.org" target="_blank" rel="noopener noreferrer">MapLibre GL JS</a>
            {t(' — 地球渲染引擎,Apache 2.0 开源。', ' — the WebGL rendering engine, Apache 2.0 open source.', " — 地球渲染引擎,Apache 2.0 開源。")}
          </li>
        </ul>
      </main>
    </div>
  );
}
