/**
 * @module App
 * 路由配置 — React Router (basename=/)，所有模块页面 lazy-load。
 * @see index.html 全局加载的外部 CSS（cubing-icons / flag-icons / Google Fonts）
 */
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';
import i18n from './i18n';
import { HomePage } from './pages/HomePage';
import { CaseSelectPage } from './pages/CaseSelectPage';
import { TrainingPage } from './pages/TrainingPage';
import { OllTrainingPage } from './pages/OllTrainingPage';
import { StatsPage } from './pages/StatsPage';
import { ZbllSelectPage } from './pages/ZbllSelectPage';
import { ZbllTimerPage } from './pages/ZbllTimerPage';
import { ZblsSelectPage } from './pages/ZblsSelectPage';
import { ZblsTimerPage } from './pages/ZblsTimerPage';

// NOTE: LandingPage 懒加载 — Toolkit 全站入口页（粒子系统 + 9 卡片）
const LandingPage = lazy(() => import('./pages/LandingPage'));

// NOTE: Calc 模块懒加载 — 体积较大，按需加载
const CalcPage = lazy(() => import('./pages/calc/CalcPage'));
// NOTE: Viz 模块懒加载 — 分布演变可视化
const VizPage = lazy(() => import('./pages/viz/VizPage'));
// NOTE: Battle 模块懒加载 — 对战计时器
const BattlePage = lazy(() => import('./pages/battle/BattlePage'));
// NOTE: Recon 模块懒加载 — 复盘数据库
const ReconListPage = lazy(() => import('./pages/recon/ReconListPage'));
const ReconDetailPage = lazy(() => import('./pages/recon/ReconDetailPage'));
const ReconSubmitPage = lazy(() => import('./pages/recon/ReconSubmitPage'));
const ReconSubmitSketchPage = lazy(() => import('./pages/recon/ReconSubmitSketchPage'));
const AltSubmitPage = lazy(() => import('./pages/recon/AltSubmitPage'));
const AltViewPage = lazy(() => import('./pages/recon/AltViewPage'));
// NOTE: OAuth 回调页——处理 WCA OAuth Implicit Grant 返回
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'));
// NOTE: WCA Stats 模块懒加载 — 统计数据展示
const WcaStatsPage = lazy(() => import('./pages/wca_stats/WcaStatsPage'));
const WcaStatsIndex = lazy(() => import('./pages/wca_stats/WcaStatsIndex'));
// NOTE: WCA 选手成绩查询（/wca-stats 子模块）
const PersonsSearchPage = lazy(() => import('./pages/wca_stats/persons/PersonsSearchPage'));
const PersonDetailPage = lazy(() => import('./pages/wca_stats/persons/PersonDetailPage'));
const NemesizerPage = lazy(() => import('./pages/nemesizer/NemesizerPage'));
// NOTE: Upcoming Comps 懒加载 — 顶尖选手近期比赛追踪
const UpcomingCompsPage = lazy(() => import('./pages/UpcomingCompsPage'));
// NOTE: Calendar Stats — 比赛随时间分布的可视化
const CalendarStatsPage = lazy(() => import('./pages/calendar_stats/CalendarStatsPage'));
// NOTE: Globe 懒加载 — 3D 地球 WCA 比赛地理分布（含 react-globe.gl + three ~500KB）
const GlobePage = lazy(() => import('./pages/GlobePage'));
// NOTE: iframe 包装页 — 嵌入未迁移的外部模块（Solver/Alg Trainer/csTimer）
const IframePage = lazy(() => import('./pages/IframePage'));
// NOTE: Pretext Canvas 表格 Demo
const PretextDemo = lazy(() => import('./pages/pretext_demo/PretextDemo'));
// NOTE: Frame Count 数帧工具懒加载
const FrameCountPage = lazy(() => import('./pages/frame-count/FrameCountPage'));
// NOTE: Scramble Stats — WCA 历史打乱难度分布
const ScrambleStatsPage = lazy(() => import('./pages/scramble_stats/ScrambleStatsPage'));
// NOTE: Tutorial — 公式教程目录（docx 源迁移）
const TutorialIndexPage = lazy(() => import('./pages/tutorial/TutorialIndexPage'));
const TutorialCategoryPage = lazy(() => import('./pages/tutorial/TutorialCategoryPage'));
const TutorialPostPage = lazy(() => import('./pages/tutorial/TutorialPostPage'));
// NOTE: Alg — 公式库 (2x2/3x3/4x4/5x5,数据来自 speedcubedb)
const AlgIndexPage = lazy(() => import('./pages/alg/AlgIndexPage'));
const AlgPuzzlePage = lazy(() => import('./pages/alg/AlgPuzzlePage'));
const AlgCategoryPage = lazy(() => import('./pages/alg/AlgCategoryPage'));
// NOTE: Sites — 魔方网址导航
const SitesPage = lazy(() => import('./pages/sites/SitesPage'));
// NOTE: /prediction — 3x3 速拧极限预测
const PredictionPage = lazy(() => import('./pages/prediction/PredictionPage'));
// NOTE: Mosaic — 魔方马赛克生成器（port of Roman-/mosaic）
const MosaicPage = lazy(() => import('./pages/mosaic/MosaicPage'));
// NOTE: WB — 非官方世界纪录（port of speedsolving.com wiki UWR list）
const WbPage = lazy(() => import('./pages/wb/WbPage'));
// NOTE: Timer — 纯 TypeScript 重写的速拧计时器（替代 cstimer iframe 的核心流程）
const TimerPage = lazy(() => import('./pages/timer/TimerPage'));
// NOTE: VisualCube Editor — 全功能交互式魔方图生成器
const VisualCubeEditorPage = lazy(() => import('./pages/visualcube/VisualCubeEditorPage'));
const VisualCubeStagesPage = lazy(() => import('./pages/visualcube/VisualCubeStagesPage'));
// NOTE: Analyze — 3x3 CFOP 打乱分析器（port of speedcubedb.com/analyze）
const AnalyzePage = lazy(() => import('./pages/analyze/AnalyzePage'));
// NOTE: Average — 成绩计算器（粘 N 个时间，按 WCA 规则算 Ao5/Ao12/Mo3）
const AveragePage = lazy(() => import('./pages/average/AveragePage'));
// NOTE: Gen — 批量打乱生成器（覆盖 16 个 WCA 项目）
const GenPage = lazy(() => import('./pages/gen/GenPage'));
// NOTE: Notation — 公式记号沙盒（化简 / 逆向 / 镜像 + HTM/QTM 计数 + TwistyPlayer）
const NotationPage = lazy(() => import('./pages/notation/NotationPage'));
// NOTE: Patterns — 著名 3x3 图案集
const PatternsPage = lazy(() => import('./pages/patterns/PatternsPage'));

// NOTE: 全站 URL 必须带 ?lang=zh|en——首次加载在 i18n/index.ts 已处理；
//       此守卫覆盖客户端导航（<Link> / navigate()）丢失 lang 的情况，
//       用 replaceState 不进历史记录、不触发 React Router 重渲染。
function LangParamGuard() {
  const location = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('lang')) return;
    params.set('lang', i18n.language || 'en');
    const newUrl = `${location.pathname}?${params.toString()}${location.hash}`;
    window.history.replaceState(null, '', newUrl);
  }, [location.pathname, location.search, location.hash]);
  return null;
}

function App() {
  return (
    <BrowserRouter basename="/">
      <LangParamGuard />
      <Routes>
        {/* NOTE: 全站入口页（复刻原版 index.html 的 9 卡片 Toolkit 主页） */}
        <Route path="/" element={<Suspense fallback={<div>Loading...</div>}><LandingPage /></Suspense>} />
        {/* NOTE: Trainer 首页（原来的 /，PLL/OLL/ZBLL/ZBLS 选择页） */}
        <Route path="/trainer" element={<HomePage />} />
        <Route path="/select/:algSetId" element={<CaseSelectPage />} />
        {/* NOTE: OLL 走专用计时器训练页，PLL 走识别训练页 */}
        <Route path="/train/oll" element={<OllTrainingPage />} />
        <Route path="/train/:algSetId" element={<TrainingPage />} />
        <Route path="/stats/:algSetId" element={<StatsPage />} />
        {/* ZBLL Trainer — 独立的选择+计时页面 */}
        <Route path="/select/zbll" element={<ZbllSelectPage />} />
        <Route path="/train/zbll" element={<ZbllTimerPage />} />
        {/* ZBLS Trainer — 独立的选择+计时页面 */}
        <Route path="/select/zbls" element={<ZblsSelectPage />} />
        <Route path="/train/zbls" element={<ZblsTimerPage />} />
        {/* Calc — 成绩计算器 */}
        <Route path="/calc" element={<Suspense fallback={<div>Loading...</div>}><CalcPage /></Suspense>} />
        {/* Viz — 分布演变可视化 */}
        <Route path="/viz" element={<Suspense fallback={<div>Loading...</div>}><VizPage /></Suspense>} />
        {/* Battle — 对战计时器 */}
        <Route path="/battle" element={<Suspense fallback={<div>Loading...</div>}><BattlePage /></Suspense>} />
        {/* Recon — 复盘数据库 */}
        <Route path="/recon" element={<Suspense fallback={<div>Loading...</div>}><ReconListPage /></Suspense>} />
        <Route path="/recon/submit" element={<Suspense fallback={<div>Loading...</div>}><ReconSubmitPage /></Suspense>} />
        <Route path="/recon/submit/:editId" element={<Suspense fallback={<div>Loading...</div>}><ReconSubmitPage /></Suspense>} />
        <Route path="/recon/submit-sketch" element={<Suspense fallback={<div>Loading...</div>}><ReconSubmitSketchPage /></Suspense>} />
        <Route path="/recon/:parentId/alt" element={<Suspense fallback={<div>Loading...</div>}><AltSubmitPage /></Suspense>} />
        <Route path="/recon/:parentId/alt/:altIdx" element={<Suspense fallback={<div>Loading...</div>}><AltViewPage /></Suspense>} />
        <Route path="/recon/:parentId/alt/:altIdx/edit" element={<Suspense fallback={<div>Loading...</div>}><AltSubmitPage /></Suspense>} />
        <Route path="/recon/:id" element={<Suspense fallback={<div>Loading...</div>}><ReconDetailPage /></Suspense>} />
        {/* Calendar — 顶尖选手近期比赛追踪（路由曾叫 /upcoming-comps，旧链接重定向） */}
        <Route path="/calendar" element={<Suspense fallback={<div>Loading...</div>}><UpcomingCompsPage /></Suspense>} />
        <Route path="/calendar/stats" element={<Suspense fallback={<div>Loading...</div>}><CalendarStatsPage /></Suspense>} />
        <Route path="/upcoming-comps" element={<Navigate to="/calendar" replace />} />
        {/* Globe — 3D 地球 WCA 比赛地理分布 */}
        <Route path="/globe" element={<Suspense fallback={<div>Loading...</div>}><GlobePage /></Suspense>} />
        {/* NOTE: iframe 包装路由 — 嵌入未迁移模块，零改动上游代码 */}
        <Route path="/solver" element={<Suspense fallback={<div>Loading...</div>}><IframePage src="/tools/solver/" title="Solver" /></Suspense>} />
        <Route path="/2x2x2" element={<Suspense fallback={<div>Loading...</div>}><IframePage src="/tools/2x2x2/" title="2x2x2 Solver" /></Suspense>} />
        <Route path="/cross_trainer" element={<Suspense fallback={<div>Loading...</div>}><IframePage src="/tools/cross_trainer/" title="Cross Trainer" /></Suspense>} />
        <Route path="/xcross_trainer" element={<Suspense fallback={<div>Loading...</div>}><IframePage src="/tools/xcross_trainer/" title="XCross Trainer" /></Suspense>} />
        <Route path="/xxcross_trainer" element={<Suspense fallback={<div>Loading...</div>}><IframePage src="/tools/xxcross_trainer/" title="XXCross Trainer" /></Suspense>} />
        <Route path="/pairing_trainer" element={<Suspense fallback={<div>Loading...</div>}><IframePage src="/tools/pairing_trainer/" title="Free Pair Trainer" /></Suspense>} />
        <Route path="/xcross_pairing_trainer" element={<Suspense fallback={<div>Loading...</div>}><IframePage src="/tools/xcross_pairing_trainer/" title="XCross Free Pair Trainer" /></Suspense>} />
        <Route path="/pseudo_xcross_trainer" element={<Suspense fallback={<div>Loading...</div>}><IframePage src="/tools/pseudo_xcross_trainer/" title="Pseudo XCross Trainer" /></Suspense>} />
        <Route path="/pseudo_pairing_trainer" element={<Suspense fallback={<div>Loading...</div>}><IframePage src="/tools/pseudo_pairing_trainer/" title="Pseudo Free Pair Trainer" /></Suspense>} />
        <Route path="/eocross_trainer" element={<Suspense fallback={<div>Loading...</div>}><IframePage src="/tools/eocross_trainer/" title="EOCross Trainer" /></Suspense>} />
        <Route path="/algTrainer" element={<Suspense fallback={<div>Loading...</div>}><IframePage src="/tools/algTrainer/" title="Alg Trainer" /></Suspense>} />
        <Route path="/alg-trainers" element={<Suspense fallback={<div>Loading...</div>}><IframePage src="/tools/alg_trainers/" title="Alg Trainer" /></Suspense>} />
        <Route path="/jsonEditor" element={<Suspense fallback={<div>Loading...</div>}><IframePage src="/tools/jsonEditor/" title="JSON Editor" /></Suspense>} />
        <Route path="/documentation" element={<Suspense fallback={<div>Loading...</div>}><IframePage src="/tools/documentation/" title="Documentation" /></Suspense>} />
        <Route path="/cstimer" element={<Suspense fallback={<div>Loading...</div>}><IframePage src="/tools/cstimer/" title="csTimer" /></Suspense>} />
        {/* Timer — 纯 TypeScript 速拧计时器 */}
        <Route path="/timer" element={<Suspense fallback={<div>Loading...</div>}><TimerPage /></Suspense>} />
        {/* VisualCube Editor — 交互式魔方图生成器（全 ICubeOptions 暴露 + URL 双向同步） */}
        <Route path="/visualcube" element={<Suspense fallback={<div>Loading...</div>}><VisualCubeEditorPage /></Suspense>} />
        {/* VisualCube Stages — 所有 mask / stage 速查 */}
        <Route path="/visualcube/stages" element={<Suspense fallback={<div>Loading...</div>}><VisualCubeStagesPage /></Suspense>} />
        {/* Analyze — 3x3 CFOP 打乱分析器 */}
        <Route path="/analyze" element={<Suspense fallback={<div>Loading...</div>}><AnalyzePage /></Suspense>} />
        {/* Average — 成绩计算器 */}
        <Route path="/average" element={<Suspense fallback={<div>Loading...</div>}><AveragePage /></Suspense>} />
        {/* Gen — 批量打乱生成器 */}
        <Route path="/gen" element={<Suspense fallback={<div>Loading...</div>}><GenPage /></Suspense>} />
        {/* Notation — 公式记号沙盒 */}
        <Route path="/notation" element={<Suspense fallback={<div>Loading...</div>}><NotationPage /></Suspense>} />
        {/* Patterns — 著名 3x3 图案集 */}
        <Route path="/patterns" element={<Suspense fallback={<div>Loading...</div>}><PatternsPage /></Suspense>} />
        {/* WCA Stats — 统计数据展示 */}
        <Route path="/wca-stats" element={<Suspense fallback={<div>Loading...</div>}><WcaStatsIndex /></Suspense>} />
        {/* NOTE: persons / 自定义页面路由必须在 :statId 之前，否则会被 catch-all 当成 statId */}
        <Route path="/wca-stats/persons" element={<Suspense fallback={<div>Loading...</div>}><PersonsSearchPage /></Suspense>} />
        <Route path="/wca-stats/persons/:wcaId" element={<Suspense fallback={<div>Loading...</div>}><PersonDetailPage /></Suspense>} />
<Route path="/wca-stats/:statId" element={<Suspense fallback={<div>Loading...</div>}><WcaStatsPage /></Suspense>} />
        {/* Nemesizer — 宿敌查询（移植自 nemesizer.com） */}
        <Route path="/nemesizer" element={<Suspense fallback={<div>Loading...</div>}><NemesizerPage /></Suspense>} />
        {/* Frame Count — 数帧工具 */}
        <Route path="/frame-count" element={<Suspense fallback={<div>Loading...</div>}><FrameCountPage /></Suspense>} />
        {/* Scramble — WCA 历史打乱难度分布 */}
        <Route path="/scramble-stats" element={<Suspense fallback={<div>Loading...</div>}><ScrambleStatsPage /></Suspense>} />
        {/* Tutorial — 公式教程目录（曾用 /alg） */}
        <Route path="/tutorial" element={<Suspense fallback={<div>Loading...</div>}><TutorialIndexPage /></Suspense>} />
        <Route path="/tutorial/c/:category" element={<Suspense fallback={<div>Loading...</div>}><TutorialCategoryPage /></Suspense>} />
        <Route path="/tutorial/:slug" element={<Suspense fallback={<div>Loading...</div>}><TutorialPostPage /></Suspense>} />
        {/* Alg — 公式库 (2x2/3x3/4x4/5x5, data from speedcubedb.com，曾用 /algdb) */}
        {/* /alg/:puzzle handles BOTH new puzzle pages AND legacy single-segment 3x3 set slugs (redirects). */}
        <Route path="/alg" element={<Suspense fallback={<div>Loading...</div>}><AlgIndexPage /></Suspense>} />
        <Route path="/alg/:puzzle" element={<Suspense fallback={<div>Loading...</div>}><AlgPuzzlePage /></Suspense>} />
        <Route path="/alg/:puzzle/:set" element={<Suspense fallback={<div>Loading...</div>}><AlgCategoryPage /></Suspense>} />
        <Route path="/alg/:puzzle/:set/:subgroup" element={<Suspense fallback={<div>Loading...</div>}><AlgCategoryPage /></Suspense>} />
        {/* Sites — 魔方网址导航 */}
        <Route path="/site" element={<Suspense fallback={<div>Loading...</div>}><SitesPage /></Suspense>} />
        <Route path="/prediction" element={<Suspense fallback={<div>Loading...</div>}><PredictionPage /></Suspense>} />
        {/* Mosaic — 魔方马赛克生成器 */}
        <Route path="/mosaic" element={<Suspense fallback={<div>Loading...</div>}><MosaicPage /></Suspense>} />
        {/* WB — 非官方世界纪录 */}
        <Route path="/wb" element={<Suspense fallback={<div>Loading...</div>}><WbPage /></Suspense>} />
        {/* Pretext Demo — Canvas 表格渲染实验 */}
        <Route path="/pretext-demo" element={<Suspense fallback={<div>Loading...</div>}><PretextDemo /></Suspense>} />
        {/* Auth — WCA OAuth 回调 */}
        <Route path="/auth/callback" element={<Suspense fallback={<div>Loading...</div>}><AuthCallbackPage /></Suspense>} />
        <Route path="/callback.html" element={<Suspense fallback={<div>Loading...</div>}><AuthCallbackPage /></Suspense>} />
        {/* Catch-all — 未匹配路径回首页 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
