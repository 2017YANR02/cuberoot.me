import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { HomePage } from './pages/HomePage';
import { CaseSelectPage } from './pages/CaseSelectPage';
import { TrainingPage } from './pages/TrainingPage';
import { OllTrainingPage } from './pages/OllTrainingPage';
import { StatsPage } from './pages/StatsPage';
import { ZbllSelectPage } from './pages/ZbllSelectPage';
import { ZbllTimerPage } from './pages/ZbllTimerPage';
import { ZblsSelectPage } from './pages/ZblsSelectPage';
import { ZblsTimerPage } from './pages/ZblsTimerPage';

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
// NOTE: OAuth 回调页——处理 WCA OAuth Implicit Grant 返回
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'));

function App() {
  return (
    <BrowserRouter basename="/app">
      <Routes>
        <Route path="/" element={<HomePage />} />
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
        <Route path="/recon/:id" element={<Suspense fallback={<div>Loading...</div>}><ReconDetailPage /></Suspense>} />
        {/* Auth — WCA OAuth 回调 */}
        <Route path="/auth/callback" element={<Suspense fallback={<div>Loading...</div>}><AuthCallbackPage /></Suspense>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
