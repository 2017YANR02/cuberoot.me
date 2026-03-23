import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { CaseSelectPage } from './pages/CaseSelectPage';
import { TrainingPage } from './pages/TrainingPage';
import { OllTrainingPage } from './pages/OllTrainingPage';
import { StatsPage } from './pages/StatsPage';
import { ZbllSelectPage } from './pages/ZbllSelectPage';
import { ZbllTimerPage } from './pages/ZbllTimerPage';
import { ZblsSelectPage } from './pages/ZblsSelectPage';
import { ZblsTimerPage } from './pages/ZblsTimerPage';

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
      </Routes>
    </BrowserRouter>
  );
}

export default App;
