/**
 * @module App
 * 路由配置 — React Router (basename=/)，所有模块页面 lazy-load。
 * @see index.html 全局加载的外部 CSS（cubing-icons / flag-icons / Google Fonts）
 */
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Suspense, lazy, useEffect, useState } from 'react';
import i18n from './i18n';
import { TrainingPage } from './pages/TrainingPage';
import AnalyticsBeacon from './components/AnalyticsBeacon';

// NOTE: 新统一公式训练器（PLL/OLL/ZBLL/ZBLS,扩展中）
const TrainerLandingPage = lazy(() => import('./pages/trainer/TrainerLandingPage'));
const TrainerSelectPage = lazy(() => import('./pages/trainer/TrainerSelectPage'));
const TrainerRunPage = lazy(() => import('./pages/trainer/TrainerRunPage'));

// NOTE: LandingPage 懒加载 — 全站入口页（粒子系统 + 卡片）
const LandingPage = lazy(() => import('./pages/LandingPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const WikiPage = lazy(() => import('./pages/wiki/WikiPage'));

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
const WcaStatAboutPage = lazy(() => import('./pages/wca_about/WcaStatAboutPage'));
// NOTE: WCA 选手详情(/wca/persons/:wcaId);搜索入口已并入 WcaStatsIndex 顶部搜索框
const PersonDetailPage = lazy(() => import('./pages/wca_stats/persons/PersonDetailPage'));
const NemesizerPage = lazy(() => import('./pages/nemesizer/NemesizerPage'));
// NOTE: WCA 6 个 cubing.pro 风格统计 tab
const GrandSlamPage = lazy(() => import('./pages/wca_stats/GrandSlamPage'));
const AllResultsPage = lazy(() => import('./pages/wca_stats/AllResultsPage'));
const RecordsPage = lazy(() => import('./pages/wca_stats/RecordsPage'));
const CohortRanksPage = lazy(() => import('./pages/wca_stats/CohortRanksPage'));
const SuccessRatePage = lazy(() => import('./pages/wca_stats/SuccessRatePage'));
const AllEventsDonePage = lazy(() => import('./pages/wca_stats/AllEventsDonePage'));
const SumOfRanksPage = lazy(() => import('./pages/wca_stats/SumOfRanksPage'));
// NOTE: Calendar 懒加载 — 比赛日历(原 /upcoming-comps,2026-05 改名)
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
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
const TrafficPage = lazy(() => import('./pages/traffic/TrafficPage'));
// NOTE: Scramble Hub + sub-tools (stats / gen / analyzer / solver)
const ScrambleHubPage = lazy(() => import('./pages/scramble/ScrambleHubPage'));
const GodNumberPage = lazy(() => import('./pages/god/GodNumberPage'));
const ScrambleStatsPage = lazy(() => import('./pages/scramble_stats/ScrambleStatsPage'));
const ScrambleSolverPage = lazy(() => import('./pages/scramble/solver/ScrambleSolverPage'));
// NOTE: Tutorial — 公式教程目录（docx 源迁移）
const TutorialIndexPage = lazy(() => import('./pages/tutorial/TutorialIndexPage'));
const TutorialCategoryPage = lazy(() => import('./pages/tutorial/TutorialCategoryPage'));
const TutorialPostPage = lazy(() => import('./pages/tutorial/TutorialPostPage'));
// NOTE: Alg — 公式库 (2x2/3x3/4x4/5x5,数据来自 speedcubedb)
const AlgIndexPage = lazy(() => import('./pages/alg/AlgIndexPage'));
const AlgPuzzlePage = lazy(() => import('./pages/alg/AlgPuzzlePage'));
const AlgCategoryPage = lazy(() => import('./pages/alg/AlgCategoryPage'));
// NOTE: Commutator — 换位子分解工具 (port of nbwzx/commutator)
const CommutatorPage = lazy(() => import('./pages/alg/commutator/CommutatorPage'));
// NOTE: Sites — 魔方网址导航
const SitesPage = lazy(() => import('./pages/sites/SitesPage'));
// NOTE: /prediction — 3x3 速拧极限预测
const PredictionPage = lazy(() => import('./pages/prediction/PredictionPage'));
const Prediction333Page = lazy(() => import('./pages/prediction/Prediction333Page'));
const LuckyLimitPage = lazy(() => import('./pages/prediction/LuckyLimitPage'));
// NOTE: Mosaic — 魔方马赛克生成器（port of Roman-/mosaic）
const MosaicPage = lazy(() => import('./pages/mosaic/MosaicPage'));
// NOTE: Memo — 记忆类工具子区
//   /memo        — 子区入口卡片页（未来扩展更多记忆类工具）
//   /memo/colpi — UI 复刻 bestsiteever.net/colpi（盲拧字母对图像数据库,Roman Strakhov 原作,非开源,本页只复刻 UI）
const MemoLandingPage = lazy(() => import('./pages/memo/MemoLandingPage'));
const ColpiPage = lazy(() => import('./pages/memo/colpi/ColpiPage'));
// NOTE: WB — 非官方世界纪录（port of speedsolving.com wiki UWR list）
const WbPage = lazy(() => import('./pages/wb/WbPage'));
// NOTE: Comp — cubing.com 比赛直播查看 (按轮成绩 + 选手弹窗 + PR 标志)
const CompIndexPage = lazy(() => import('./pages/comp/CompIndexPage'));
const CompDetailPage = lazy(() => import('./pages/comp/CompDetailPage'));
const CompSourcesPage = lazy(() => import('./pages/comp/CompSourcesPage'));
// NOTE: Timer — 纯 TypeScript 重写的速拧计时器（替代 cstimer iframe 的核心流程）
const TimerPage = lazy(() => import('./pages/timer/TimerPage'));
// NOTE: VisualCube Editor — 全功能交互式魔方图生成器
const VisualCubeEditorPage = lazy(() => import('./pages/visualcube/VisualCubeEditorPage'));
const VisualCubeStagesPage = lazy(() => import('./pages/visualcube/VisualCubeStagesPage'));
// NOTE: Analyze — 3x3 CFOP 打乱分析器（port of speedcubedb.com/analyze）
const AnalyzePage = lazy(() => import('./pages/analyze/AnalyzePage'));
// NOTE: Gen — 批量打乱生成器（覆盖 16 个 WCA 项目）
const GenPage = lazy(() => import('./pages/gen/GenPage'));
const Scramble555AboutPage = lazy(() => import('./pages/scramble_555_about/Scramble555AboutPage'));
// NOTE: liquid-glass-react 沙盒,验证 iOS 26 效果用,无导航入口
const LiquidGlassTestPage = lazy(() => import('./pages/liquid_glass_test/LiquidGlassTestPage'));
// NOTE: Sim — 虚拟魔方 Playground (port of huazhechen/cuber)
const SimPage = lazy(() => import('./pages/sim/SimPage'));
// NOTE: Patterns — 著名 3x3 图案集
const PatternsPage = lazy(() => import('./pages/patterns/PatternsPage'));
// NOTE: /code — hub (架构 + 语言两张卡片) + 子页面
const CodeIndexPage = lazy(() => import('./pages/code/CodeIndexPage'));
const CodeLandingPage = lazy(() => import('./pages/code/CodeLandingPage'));
const ArchitecturePage = lazy(() => import('./pages/code/ArchitecturePage'));
const StackLandingPage = lazy(() => import('./pages/code/StackLandingPage'));
const StackToolPage = lazy(() => import('./pages/code/StackToolPage'));
const OpsPage = lazy(() => import('./pages/code/OpsPage'));
const TsIntroPage = lazy(() => import('./pages/code/TsIntroPage'));
const RustIntroPage = lazy(() => import('./pages/code/RustIntroPage'));
const GoIntroPage = lazy(() => import('./pages/code/GoIntroPage'));
const PythonIntroPage = lazy(() => import('./pages/code/PythonIntroPage'));
const CIntroPage = lazy(() => import('./pages/code/CIntroPage'));
const CppIntroPage = lazy(() => import('./pages/code/CppIntroPage'));
const ZigIntroPage = lazy(() => import('./pages/code/ZigIntroPage'));
const SwiftIntroPage = lazy(() => import('./pages/code/SwiftIntroPage'));
const KotlinIntroPage = lazy(() => import('./pages/code/KotlinIntroPage'));
const JavaIntroPage = lazy(() => import('./pages/code/JavaIntroPage'));
const JavaScriptIntroPage = lazy(() => import('./pages/code/JavaScriptIntroPage'));
const MojoIntroPage = lazy(() => import('./pages/code/MojoIntroPage'));
const CsharpIntroPage = lazy(() => import('./pages/code/CsharpIntroPage'));
const RubyIntroPage = lazy(() => import('./pages/code/RubyIntroPage'));
const PhpIntroPage = lazy(() => import('./pages/code/PhpIntroPage'));
const LuaIntroPage = lazy(() => import('./pages/code/LuaIntroPage'));
const HaskellIntroPage = lazy(() => import('./pages/code/HaskellIntroPage'));
const HtmlIntroPage = lazy(() => import('./pages/code/HtmlIntroPage'));
const CssIntroPage = lazy(() => import('./pages/code/CssIntroPage'));
const BashIntroPage = lazy(() => import('./pages/code/BashIntroPage'));
const PowershellIntroPage = lazy(() => import('./pages/code/PowershellIntroPage'));
const SqlIntroPage = lazy(() => import('./pages/code/SqlIntroPage'));
const LatexIntroPage = lazy(() => import('./pages/code/LatexIntroPage'));
const KatexIntroPage = lazy(() => import('./pages/code/KatexIntroPage'));
const CompareAo5Page = lazy(() => import('./pages/code/CompareAo5Page'));
const CompareScramblePage = lazy(() => import('./pages/code/CompareScramblePage'));
// NOTE: Theory — Rubik's cube as a group (long-form math essay + interactive panels)
const GroupTheoryPage = lazy(() => import('./pages/theory/GroupTheoryPage'));

// NOTE: 全站 URL 必须带 ?lang=zh|en——首次加载在 i18n/index.ts 已处理；
//       此守卫覆盖客户端导航（<Link> / navigate()）丢失 lang 的情况，
//       用 replaceState 不进历史记录、不触发 React Router 重渲染。
// Blog 双轨:境内走 cuberoot.me/blog/ (主 vhost,nginx ^~ /blog/ alias 直 serve);
// 境外走 https://blog.cuberoot.me/ (GH Pages cuberoot-blog repo)。
// 1) 旧 WP permalink (/1lll/, /wp-content/...) → 主路径 /blog/<path>,境内秒开 + 境外再次兜底
// 2) /blog/* 走到 SPA 兜底 = 境外 GH Pages mirror 无该文件 → 跳子域 (境内 nginx 在 SPA 之前接住,不会进这里)
function BlogRedirectFallback() {
  const location = useLocation();
  const [slugs, setSlugs] = useState<Set<string> | null>(null);

  useEffect(() => {
    fetch('/blog-slugs.json')
      .then(r => r.json())
      .then((list: string[]) => setSlugs(new Set(list)))
      .catch(() => setSlugs(new Set()));
  }, []);

  if (slugs === null) return <div>Loading...</div>;

  const firstSeg = location.pathname.split('/').filter(Boolean)[0];

  if (firstSeg && slugs.has(decodeURIComponent(firstSeg))) {
    window.location.replace(`/blog${location.pathname}${location.search}${location.hash}`);
    return <div>Redirecting…</div>;
  }

  if (firstSeg === 'blog') {
    const rest = location.pathname.replace(/^\/blog/, '') || '/';
    window.location.replace(`https://blog.cuberoot.me${rest}${location.search}${location.hash}`);
    return <div>Redirecting…</div>;
  }

  return <Navigate to="/" replace />;
}

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
      <AnalyticsBeacon />
      <Routes>
        {/* NOTE: 全站入口页（卡片网格） */}
        <Route path="/" element={<Suspense fallback={<div>Loading...</div>}><LandingPage /></Suspense>} />
        <Route path="/about" element={<Suspense fallback={<div>Loading...</div>}><AboutPage /></Suspense>} />
        <Route path="/wiki" element={<Suspense fallback={<div>Loading...</div>}><WikiPage /></Suspense>} />
        {/* 统一公式训练器 — 所有 set 走同一套页面+组件 */}
        <Route path="/trainer" element={<Suspense fallback={<div>Loading...</div>}><TrainerLandingPage /></Suspense>} />
        <Route path="/trainer/:puzzle/:set" element={<Suspense fallback={<div>Loading...</div>}><TrainerSelectPage /></Suspense>} />
        <Route path="/trainer/:puzzle/:set/run" element={<Suspense fallback={<div>Loading...</div>}><TrainerRunPage /></Suspense>} />
        {/* PLL 识别训练（输入字母回答，独立于公式计时训练） */}
        <Route path="/recognize/:algSetId" element={<TrainingPage />} />
        {/* Calc — 成绩计算器 */}
        <Route path="/calc" element={<Suspense fallback={<div>Loading...</div>}><CalcPage /></Suspense>} />
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
        {/* Scramble — 打乱 hub + 4 个子工具 (stats / gen / analyzer / solver) */}
        <Route path="/scramble" element={<Suspense fallback={<div>Loading...</div>}><ScrambleHubPage /></Suspense>} />
        <Route path="/scramble/stats" element={<Suspense fallback={<div>Loading...</div>}><ScrambleStatsPage /></Suspense>} />
        <Route path="/scramble/gen" element={<Suspense fallback={<div>Loading...</div>}><GenPage /></Suspense>} />
        <Route path="/scramble/555-about" element={<Suspense fallback={<div>Loading...</div>}><Scramble555AboutPage /></Suspense>} />
        <Route path="/liquid-glass-test" element={<Suspense fallback={<div>Loading...</div>}><LiquidGlassTestPage /></Suspense>} />
        <Route path="/scramble/analyzer" element={<Suspense fallback={<div>Loading...</div>}><AnalyzePage /></Suspense>} />
        <Route path="/scramble/solver" element={<Suspense fallback={<div>Loading...</div>}><ScrambleSolverPage /></Suspense>} />
        <Route path="/scramble/pattern" element={<Suspense fallback={<div>Loading...</div>}><PatternsPage /></Suspense>} />
        <Route path="/scramble/god" element={<Suspense fallback={<div>Loading...</div>}><GodNumberPage /></Suspense>} />
        {/* 旧链接兼容重定向 */}
        <Route path="/scramble-stats" element={<Navigate to="/scramble/stats" replace />} />
        <Route path="/analyze" element={<Navigate to="/scramble/analyzer" replace />} />
        <Route path="/gen" element={<Navigate to="/scramble/gen" replace />} />
        <Route path="/patterns" element={<Navigate to="/scramble/pattern" replace />} />
        {/* /average 已并入 /calc 的"成绩计算器" tab — 兼容旧链接 */}
        <Route path="/average" element={<Navigate to="/calc?tab=average" replace />} />
        {/* Sim — 虚拟魔方 Playground */}
        <Route path="/sim" element={<Suspense fallback={<div>Loading...</div>}><SimPage /></Suspense>} />
        {/* Code — hub (架构 + 语言) + 子页面 */}
        <Route path="/code" element={<Suspense fallback={<div>Loading...</div>}><CodeIndexPage /></Suspense>} />
        <Route path="/code/architecture" element={<Suspense fallback={<div>Loading...</div>}><ArchitecturePage /></Suspense>} />
        <Route path="/code/stack" element={<Suspense fallback={<div>Loading...</div>}><StackLandingPage /></Suspense>} />
        <Route path="/code/stack/:slug" element={<Suspense fallback={<div>Loading...</div>}><StackToolPage /></Suspense>} />
        <Route path="/code/ops" element={<Suspense fallback={<div>Loading...</div>}><OpsPage /></Suspense>} />
        <Route path="/code/language" element={<Suspense fallback={<div>Loading...</div>}><CodeLandingPage /></Suspense>} />
        <Route path="/code/language/ts" element={<Suspense fallback={<div>Loading...</div>}><TsIntroPage /></Suspense>} />
        <Route path="/code/language/rust" element={<Suspense fallback={<div>Loading...</div>}><RustIntroPage /></Suspense>} />
        <Route path="/code/language/go" element={<Suspense fallback={<div>Loading...</div>}><GoIntroPage /></Suspense>} />
        <Route path="/code/language/python" element={<Suspense fallback={<div>Loading...</div>}><PythonIntroPage /></Suspense>} />
        <Route path="/code/language/c" element={<Suspense fallback={<div>Loading...</div>}><CIntroPage /></Suspense>} />
        <Route path="/code/language/cpp" element={<Suspense fallback={<div>Loading...</div>}><CppIntroPage /></Suspense>} />
        <Route path="/code/language/zig" element={<Suspense fallback={<div>Loading...</div>}><ZigIntroPage /></Suspense>} />
        <Route path="/code/language/swift" element={<Suspense fallback={<div>Loading...</div>}><SwiftIntroPage /></Suspense>} />
        <Route path="/code/language/kotlin" element={<Suspense fallback={<div>Loading...</div>}><KotlinIntroPage /></Suspense>} />
        <Route path="/code/language/java" element={<Suspense fallback={<div>Loading...</div>}><JavaIntroPage /></Suspense>} />
        <Route path="/code/language/javascript" element={<Suspense fallback={<div>Loading...</div>}><JavaScriptIntroPage /></Suspense>} />
        <Route path="/code/language/mojo" element={<Suspense fallback={<div>Loading...</div>}><MojoIntroPage /></Suspense>} />
        <Route path="/code/language/csharp" element={<Suspense fallback={<div>Loading...</div>}><CsharpIntroPage /></Suspense>} />
        <Route path="/code/language/ruby" element={<Suspense fallback={<div>Loading...</div>}><RubyIntroPage /></Suspense>} />
        <Route path="/code/language/php" element={<Suspense fallback={<div>Loading...</div>}><PhpIntroPage /></Suspense>} />
        <Route path="/code/language/lua" element={<Suspense fallback={<div>Loading...</div>}><LuaIntroPage /></Suspense>} />
        <Route path="/code/language/haskell" element={<Suspense fallback={<div>Loading...</div>}><HaskellIntroPage /></Suspense>} />
        <Route path="/code/language/html" element={<Suspense fallback={<div>Loading...</div>}><HtmlIntroPage /></Suspense>} />
        <Route path="/code/language/css" element={<Suspense fallback={<div>Loading...</div>}><CssIntroPage /></Suspense>} />
        <Route path="/code/language/bash" element={<Suspense fallback={<div>Loading...</div>}><BashIntroPage /></Suspense>} />
        <Route path="/code/language/powershell" element={<Suspense fallback={<div>Loading...</div>}><PowershellIntroPage /></Suspense>} />
        <Route path="/code/language/sql" element={<Suspense fallback={<div>Loading...</div>}><SqlIntroPage /></Suspense>} />
        <Route path="/code/language/latex" element={<Suspense fallback={<div>Loading...</div>}><LatexIntroPage /></Suspense>} />
        <Route path="/code/language/katex" element={<Suspense fallback={<div>Loading...</div>}><KatexIntroPage /></Suspense>} />
        <Route path="/code/language/compare" element={<Suspense fallback={<div>Loading...</div>}><CompareAo5Page /></Suspense>} />
        <Route path="/code/language/scramble" element={<Suspense fallback={<div>Loading...</div>}><CompareScramblePage /></Suspense>} />
        {/* 旧路径 → 新路径 兼容 */}
        <Route path="/code/ts" element={<Navigate to="/code/language/ts" replace />} />
        <Route path="/code/rust" element={<Navigate to="/code/language/rust" replace />} />
        <Route path="/code/go" element={<Navigate to="/code/language/go" replace />} />
        <Route path="/code/python" element={<Navigate to="/code/language/python" replace />} />
        <Route path="/code/c" element={<Navigate to="/code/language/c" replace />} />
        <Route path="/code/cpp" element={<Navigate to="/code/language/cpp" replace />} />
        <Route path="/code/zig" element={<Navigate to="/code/language/zig" replace />} />
        <Route path="/code/swift" element={<Navigate to="/code/language/swift" replace />} />
        <Route path="/code/kotlin" element={<Navigate to="/code/language/kotlin" replace />} />
        <Route path="/code/java" element={<Navigate to="/code/language/java" replace />} />
        <Route path="/code/javascript" element={<Navigate to="/code/language/javascript" replace />} />
        <Route path="/code/mojo" element={<Navigate to="/code/language/mojo" replace />} />
        <Route path="/code/compare" element={<Navigate to="/code/language/compare" replace />} />
        <Route path="/code/scramble" element={<Navigate to="/code/language/scramble" replace />} />
        {/* WCA Stats — 统计数据展示 */}
        <Route path="/wca" element={<Suspense fallback={<div>Loading...</div>}><WcaStatsIndex /></Suspense>} />
        {/* NOTE: persons / 自定义页面路由必须在 :statId 之前，否则会被 catch-all 当成 statId */}
        <Route path="/wca/persons/:wcaId" element={<Suspense fallback={<div>Loading...</div>}><PersonDetailPage /></Suspense>} />
        <Route path="/wca/grand-slam" element={<Suspense fallback={<div>Loading...</div>}><GrandSlamPage /></Suspense>} />
        <Route path="/wca/all-results" element={<Suspense fallback={<div>Loading...</div>}><AllResultsPage /></Suspense>} />
        <Route path="/wca/records" element={<Suspense fallback={<div>Loading...</div>}><RecordsPage /></Suspense>} />
        <Route path="/wca/cohort-ranks" element={<Suspense fallback={<div>Loading...</div>}><CohortRanksPage /></Suspense>} />
        <Route path="/wca/success-rate" element={<Suspense fallback={<div>Loading...</div>}><SuccessRatePage /></Suspense>} />
        <Route path="/wca/all-events-done" element={<Suspense fallback={<div>Loading...</div>}><AllEventsDonePage /></Suspense>} />
        <Route path="/wca/sum-of-ranks" element={<Suspense fallback={<div>Loading...</div>}><SumOfRanksPage /></Suspense>} />
        <Route path="/wca/about/:id" element={<Suspense fallback={<div>Loading...</div>}><WcaStatAboutPage /></Suspense>} />
        {/* /wca/* 子页面(原 top-level /calendar /globe /viz /prediction /comp,2026-05 迁入 /wca 命名空间) */}
        <Route path="/wca/calendar" element={<Suspense fallback={<div>Loading...</div>}><CalendarPage /></Suspense>} />
        <Route path="/wca/calendar/stats" element={<Suspense fallback={<div>Loading...</div>}><CalendarStatsPage /></Suspense>} />
        <Route path="/upcoming-comps" element={<Navigate to="/wca/calendar" replace />} />
        <Route path="/wca/globe" element={<Suspense fallback={<div>Loading...</div>}><GlobePage /></Suspense>} />
        <Route path="/wca/viz" element={<Suspense fallback={<div>Loading...</div>}><VizPage /></Suspense>} />
        <Route path="/wca/prediction" element={<Suspense fallback={<div>Loading...</div>}><PredictionPage /></Suspense>} />
        <Route path="/wca/prediction/333" element={<Suspense fallback={<div>Loading...</div>}><Prediction333Page /></Suspense>} />
        <Route path="/wca/prediction/333/:sectionId" element={<Suspense fallback={<div>Loading...</div>}><Prediction333Page /></Suspense>} />
        <Route path="/wca/prediction/lucky" element={<Suspense fallback={<div>Loading...</div>}><LuckyLimitPage /></Suspense>} />
        <Route path="/wca/comp" element={<Suspense fallback={<div>Loading...</div>}><CompIndexPage /></Suspense>} />
        <Route path="/wca/comp/sources" element={<Suspense fallback={<div>Loading...</div>}><CompSourcesPage /></Suspense>} />
        <Route path="/wca/comp/:slug" element={<Suspense fallback={<div>Loading...</div>}><CompDetailPage /></Suspense>} />
        <Route path="/wca/:statId" element={<Suspense fallback={<div>Loading...</div>}><WcaStatsPage /></Suspense>} />
        {/* Nemesizer — 宿敌查询（移植自 nemesizer.com） */}
        <Route path="/nemesizer" element={<Suspense fallback={<div>Loading...</div>}><NemesizerPage /></Suspense>} />
        {/* Frame Count — 数帧工具 */}
        <Route path="/frame-count" element={<Suspense fallback={<div>Loading...</div>}><FrameCountPage /></Suspense>} />
        <Route path="/code/traffic" element={<Suspense fallback={<div>Loading...</div>}><TrafficPage /></Suspense>} />
        {/* Tutorial — 公式教程目录（曾用 /alg） */}
        <Route path="/tutorial" element={<Suspense fallback={<div>Loading...</div>}><TutorialIndexPage /></Suspense>} />
        <Route path="/tutorial/c/:category" element={<Suspense fallback={<div>Loading...</div>}><TutorialCategoryPage /></Suspense>} />
        <Route path="/tutorial/:slug" element={<Suspense fallback={<div>Loading...</div>}><TutorialPostPage /></Suspense>} />
        {/* Alg — 公式库 (2x2/3x3/4x4/5x5, data from speedcubedb.com，曾用 /algdb) */}
        {/* /alg/:puzzle handles BOTH new puzzle pages AND legacy single-segment 3x3 set slugs (redirects). */}
        <Route path="/alg" element={<Suspense fallback={<div>Loading...</div>}><AlgIndexPage /></Suspense>} />
        {/* NOTE: /alg/commutator must precede /alg/:puzzle so the catch-all doesn't swallow it. */}
        <Route path="/alg/commutator" element={<Suspense fallback={<div>Loading...</div>}><CommutatorPage /></Suspense>} />
        <Route path="/alg/:puzzle" element={<Suspense fallback={<div>Loading...</div>}><AlgPuzzlePage /></Suspense>} />
        <Route path="/alg/:puzzle/:set" element={<Suspense fallback={<div>Loading...</div>}><AlgCategoryPage /></Suspense>} />
        <Route path="/alg/:puzzle/:set/:subgroup" element={<Suspense fallback={<div>Loading...</div>}><AlgCategoryPage /></Suspense>} />
        {/* Sites — 魔方网址导航 */}
        <Route path="/site" element={<Suspense fallback={<div>Loading...</div>}><SitesPage /></Suspense>} />
        {/* Mosaic — 魔方马赛克生成器 */}
        <Route path="/mosaic" element={<Suspense fallback={<div>Loading...</div>}><MosaicPage /></Suspense>} />
        {/* Memo — 记忆类工具子区(/memo: 子区入口, /memo/colpi: 字母对图像 UI 复刻) */}
        <Route path="/memo" element={<Suspense fallback={<div>Loading...</div>}><MemoLandingPage /></Suspense>} />
        <Route path="/memo/colpi" element={<Suspense fallback={<div>Loading...</div>}><ColpiPage /></Suspense>} />
        <Route path="/memo/colpi/:pair" element={<Suspense fallback={<div>Loading...</div>}><ColpiPage /></Suspense>} />
        {/* WB — 非官方世界纪录 */}
        <Route path="/wb" element={<Suspense fallback={<div>Loading...</div>}><WbPage /></Suspense>} />
        {/* Theory — 长文 + 互动: 魔方与群论 */}
        <Route path="/theory/group" element={<Suspense fallback={<div>Loading...</div>}><GroupTheoryPage /></Suspense>} />
        <Route path="/theory/group/:slug" element={<Suspense fallback={<div>Loading...</div>}><GroupTheoryPage /></Suspense>} />
        {/* Pretext Demo — Canvas 表格渲染实验 */}
        <Route path="/pretext-demo" element={<Suspense fallback={<div>Loading...</div>}><PretextDemo /></Suspense>} />
        {/* Auth — WCA OAuth 回调 */}
        <Route path="/auth/callback" element={<Suspense fallback={<div>Loading...</div>}><AuthCallbackPage /></Suspense>} />
        <Route path="/callback.html" element={<Suspense fallback={<div>Loading...</div>}><AuthCallbackPage /></Suspense>} />
        {/* Catch-all — 旧 WP blog slug → 子域,其余回首页 */}
        <Route path="*" element={<BlogRedirectFallback />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
