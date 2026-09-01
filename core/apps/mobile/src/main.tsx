import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';

import '@cuberoot/app-ui/app.css';

import { capacitorHost } from './capacitor-host';

const App = lazy(async () => {
  const module = await import('@cuberoot/app-ui');
  return { default: module.App };
});

const root = document.getElementById('root');

if (!root) {
  throw new Error('Missing #root mount point');
}

createRoot(root).render(
  <StrictMode>
    <Suspense fallback={<main className="loading-screen"><strong>CubeRoot</strong></main>}>
      <App host={capacitorHost} />
    </Suspense>
  </StrictMode>,
);
