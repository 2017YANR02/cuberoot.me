import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';

import './app.css';

const App = lazy(async () => {
  const module = await import('./App');
  return { default: module.App };
});

const root = document.getElementById('root');

if (!root) {
  throw new Error('Missing #root mount point');
}

createRoot(root).render(
  <StrictMode>
    <Suspense fallback={<main className="loading-screen"><strong>CubeRoot</strong></main>}>
      <App />
    </Suspense>
  </StrictMode>,
);
