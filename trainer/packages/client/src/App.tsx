import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { CaseSelectPage } from './pages/CaseSelectPage';
import { TrainingPage } from './pages/TrainingPage';
import { StatsPage } from './pages/StatsPage';

function App() {
  return (
    <BrowserRouter basename="/trainer">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/select/:algSetId" element={<CaseSelectPage />} />
        <Route path="/train/:algSetId" element={<TrainingPage />} />
        <Route path="/stats/:algSetId" element={<StatsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
